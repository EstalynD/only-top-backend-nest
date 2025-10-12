import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ContratosService } from './contratos.service.js';
import { CreateContratoDto, UpdateContratoDto, AprobarContratoDto, RenovarContratoDto } from './dto/create-contrato.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { User } from '../auth/user.decorator.js';

@Controller(['api/rrhh/contratos', 'rrhh/contratos'])
@UseGuards(AuthGuard)
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

  /**
   * Crear un nuevo contrato
   */
  @Post()
  async crearContrato(
    @Body() createContratoDto: CreateContratoDto,
    @User() usuario: any,
  ) {
    const contrato = await this.contratosService.crearContrato(
      createContratoDto,
      new Types.ObjectId(usuario.id)
    );

    return {
      success: true,
      message: 'Contrato creado exitosamente',
      data: contrato,
    };
  }

  /**
   * Obtener todos los contratos
   */
  @Get()
  async obtenerContratos(
    @Query('empleadoId') empleadoId?: string,
    @Query('estado') estado?: string,
    @Query('tipoContrato') tipoContrato?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    const filtros: any = {};

    if (empleadoId) filtros.empleadoId = new Types.ObjectId(empleadoId);
    if (estado) filtros.estado = estado;
    if (tipoContrato) filtros.tipoContrato = tipoContrato;
    if (fechaInicio) filtros.fechaInicio = new Date(fechaInicio);
    if (fechaFin) filtros.fechaFin = new Date(fechaFin);

    const contratos = await this.contratosService.obtenerContratos(filtros);

    return {
      success: true,
      data: contratos,
    };
  }

  /**
   * Obtener un contrato por ID
   */
  @Get(':id')
  async obtenerContratoPorId(@Param('id') id: string) {
    const contrato = await this.contratosService.obtenerContratoPorId(new Types.ObjectId(id));

    return {
      success: true,
      data: contrato,
    };
  }

  /**
   * Obtener contratos de un empleado
   */
  @Get('empleado/:empleadoId')
  async obtenerContratosPorEmpleado(@Param('empleadoId') empleadoId: string) {
    const contratos = await this.contratosService.obtenerContratosPorEmpleado(
      new Types.ObjectId(empleadoId)
    );

    return {
      success: true,
      data: contratos,
    };
  }

  /**
   * Actualizar un contrato
   */
  @Put(':id')
  async actualizarContrato(
    @Param('id') id: string,
    @Body() updateContratoDto: UpdateContratoDto,
  ) {
    const contrato = await this.contratosService.actualizarContrato(
      new Types.ObjectId(id),
      updateContratoDto
    );

    return {
      success: true,
      message: 'Contrato actualizado exitosamente',
      data: contrato,
    };
  }

  /**
   * Aprobar o rechazar un contrato
   */
  @Put(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  async aprobarContrato(
    @Param('id') id: string,
    @Body() aprobarContratoDto: AprobarContratoDto,
    @User() usuario: any,
  ) {
    const contrato = await this.contratosService.aprobarContrato(
      new Types.ObjectId(id),
      aprobarContratoDto,
      new Types.ObjectId(usuario.id)
    );

    return {
      success: true,
      message: `Contrato ${aprobarContratoDto.estado.toLowerCase()} exitosamente`,
      data: contrato,
    };
  }

  /**
   * Renovar un contrato
   */
  @Post(':id/renovar')
  async renovarContrato(
    @Param('id') id: string,
    @Body() renovarContratoDto: RenovarContratoDto,
    @User() usuario: any,
  ) {
    const contrato = await this.contratosService.renovarContrato(
      new Types.ObjectId(id),
      renovarContratoDto,
      new Types.ObjectId(usuario.id)
    );

    return {
      success: true,
      message: 'Contrato renovado exitosamente',
      data: contrato,
    };
  }

  /**
   * Eliminar un contrato
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarContrato(@Param('id') id: string) {
    await this.contratosService.eliminarContrato(new Types.ObjectId(id));

    return {
      success: true,
      message: 'Contrato eliminado exitosamente',
    };
  }

  /**
   * Obtener contratos próximos a vencer
   */
  @Get('alertas/proximos-vencer')
  async obtenerContratosProximosAVencer(@Query('dias') dias?: string) {
    const diasNum = dias ? parseInt(dias) : 30;
    const contratos = await this.contratosService.obtenerContratosProximosAVencer(diasNum);

    return {
      success: true,
      data: contratos,
    };
  }

  /**
   * Obtener contratos vencidos
   */
  @Get('alertas/vencidos')
  async obtenerContratosVencidos() {
    const contratos = await this.contratosService.obtenerContratosVencidos();

    return {
      success: true,
      data: contratos,
    };
  }

  /**
   * Marcar contratos vencidos automáticamente
   */
  @Post('alertas/marcar-vencidos')
  @HttpCode(HttpStatus.OK)
  async marcarContratosVencidos() {
    const cantidad = await this.contratosService.marcarContratosVencidos();

    return {
      success: true,
      message: `${cantidad} contratos marcados como vencidos`,
      data: { cantidadMarcados: cantidad },
    };
  }

  /**
   * Obtener estadísticas de contratos
   */
  @Get('estadisticas/generales')
  async obtenerEstadisticasContratos() {
    const estadisticas = await this.contratosService.obtenerEstadisticasContratos();

    return {
      success: true,
      data: estadisticas,
    };
  }

  /**
   * Buscar contratos por criterios
   */
  @Get('buscar/criterios')
  async buscarContratos(
    @Query('empleadoId') empleadoId?: string,
    @Query('estado') estado?: string,
    @Query('tipoContrato') tipoContrato?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('numeroContrato') numeroContrato?: string,
  ) {
    const criterios: any = {};

    if (empleadoId) criterios.empleadoId = new Types.ObjectId(empleadoId);
    if (estado) criterios.estado = estado;
    if (tipoContrato) criterios.tipoContrato = tipoContrato;
    if (fechaInicio) criterios.fechaInicio = new Date(fechaInicio);
    if (fechaFin) criterios.fechaFin = new Date(fechaFin);
    if (numeroContrato) criterios.numeroContrato = numeroContrato;

    const contratos = await this.contratosService.buscarContratos(criterios);

    return {
      success: true,
      data: contratos,
    };
  }

  /**
   * Generar PDF del contrato
   */
  @Get(':id/pdf')
  async generarPdfContrato(@Param('id') id: string) {
    const result = await this.contratosService.generarPdfContrato(new Types.ObjectId(id));
    return {
      success: true,
      message: 'PDF generado exitosamente',
      data: {
        filename: result.filename,
        mimeType: result.mimeType,
        pdfBuffer: result.buffer.toString('base64'),
      },
    };
  }
}
