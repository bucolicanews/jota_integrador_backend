import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/common/supabase/supabase.service';

/**
 * Backfill de cst_pis/cst_cofins pras notas fiscais importadas ANTES da Fase 4.5 da
 * apuração do Simples (migration 20261114000009). Reaplica a mesma lógica de
 * `primeiroGrupoFilho` do parser (src/notas-fiscais/dominio/parser-xml-nfe.ts) sobre o
 * `imposto_bruto` já salvo -- não precisa reimportar XML, o grupo de imposto cru de cada
 * item já está em jsonb desde a primeira importação. Idempotente: só atualiza linhas com
 * cst_pis/cst_cofins ainda nulos.
 *
 * Uso: npm run backfill:cst-pis-cofins
 */
function primeiroGrupoFilho(grupo: unknown): any {
  if (!grupo || typeof grupo !== 'object') return null;
  const chave = Object.keys(grupo as object)[0];
  return chave ? (grupo as any)[chave] : null;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const supabase = app.get(SupabaseService);

    const { data: linhas, error } = await supabase.admin
      .from('notas_fiscais_itens')
      .select('id, imposto_bruto')
      .is('cst_pis', null);
    if (error) throw new Error(`Falha ao listar itens pendentes de backfill: ${error.message}`);

    console.log(`${linhas?.length ?? 0} item(ns) sem cst_pis/cst_cofins -- iniciando backfill...`);

    let atualizados = 0;
    let semGrupoPisOuCofins = 0;

    for (const linha of linhas ?? []) {
      const impostoBruto = linha.imposto_bruto as any;
      const dadosPis = primeiroGrupoFilho(impostoBruto?.PIS);
      const dadosCofins = primeiroGrupoFilho(impostoBruto?.COFINS);
      const cstPis = dadosPis?.CST ?? null;
      const cstCofins = dadosCofins?.CST ?? null;

      if (!dadosPis && !dadosCofins) {
        semGrupoPisOuCofins += 1;
        continue;
      }

      const { error: erroUpdate } = await supabase.admin
        .from('notas_fiscais_itens')
        .update({ cst_pis: cstPis, cst_cofins: cstCofins })
        .eq('id', linha.id);
      if (erroUpdate) throw new Error(`Falha ao atualizar item ${linha.id}: ${erroUpdate.message}`);
      atualizados += 1;
    }

    console.log(`Backfill concluído: ${atualizados} atualizado(s), ${semGrupoPisOuCofins} sem grupo PIS/COFINS em imposto_bruto (ficam null, mesmo comportamento do parser pra XML sem esse grupo).`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
