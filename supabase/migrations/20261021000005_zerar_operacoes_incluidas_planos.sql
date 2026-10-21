-- "Operações SERPRO incluídas" (operacoes_incluidas) foi substituído pela cota granular
-- por sistema (plano_consultas_incluidas, ver VerificarCotaIncluidaUseCase) -- deixou de
-- ser editável/concedido na renovação (AtivarAssinaturaManualUseCase /
-- ProcessarWebhookPagbankCreditosUseCase não geram mais crédito a partir dele). Zera os
-- planos existentes pra não deixar nenhum crédito genérico fantasma configurado -- a
-- coluna permanece na tabela (NOT NULL já satisfeito por 0), só não é mais lida/escrita
-- pela aplicação.
update planos set operacoes_incluidas = 0 where operacoes_incluidas <> 0;
