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
  StreamableFile,
  Header,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatterSalesService } from './chatter-sales.service.js';
import { ChatterGoalsService } from './chatter-goals.service.js';
import { ChatterCommissionsService } from './chatter-commissions.service.js';
import { ChatterPdfService } from './chatter-pdf.service.js';
import { ChatterExcelService } from './chatter-excel.service.js';
import { CreateChatterSaleDto } from './dto/create-chatter-sale.dto.js';
import { UpdateChatterSaleDto } from './dto/update-chatter-sale.dto.js';
import { FilterSalesDto } from './dto/filter-sales.dto.js';
import {
  CreateChatterGoalDto,
  UpdateChatterGoalDto,
  CloseChatterGoalDto,
  FilterChatterGoalsDto,
} from './dto/chatter-goal.dto.js';
import {
  GenerateCommissionsDto,
  ApproveCommissionDto,
  RejectCommissionDto,
  PayCommissionDto,
  FilterCommissionsDto,
  BulkApproveCommissionsDto,
  BulkPayCommissionsDto,
} from './dto/chatter-commission.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { User } from '../auth/user.decorator.js';

@Controller('api/chatter/sales')
@UseGuards(AuthGuard)
export class ChatterSalesController {
  constructor(
    private readonly chatterSalesService: ChatterSalesService,
    private readonly chatterGoalsService: ChatterGoalsService,
    private readonly chatterCommissionsService: ChatterCommissionsService,
    private readonly chatterPdfService: ChatterPdfService,
    private readonly chatterExcelService: ChatterExcelService,
  ) {}

  // ========== CREAR VENTA ==========

  @Post()
  @RequirePermissions('ventas:chatting:create')
  async createSale(@Body() createDto: CreateChatterSaleDto, @User() user: any) {
    return await this.chatterSalesService.createSale(createDto, user.id);
  }

  // ========== OBTENER VENTAS CON FILTROS ==========

  @Get()
  @RequirePermissions('ventas:chatting:read')
  async findSales(@Query() filters: FilterSalesDto) {
    return await this.chatterSalesService.findSales(filters);
  }

  // ========== ESTADÍSTICAS GENERALES ==========

  @Get('stats/general')
  @RequirePermissions('ventas:chatting:read')
  async getGeneralStats(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.chatterSalesService.getGeneralStats(fechaInicio, fechaFin);
  }

  // ========== CHATTERS ACTIVOS ==========

  @Get('chatters/active')
  @RequirePermissions('ventas:chatting:read')
  async getActiveChatters() {
    return await this.chatterSalesService.getActiveChatters();
  }

  // ========== CHATTERS DE UNA MODELO ==========

  @Get('modelo/:modeloId/chatters')
  @RequirePermissions('ventas:chatting:read')
  async getChattersForModel(@Param('modeloId') modeloId: string) {
    return await this.chatterSalesService.getChattersForModel(modeloId);
  }

  // ========== VENTAS POR GRUPO ==========

  @Get('grupo/:modeloId')
  @RequirePermissions('ventas:chatting:read')
  async getSalesByGroup(
    @Param('modeloId') modeloId: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.chatterSalesService.getSalesByGroup(modeloId, fechaInicio, fechaFin);
  }

  // ========== COMPARAR GRUPOS ==========

  @Post('comparar-grupos')
  @RequirePermissions('ventas:chatting:read')
  async compareGroups(
    @Body() body: { modeloIds: string[]; fechaInicio?: string; fechaFin?: string },
  ) {
    return await this.chatterSalesService.compareGroups(
      body.modeloIds,
      body.fechaInicio,
      body.fechaFin,
    );
  }

  // ========== ESTADÍSTICAS POR CHATTER ==========

  @Get('chatter/:chatterId/stats')
  @RequirePermissions('ventas:chatting:read')
  async getChatterStats(
    @Param('chatterId') chatterId: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.chatterSalesService.getChatterStats(chatterId, fechaInicio, fechaFin);
  }

  // ========== ESTADÍSTICAS POR MODELO ==========

  @Get('modelo/:modeloId/stats')
  @RequirePermissions('ventas:chatting:read')
  async getModeloStats(
    @Param('modeloId') modeloId: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.chatterSalesService.getModeloStats(modeloId, fechaInicio, fechaFin);
  }

  // ========== OBTENER VENTA POR ID ==========

  @Get('sale/:id')
  @RequirePermissions('ventas:chatting:read')
  async findSaleById(@Param('id') id: string) {
    return await this.chatterSalesService.findSaleById(id);
  }

  // ========== ACTUALIZAR VENTA ==========

  @Patch('sale/:id')
  @RequirePermissions('ventas:chatting:update')
  async updateSale(@Param('id') id: string, @Body() updateDto: UpdateChatterSaleDto) {
    return await this.chatterSalesService.updateSale(id, updateDto);
  }

