-- Bucket privado pro .zip do agente local (agente-notas-fiscais/) -- usuário baixa pelo
-- botão "Baixar agente" na tela de Notas Fiscais (mesmo padrão de signed URL já usado
-- pros PDFs/XML do DAS/CCMEI/notas fiscais, nunca bucket público). Objeto único,
-- re-subido manualmente a cada versão do agente (sem pipeline de build ainda).
insert into storage.buckets (id, name, public)
values ('downloads', 'downloads', false)
on conflict (id) do nothing;
