import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    await this.assertNameFree(dto.name);
    return this.prisma.category.create({ data: { name: dto.name } });
  }

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id); // clean 404 if it does not exist
    if (dto.name) {
      await this.assertNameFree(dto.name, id);
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    const spotCount = await this.prisma.spot.count({
      where: { categoryId: id },
    });
    if (spotCount > 0) {
      throw new ConflictException(
        `Cannot delete category ${id}: ${spotCount} spot(s) still use it`,
      );
    }
    return this.prisma.category.delete({ where: { id } });
  }

  // Throws 409 if another category already uses this name
  private async assertNameFree(name: string, ignoreId?: number) {
    const existing = await this.prisma.category.findUnique({ where: { name } });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(`Category "${name}" already exists`);
    }
  }
}