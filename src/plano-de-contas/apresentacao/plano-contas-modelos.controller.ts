import { BadRequestException, Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { construirCsvPlanoContas } from '../dominio/parser-plano-contas';
import { MODELOS_PLANO_CONTAS, MODELOS_PLANO_CONTAS_INFO, ModeloPlanoContas } from '../dominio/modelos-plano-contas';

interface ModeloResumo {
  chave: ModeloPlanoContas;
  rotulo: string;
}

/**
 * Referência estática (não depende de empresa) -- qualquer usuário autenticado pode
 * listar/baixar, igual a um template de documento. Nenhuma checagem de posse de
 * empresa aqui porque não há empresa envolvida.
 */
@Controller('plano-contas-modelos')
@UseGuards(SupabaseAuthGuard)
export class PlanoContasModelosController {
  @Get()
  listar(): ModeloResumo[] {
    return (Object.keys(MODELOS_PLANO_CONTAS_INFO) as ModeloPlanoContas[]).map((chave) => ({
      chave,
      rotulo: MODELOS_PLANO_CONTAS_INFO[chave],
    }));
  }

  @Get(':modelo/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  baixarCsv(@Param('modelo') modelo: string): string {
    if (!(modelo in MODELOS_PLANO_CONTAS)) {
      throw new BadRequestException(`Modelo "${modelo}" não existe`);
    }
    return construirCsvPlanoContas(MODELOS_PLANO_CONTAS[modelo as ModeloPlanoContas]);
  }
}
