import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service';

const BUCKET = 'notas-fiscais-xml';
const EXPIRACAO_SIGNED_URL_SEGUNDOS = 300;

const BUCKET_DOWNLOADS = 'downloads';
const CAMINHO_AGENTE_ZIP = 'agente-notas-fiscais.zip';

/** Bucket privado -- mesmo padrão de StorageCcmeiService/StorageDasService. XML cru nunca é descartado, mesmo depois da nota aprovada/rejeitada (prova/auditoria). */
@Injectable()
export class StorageNotasFiscaisService {
  constructor(private readonly supabase: SupabaseService) {}

  async armazenar(empresaId: string, xmlBruto: string): Promise<string> {
    const ref = `${empresaId}/${randomUUID()}.xml`;
    const { error } = await this.supabase.admin.storage.from(BUCKET).upload(ref, Buffer.from(xmlBruto, 'utf-8'), { contentType: 'application/xml' });
    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar XML da nota fiscal: ${error.message}`);
    }
    return ref;
  }

  async gerarUrlAssinada(ref: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const { data, error } = await this.supabase.admin.storage.from(BUCKET).createSignedUrl(ref, EXPIRACAO_SIGNED_URL_SEGUNDOS);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL do XML da nota fiscal: ${error?.message}`);
    }
    return { url: data.signedUrl, expiraEmSegundos: EXPIRACAO_SIGNED_URL_SEGUNDOS };
  }

  /** .zip do agente local (código-fonte), objeto único no bucket `downloads` -- reenviado manualmente a cada versão nova (ObterUrlDownloadAgenteUseCase). */
  async gerarUrlDownloadAgente(): Promise<{ url: string; expiraEmSegundos: number }> {
    const { data, error } = await this.supabase.admin.storage.from(BUCKET_DOWNLOADS).createSignedUrl(CAMINHO_AGENTE_ZIP, EXPIRACAO_SIGNED_URL_SEGUNDOS);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL de download do agente: ${error?.message}`);
    }
    return { url: data.signedUrl, expiraEmSegundos: EXPIRACAO_SIGNED_URL_SEGUNDOS };
  }
}
