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
import { RecruitmentGoalsService } from './recruitment-goals.service.js';
import {
  CreateRecruitmentGoalDto,
  UpdateRecruitmentGoalDto,
  UpdateGoalProgressDto,
} from './dto/recruitment-goal.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { User } from '../auth/user.decorator.js';
import { GoalStatus, GoalType } from './recruitment-goal.schema.js';

@Controller('api/recruitment/goals')
@UseGuards(AuthGuard)
export class RecruitmentGoalsController {
  constructor(private readonly goalsService: RecruitmentGoalsService) {}

  // ========== CRUD DE METAS ==========

  @Post()
  @RequirePermissions('ventas:recruitment:create')
  async createGoal(
    @Body() createDto: CreateRecruitmentGoalDto,
    @User() user: any,
  ) {
    const userId = user.sub || user.userId;
    return await this.goalsService.createGoal(createDto, userId);
  }

  @Get()
  @RequirePermissions('ventas:recruitment:read')
  async findAllGoals(
    @Query('salesCloserId') salesCloserId?: string,
    @Query('estado') estado?: GoalStatus,
    @Query('tipo') tipo?: GoalType,
    @Query('activas') activas?: string,
  ) {
    return await this.goalsService.findAllGoals({
      salesCloserId,
      estado,
      tipo,
      activas: activas === 'true',
    });
  }

  @Get('stats')
  @RequirePermissions('ventas:recruitment:read')
  async getGoalStats(
    @Query('salesCloserId') salesCloserId?: string,
  ) {
    return await this.goalsService.getGoalStats(salesCloserId);
  }

  @Get(':id')
  @RequirePermissions('ventas:recruitment:read')
  async findGoalById(@Param('id') id: string) {
    return await this.goalsService.findGoalById(id);
  }

  @Patch(':id')
  @RequirePermissions('ventas:recruitment:update')
  async updateGoal(
    @Param('id') id: string,
    @Body() updateDto: UpdateRecruitmentGoalDto,
    @User() user: any,
  ) {
    const userId = user.sub || user.userId;
    return await this.goalsService.updateGoal(id, updateDto, userId);
  }

  @Delete(':id')
  @RequirePermissions('ventas:recruitment:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGoal(@Param('id') id: string) {
    await this.goalsService.deleteGoal(id);
  }

  // ========== ACTUALIZACIÓN DE PROGRESO ==========

  @Post(':id/update-progress')
  @RequirePermissions('ventas:recruitment:update')
  async updateGoalProgress(@Param('id') id: string) {
    return await this.goalsService.updateGoalProgress(id);
  }

  @Post('update-all')
  @RequirePermissions('ventas:recruitment:update')
  async updateAllActiveGoals() {
    await this.goalsService.updateAllActiveGoals();
    return { message: 'Actualización de metas iniciada' };
  }
}

