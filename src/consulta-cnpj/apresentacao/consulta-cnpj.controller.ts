import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { ConsultarCnpjUseCase, DadosCnpj } from '../aplicacao/casos-de-uso/consultar-cnpj.usecase';

/**
 * Dado público da Receita Federal (via Conecta Gov) -- não é dado de tenant, por isso só
 * exige autenticação (sem PermissoesGuard/ModulosGuard): qualquer usuário logado pode
 * consultar, independente de contador/empresa ou módulo licenciado.
 */
@Controller('consulta-cnpj')
@UseGuards(SupabaseAuthGuard)
export class ConsultaCnpjController {
  constructor(private readonly consultarCnpj: ConsultarCnpjUseCase) {}

  @Get(':cnpj')
  async consultar(@Param('cnpj') cnpj: string): Promise<DadosCnpj> {
    return this.consultarCnpj.executar(cnpj);
  }
}
