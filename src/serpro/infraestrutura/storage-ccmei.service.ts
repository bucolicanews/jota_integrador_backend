import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service';

const BUCKET = 'ccmei-documentos';
const EXPIRACAO_SIGNED_URL_SEGUNDOS = 300;

/**
 * Bucket privado -- mesmo padrão de StorageDasService: o PDF vem em base64 do SERPRO
 * (CCMEI/DADOSCCMEI122) e é gravado uma única vez por empresa (nunca expira sozinho,
 * pedido do usuário 2026-11-13) -- downloads seguintes só regeneram a signed URL,
 * nunca chamam o SERPRO de novo.
 */
@Injectable()
export class StorageCcmeiService {
  constructor(private readonly supabase: SupabaseService) {}

  async armazenar(empresaId: string, pdfBase64: string): Promise<string> {
    const ref = `${empresaId}/${randomUUID()}.pdf`;
    const conteudo = Buffer.from(pdfBase64, 'base64');
    const { error } = await this.supabase.admin.storage.from(BUCKET).upload(ref, conteudo, { contentType: 'application/pdf' });
    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar PDF do CCMEI: ${error.message}`);
    }
    return ref;
  }

  async gerarUrlAssinada(ref: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const { data, error } = await this.supabase.admin.storage.from(BUCKET).createSignedUrl(ref, EXPIRACAO_SIGNED_URL_SEGUNDOS);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL do CCMEI: ${error?.message}`);
    }
    return { url: data.signedUrl, expiraEmSegundos: EXPIRACAO_SIGNED_URL_SEGUNDOS };
  }
}
