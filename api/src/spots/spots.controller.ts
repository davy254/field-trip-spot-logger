import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateSpotDto } from './dto/create-spot.dto';
import { UpdateSpotDto } from './dto/update-spot.dto';
import { SpotsService } from './spots.service';

@Controller('spots')
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  @Post()
  create(@Body() dto: CreateSpotDto) {
    return this.spotsService.create(dto);
  }

  @Get()
  findAll(
    @Query('categoryId', new ParseIntPipe({ optional: true }))
    categoryId?: number,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.spotsService.findAll({ categoryId, search, page, limit });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.spotsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSpotDto,
  ) {
    return this.spotsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.spotsService.remove(id);
  }
}