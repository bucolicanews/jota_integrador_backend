import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as Papa from 'papaparse';
import { LinhaPlanoContaBruta, parsearPlanoContasCsv } from '../../dominio/parser-plano-contas';
import {
  PLANO_CONTAS_REPOSITORIO,
  PlanoContasRepositorioPort,
  ResultadoImportacaoPlanoContas,
} from '../portas/plano-contas-repositorio.port';

@Injectable()
export class ImportarPlanoContasUseCase {
  constructor(
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly repositorio: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string, conteudoCsv: string): Promise<ResultadoImportacaoPlanoContas> {
    const parseResultado = Papa.parse<LinhaPlanoContaBruta>(conteudoCsv, {
      header: true,
      skipEmptyLines: true,
    });

    if (parseResultado.errors.length > 0) {
      throw new BadRequestException(`Arquivo CSV inválido: ${parseResultado.errors[0].message}`);
    }

    const { linhas, erros } = parsearPlanoContasCsv(parseResultado.data);

    if (linhas.length === 0) {
      throw new BadRequestException('O arquivo não tem nenhuma conta válida.');
    }
    if (erros.length > 0) {
      throw new BadRequestException(`Corrija o arquivo antes de importar: ${erros.join(' | ')}`);
    }

    return this.repositorio.importarLote(empresaId, linhas);
  }
}
