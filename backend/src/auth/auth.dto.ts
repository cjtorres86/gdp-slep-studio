import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  usuario: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  contrasena: string;
}
