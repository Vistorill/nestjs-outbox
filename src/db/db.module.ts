import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { Global as global, Module as module } from '@nestjs/common';
import { ConfigService as configService } from '@nestjs/config';

export const DRIZLE = Symbol('DRIZLE');

export type Database = ReturnType<typeof createDb>;

function createDb(url: string) {
  const client = postgres(url);
  return drizzle(client, { schema });
}

@global()
@module({
  providers: [
    {
      provide: DRIZLE,
      useFactory: (config: configService) =>
        createDb(config.getOrThrow('DATABASE_URL')),
      inject: [configService],
    },
  ],
  exports: [DRIZLE],
})
export class DbModule {}
