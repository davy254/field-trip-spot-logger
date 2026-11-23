import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(spotId: number, dto: CreateVisitDto, userId: number) {
    await this.assertSpotExists(spotId);

    const existing = await this.prisma.visit.findUnique({
      where: { spotId_userId: { spotId, userId } },
    });
    if (existing) {
      throw new ConflictException(
        'You have already logged a visit to this spot. Update it instead.',
      );
    }

    return this.prisma.visit.create({ data: { ...dto, spotId, userId } });
  }

  async findForSpot(spotId: number) {
    await this.assertSpotExists(spotId);
    return this.prisma.visit.findMany({
      where: { spotId },
      select: {
        id: true,
        rating: true,
        note: true,
        visitedAt: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { visitedAt: 'desc' },
    });
  }

  async update(id: number, dto: UpdateVisitDto, user: AuthUser) {
    const visit = await this.findVisit(id);
    if (visit.userId !== user.id) {
      throw new ForbiddenException('You can only edit your own visits');
    }
    return this.prisma.visit.update({ where: { id }, data: dto });
  }

  async remove(id: number, user: AuthUser) {
    const visit = await this.findVisit(id);
    if (visit.userId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own visits');
    }
    return this.prisma.visit.delete({ where: { id } });
  }

  private async findVisit(id: number) {
    const visit = await this.prisma.visit.findUnique({ where: { id } });
    if (!visit) {
      throw new NotFoundException(`Visit with id ${id} not found`);
    }
    return visit;
  }

  private async assertSpotExists(spotId: number) {
    const spot = await this.prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) {
      throw new NotFoundException(`Spot with id ${spotId} not found`);
    }
  }
}