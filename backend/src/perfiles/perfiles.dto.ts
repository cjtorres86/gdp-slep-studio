import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

class RestriccionesDto {
  @IsBoolean() exigeSlep: boolean;
  @IsIn(['siempre', 'opcional_si', 'opcional_no', 'nunca']) carga: 'siempre' | 'opcional_si' | 'opcional_no' | 'nunca';
  @IsBoolean() cargaSoloSuperadmin: boolean;
}

class CamposPerfil {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(200)
  descripcion?: string;

  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'El color debe tener el formato #RRGGBB.' })
  color?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true })
  permisos?: string[];

  @IsOptional() @ValidateNested() @Type(() => RestriccionesDto)
  restricciones?: RestriccionesDto;
}

export class CrearPerfilDto extends CamposPerfil {
  @IsString() @IsNotEmpty() @MaxLength(60)
  aplicacionId: string;

  @IsString() @MinLength(2) @MaxLength(60)
  declare nombre: string;
}

export class EditarPerfilDto extends CamposPerfil {}
