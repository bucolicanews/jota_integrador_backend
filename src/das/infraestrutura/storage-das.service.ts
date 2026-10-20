import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service';

const BUCKET = 'das-documentos';
const EXPIRACAO_SIGNED_URL_SEGUNDOS = 300;

/**
 * Bucket privado -- mesmo padrão de StorageProtocolosService/StorageContratosService:
 * todo upload/leitura passa pelo backend (service_role), leitura só via signed URL de
 * curta duração gerada sob demanda. O PDF em si vem em base64 do SERPRO (GERARDASPDF21/
 * CONSEXTRATO16) e é gravado uma única vez por competência -- downloads seguintes
 * (inclusive "2ª via") só regeneram a signed URL, nunca chamam o SERPRO de novo.
 */
@Injectable()
export class StorageDasService {
  constructor(private readonly supabase: SupabaseService) {}

  async armazenar(empresaId: string, competencia: string, pdfBase64: string): Promise<string> {
    const ref = `${empresaId}/${competencia}/${randomUUID()}.pdf`;
    const conteudo = Buffer.from(pdfBase64, 'base64');
    const { error } = await this.supabase.admin.storage.from(BUCKET).upload(ref, conteudo, { contentType: 'application/pdf' });
    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar PDF do DAS: ${error.message}`);
    }
    return ref;
  }

  async gerarUrlAssinada(ref: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const { data, error } = await this.supabase.admin.storage.from(BUCKET).createSignedUrl(ref, EXPIRACAO_SIGNED_URL_SEGUNDOS);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL do DAS: ${error?.message}`);
    }
    return { url: data.signedUrl, expiraEmSegundos: EXPIRACAO_SIGNED_URL_SEGUNDOS };
  }
}
