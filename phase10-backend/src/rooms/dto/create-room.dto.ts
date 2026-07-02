import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(1)
  @MaxLength(18, { message: 'O nome pode ter no máximo 18 caracteres.' })
  name!: string;

  @IsString()
  avatar!: string;

  @IsString()
  color!: string;

  @IsInt()
  @Min(2)
  @Max(10)
  maxPlayers!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  password?: string;

  @IsOptional()
  @IsBoolean()
  allowBots?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600_000)
  botDelay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600_000)
  drawTimeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600_000)
  discardTimeoutMs?: number;

  @IsOptional()
  @IsIn(['phase10', 'truco', 'poker', 'tower_master'])
  cardGame?: 'phase10' | 'truco' | 'poker' | 'tower_master';
}
