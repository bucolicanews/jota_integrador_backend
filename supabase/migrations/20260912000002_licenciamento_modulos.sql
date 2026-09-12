-- Licenciamento de módulos por pacote + contabilidade própria de contador/plataforma.
-- Ver plano C:\Users\jotac\.claude\plans\optimized-zooming-puppy.md pro contexto completo.
--
-- Modelo: Admin vende PACOTES (bundle de módulos + preço) pro contador (atacado). Comprar
-- gera uma LICENÇA interna (sem código visível) que o contador ativa em qualquer empresa
-- da carteira -- isso gera um CONTRATO (módulo já existente da Fase 6) cobrando o valor
-- que o contador decide, que por sua vez lança automaticamente uma conta a receber nos
-- livros do contador + a conta a pagar espelhada nos livros da empresa (varejo). O mesmo
-- mecanismo serve pro nível de cima (admin cobra o contador pelo pacote).
--
-- Pra isso, contador e a própria Jota precisam virar linhas em `empresas` (reaproveitando
-- 100% plano de contas/lançamentos/CP-CR que já existe), sem mexer no schema dessas
-- tabelas -- só um discriminador de tipo pra não confundir com empresa-cliente de verdade.

-- ============================================================
-- Discriminador de tipo de empresa
-- ============================================================

alter table empresas add column tipo text not null default 'cliente'
  check (tipo in ('cliente', 'interna_contador', 'interna_plataforma'));

comment on column empresas.tipo is 'cliente = empresa-cliente de verdade (padrão). interna_contador = contabilidade do próprio contador. interna_plataforma = contabilidade da própria Jota. As duas últimas nunca aparecem em listagem de carteira/marketplace, não passam por módulo de licenciamento (sempre liberadas).';

-- Um contador só pode ter UMA empresa interna própria.
create unique index idx_empresas_interna_contador on empresas(contador_id) where tipo = 'interna_contador';

-- ============================================================
-- Seed: contador/empresa/usuário internos da Jota (IDs fixos, sentinelas -- idempotente)
-- ============================================================

insert into contadores (id, tipo, nome, cnpj_cpf, email)
values ('00000000-0000-0000-0000-000000000001', 'interno_jota', 'Jota Contabilidade', '00000000000191', 'sistema@jota.internal')
on conflict (id) do nothing;

insert into empresas (id, contador_id, tipo, razao_social, cnpj, modo_acesso_serpro)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'interna_plataforma', 'Jota Contabilidade', '00000000000191', 'procuracao')
on conflict (id) do nothing;

-- Usuário-sistema: NÃO dá pra seedar aqui -- `usuarios.id` tem FK real pra `auth.users`
-- (confirmado batendo de frente com esse erro: não existe jeito de criar auth.users só de
-- SQL puro, precisa passar pela Admin API, mesma regra que todo o resto do projeto já
-- segue). `criado_por` das cobranças internas usa o id do humano que de fato iniciou a
-- ação (contador clicando "ativar licença", admin confirmando a venda do pacote) sempre
-- que possível -- só o caso 100% automático (webhook do Stripe sem nenhum clique humano
-- por perto) precisaria de um usuário-sistema de verdade, resolvido então via Admin API
-- na implementação desse fluxo específico (Fase "admin↔contador"), não aqui.

-- Plano de contas mínimo da empresa interna da Jota -- mesmo catálogo básico que toda
-- empresa interna (contador ou plataforma) precisa pra registrar as cobranças de módulo.
insert into plano_contas (empresa_id, codigo, nome, grupo, sintetica)
select '00000000-0000-0000-0000-000000000002', v.codigo, v.nome, v.grupo, false
from (values
  ('1.1', 'Contas a Receber', 'ativo'),
  ('2.1', 'Contas a Pagar', 'passivo'),
  ('3.1', 'Receita de Módulos e Assinaturas', 'receita'),
  ('4.1', 'Despesas com Licenças e Honorários', 'despesa')
) as v(codigo, nome, grupo)
where not exists (
  select 1 from plano_contas pc where pc.empresa_id = '00000000-0000-0000-0000-000000000002' and pc.codigo = v.codigo
);

-- ============================================================
-- Catálogo de pacotes vendáveis (admin) -- "pacote" e "plano" são a mesma entidade aqui
-- (simplificação deliberada v1: nome + módulos + preço + periodicidade, sem camada extra
-- separando bundle de módulos e tabela de preço).
-- ============================================================

