import { ApiPropertyOptional } from '@nestjs/swagger';
import { OFFER_LIST_VIEWS, type OfferListView } from '@hr-demo/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryOffersDto {
  @ApiPropertyOptional({
    enum: OFFER_LIST_VIEWS,
    default: 'PENDING_SEND',
    description: 'Offer 阶段视图',
  })
  @IsOptional()
  @IsIn(OFFER_LIST_VIEWS)
  view?: OfferListView = 'PENDING_SEND';

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
