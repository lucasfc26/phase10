import { IsArray, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class GameActionDto {
  @IsString()
  type!: 'draw' | 'discard' | 'lay_down' | 'hit' | 'next_round';

  @IsOptional()
  @IsIn(['draw', 'discard'])
  source?: 'draw' | 'discard';

  @IsOptional()
  @IsString()
  cardId?: string;

  @IsOptional()
  @IsString()
  skipPlayerId?: string;

  @IsOptional()
  @IsArray()
  group1CardIds?: string[];

  @IsOptional()
  @IsArray()
  group2CardIds?: string[];

  @IsOptional()
  @IsString()
  targetPlayerId?: string;

  @IsOptional()
  @IsInt()
  groupIndex?: number;
}
