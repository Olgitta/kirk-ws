// src/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, RedisOptions } from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDevToProd = process.env.NODE_ENV === 'development';

        const redisOptions: RedisOptions = isDevToProd
          ? {
              host: config.get<string>('REDIS_HOST'),
              port: config.get<number>('REDIS_PORT'),
              username: config.get<string>('REDIS_USERNAME'),
              password: config.get<string>('REDIS_PASSWORD'),
              tls: {}, // enables TLS in prod
            }
          : {
              host: config.get<string>('REDIS_HOST'),
              port: config.get<number>('REDIS_PORT'),
            };

        const redis = new Redis(redisOptions);

        redis.on('error', (err) => {
          console.error('Redis Client Error:', err);
        });

        redis.on('connect', () => {
          console.log(
            'Successfully connected to Redis',
            config.get<string>('REDIS_HOST'),
          );
        });

        return redis;
      },
    },
  ],
  exports: ['REDIS_CLIENT'], // Экспортируем токен, чтобы другие модули могли использовать Redis клиент
})
export class RedisModule {}
