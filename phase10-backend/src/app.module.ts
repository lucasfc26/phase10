import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsModule } from './rooms/rooms.module';
import { GameModule } from './game/game.module';
import { Room, RoomMember } from './rooms/entities/room.entities';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'phase10.db',
      entities: [Room, RoomMember],
      synchronize: true,
    }),
    RoomsModule,
    GameModule,
  ],
})
export class AppModule {}
