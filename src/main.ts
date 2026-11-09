import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SaldoInsuficienteFilter } from './common/filtros/saldo-insuficiente.filter';

async function bootstrap(): Promise<void> {
  // rawBody: mantém req.rawBody (Buffer) junto com o body já parseado -- necessário pro
  // Auth Hook do Supabase (src/supabase-hooks/) verificar a assinatura HMAC sobre o
  // corpo EXATO que foi enviado, sem reserializar.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.useGlobalFilters(new SaldoInsuficienteFilter());

  // Nunca CORS aberto em produção (docs/SEGURANCA.md) -- allowlist explícita via env.
  const origensPermitidas = config
    .getOrThrow<string>('APP_ALLOWED_ORIGINS')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origensPermitidas,
    credentials: true,
  });

  // whitelist+forbidNonWhitelisted: qualquer campo fora do DTO é rejeitado, não
  // silenciosamente ignorado -- fecha a porta de mass assignment na entrada da API.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const porta = config.get<string>('PORT') ?? '3002';
  await app.listen(porta);
}

bootstrap();
