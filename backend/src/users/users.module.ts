import { Module } from '@nestjs/common';
import { UsersBot } from './users.bot';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService, UsersBot],
  exports: [UsersService],
})
export class UsersModule {}
