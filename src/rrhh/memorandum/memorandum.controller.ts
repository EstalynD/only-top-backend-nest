import { Controller, Post, Query, Res, Req, UseGuards, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../auth/auth.guard.js';
import { Permissions } from '../../rbac/rbac.decorators.js';
import { MemorandumService, MemorandumType } from './memorandum.service.js';

@Controller(['rrhh/memorandum', 'api/rrhh/memorandum'])
@UseGuards(AuthGuard)
export class MemorandumController {
  constructor(private readonly memorandumService: MemorandumService) {}

  @Post('generate')
  @Permissions('rrhh.attendance.admin')
  async generateMemorandum(
    @Query('type') type: string,
    @Query('userId') userId: string,
    @Query('date') dateStr: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    // Validate inputs
    if (!type || !userId || !dateStr) {
      throw new BadRequestException('Faltan parámetros requeridos: type, userId, date');
    }

    const validTypes: MemorandumType[] = ['AUSENCIA', 'LLEGADA_TARDE', 'SALIDA_ANTICIPADA'];
    if (!validTypes.includes(type as MemorandumType)) {
      throw new BadRequestException(`Tipo de memorando inválido. Tipos válidos: ${validTypes.join(', ')}`);
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }

    // Generate PDF
    const pdfBuffer = await this.memorandumService.generateMemorandum(
      type as MemorandumType,
      userId,
      date,
      {
        username: req.user?.username || 'Administración',
        cargo: req.user?.cargo || 'Recursos Humanos'
      }
    );

    // Set response headers
    const filename = `memorandum-${type.toLowerCase()}-${userId}-${dateStr}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);
  }
}
