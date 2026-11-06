import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
