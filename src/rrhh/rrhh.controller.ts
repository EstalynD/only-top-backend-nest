import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { RrhhService } from './rrhh.service.js';
import { RrhhSeederService } from './rrhh.seeder.js';
import { CreateAreaDto } from './dto/create-area.dto.js';
import { UpdateAreaDto } from './dto/update-area.dto.js';
import { CreateCargoDto } from './dto/create-cargo.dto.js';
import { UpdateCargoDto } from './dto/update-cargo.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';

@Controller('api/rrhh')
@UseGuards(AuthGuard)
export class RrhhController {
  constructor(
    private readonly rrhhService: RrhhService,
    private readonly rrhhSeederService: RrhhSeederService,
  ) {}

  // ========== ÁREAS ==========

  @Post('areas')
  @RequirePermissions('rrhh:areas:create')
  async createArea(@Body() createAreaDto: CreateAreaDto) {
    return await this.rrhhService.createArea(createAreaDto);
  }

  @Get('areas')
  @RequirePermissions('rrhh:areas:read')
  async findAllAreas(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return await this.rrhhService.findAllAreas(include);
  }

  @Get('areas/with-cargos')
  @RequirePermissions('rrhh:areas:read')
  async getAreasWithCargos(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return await this.rrhhService.getAreasWithCargos(include);
  }

  @Get('areas/:id')
  @RequirePermissions('rrhh:areas:read')
  async findAreaById(@Param('id') id: string) {
    return await this.rrhhService.findAreaById(id);
  }

  @Get('areas/code/:code')
  @RequirePermissions('rrhh:areas:read')
  async findAreaByCode(@Param('code') code: string) {
    return await this.rrhhService.findAreaByCode(code);
  }

  @Patch('areas/:id')
  @RequirePermissions('rrhh:areas:update')
  async updateArea(@Param('id') id: string, @Body() updateAreaDto: UpdateAreaDto) {
    return await this.rrhhService.updateArea(id, updateAreaDto);
  }

  @Delete('areas/:id')
  @RequirePermissions('rrhh:areas:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteArea(@Param('id') id: string) {
    await this.rrhhService.deleteArea(id);
  }

  // ========== CARGOS ==========

  @Post('cargos')
  @RequirePermissions('rrhh:cargos:create')
  async createCargo(@Body() createCargoDto: CreateCargoDto) {
    return await this.rrhhService.createCargo(createCargoDto);
  }

  @Get('cargos')
  @RequirePermissions('rrhh:cargos:read')
  async findAllCargos(
    @Query('includeInactive') includeInactive?: string,
    @Query('areaId') areaId?: string
  ) {
    const include = includeInactive === 'true';
    return await this.rrhhService.findAllCargos(include, areaId);
  }

  @Get('cargos/:id')
  @RequirePermissions('rrhh:cargos:read')
  async findCargoById(@Param('id') id: string) {
    return await this.rrhhService.findCargoById(id);
  }

  @Get('cargos/code/:code')
  @RequirePermissions('rrhh:cargos:read')
  async findCargoByCode(@Param('code') code: string) {
    return await this.rrhhService.findCargoByCode(code);
  }

  @Patch('cargos/:id')
  @RequirePermissions('rrhh:cargos:update')
  async updateCargo(@Param('id') id: string, @Body() updateCargoDto: UpdateCargoDto) {
    return await this.rrhhService.updateCargo(id, updateCargoDto);
  }

  @Delete('cargos/:id')
  @RequirePermissions('rrhh:cargos:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCargo(@Param('id') id: string) {
    await this.rrhhService.deleteCargo(id);
  }

  // ========== SEEDER ==========
  @Post('seed-defaults')
  @RequirePermissions('system.admin')
  @HttpCode(HttpStatus.ACCEPTED)
  async seedDefaults() {
    await this.rrhhSeederService.seedDefaultData();
    return { ok: true };
  }
}
