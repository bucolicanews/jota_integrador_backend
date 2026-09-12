import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { AssinarContratoPublicoUseCase } from '../aplicacao/casos-de-uso/assinar-contrato-publico.usecase';
import { ContratoPublico, ObterContratoPublicoUseCase } from '../aplicacao/casos-de-uso/obter-contrato-publico.usecase';

const TAMANHO_MAXIMO_SELFIE = 10 * 1024 * 1024; // 10MB

/**
 * Superfície PÚBLICA de propósito -- sem SupabaseAuthGuard/PapeisGuard/PermissoesGuard,
 * cliente final assina sem ter conta no sistema. Busca SEMPRE por token opaco
 * (contratos_gerados.token_assinatura), nunca por id cru. Throttle bem mais restrito
 * que o default global (100/min, ver app.module.ts) -- superfície não-autenticada é alvo
 * natural de brute-force de token.
 */
@Controller('assinatura-publica')
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class AssinaturaPublicaController {
  constructor(
    private readonly obterContratoPublico: ObterContratoPublicoUseCase,
    private readonly assinarContratoPublico: AssinarContratoPublicoUseCase,
  ) {}

  @Get(':token')
  async obter(@Param('token') token: string): Promise<ContratoPublico> {
    return this.obterContratoPublico.executar(token);
  }

  @Post(':token/assinar')
  @UseInterceptors(FileInterceptor('selfie', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_SELFIE } }))
  async assinar(
    @Param('token') token: string,
    @UploadedFile() selfie: Express.Multer.File | undefined,
    @Body('nome') nome: string | undefined,
  ): Promise<{ ok: true }> {
    if (!nome?.trim()) {
      throw new BadRequestException('Nome é obrigatório para assinar');
    }
    if (!selfie) {
      throw new NotFoundException('Selfie (campo "selfie") é obrigatória para assinar');
    }

    await this.assinarContratoPublico.executar({
      token,
      nome,
      selfie: { nomeOriginal: selfie.originalname, buffer: selfie.buffer, contentType: selfie.mimetype },
    });
    return { ok: true };
  }
}
