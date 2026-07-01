import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

const ACTION_TYPES = [
  'draw',
  'discard',
  'lay_down',
  'hit',
  'next_round',
  'select_character',
  'play_card',
  'call_truco',
  'accept_truco',
  'refuse_truco',
  'fold',
  'check',
  'call',
  'raise',
  'all_in',
  'use_tower_power',
  'use_class_ability',
  'use_legendary',
] as const;

export class GameActionDto {
  @IsString()
  @IsIn(ACTION_TYPES)
  type!: (typeof ACTION_TYPES)[number];

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

  @IsOptional()
  @IsInt()
  expectedStateVersion?: number;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsInt()
  raiseTotal?: number;

  @IsOptional()
  @IsBoolean()
  copyMode?: boolean;

  @IsOptional()
  @IsString()
  copiedPowerId?: string;

  @IsOptional()
  @IsString()
  chosenColor?: string;

  @IsOptional()
  @IsString()
  ownCardId?: string;

  @IsOptional()
  @IsString()
  discardRecoveryId?: string;

  @IsOptional()
  @IsString()
  reciclagemDiscardId?: string;

  @IsOptional()
  @IsArray()
  segundaChanceDiscardIds?: string[];

  @IsOptional()
  @IsArray()
  generalCardIds?: string[];

  @IsOptional()
  @IsString()
  alchemistCardId?: string;
}
