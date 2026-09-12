import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service';

const BUCKET = 'protocolos-anexos';
const EXPIRACAO_SIGNED_URL_SEGUNDOS = 300;

/**
 * Bucket privado -- diferente do jotaCaixa (upload direto do browser, bucket público),
 * aqui todo upload/leitura passa pelo backend (service_role), leitura só via signed URL
 * de curta duração gerada sob demanda. Mesmo padrão de StorageMensagensCaixaPostalService.
 */
@Injectable()
export class StorageProtocolosService {
  constructor(private readonly supabase: SupabaseService) {}

  async armazenar(empresaId: string, protocoloId: string, nomeArquivo: string, conteudo: Buffer, contentType: string): Promise<string> {
    const ref = `${empresaId}/${protocoloId}/${randomUUID()}-${nomeArquivo}`;
    const { error } = await this.supabase.admin.storage.from(BUCKET).upload(ref, conteudo, { contentType });
    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar anexo: ${error.message}`);
    }
    return ref;
  }

  async gerarUrlAssinada(ref: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const { data, error } = await this.supabase.admin.storage.from(BUCKET).createSignedUrl(ref, EXPIRACAO_SIGNED_URL_SEGUNDOS);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL do anexo: ${error?.message}`);
    }
    return { url: data.signedUrl, expiraEmSegundos: EXPIRACAO_SIGNED_URL_SEGUNDOS };
  }
}
