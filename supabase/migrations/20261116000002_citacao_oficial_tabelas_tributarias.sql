-- Enriquece a descrição com a citação legal oficial validada (ver sessão de validação
-- 2026-11-16) -- valores numéricos não mudam, só rastreabilidade da fonte.
update tabelas_tributarias
set descricao = 'Tabela INSS 2026 -- Portaria Interministerial MPS/MF nº 13/2026. 4 faixas progressivas, teto R$ 8.475,55.'
where tipo = 'inss' and vigencia_inicio = '2026-01-01';

update tabelas_tributarias
set descricao = 'Tabela IRRF 2026 -- Lei nº 15.270/2025, Art. 3º-A (isenção até R$ 5.000 + redutor linear até R$ 7.350, coeficientes 978,62/0,133145 confirmados no texto oficial). Dedução por dependente e desconto simplificado são da Lei 9.250/1995, inalterados.'
where tipo = 'irrf' and vigencia_inicio = '2026-01-01';
