-- Persiste o código/QR PIX gerado -- antes só era devolvido na resposta do
-- iniciar-pagamento (nunca mais visível depois). Necessário pra empresa-cliente ver a
-- pendência numa tela própria (JOTA FISCAL) e pagar sem depender do contador repassar
-- o código por fora.
alter table pagamentos_ativacao_licenca
  add column pix_code text,
  add column pix_qr_url text;
