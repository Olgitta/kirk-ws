// src/events.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

// Определяем интерфейс для объекта сообщения, отправляемого клиенту
interface SocketIOMessage {
  pattern: string;
  channel: string;
  message: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private redisSubscriber: Redis; // Клиент Redis для подписки

  // Мапа для сопоставления паттернов Redis с именами событий Socket.IO
  // Ключ: паттерн Redis, Значение: имя события Socket.IO
  private readonly appEvents: Record<string, string> = {
    'seat:events:*_*': 'seat_events',
    'login:*:event:*': 'login_events',
    // Добавь другие паттерны и соответствующие им имена событий по мере необходимости
  };

  constructor(@Inject('REDIS_CLIENT') private redisClient: Redis) {
    this.redisSubscriber = redisClient.duplicate();
  }

  afterInit(server: Server) {
    console.log('WebSocket Gateway initialized');

    // Подписка на все паттерны, определенные в appEvents
    Object.keys(this.appEvents).forEach(pattern => {
      this.redisSubscriber.psubscribe(pattern, (err, count) => {
        if (err) {
          console.error(`Failed to pattern subscribe to '${pattern}':`, err.message);
        } else {
          console.log(
            `Pattern subscribed to ${count} channel(s) with pattern: ${pattern}`,
          );
        }
      });
    });

    // Обработчик для сообщений, приходящих из обычных SUBSCRIBE каналов (если таковые используются)
    // В данном случае, мы сосредоточены на pmessage, поэтому этот обработчик может быть опциональным,
    // если все сообщения приходят через паттерны.
    this.redisSubscriber.on('message', (channel, message) => {
      console.log(
        `Received message from Redis channel '${channel}': ${message}`,
      );
      // Возможно, здесь тоже нужно использовать мапу или дефолтное имя события Socket.IO
      this.server.emit('default_redis_message', message); // Пример: отправка на дефолтный канал
    });

    // Обработчик для сообщений, приходящих из PSUBSCRIBE паттернов
    this.redisSubscriber.on('pmessage', (pattern, channel, message) => {
      console.log(
        `Received message from Redis: Pattern '${pattern}', Channel '${channel}', Message: '${message}'`,
      );

      // Получаем имя события Socket.IO из мапы по паттерну Redis
      const socketEventName = this.appEvents[pattern];

      if (socketEventName) {
        // Отправляем сообщение всем подключенным клиентам на соответствующий канал Socket.IO
        // Отправляем исходные pattern, channel, message без дополнительной обработки
        this.server.emit(socketEventName, { pattern, channel, message });
        console.log(`Emitting to '${socketEventName}' for pattern '${pattern}'.`);
      } else {
        // Если паттерн не найден в мапе, можно отправить на дефолтный канал или проигнорировать
        console.warn(`No Socket.IO event name defined for pattern '${pattern}'. Emitting to 'unknown_event_type'.`);
        this.server.emit('unknown_event_type', { pattern, channel, message });
      }
    });
  }

  // client connected
  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  // client disconnected
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // exampl hendling message from client ()
  @SubscribeMessage('message_from_client')
  handleMessage(@MessageBody() data: string): string {
    console.log(`Message from client ${data}`);
    return `Server received: ${data}`; // return response to a client
  }
}