import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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
  @Min(3)
  @Max(10)
  maxPlayers!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  password?: string;

  @IsOptional()
  @IsBoolean()
  allowBots?: boolean;
}
