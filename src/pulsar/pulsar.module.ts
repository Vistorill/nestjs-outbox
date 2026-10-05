import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Pulssar from 'pulsar-client';

export const PULSAR_CLIENT = 'PULSAR_CLIENT';


@Global()
@Module({
  providers: [
    {
      provide: PULSAR_CLIENT,
      useFactory: (config: ConfigService) =>
        new Pulssar.Client({
          serviceUrl: config.getOrThrow<string>('PULSAR_URL'),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [PULSAR_CLIENT],
})
export class PulsarModule {}