import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ContratosModeloService } from './contratos-modelo.service.js';
import {
  CreateContratoModeloDto,
  UpdateContratoModeloDto,
  SolicitarOtpDto,
  FirmarContratoDto,
  EnviarParaFirmaDto,
} from './dto/contrato-modelo.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { EstadoContrato } from './contrato-modelo.schema.js';

@Controller('api/rrhh/contratos-modelo')
@UseGuards(AuthGuard)
export class ContratosModeloController {
  constructor(private readonly contratosService: ContratosModeloService) {}

  // ========== CRUD DE CONTRATOS ==========

  @Post()
  @RequirePermissions('clientes:contratos:create')
  async createContrato(@Body() createContratoDto: CreateContratoModeloDto, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return await this.contratosService.createContrato(createContratoDto, userId);
  }

  @Get()
  @RequirePermissions('clientes:contratos:read')
  async findAllContratos(
    @Query('modeloId') modeloId?: string,
    @Query('estado') estado?: EstadoContrato,
    @Query('search') search?: string,
  ) {
    return await this.contratosService.findAllContratos({ modeloId, estado, search });
  }

  @Get('stats')
  @RequirePermissions('clientes:contratos:read')
  async getContratosStats() {
    return await this.contratosService.getContratosStats();
  }

  @Get(':id')
  @RequirePermissions('clientes:contratos:read')
  async findContratoById(@Param('id') id: string) {
    return await this.contratosService.findContratoById(id);
  }

  @Patch(':id')
  @RequirePermissions('clientes:contratos:update')
  async updateContrato(@Param('id') id: string, @Body() updateContratoDto: UpdateContratoModeloDto) {
    return await this.contratosService.updateContrato(id, updateContratoDto);
  }

  @Delete(':id')
  @RequirePermissions('clientes:contratos:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteContrato(@Param('id') id: string) {
    await this.contratosService.deleteContrato(id);
  }

  // ========== PROCESO DE FIRMA (Método antiguo - mantener por compatibilidad) ==========

  @Post('enviar-para-firma')
  @RequirePermissions('clientes:contratos:send')
  async enviarParaFirma(@Body() dto: EnviarParaFirmaDto) {
    return await this.contratosService.enviarParaFirma(dto.contratoId);
  }

  @Post('solicitar-otp')
  @HttpCode(HttpStatus.OK)
  async solicitarOtp(@Body() body: { contratoId: string; correoModelo: string }) {
    return await this.contratosService.solicitarOtp(body.contratoId, body.correoModelo);
  }

  @Post('firmar')
  @HttpCode(HttpStatus.OK)
  async firmarContrato(@Body() dto: FirmarContratoDto) {
    return await this.contratosService.firmarContrato(dto);
  }

  // ========== PROCESO DE FIRMA POR ENLACE (Nuevo método profesional) ==========

  @Post('enviar-enlace-firma')
  @RequirePermissions('clientes:contratos:send')
  async enviarEnlaceFirma(@Body() dto: EnviarParaFirmaDto) {
    return await this.contratosService.enviarEnlaceFirma(dto.contratoId);
  }
}

// ========== ENDPOINTS PÚBLICOS PARA FIRMA POR ENLACE ==========

@Controller('api/firma-contrato')
export class FirmaPublicaController {
  constructor(private readonly contratosService: ContratosModeloService) {}

  @Get(':token')
  @HttpCode(HttpStatus.OK)
  async obtenerContratoPorToken(@Param('token') token: string) {
    const contrato = await this.contratosService.obtenerContratoPorToken(token);
    return {
      success: true,
      data: contrato,
    };
  }

  @Post(':token/solicitar-otp')
  @HttpCode(HttpStatus.OK)
  async solicitarOtpPorToken(@Param('token') token: string) {
    return await this.contratosService.solicitarOtpPorToken(token);
  }

  @Post(':token/firmar')
  @HttpCode(HttpStatus.OK)
  async firmarContratoPorToken(
    @Param('token') token: string,
    @Body() dto: Omit<FirmarContratoDto, 'contratoId'>
  ) {
    return await this.contratosService.firmarContratoPorToken(token, dto);
  }
}

