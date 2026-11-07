-- contadores.cnpj_cpf nunca teve unique constraint (ao contrário de empresas.cnpj) -- até
-- agora a checagem de duplicado vivia só na aplicação (CorrigirCnpjCpfContadorUseCase),
-- o que deixa uma corrida de criação simultânea sem proteção nenhuma. CriarContadorUseCase
-- passa a checar duplicado antes também, mas o index é quem garante de verdade.
create unique index contadores_cnpj_cpf_key on contadores (cnpj_cpf);
