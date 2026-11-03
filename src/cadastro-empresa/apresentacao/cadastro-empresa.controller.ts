import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { CadastrarEmpresaComPlanoUseCase, ResultadoCadastrarEmpresaComPlano } from '../aplicacao/casos-de-uso/cadastrar-empresa-com-plano.usecase';
import { CadastrarEmpresaComPlanoDto } from './dto/cadastrar-empresa-com-plano.dto';

/**
 * Dono da rota `POST /empresas` (antes era EmpresasController -- ver comentário lá).
 * Mesmo guard/papéis de antes, DTO maior: plano+cobrança+login do cliente são
 * obrigatórios junto da criação, não mais um passo manual separado depois.
 */
@Controller('empresas')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class CadastroEmpresaController {
  constructor(private readonly cadastrarEmpresaComPlano: CadastrarEmpresaComPlanoUseCase) {}

  @Post()
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO)
  async criar(
    @Body() dto: CadastrarEmpresaComPlanoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoCadastrarEmpresaComPlano> {
    const contadorId = usuarioAtual.papel === Papel.SUPER_ADMIN ? dto.contadorId : usuarioAtual.contadorId;
    if (!contadorId) {
      throw new BadRequestException('contadorId é obrigatório');
    }

    return this.cadastrarEmpresaComPlano.executar({
      contadorId,
      razaoSocial: dto.razaoSocial,
      nomeFantasia: dto.nomeFantasia ?? null,
      cnpj: dto.cnpj,
      regimeTributario: dto.regimeTributario ?? null,
      modoAcessoSerpro: dto.modoAcessoSerpro,
      planoContasModelo: dto.planoContasModelo ?? null,
      planoId: dto.planoId,
      cobranca: dto.cobranca,
      metodo: dto.metodo,
      cardEncrypted: dto.cardEncrypted,
      installments: dto.installments,
      clienteNome: dto.clienteNome,
      clienteEmail: dto.clienteEmail,
    });
  }
}
