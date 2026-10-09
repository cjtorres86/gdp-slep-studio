import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Detrás del proxy de Render, sin esto la IP de cada persona sería
  // siempre la del proxy (la necesitará la bitácora central).
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  const origenes = (process.env.FRONTEND_URL ?? 'http://localhost:4300').split(',').map((s) => s.trim());
  app.enableCors({ origin: origenes });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const puerto = Number(process.env.PORT ?? 3100);
  await app.listen(puerto);
  console.log(`GDP-SLEP Studio (portal) backend corriendo en http://localhost:${puerto}`);
}
bootstrap();
