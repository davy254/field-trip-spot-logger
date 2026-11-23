import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { VisitsService } from './visits.service';

@Controller()
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post('spots/:spotId/visits')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('spotId', ParseIntPipe) spotId: number,
    @Body() dto: CreateVisitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visitsService.create(spotId, dto, req.user.id);
  }

  @Get('spots/:spotId/visits')
  findForSpot(@Param('spotId', ParseIntPipe) spotId: number) {
    return this.visitsService.findForSpot(spotId);
  }

  @Patch('visits/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVisitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visitsService.update(id, dto, req.user);
  }

  @Delete('visits/:id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visitsService.remove(id, req.user);
  }
}