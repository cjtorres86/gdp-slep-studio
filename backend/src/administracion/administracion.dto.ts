import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { RolPortal } from '../usuarios/entities/usuario.entity';

const ROLES: RolPortal[] = ['usuario', 'admin', 'superadmin'];

export class AccesoDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  aplicacionId: string;

  @IsString() @IsNotEmpty() @MaxLength(60)
  rol: string;

  @IsArray() @ArrayMaxSize(40) @IsString({ each: true })
  alcance: string[];

  @IsOptional() @IsObject()
  opciones?: Record<string, boolean>;
}

class CamposPersona {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  nombreParaMostrar?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60)
  usuario?: string;

  // Vacío = sin RUT.
  @IsOptional() @IsString() @MaxLength(14)
  rut?: string;

  @IsOptional() @IsIn(ROLES)
  rolPortal?: RolPortal;

  // Mínimo 8 caracteres para cualquier clave nueva que se ponga desde el portal.
  @IsOptional() @IsString() @MinLength(8, { message: 'La clave debe tener al menos 8 caracteres.' }) @MaxLength(200)
  contrasena?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => AccesoDto)
  accesos?: AccesoDto[];
}

export class CrearPersonaDto extends CamposPersona {
  @IsString() @IsNotEmpty() @MaxLength(120)
  declare nombreParaMostrar: string;
}

export class EditarPersonaDto extends CamposPersona {}

export class CambiarEstadoDto {
  @IsBoolean()
  activo: boolean;
}
