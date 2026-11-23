import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateSpotDto } from './create-spot.dto';

export class UpdateSpotDto extends PartialType(
  OmitType(CreateSpotDto, ['createdById'] as const),
) {}