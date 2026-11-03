import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

const BUCKET = 'avatares-perfil';
const EXPIRACAO_SIGNED_URL_SEGUNDOS = 3600;

/**
 * Bucket privado -- mirror de StorageContratosService. Mesmo caminho pro mesmo usuário
 * (upsert) de propósito: trocar o avatar nunca deixa arquivo órfão, sempre sobrescreve.
 */
@Injectable()
export class StorageAvataresService {
  constructor(private readonly supabase: SupabaseService) {}

  async armazenar(usuarioId: string, conteudo: Buffer, contentType: string, extensao: string): Promise<string> {
    const ref = `${usuarioId}/avatar.${extensao}`;
    const { error } = await this.supabase.admin.storage.from(BUCKET).upload(ref, conteudo, { contentType, upsert: true });
    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar foto de perfil: ${error.message}`);
    }
    return ref;
  }

  async remover(ref: string): Promise<void> {
    await this.supabase.admin.storage.from(BUCKET).remove([ref]);
  }

  async gerarUrlAssinada(ref: string): Promise<string> {
    const { data, error } = await this.supabase.admin.storage.from(BUCKET).createSignedUrl(ref, EXPIRACAO_SIGNED_URL_SEGUNDOS);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL da foto de perfil: ${error?.message}`);
    }
    return data.signedUrl;
  }
}
