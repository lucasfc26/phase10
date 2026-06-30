import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(18, { message: 'O nome pode ter no máximo 18 caracteres.' })
  name!: string;

  @IsString()
  avatar!: string;

  @IsString()
  color!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  password?: string;
}
