-- Módulo NFS-e Nacional (Fase 1: ingestão) -- mesmo padrão arquitetural de notas_fiscais
-- (20261114000003), mas NFS-e tem 1 serviço por nota (sem tabela de itens separada) e chave
-- de acesso de formato diferente (infNFSe/@Id, não 44 dígitos numéricos). Reusa o mesmo
-- agente local/token (agentes_notas_fiscais) -- não é um tipo de documento novo pro agente,
-- só mais um endpoint de upload. SEM lançamento contábil nesta fase (Fase 2, igual
-- AprovarNotaFiscalUseCase faz pra NFe/NFCe).

create type status_nota_servico as enum ('capturada', 'aprovada', 'rejeitada');

create table notas_servico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  chave_acesso text not null,
  situacao text not null,
  numero_nfse text not null,
  data_processamento timestamptz not null,
  data_emissao_dps timestamptz not null,
  direcao direcao_nota_fiscal not null,
  emitente_cnpj text,
  emitente_cpf text,
  emitente_nome text not null,
  tomador_cnpj text,
  tomador_cpf text,
  tomador_nome text,
  descricao_servico text not null,
  codigo_tributacao_nacional text,
  valor_liquido numeric(14,2) not null default 0,
  valor_issqn numeric(14,2) not null default 0,
  valor_base_calculo numeric(14,2) not null default 0,
  status status_nota_servico not null default 'capturada',
  xml_storage_ref text not null,
  xml_bruto jsonb not null,
  motivo_rejeicao text,
  aprovado_por uuid references usuarios(id),
  aprovado_em timestamptz,
  criado_em timestamptz not null default now(),
  check (emitente_cnpj is not null or emitente_cpf is not null)
);

create unique index idx_notas_servico_chave on notas_servico(empresa_id, chave_acesso);
create index idx_notas_servico_empresa_status on notas_servico(empresa_id, status);

comment on column notas_servico.chave_acesso is 'infNFSe/@Id -- formato "NFS"+cMun(7)+ambGer(1)+tpInsc(1)+inscrFederal(14)+nNFSe(13)+anoMes(4)+cNum(9)+DV(1), confirmado no XSD oficial v1.01. Diferente do chNFe de 44 dígitos (NFe).';
comment on column notas_servico.situacao is 'infNFSe/@situacao -- bruto como veio (válida/substituída/cancelada), nunca normalizado. Mesmo valor repassado pro parâmetro stc do gerador DANFSe quando a Fase 3 (geração de PDF) for implementada.';
comment on column notas_servico.xml_bruto is 'Parse completo do XML em JSON -- nunca perde dado não mapeado nas colunas tipadas, mesmo princípio de notas_fiscais.xml_bruto.';

alter table notas_servico enable row level security;
create policy notas_servico_select on notas_servico for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy notas_servico_insert on notas_servico for insert to authenticated with check (eh_plataforma());
create policy notas_servico_update on notas_servico for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy notas_servico_delete on notas_servico for delete to authenticated using (false);

create or replace function criar_nota_servico(
  p_empresa_id uuid,
  p_chave_acesso text,
  p_situacao text,
  p_numero_nfse text,
  p_data_processamento timestamptz,
  p_data_emissao_dps timestamptz,
  p_direcao text,
  p_emitente_cnpj text,
  p_emitente_cpf text,
  p_emitente_nome text,
  p_tomador_cnpj text,
  p_tomador_cpf text,
  p_tomador_nome text,
  p_descricao_servico text,
  p_codigo_tributacao_nacional text,
  p_valor_liquido numeric,
  p_valor_issqn numeric,
  p_valor_base_calculo numeric,
  p_xml_storage_ref text,
  p_xml_bruto jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nota_id uuid;
begin
  insert into notas_servico (
    empresa_id, chave_acesso, situacao, numero_nfse, data_processamento, data_emissao_dps,
    direcao, emitente_cnpj, emitente_cpf, emitente_nome, tomador_cnpj, tomador_cpf, tomador_nome,
    descricao_servico, codigo_tributacao_nacional, valor_liquido, valor_issqn, valor_base_calculo,
    xml_storage_ref, xml_bruto
  ) values (
    p_empresa_id, p_chave_acesso, p_situacao, p_numero_nfse, p_data_processamento, p_data_emissao_dps,
    p_direcao::direcao_nota_fiscal, p_emitente_cnpj, p_emitente_cpf, p_emitente_nome, p_tomador_cnpj, p_tomador_cpf, p_tomador_nome,
    p_descricao_servico, p_codigo_tributacao_nacional, p_valor_liquido, p_valor_issqn, p_valor_base_calculo,
    p_xml_storage_ref, p_xml_bruto
  )
  returning id into v_nota_id;

  return v_nota_id;
end;
$$;

comment on function criar_nota_servico(uuid, text, text, text, timestamptz, timestamptz, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, jsonb) is 'Única forma de criar uma NFS-e capturada -- Fase 1 (ingestão), sem fornecedor/cliente/lançamento contábil ainda.';

-- Bucket privado -- mesmo padrão de notas-fiscais-xml.
insert into storage.buckets (id, name, public)
values ('notas-servico-xml', 'notas-servico-xml', false)
on conflict (id) do nothing;

insert into permissoes (recurso, acao) values
  ('notas_servico', 'visualizar'), ('notas_servico', 'editar')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'notas_servico'
on conflict do nothing;
