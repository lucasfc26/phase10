import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { OnlineGameService } from './online-game.service';

@Module({
  providers: [GameService, OnlineGameService],
  exports: [GameService, OnlineGameService],
})
export class GameModule {}
