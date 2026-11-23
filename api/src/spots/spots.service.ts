import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpotDto } from './dto/create-spot.dto';
import { UpdateSpotDto } from './dto/update-spot.dto';

@Injectable()
export class SpotsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSpotDto) {
    await this.assertCategoryExists(dto.categoryId);
    await this.assertUserExists(dto.createdById);
    return this.prisma.spot.create({
      data: dto,
      include: { category: true },
    });
  }

  async findAll(params: {
    categoryId?: number;
    search?: string;
    page: number;
    limit: number;
  }) {
    const page = Math.max(1, params.page);
    const limit = Math.min(100, Math.max(1, params.limit));

    const where: Prisma.SpotWhereInput = {};
    if (params.categoryId) {
      where.categoryId = params.categoryId;
    }
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.spot.findMany({
        where,
        include: { category: true },
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.spot.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const spot = await this.prisma.spot.findUnique({
      where: { id },
      include: {
        category: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!spot) {
      throw new NotFoundException(`Spot with id ${id} not found`);
    }

    const ratings = await this.prisma.visit.aggregate({
      where: { spotId: id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      ...spot,
      averageRating: ratings._avg.rating,
      visitCount: ratings._count.rating,
    };
  }

  async update(id: number, dto: UpdateSpotDto) {
    await this.findOne(id);
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }
    return this.prisma.spot.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.spot.delete({ where: { id } });
  }

  private async assertCategoryExists(categoryId: number) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }
  }

  private async assertUserExists(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
  }
}