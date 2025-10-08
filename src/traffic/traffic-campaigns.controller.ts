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
} from '@nestjs/common';
import { TrafficCampaignsService } from './traffic-campaigns.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';
import { FilterCampaignsDto } from './dto/filter-campaigns.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { User } from '../auth/user.decorator.js';

@Controller('api/traffic/campaigns')
@UseGuards(AuthGuard)
export class TrafficCampaignsController {
  constructor(private readonly campaignsService: TrafficCampaignsService) {}

  // ========== CREAR CAMPAÑA ==========

  @Post()
  @RequirePermissions('ventas:traffic:campaigns:create')
  async createCampaign(@Body() createDto: CreateCampaignDto, @User() user: any) {
    // El traffickerId puede venir del DTO o del usuario autenticado
    const traffickerId = createDto.traffickerId || user.empleadoId || user.id;
    return await this.campaignsService.createCampaign(createDto, traffickerId);
  }

  // ========== OBTENER CAMPAÑAS CON FILTROS ==========

  @Get()
  @RequirePermissions('ventas:traffic:campaigns:read')
  async findCampaigns(@Query() filters: FilterCampaignsDto) {
    return await this.campaignsService.findCampaigns(filters);
  }

  // ========== ESTADÍSTICAS GENERALES ==========

  @Get('statistics')
  @RequirePermissions('ventas:traffic:campaigns:read')
  async getCampaignsStatistics(@Query() filters?: FilterCampaignsDto) {
    return await this.campaignsService.getCampaignsStatistics(filters);
  }

  // ========== LISTAR TRAFFICKERS ==========

  @Get('traffickers')
  @RequirePermissions('ventas:traffic:campaigns:read')
  async getTraffickers() {
    return await this.campaignsService.getTraffickers();
  }

  // ========== HISTÓRICO POR MODELO ==========

  @Get('modelo/:modeloId')
  @RequirePermissions('ventas:traffic:campaigns:read')
  async getCampaignsByModelo(@Param('modeloId') modeloId: string) {
    return await this.campaignsService.getCampaignsByModelo(modeloId);
  }

  // ========== OBTENER CAMPAÑA POR ID ==========

  @Get('campaign/:id')
  @RequirePermissions('ventas:traffic:campaigns:read')
  async findCampaignById(@Param('id') id: string) {
    return await this.campaignsService.findCampaignById(id);
  }

  // ========== ACTUALIZAR CAMPAÑA ==========

  @Patch('campaign/:id')
  @RequirePermissions('ventas:traffic:campaigns:update')
  async updateCampaign(@Param('id') id: string, @Body() updateDto: UpdateCampaignDto) {
    return await this.campaignsService.updateCampaign(id, updateDto);
  }

  // ========== ELIMINAR CAMPAÑA ==========

  @Delete('campaign/:id')
  @RequirePermissions('ventas:traffic:campaigns:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCampaign(@Param('id') id: string) {
    await this.campaignsService.deleteCampaign(id);
  }

  // TODO: Implementar exportación a Excel/PDF en futuras iteraciones
}
