import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, Roles, TelegramGuard } from '../auth/guards';
import { LocationDto, UpdateTeacherProfileDto } from './teachers.dto';
import { TeachersService } from './teachers.service';

@Controller('teachers')
@UseGuards(TelegramGuard)
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  list(@Query('subjectId') subjectId?: string) {
    return this.teachers.list(subjectId ? Number(subjectId) : undefined);
  }

  @Get('me')
  @Roles('TEACHER')
  me(@CurrentUser() user: User) {
    return this.teachers.me(user.id);
  }

  @Patch('me')
  @Roles('TEACHER')
  update(@CurrentUser() user: User, @Body() dto: UpdateTeacherProfileDto) {
    return this.teachers.updateProfile(user.id, dto);
  }

  @Post('me/locations')
  @Roles('TEACHER')
  addLocation(@CurrentUser() user: User, @Body() dto: LocationDto) {
    return this.teachers.addLocation(user.id, dto);
  }

  @Patch('me/locations/:id')
  @Roles('TEACHER')
  updateLocation(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() dto: LocationDto) {
    return this.teachers.updateLocation(user.id, id, dto);
  }

  @Delete('me/locations/:id')
  @Roles('TEACHER')
  removeLocation(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.teachers.removeLocation(user.id, id);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.teachers.get(id);
  }
}
