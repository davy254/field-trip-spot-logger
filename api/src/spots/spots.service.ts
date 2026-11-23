import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpotDto } from './dto/create-spot.dto';
import { UpdateSpotDto } from './dto/update-spot.dto';

@Injectable()
export class SpotsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSpotDto, userId: number) {
    await this.assertCategoryExists(dto.categoryId);
    await this.assertUserExists(userId);
    return this.prisma.spot.create({
      data: { ...dto, createdById: userId },
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

  async update(id: number, dto: UpdateSpotDto, user: AuthUser) {
    await this.assertCanModify(id, user);
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }
    return this.prisma.spot.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  async remove(id: number, user: AuthUser) {
    await this.assertCanModify(id, user);
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
  // 404 if missing, 403 if the user is neither the owner nor an admin
  private async assertCanModify(id: number, user: AuthUser) {
    const spot = await this.prisma.spot.findUnique({ where: { id } });
    if (!spot) {
      throw new NotFoundException(`Spot with id ${id} not found`);
    }
    if (user.role !== Role.ADMIN && spot.createdById !== user.id) {
      throw new ForbiddenException('You can only modify your own spots');
    }
  }
}