  // ========== ELIMINAR VENTA ==========

  @Delete('sale/:id')
  @RequirePermissions('ventas:chatting:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSale(@Param('id') id: string) {
    await this.chatterSalesService.deleteSale(id);
  }

  // ========== EXPORTAR A PDF ==========

  @Get('excel/template')
  @RequirePermissions('ventas:chatting:read')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async downloadTemplate(): Promise<StreamableFile> {
    const excelBuffer = await this.chatterExcelService.generateTemplate();
    return new StreamableFile(excelBuffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="plantilla-ventas-chatters.xlsx"`,
    });
  }

  @Post('excel/import')
  @RequirePermissions('ventas:chatting:create')
  @UseInterceptors(FileInterceptor('file'))
  async importFromExcel(
    @UploadedFile() file: any,
    @User() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningún archivo');
    }

    if (!file.originalname.match(/\.(xlsx|xls)$/)) {
      throw new BadRequestException('El archivo debe ser un Excel (.xlsx o .xls)');
    }

    const result = await this.chatterExcelService.importSales(file.buffer, user.id);
    return result;
  }

  // ========== EXPORTAR A PDF ==========

  @Get('grupo/:modeloId/pdf')
  @RequirePermissions('ventas:chatting:read')
  @Header('Content-Type', 'application/pdf')
  async exportGroupSalesPdf(
    @Param('modeloId') modeloId: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ): Promise<StreamableFile> {
    const data = await this.chatterSalesService.getSalesByGroup(modeloId, fechaInicio, fechaFin);
    const pdfBuffer = await this.chatterPdfService.generateGroupSalesReport(data);
    return new StreamableFile(pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="reporte-grupo-${modeloId}.pdf"`,
    });
  }

  @Get('chatter/:chatterId/stats/pdf')
  @RequirePermissions('ventas:chatting:read')
  @Header('Content-Type', 'application/pdf')
  async exportChatterStatsPdf(
    @Param('chatterId') chatterId: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ): Promise<StreamableFile> {
    const data = await this.chatterSalesService.getChatterStats(chatterId, fechaInicio, fechaFin);
    const pdfBuffer = await this.chatterPdfService.generateChatterStatsReport(data);
    return new StreamableFile(pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="estadisticas-chatter-${chatterId}.pdf"`,
    });
  }

  @Post('comparar-grupos/pdf')
  @RequirePermissions('ventas:chatting:read')
  @Header('Content-Type', 'application/pdf')
  async exportGroupComparisonPdf(
    @Body() body: { modeloIds: string[]; fechaInicio?: string; fechaFin?: string },
  ): Promise<StreamableFile> {
    const data = await this.chatterSalesService.compareGroups(
      body.modeloIds,
      body.fechaInicio,
      body.fechaFin,
    );
    const pdfBuffer = await this.chatterPdfService.generateGroupComparisonReport(data);
    return new StreamableFile(pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="comparacion-grupos.pdf"`,
    });
  }

  @Get('stats/general/pdf')
  @RequirePermissions('ventas:chatting:read')
  @Header('Content-Type', 'application/pdf')
  async exportGeneralStatsPdf(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ): Promise<StreamableFile> {
    const data = await this.chatterSalesService.getGeneralStats(fechaInicio, fechaFin);
    const pdfBuffer = await this.chatterPdfService.generateGeneralStatsReport(data);
    return new StreamableFile(pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="reporte-general-chatters.pdf"`,
    });
  }

  // ========== METAS DE CHATTERS ==========

  @Post('goals')
  @RequirePermissions('ventas:chatting:goals:create')
  async createGoal(@Body() createDto: CreateChatterGoalDto, @User() user: any) {
    return await this.chatterGoalsService.createGoal(createDto, user.id);
  }

  @Get('goals')
  @RequirePermissions('ventas:chatting:goals:read')
  async findGoals(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        skipMissingProperties: true,
        forbidNonWhitelisted: false,
      }),
    )
    filters: FilterChatterGoalsDto,
  ) {
    return await this.chatterGoalsService.findGoals(filters);
  }

  @Get('goals/statistics')
  @RequirePermissions('ventas:chatting:goals:read')
  async getGoalStatistics(
    @Query('modeloId') modeloId?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.chatterGoalsService.getGoalStatistics(modeloId, fechaInicio, fechaFin);
  }

  @Get('goals/modelo/:modeloId/active')
  @RequirePermissions('ventas:chatting:goals:read')
  async getActiveGoalForModel(@Param('modeloId') modeloId: string) {
    return await this.chatterGoalsService.getActiveGoalForModel(modeloId);
  }

  @Get('goals/:id')
  @RequirePermissions('ventas:chatting:goals:read')
  async findGoalById(@Param('id') id: string) {
    return await this.chatterGoalsService.findGoalById(id);
  }

  @Patch('goals/:id')
  @RequirePermissions('ventas:chatting:goals:update')
  async updateGoal(@Param('id') id: string, @Body() updateDto: UpdateChatterGoalDto) {
    return await this.chatterGoalsService.updateGoal(id, updateDto);
  }

  @Post('goals/:id/close')
  @RequirePermissions('ventas:chatting:goals:update')
  async closeGoal(@Param('id') id: string, @Body() closeDto: CloseChatterGoalDto, @User() user: any) {
    return await this.chatterGoalsService.closeGoal(id, closeDto, user.id);
  }

  @Post('goals/:id/cancel')
  @RequirePermissions('ventas:chatting:goals:update')
  async cancelGoal(@Param('id') id: string, @Body() body: { reason?: string }, @User() user: any) {
    return await this.chatterGoalsService.cancelGoal(id, body.reason, user.id);
  }

  @Delete('goals/:id')
  @RequirePermissions('ventas:chatting:goals:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGoal(@Param('id') id: string) {
    await this.chatterGoalsService.deleteGoal(id);
  }

  @Post('goals/:id/update-progress')
  @RequirePermissions('ventas:chatting:goals:read')
  async updateGoalProgress(@Param('id') id: string) {
    return await this.chatterGoalsService.updateGoalProgress(id);
  }

  // ========== COMISIONES DE CHATTERS ==========

  @Post('commissions/generate')
  @RequirePermissions('ventas:chatting:commissions:create')
  async generateCommissions(@Body() generateDto: GenerateCommissionsDto, @User() user: any) {
    return await this.chatterCommissionsService.generateCommissions(generateDto, user.id);
  }

  @Get('commissions')
  @RequirePermissions('ventas:chatting:commissions:read')
  async findCommissions(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        skipMissingProperties: true,
        forbidNonWhitelisted: false,
      }),
    )
    filters: FilterCommissionsDto,
  ) {
    return await this.chatterCommissionsService.findCommissions(filters);
  }

  @Get('commissions/statistics')
  @RequirePermissions('ventas:chatting:commissions:read')
  async getCommissionStatistics(
    @Query('chatterId') chatterId?: string,
    @Query('modeloId') modeloId?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.chatterCommissionsService.getCommissionStatistics(
      chatterId,
      modeloId,
      fechaInicio,
      fechaFin,
    );
  }

  @Get('commissions/chatter/:chatterId')
  @RequirePermissions('ventas:chatting:commissions:read')
  async getCommissionsForChatter(@Param('chatterId') chatterId: string, @Query('estado') estado?: any) {
    return await this.chatterCommissionsService.getCommissionsForChatter(chatterId, estado);
  }

  @Get('commissions/:id')
  @RequirePermissions('ventas:chatting:commissions:read')
  async findCommissionById(@Param('id') id: string) {
    return await this.chatterCommissionsService.findCommissionById(id);
  }

  @Post('commissions/:id/approve')
  @RequirePermissions('ventas:chatting:commissions:approve')
  async approveCommission(
    @Param('id') id: string,
    @Body() approveDto: ApproveCommissionDto,
    @User() user: any,
  ) {
    return await this.chatterCommissionsService.approveCommission(id, approveDto, user.id);
  }

  @Post('commissions/:id/reject')
  @RequirePermissions('ventas:chatting:commissions:approve')
  async rejectCommission(
    @Param('id') id: string,
    @Body() rejectDto: RejectCommissionDto,
    @User() user: any,
  ) {
    return await this.chatterCommissionsService.rejectCommission(id, rejectDto, user.id);
  }

  @Post('commissions/:id/pay')
  @RequirePermissions('ventas:chatting:commissions:pay')
  async payCommission(@Param('id') id: string, @Body() payDto: PayCommissionDto, @User() user: any) {
    return await this.chatterCommissionsService.payCommission(id, payDto, user.id);
  }

  @Post('commissions/bulk-approve')
  @RequirePermissions('ventas:chatting:commissions:approve')
  async bulkApproveCommissions(@Body() bulkDto: BulkApproveCommissionsDto, @User() user: any) {
    return await this.chatterCommissionsService.bulkApproveCommissions(bulkDto, user.id);
  }

  @Post('commissions/bulk-pay')
  @RequirePermissions('ventas:chatting:commissions:pay')
  async bulkPayCommissions(@Body() bulkDto: BulkPayCommissionsDto, @User() user: any) {
    return await this.chatterCommissionsService.bulkPayCommissions(bulkDto, user.id);
  }

  @Delete('commissions/:id')
  @RequirePermissions('ventas:chatting:commissions:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCommission(@Param('id') id: string) {
    await this.chatterCommissionsService.deleteCommission(id);
  }
}

