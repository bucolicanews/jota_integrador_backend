-- Contador sentinela '00000000-0000-0000-0000-000000000001' ("Jota Contabilidade") nunca
-- ganhou a própria empresa interna_contador (CriarContadorUseCase cria isso pra todo
-- contador novo, mas esse foi seedado direto em 20260912000002, só com a interna_plataforma
-- do admin -- que tem contador_id apontando pra ele por exigência de FK, não é a
-- contabilidade DELE). Sem isso, obterEmpresaInterna() retorna null pra esse contador e o
-- seletor de empresa do Header (useEmpresaAtiva.js) fica vazio -- ele não tem "a si mesmo"
-- pra selecionar.
--
-- cnpj '00000000000191' já está em uso pela interna_plataforma (unique constraint) --
-- placeholder novo e igualmente fake, mesma lógica (nunca consulta SERPRO).
do $$
declare
  v_empresa_id uuid;
begin
  if not exists (
    select 1 from empresas where contador_id = '00000000-0000-0000-0000-000000000001' and tipo = 'interna_contador'
  ) then
    insert into empresas (contador_id, tipo, razao_social, cnpj, modo_acesso_serpro)
    values ('00000000-0000-0000-0000-000000000001', 'interna_contador', 'Jota Contabilidade', '00000000000192', 'procuracao')
    returning id into v_empresa_id;

    insert into plano_contas (empresa_id, codigo, nome, grupo, sintetica, conta_a_receber, conta_a_pagar)
    values
      (v_empresa_id, '1.1', 'Contas a Receber', 'ativo', false, true, false),
      (v_empresa_id, '2.1', 'Contas a Pagar', 'passivo', false, false, true),
      (v_empresa_id, '3.1', 'Receita de Módulos e Assinaturas', 'receita', false, false, false),
      (v_empresa_id, '4.1', 'Despesas com Licenças e Honorários', 'despesa', false, false, false);

    insert into configuracao_contratos (
      empresa_id, conta_patrimonial_receber_id, conta_resultado_receita_id,
      conta_patrimonial_pagar_id, conta_resultado_despesa_id
    )
    select
      v_empresa_id,
      (select id from plano_contas where empresa_id = v_empresa_id and codigo = '1.1'),
      (select id from plano_contas where empresa_id = v_empresa_id and codigo = '3.1'),
      (select id from plano_contas where empresa_id = v_empresa_id and codigo = '2.1'),
      (select id from plano_contas where empresa_id = v_empresa_id and codigo = '4.1');
  end if;
end $$;
