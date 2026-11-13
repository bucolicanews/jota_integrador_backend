import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CCMEI_REPOSITORIO, CcmeiRepositorioPort } from '../portas/ccmei-repositorio.port';
import { StorageCcmeiService } from '../../infraestrutura/storage-ccmei.service';
import { ConsultarCcmeiUseCase } from './consultar-ccmei.usecase';

/**
 * "Baixar" é cacheado: o PDF só é pedido ao SERPRO (e só gasta crédito) na primeira
 * vez por empresa, ou quando `forcarAtualizacao=true` (botão "Atualizar" explícito --
 * pedido do usuário 2026-11-13, mesmo padrão do PDF do DAS em
 * obter-url-pdf-das.usecase.ts). CCMEI não expira sozinho -- diferente do DAS, que é
 * 1 documento por competência, aqui é 1 documento por empresa pra sempre.
 *
 * NUNCA CONFIRMADO contra o trial/produção real (ao contrário de GERARDASPDF21, ver
 * sincronizar-das-empresa.usecase.ts) -- `extrairPdfBase64` assume o mesmo formato
 * (`corpo.dados` como JSON string, campo `pdf` em base64), mas o shape exato de
 * DADOSCCMEI122 (objeto único vs array) ainda não foi testado contra o SERPRO real.
 * Testar antes de confiar em produção, por isso o parse aceita os dois formatos.
 */
@Injectable()
export class ObterUrlCcmeiUseCase {
  constructor(
    @Inject(CCMEI_REPOSITORIO) private readonly repositorio: CcmeiRepositorioPort,
    private readonly storage: StorageCcmeiService,
    private readonly consultarCcmei: ConsultarCcmeiUseCase,
  ) {}

  async executar(empresaId: string, forcarAtualizacao: boolean): Promise<{ url: string; expiraEmSegundos: number }> {
    if (!forcarAtualizacao) {
      const existente = await this.repositorio.buscarPorEmpresa(empresaId);
      if (existente?.pdfStorageRef) {
        return this.storage.gerarUrlAssinada(existente.pdfStorageRef);
      }
    }

    // Débito de crédito acontece DENTRO de consultarCcmei.executar -- nunca duplicado aqui.
    const corpo = await this.consultarCcmei.executar(empresaId);
    const pdfBase64 = this.extrairPdfBase64(corpo);
    if (!pdfBase64) {
      throw new InternalServerErrorException('CCMEI consultado, mas o SERPRO não devolveu o PDF nesta resposta');
    }

    const ref = await this.storage.armazenar(empresaId, pdfBase64);
    await this.repositorio.upsert(empresaId, ref);
    return this.storage.gerarUrlAssinada(ref);
  }

  private extrairPdfBase64(corpo: unknown): string | null {
    try {
      const corpoObj = corpo as { dados?: string };
      if (!corpoObj?.dados) return null;
      const parsed = JSON.parse(corpoObj.dados) as { pdf?: string } | Array<{ pdf?: string }>;
      const item = Array.isArray(parsed) ? parsed[0] : parsed;
      return item?.pdf ?? null;
    } catch {
      return null;
    }
  }
}
