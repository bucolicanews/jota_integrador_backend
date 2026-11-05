-- Empresa interna_contador pode ser pessoa física (contador autônomo com CPF+CRC, sem
-- CNPJ) -- empresa-cliente de verdade continua sempre jurídica (CNPJ obrigatório pra
-- consulta SERPRO). `cnpj` guarda o CPF nesse caso (mesma coluna, dígito verificador
-- trocado em validarDocumentoEmpresa conforme tipo_pessoa).

alter table empresas add column tipo_pessoa text not null default 'juridica'
  check (tipo_pessoa in ('fisica', 'juridica'));

alter table empresas add column crc text;

alter table empresas add constraint chk_empresas_pessoa_fisica_so_interna
  check (tipo_pessoa = 'juridica' or tipo = 'interna_contador');

alter table empresas add constraint chk_empresas_crc_obrigatorio_pessoa_fisica
  check (tipo_pessoa = 'juridica' or crc is not null);

comment on column empresas.tipo_pessoa is 'fisica só é permitido quando tipo=interna_contador (contador autônomo, CPF+CRC em vez de CNPJ). Empresa-cliente sempre juridica.';
comment on column empresas.crc is 'Registro no Conselho Regional de Contabilidade -- obrigatório quando tipo_pessoa=fisica.';
