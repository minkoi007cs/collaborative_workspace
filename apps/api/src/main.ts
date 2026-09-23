import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: config.WEB_ORIGIN });
  app.enableShutdownHooks();
  await app.listen(config.API_PORT);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
