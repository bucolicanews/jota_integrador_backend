-- Captura automática de NFe (modelo 55) e NFCe (modelo 65), entrada e saída, a partir de
-- um agente local novo que varre pastas de entrada/saída no PC do contador/empresa (mesma
-- necessidade estrutural dos agentes locais do DeliveryHub -- o backend cloud não alcança
-- a máquina do cliente). Nota chega como 'capturada' e só gera fornecedor/cliente + conta
-- a pagar/receber + lançamento contábil quando um humano aprova explicitamente
-- (AprovarNotaFiscalUseCase) -- nunca lança sozinha na contabilidade.

create table agentes_notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  token_hash text not null,
  ativo boolean not null default true,
  ultimo_uso_em timestamptz,
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now()
);

-- Só 1 token ativo por empresa -- gerar um novo revoga o anterior (ver GerarTokenAgenteUseCase).
create unique index idx_agentes_nf_empresa_ativo on agentes_notas_fiscais(empresa_id) where ativo;
create index idx_agentes_nf_token_hash on agentes_notas_fiscais(token_hash) where ativo;

comment on table agentes_notas_fiscais is 'Token do agente local que sobe os XML pra ingestão -- token_hash nunca é lido de volta, só comparado em TokenAgenteGuard (mesmo princípio de hashCodigo2fa em usuarios.repositorio.supabase.ts).';

alter table agentes_notas_fiscais enable row level security;
-- Tabela só acessada pelo backend via client admin (service role) -- mesmo padrão de das_configuracoes_lancamentos.
create policy agentes_notas_fiscais_deny on agentes_notas_fiscais for all using (false) with check (false);

create type direcao_nota_fiscal as enum ('entrada', 'saida');
create type status_nota_fiscal as enum ('capturada', 'aprovada', 'rejeitada');

create table notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  chave_acesso text not null,
  modelo text not null check (modelo in ('55', '65')),
  direcao direcao_nota_fiscal not null,
  numero text not null,
  serie text not null,
  data_emissao timestamptz not null,
  c_stat integer not null,
  emitente_cnpj text not null,
  emitente_nome text not null,
  destinatario_documento text,
  destinatario_nome text,
  valor_total numeric(14,2) not null,
  fornecedor_id uuid references fornecedores(id),
  cliente_id uuid references clientes(id),
  conta_pagar_id uuid references contas_pagar(id),
  conta_receber_id uuid references contas_receber(id),
  status status_nota_fiscal not null default 'capturada',
  xml_storage_ref text not null,
  xml_bruto jsonb not null,
  motivo_rejeicao text,
  aprovado_por uuid references usuarios(id),
  aprovado_em timestamptz,
  criado_em timestamptz not null default now()
);

create unique index idx_notas_fiscais_chave on notas_fiscais(empresa_id, chave_acesso);
create index idx_notas_fiscais_empresa_status on notas_fiscais(empresa_id, status);

comment on column notas_fiscais.c_stat is 'protNFe/infProt/cStat -- 100=autorizada. Diferente de 100 nunca aparece na fila normal de aprovação, mas fica gravada pra rastro (nunca descartar o XML recebido).';
comment on column notas_fiscais.destinatario_documento is 'Null em NFCe de consumidor final não identificado -- nesse caso nunca força cadastro de cliente.';
comment on column notas_fiscais.xml_bruto is 'Parse completo do XML em JSON -- nunca perde dado não mapeado nas colunas tipadas abaixo/em notas_fiscais_itens.';

alter table notas_fiscais enable row level security;
create policy notas_fiscais_select on notas_fiscais for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy notas_fiscais_insert on notas_fiscais for insert to authenticated with check (eh_plataforma());
create policy notas_fiscais_update on notas_fiscais for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy notas_fiscais_delete on notas_fiscais for delete to authenticated using (false);

create table notas_fiscais_itens (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid not null references notas_fiscais(id) on delete cascade,
  empresa_id uuid not null references empresas(id),
  numero_item integer not null,
  codigo_produto text,
  descricao text not null,
  ncm text,
  cest text,
  cfop text not null,
  quantidade numeric(14,4) not null,
  -- 21,10 pra caber vUnCom/vUnTrib real (NFe aceita até 10 casas decimais nesse campo --
  -- confirmado no XML de exemplo: combustível com 5.6003000000).
  valor_unitario numeric(21,10) not null,
  valor_total numeric(14,2) not null,
  cst_csosn text,
  valor_icms numeric(14,2) not null default 0,
  valor_icms_st numeric(14,2) not null default 0,
  valor_pis numeric(14,2) not null default 0,
  valor_cofins numeric(14,2) not null default 0,
  valor_cbs numeric(14,2) not null default 0,
  valor_ibs numeric(14,2) not null default 0,
  imposto_bruto jsonb not null
);

