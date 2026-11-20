import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service';

const BUCKET = 'notas-servico-xml';
const EXPIRACAO_SIGNED_URL_SEGUNDOS = 300;

/** Bucket privado -- mesmo padrão de StorageNotasFiscaisService. XML cru nunca é descartado, mesmo depois da nota aprovada/rejeitada (prova/auditoria). */
@Injectable()
export class StorageNotasServicoService {
  constructor(private readonly supabase: SupabaseService) {}

  async armazenar(empresaId: string, xmlBruto: string): Promise<string> {
    const ref = `${empresaId}/${randomUUID()}.xml`;
    const { error } = await this.supabase.admin.storage.from(BUCKET).upload(ref, Buffer.from(xmlBruto, 'utf-8'), { contentType: 'application/xml' });
    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar XML da NFS-e: ${error.message}`);
    }
    return ref;
  }

  async gerarUrlAssinada(ref: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const { data, error } = await this.supabase.admin.storage.from(BUCKET).createSignedUrl(ref, EXPIRACAO_SIGNED_URL_SEGUNDOS);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL do XML da NFS-e: ${error?.message}`);
    }
    return { url: data.signedUrl, expiraEmSegundos: EXPIRACAO_SIGNED_URL_SEGUNDOS };
  }
}
