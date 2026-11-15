import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IngerirNotaFiscalUseCase, ResultadoIngestaoNotaFiscal } from '../aplicacao/casos-de-uso/ingerir-nota-fiscal.usecase';
import { EmpresaAgenteAtual } from '../infraestrutura/auth/empresa-agente-atual.decorator';
import { TokenAgenteGuard } from '../infraestrutura/auth/token-agente.guard';

const TAMANHO_MAXIMO_ARQUIVO = 2 * 1024 * 1024; // 2MB -- XML de NFe/NFCe é sempre bem pequeno (poucas dezenas de KB mesmo com assinatura)

/**
 * Único endpoint que o agente local chama -- auth por token de máquina (TokenAgenteGuard),
 * nunca SupabaseAuthGuard (não há usuário humano na requisição). empresaId vem do token,
 * nunca de um parâmetro que o agente poderia manipular.
 */
@Controller('notas-fiscais')
@UseGuards(TokenAgenteGuard)
export class IngestaoNotasFiscaisController {
  constructor(private readonly ingerirNotaFiscal: IngerirNotaFiscalUseCase) {}

  @Post('ingestao')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async ingerir(
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @EmpresaAgenteAtual() empresaId: string,
  ): Promise<ResultadoIngestaoNotaFiscal> {
    if (!arquivo) {
      throw new BadRequestException('Arquivo XML (campo "arquivo") é obrigatório');
    }
    return this.ingerirNotaFiscal.executar(empresaId, arquivo.buffer.toString('utf-8'));
  }
}
