import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmpresaAgenteAtual } from '../../notas-fiscais/infraestrutura/auth/empresa-agente-atual.decorator';
import { TokenAgenteGuard } from '../../notas-fiscais/infraestrutura/auth/token-agente.guard';
import { IngerirNotaServicoUseCase, ResultadoIngestaoNotaServico } from '../aplicacao/casos-de-uso/ingerir-nota-servico.usecase';

const TAMANHO_MAXIMO_ARQUIVO = 2 * 1024 * 1024; // 2MB -- mesmo limite de ingestao-notas-fiscais.controller.ts

/**
 * Mesmo agente local/token de notas-fiscais (TokenAgenteGuard não é específico de NFe/NFCe,
 * só valida empresa) -- não criamos um 2º sistema de credencial só pra NFS-e, é outro
 * endpoint de upload da mesma máquina.
 */
@Controller('notas-servico')
@UseGuards(TokenAgenteGuard)
export class IngestaoNotasServicoController {
  constructor(private readonly ingerirNotaServico: IngerirNotaServicoUseCase) {}

  @Post('ingestao')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async ingerir(
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @EmpresaAgenteAtual() empresaId: string,
  ): Promise<ResultadoIngestaoNotaServico> {
    if (!arquivo) {
      throw new BadRequestException('Arquivo XML (campo "arquivo") é obrigatório');
    }
    return this.ingerirNotaServico.executar(empresaId, arquivo.buffer.toString('utf-8'));
  }
}