create table pacotes_modulos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  modulos text[] not null,
  preco numeric(12, 2) not null check (preco >= 0),
  periodicidade text not null check (periodicidade in ('mensal', 'anual')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_pacotes_modulos_atualizado_em before update on pacotes_modulos
  for each row execute function set_atualizado_em();

comment on column pacotes_modulos.modulos is 'Chaves de módulo (mesmo padrão de permissoes.recurso): contratos, documentos_societarios, conciliacao_bancaria, protocolos, bancos, relatorios, descricoes_extrato, identificadores_extrato. Núcleo (lançamentos, plano de contas, CP/CR, clientes, fornecedores, históricos) nunca entra aqui -- sempre liberado.';

alter table pacotes_modulos enable row level security;

-- Catálogo é público pra qualquer autenticado poder ver o que existe pra comprar.
create policy pacotes_modulos_select on pacotes_modulos for select to authenticated using (true);
create policy pacotes_modulos_insert on pacotes_modulos for insert to authenticated with check (eh_plataforma());
create policy pacotes_modulos_update on pacotes_modulos for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy pacotes_modulos_delete on pacotes_modulos for delete to authenticated using (false);

-- ============================================================
-- Licenças -- uma linha por "assento" comprado. status='disponivel' até o contador
-- escolher em qual empresa da carteira ativar (empresa_id vai de null pra preenchido).
-- ============================================================

create table licencas_modulo (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  pacote_id uuid not null references pacotes_modulos(id),
  empresa_id uuid references empresas(id),
  status text not null default 'disponivel' check (status in ('disponivel', 'ativa', 'cancelada')),
  stripe_subscription_id text,
  ativado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index idx_licencas_modulo_contador on licencas_modulo(contador_id);
-- Uma empresa só tem 1 licença ativa por vez nesta v1 -- ativar uma nova enquanto já tem
-- outra ativa deve desativar a anterior explicitamente primeiro (regra na Application).
create unique index idx_licencas_modulo_empresa_ativa on licencas_modulo(empresa_id) where status = 'ativa';

comment on table licencas_modulo is 'O "token" de licença -- só registro interno, nunca um código visível/copiável. Ativar = preencher empresa_id + status=ativa.';

alter table licencas_modulo enable row level security;

create policy licencas_modulo_select on licencas_modulo for select to authenticated
  using (eh_plataforma() or auth_contador_id() = contador_id);
create policy licencas_modulo_insert on licencas_modulo for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = contador_id);
create policy licencas_modulo_update on licencas_modulo for update to authenticated
  using (eh_plataforma() or auth_contador_id() = contador_id)
  with check (eh_plataforma() or auth_contador_id() = contador_id);
create policy licencas_modulo_delete on licencas_modulo for delete to authenticated using (false);

-- ============================================================
-- Contrato pode ter como contraparte um CLIENTE (cadastro interno da empresa, caso já
-- existente da Fase 6) OU uma EMPRESA da carteira do contador (caso novo: contador cobra
-- a própria empresa-cliente por um serviço/módulo) -- exatamente um dos dois.
-- ============================================================

alter table contratos_gerados alter column cliente_id drop not null;
alter table contratos_gerados add column empresa_contraparte_id uuid references empresas(id);
alter table contratos_gerados add constraint contratos_gerados_contraparte_check
  check ((cliente_id is not null) <> (empresa_contraparte_id is not null));

comment on column contratos_gerados.empresa_contraparte_id is 'Preenchido quando o contrato é do contador cobrando uma empresa da própria carteira (ex: ativação de licença de módulo) -- nesse caso cliente_id fica null e o financeiro gera o par receber(emissor)/pagar(contraparte) via emitir_cobranca_interna, não só um receber isolado.';

-- ============================================================
-- Rastreio do par receber/pagar de uma cobrança interna -- pra cancelar os dois lados
-- juntos (nunca deixa um lado cancelado e o outro não).
-- ============================================================

create table vinculos_financeiros_espelho (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references contratos_gerados(id),
  conta_receber_id uuid not null references contas_receber(id),
  conta_pagar_id uuid not null references contas_pagar(id),
  estornado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index idx_vinculos_espelho_contrato on vinculos_financeiros_espelho(contrato_id);

alter table vinculos_financeiros_espelho enable row level security;

create policy vinculos_espelho_select on vinculos_financeiros_espelho for select to authenticated
  using (
    exists (select 1 from contas_receber cr where cr.id = conta_receber_id and pode_acessar_empresa(cr.empresa_id))
    or exists (select 1 from contas_pagar cp where cp.id = conta_pagar_id and pode_acessar_empresa(cp.empresa_id))
  );
-- Escrita só via as funções SECURITY DEFINER abaixo (bypassam RLS) -- nunca INSERT/UPDATE direto.
create policy vinculos_espelho_insert on vinculos_financeiros_espelho for insert to authenticated with check (false);
create policy vinculos_espelho_update on vinculos_financeiros_espelho for update to authenticated using (false);
create policy vinculos_espelho_delete on vinculos_financeiros_espelho for delete to authenticated using (false);

-- ============================================================
-- Catálogo de permissões
-- ============================================================

insert into permissoes (recurso, acao) values
  ('pacotes_modulos', 'visualizar'), ('pacotes_modulos', 'criar'), ('pacotes_modulos', 'editar'), ('pacotes_modulos', 'excluir'),
  ('licencas_modulo', 'visualizar'), ('licencas_modulo', 'criar'), ('licencas_modulo', 'editar')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('CONTADOR_DONO', 'OPERADOR_CONTADOR')
  and perm.recurso = 'licencas_modulo'
on conflict do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('SUPER_ADMIN', 'ADMIN_FINANCEIRO')
  and perm.recurso = 'pacotes_modulos'
on conflict do nothing;

-- ============================================================
-- Funções
-- ============================================================

-- Módulo liberado pra uma empresa -- mesmo padrão SECURITY DEFINER de pode_acessar_empresa
-- (evita expor licencas_modulo/pacotes_modulos inteiros só pra checar 1 módulo).
-- Empresas internas (contador/plataforma) sempre passam -- não fazem parte do circuito de
-- licenciamento, controlam o próprio negócio livremente.
create or replace function empresa_tem_modulo(p_empresa_id uuid, p_modulo text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    (select tipo from empresas where id = p_empresa_id) <> 'cliente'
    or exists (
      select 1 from licencas_modulo lm
      join pacotes_modulos pm on pm.id = lm.pacote_id
      where lm.empresa_id = p_empresa_id and lm.status = 'ativa' and p_modulo = any(pm.modulos)
    )
$$;

-- Emite uma cobrança interna dos DOIS lados numa transação só: conta a receber na empresa
-- credora + conta a pagar na empresa devedora, cada uma com seu lançamento contábil de
-- competência (mesmo par débito/crédito que CriarContaReceberUseCase/CriarContaPagarUseCase
-- já fazem hoje na camada NestJS pra uma empresa só -- aqui replicado pras duas de uma vez,
-- porque não existe lançamento cross-empresa e as duas tabelas de conta continuam sendo por
-- empresa). Nunca grava um lado sem o outro -- se qualquer INSERT falhar, a transação
-- inteira desfaz (comportamento padrão de função plpgsql sem savepoint).
create or replace function emitir_cobranca_interna(
  p_empresa_credora_id uuid,
  p_nome_devedor text,
  p_conta_patrimonial_credora_id uuid, -- Ativo (a receber) da credora
  p_conta_resultado_credora_id uuid,   -- Receita da credora
  p_empresa_devedora_id uuid,
  p_nome_credor text,
  p_conta_resultado_devedora_id uuid,   -- Despesa da devedora
  p_conta_patrimonial_devedora_id uuid, -- Passivo (a pagar) da devedora
  p_descricao text,
  p_data_emissao date,
  p_criado_por uuid,
  p_parcelas jsonb, -- [{"numero_parcela":1,"valor_parcela":100.00,"data_vencimento":"2026-10-01"}, ...]
  p_contrato_id uuid
)
returns table(conta_receber_id uuid, conta_pagar_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_conta_receber_id uuid;
  v_conta_pagar_id uuid;
  v_valor_total numeric;
begin
  v_valor_total := (select coalesce(sum((p ->> 'valor_parcela')::numeric), 0) from jsonb_array_elements(p_parcelas) as p);

  v_conta_receber_id := criar_conta_receber_com_parcelas(
    p_empresa_credora_id, p_nome_devedor, p_descricao,
    p_conta_patrimonial_credora_id, p_conta_resultado_credora_id,
    p_data_emissao, p_criado_por, p_parcelas
  );
  perform criar_lancamento_contabil(
    p_empresa_credora_id, p_data_emissao, concat('Competência: ', p_descricao, ' (', p_nome_devedor, ')'),
    v_conta_receber_id::text, 'contas_a_receber',
    jsonb_build_array(
      jsonb_build_object('conta_id', p_conta_patrimonial_credora_id, 'tipo', 'debito', 'valor', v_valor_total),
      jsonb_build_object('conta_id', p_conta_resultado_credora_id, 'tipo', 'credito', 'valor', v_valor_total)
    ),
    p_criado_por
  );

  v_conta_pagar_id := criar_conta_pagar_com_parcelas(
    p_empresa_devedora_id, p_nome_credor, p_descricao,
    p_conta_patrimonial_devedora_id, p_conta_resultado_devedora_id,
    p_data_emissao, p_criado_por, p_parcelas
  );
  perform criar_lancamento_contabil(
    p_empresa_devedora_id, p_data_emissao, concat('Competência: ', p_descricao, ' (', p_nome_credor, ')'),
    v_conta_pagar_id::text, 'contas_a_pagar',
    jsonb_build_array(
      jsonb_build_object('conta_id', p_conta_resultado_devedora_id, 'tipo', 'debito', 'valor', v_valor_total),
      jsonb_build_object('conta_id', p_conta_patrimonial_devedora_id, 'tipo', 'credito', 'valor', v_valor_total)
    ),
    p_criado_por
  );

  insert into vinculos_financeiros_espelho (contrato_id, conta_receber_id, conta_pagar_id)
  values (p_contrato_id, v_conta_receber_id, v_conta_pagar_id);

  return query select v_conta_receber_id, v_conta_pagar_id;
end;
$$;

comment on function emitir_cobranca_interna is 'Única forma de gerar uma cobrança cross-tenant (contador->empresa ou plataforma->contador) -- os dois lados (receber+pagar), cada um com seu lançamento de competência, numa transação só.';

-- Estorna os dois lados juntos -- bloqueia se qualquer lado já tiver recebimento/pagamento
-- registrado (mesma regra de CancelarContaReceberUseCase/CancelarContaPagarUseCase, só que
-- checando os dois antes de mexer em qualquer um).
create or replace function estornar_cobranca_interna(p_vinculo_id uuid, p_motivo text, p_executado_por uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_vinculo record;
  v_valor_recebido numeric;
  v_valor_pago numeric;
begin
  select * into v_vinculo from vinculos_financeiros_espelho where id = p_vinculo_id;
  if v_vinculo is null then
    raise exception 'Vínculo financeiro não encontrado';
  end if;
  if v_vinculo.estornado then
    raise exception 'Vínculo já foi estornado';
  end if;

  select coalesce(sum(r.valor_recebido), 0) into v_valor_recebido
  from recebimentos_contas_receber r
  join parcelas_contas_receber pr on pr.id = r.parcela_id
  where pr.conta_receber_id = v_vinculo.conta_receber_id and not r.estornado;

  select coalesce(sum(p.valor_pago), 0) into v_valor_pago
  from pagamentos_contas_pagar p
  join parcelas_contas_pagar pp on pp.id = p.parcela_id
  where pp.conta_pagar_id = v_vinculo.conta_pagar_id and not p.estornado;

  if v_valor_recebido > 0 or v_valor_pago > 0 then
    raise exception 'Já existe recebimento/pagamento registrado -- estorne antes de cancelar o vínculo';
  end if;

  update contas_receber set cancelada = true where id = v_vinculo.conta_receber_id;
  update contas_pagar set cancelada = true where id = v_vinculo.conta_pagar_id;
  update vinculos_financeiros_espelho set estornado = true where id = p_vinculo_id;
end;
$$;

comment on function estornar_cobranca_interna is 'Cancela os dois lados (receber do credor + pagar do devedor) de uma cobrança interna juntos -- nunca deixa um cancelado e o outro não. p_motivo/p_executado_por reservados pra log de auditoria feito na Application.';
