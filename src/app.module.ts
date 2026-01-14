import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { CepModule } from './cep/cep.module';

@Module({
  imports: [
    // Carrega .env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Banco de dados (Supabase)
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      schema: process.env.DB_SCHEMA,
      ssl: {
        rejectUnauthorized: false,
      },
      autoLoadEntities: true,
      synchronize: false, // NUNCA true em produção
    }),

    // Módulos da aplicação
    CepModule,
  ],
})
export class AppModule {}
