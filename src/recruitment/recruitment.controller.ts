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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RecruitmentService } from './recruitment.service.js';
import {
  CreateRecruitmentActivityDto,
  UpdateRecruitmentActivityDto,
  VincularModeloDto,
} from './dto/recruitment-activity.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { User } from '../auth/user.decorator.js';
import { EstadoModeloCerrada } from './recruitment-activity.schema.js';

@Controller('api/recruitment/activities')
@UseGuards(AuthGuard)
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  // ========== CRUD DE ACTIVIDADES ==========

  @Post()
  @RequirePermissions('ventas:recruitment:create')
  async createActivity(
    @Body() createDto: CreateRecruitmentActivityDto,
    @User() user: any,
    @Req() req: any,
  ) {
    // Obtener el Sales Closer del empleado vinculado al usuario
    const userId = user.sub || user.userId;
    const salesCloserId = req.user?.empleadoId; // Asumiendo que el usuario tiene empleadoId

    return await this.recruitmentService.createActivity(createDto, userId, salesCloserId);
  }

  @Get()
  @RequirePermissions('ventas:recruitment:read')
  async findAllActivities(
    @Query('salesCloserId') salesCloserId?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('estado') estado?: EstadoModeloCerrada,
  ) {
    return await this.recruitmentService.findAllActivities({
      salesCloserId,
      fechaDesde,
      fechaHasta,
      estado,
    });
  }

  @Get('stats')
  @RequirePermissions('ventas:recruitment:read')
  async getGeneralStats(
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return await this.recruitmentService.getGeneralStats(fechaDesde, fechaHasta);
  }

  @Get('sales-closers')
  @RequirePermissions('ventas:recruitment:read')
  async getSalesClosers() {
    return await this.recruitmentService.getSalesClosers();
  }

  @Get('stats/:salesCloserId')
  @RequirePermissions('ventas:recruitment:read')
  async getStatsBySalesCloser(
    @Param('salesCloserId') salesCloserId: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return await this.recruitmentService.getStatsBySalesCloser(
      salesCloserId,
      fechaDesde,
      fechaHasta,
    );
  }

  @Get(':id')
  @RequirePermissions('ventas:recruitment:read')
  async findActivityById(@Param('id') id: string) {
    return await this.recruitmentService.findActivityById(id);
  }

  @Patch(':id')
  @RequirePermissions('ventas:recruitment:update')
  async updateActivity(
    @Param('id') id: string,
    @Body() updateDto: UpdateRecruitmentActivityDto,
  ) {
    return await this.recruitmentService.updateActivity(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('ventas:recruitment:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteActivity(@Param('id') id: string) {
    await this.recruitmentService.deleteActivity(id);
  }

  // ========== VINCULAR MODELO ==========

  @Post('vincular-modelo')
  @RequirePermissions('ventas:recruitment:update')
  async vincularModelo(@Body() vincularDto: VincularModeloDto) {
    return await this.recruitmentService.vincularModelo(vincularDto);
  }

  // ========== EXPORTACIÓN ==========

  @Get('export/excel')
  @RequirePermissions('ventas:recruitment:export')
  async exportToExcel(
    @Query('salesCloserId') salesCloserId?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.recruitmentService.exportToExcel({
      salesCloserId,
      fechaDesde,
      fechaHasta,
    });

    const filename = `recruitment-${fechaDesde || 'all'}-${fechaHasta || 'all'}.xlsx`;

    if (res) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    }

    return buffer;
  }

  @Get('export/pdf')
  @RequirePermissions('ventas:recruitment:export')
  async exportToPdf(
    @Query('salesCloserId') salesCloserId?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.recruitmentService.exportToPdf({
      salesCloserId,
      fechaDesde,
      fechaHasta,
    });

    const filename = `recruitment-${fechaDesde || 'all'}-${fechaHasta || 'all'}.pdf`;

    if (res) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    }

    return buffer;
  }
}