create index idx_nf_itens_nota on notas_fiscais_itens(nota_fiscal_id);

comment on column notas_fiscais_itens.cst_csosn is 'Guarda bruto o que veio no XML (CST normal ICMS00..90, CSOSN101..500 quando o emitente é Simples Nacional, ou CST60/61/70 monofásico de combustível) -- nunca normalizado pra um formato único, os três grupos têm significado diferente.';
comment on column notas_fiscais_itens.valor_cbs is 'IBSCBS/CBS -- campo da reforma tributária, quase sempre 0 nos XML reais de 2026 (fase de teste). Capturado pra quando vier preenchido, não usado em nenhum cálculo ainda.';
comment on column notas_fiscais_itens.valor_ibs is 'IBSCBS/IBS -- mesma observação de valor_cbs.';
comment on column notas_fiscais_itens.imposto_bruto is 'Grupo de imposto (ICMS/IPI/PIS/COFINS/IBSCBS) inteiro como veio no item do XML, cru.';

alter table notas_fiscais_itens enable row level security;
create policy notas_fiscais_itens_select on notas_fiscais_itens for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy notas_fiscais_itens_insert on notas_fiscais_itens for insert to authenticated with check (eh_plataforma());
create policy notas_fiscais_itens_update on notas_fiscais_itens for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy notas_fiscais_itens_delete on notas_fiscais_itens for delete to authenticated using (false);

create table notas_fiscais_parcelas (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid not null references notas_fiscais(id) on delete cascade,
  empresa_id uuid not null references empresas(id),
  numero_duplicata text not null,
  data_vencimento date not null,
  valor numeric(14,2) not null
);

create index idx_nf_parcelas_nota on notas_fiscais_parcelas(nota_fiscal_id);

comment on table notas_fiscais_parcelas is 'Espelha cobr/dup (nDup/dVenc/vDup) do XML -- valores/datas podem ser irregulares entre parcelas, nunca recalculadas (ver ModoParcelamento "explicito" em contas_pagar/contas_receber).';

alter table notas_fiscais_parcelas enable row level security;
create policy notas_fiscais_parcelas_select on notas_fiscais_parcelas for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy notas_fiscais_parcelas_insert on notas_fiscais_parcelas for insert to authenticated with check (eh_plataforma());
create policy notas_fiscais_parcelas_update on notas_fiscais_parcelas for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy notas_fiscais_parcelas_delete on notas_fiscais_parcelas for delete to authenticated using (false);

create table configuracoes_lancamentos_notas_fiscais (
  empresa_id uuid primary key references empresas(id),
  conta_patrimonial_entrada_id uuid not null references plano_contas(id),
  conta_resultado_entrada_id uuid not null references plano_contas(id),
  conta_patrimonial_saida_id uuid not null references plano_contas(id),
  conta_resultado_saida_id uuid not null references plano_contas(id),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid not null references usuarios(id)
);

comment on table configuracoes_lancamentos_notas_fiscais is 'Par de contas (patrimonial/resultado) por direção, usado por AprovarNotaFiscalUseCase -- mesmo padrão de das_configuracoes_lancamentos, mas com 2 pares (entrada e saída) em vez de 1.';

alter table configuracoes_lancamentos_notas_fiscais enable row level security;
create policy configuracoes_lancamentos_notas_fiscais_deny on configuracoes_lancamentos_notas_fiscais for all using (false) with check (false);

-- Bucket privado -- upload/leitura só via backend (service_role), nunca direto do browser/agente.
insert into storage.buckets (id, name, public)
values ('notas-fiscais-xml', 'notas-fiscais-xml', false)
on conflict (id) do nothing;

-- Catálogo de ações é enum fixo do banco (permissoes_acao_check: visualizar/criar/editar/
-- excluir/bloquear) -- aprovar/rejeitar/configurar/gerar-token caem todos em 'editar'.
insert into permissoes (recurso, acao) values
  ('notas_fiscais', 'visualizar'), ('notas_fiscais', 'editar')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'notas_fiscais'
on conflict do nothing;
