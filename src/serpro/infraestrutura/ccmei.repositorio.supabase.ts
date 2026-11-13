import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CcmeiDocumento, CcmeiRepositorioPort } from '../aplicacao/portas/ccmei-repositorio.port';

interface LinhaCcmeiDocumento {
  id: string;
  empresa_id: string;
  pdf_storage_ref: string | null;
  consultado_em: string;
  atualizado_em: string;
}

const COLUNAS = 'id, empresa_id, pdf_storage_ref, consultado_em, atualizado_em';

@Injectable()
export class CcmeiRepositorioSupabase implements CcmeiRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async buscarPorEmpresa(empresaId: string): Promise<CcmeiDocumento | null> {
    const { data, error } = await this.supabase.admin
      .from('ccmei_documentos')
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(`Falha ao buscar CCMEI: ${error.message}`);
    return data ? this.mapear(data as LinhaCcmeiDocumento) : null;
  }

  async upsert(empresaId: string, pdfStorageRef: string): Promise<CcmeiDocumento> {
    const { data, error } = await this.supabase.admin
      .from('ccmei_documentos')
      .upsert(
        { empresa_id: empresaId, pdf_storage_ref: pdfStorageRef, consultado_em: new Date().toISOString() },
        { onConflict: 'empresa_id' },
      )
      .select(COLUNAS)
      .single();
    if (error) throw new InternalServerErrorException(`Falha ao salvar CCMEI: ${error.message}`);
    return this.mapear(data as LinhaCcmeiDocumento);
  }

  private mapear(linha: LinhaCcmeiDocumento): CcmeiDocumento {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      pdfStorageRef: linha.pdf_storage_ref,
      consultadoEm: linha.consultado_em,
      atualizadoEm: linha.atualizado_em,
    };
  }
}
