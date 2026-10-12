import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ResultadoBusqueda } from './entities/busqueda.entity';

export class RegistrarBusquedaDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  texto: string;

  @IsOptional() @IsString() @MaxLength(60)
  aplicacionId?: string | null;

  @IsIn(['abrir', 'proximamente', 'sin_autorizacion', 'sin_resultados'])
  resultado: ResultadoBusqueda;
}
