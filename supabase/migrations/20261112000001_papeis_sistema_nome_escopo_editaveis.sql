-- Pedido explícito do usuário em 2026-11-12: reverte a trava descrita no comentário
-- original de `papeis.sistema` (migration 20261108000002) -- SUPER_ADMIN agora pode
-- editar nome/escopo dos 7 papéis de sistema também, não só descrição/teto. Sem mudança
-- de schema, só corrige a documentação (`comment on column`) que ficou desatualizada.
-- Risco aceito documentado em PapeisController.atualizar() (TS): os 7 nomes são string
-- literals hardcoded em ~45-60 `@Papeis(Papel.X)` pelo código -- renomear quebra essas
-- checagens pra quem já tem o papel.

comment on column papeis.sistema is 'true só nos 7 papéis originais -- UI de gestão de papéis permite editar nome/escopo/descrição/teto deles também (sem trava extra), mas nunca excluir a linha.';
