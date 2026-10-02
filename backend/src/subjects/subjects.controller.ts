import { Controller, Get, UseGuards } from '@nestjs/common';
import { TelegramGuard } from '../auth/guards';
import { SubjectsService } from './subjects.service';

@Controller('subjects')
@UseGuards(TelegramGuard)
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  list() {
    return this.subjects.list();
  }
}
