import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service';

const BUCKET_SELFIES = 'ponto-selfies';
const BUCKET_ATESTADOS = 'ponto-atestados';
const EXPIRACAO_SIGNED_URL_SEGUNDOS = 300;

/** Dois buckets privados, mesmo padrão de StorageProtocolosService/StorageSuporteService -- upload/leitura só via backend, signed URL de curta duração sob demanda. */
@Injectable()
export class StoragePontoService {
  constructor(private readonly supabase: SupabaseService) {}

  async armazenarSelfie(usuarioId: string, nomeArquivo: string, conteudo: Buffer, contentType: string): Promise<string> {
    return this.armazenar(BUCKET_SELFIES, usuarioId, nomeArquivo, conteudo, contentType);
  }

  async armazenarAtestado(usuarioId: string, nomeArquivo: string, conteudo: Buffer, contentType: string): Promise<string> {
    return this.armazenar(BUCKET_ATESTADOS, usuarioId, nomeArquivo, conteudo, contentType);
  }

  async gerarUrlAssinadaSelfie(ref: string): Promise<{ url: string; expiraEmSegundos: number }> {
    return this.gerarUrlAssinada(BUCKET_SELFIES, ref);
  }

  async gerarUrlAssinadaAtestado(ref: string): Promise<{ url: string; expiraEmSegundos: number }> {
    return this.gerarUrlAssinada(BUCKET_ATESTADOS, ref);
  }

  private async armazenar(bucket: string, usuarioId: string, nomeArquivo: string, conteudo: Buffer, contentType: string): Promise<string> {
    const ref = `${usuarioId}/${randomUUID()}-${nomeArquivo}`;
    const { error } = await this.supabase.admin.storage.from(bucket).upload(ref, conteudo, { contentType });
    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar arquivo: ${error.message}`);
    }
    return ref;
  }

  private async gerarUrlAssinada(bucket: string, ref: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const { data, error } = await this.supabase.admin.storage.from(bucket).createSignedUrl(ref, EXPIRACAO_SIGNED_URL_SEGUNDOS);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL do arquivo: ${error?.message}`);
    }
    return { url: data.signedUrl, expiraEmSegundos: EXPIRACAO_SIGNED_URL_SEGUNDOS };
  }
}
