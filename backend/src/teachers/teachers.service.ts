import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationDto, UpdateTeacherProfileDto } from './teachers.dto';

/** Определить провайдера карты по ссылке */
export function detectProvider(url: string): 'TWOGIS' | 'YANDEX' | 'GOOGLE' | null {
  if (/2gis\./i.test(url)) return 'TWOGIS';
  if (/yandex\./i.test(url)) return 'YANDEX';
  if (/google\.|goo\.gl/i.test(url)) return 'GOOGLE';
  return null;
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async requireTeacher(userId: number) {
    const t = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!t) throw new ForbiddenException('Ustoz profili topilmadi');
    return t;
  }

  list(subjectId?: number) {
    return this.prisma.teacher.findMany({
      where: { user: { status: 'APPROVED' }, subjects: subjectId ? { some: { id: subjectId } } : undefined },
      include: {
        user: { select: { fullName: true, username: true } },
        subjects: true,
        _count: { select: { lessons: { where: { isActive: true } } } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async get(id: number) {
    const t = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, username: true } },
        subjects: true,
        locations: true,
        lessons: { where: { isActive: true }, include: { subject: true, location: true }, orderBy: { weekDay: 'asc' } },
      },
    });
    if (!t) throw new NotFoundException('Ustoz topilmadi');
    return t;
  }

  async me(userId: number) {
    const t = await this.requireTeacher(userId);
    return this.prisma.teacher.findUnique({
      where: { id: t.id },
      include: {
        user: true,
        subjects: true,
        locations: { orderBy: { id: 'asc' } },
        donationFund: true,
        lessons: {
          include: { subject: true, location: true, _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } },
          orderBy: [{ weekDay: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }

  async updateProfile(userId: number, dto: UpdateTeacherProfileDto) {
    const t = await this.requireTeacher(userId);
    return this.prisma.teacher.update({
      where: { id: t.id },
      data: {
        telegramPhone: dto.telegramPhone?.replace(/[\s-]/g, ''),
        mbankNumber: dto.mbankNumber?.replace(/[\s-]/g, ''),
        bio: dto.bio,
        subjects: dto.subjectIds ? { set: dto.subjectIds.map((id) => ({ id })) } : undefined,
      },
      include: { subjects: true },
    });
  }

  async addLocation(userId: number, dto: LocationDto) {
    const t = await this.requireTeacher(userId);
    return this.prisma.teacherLocation.create({
      data: { ...dto, provider: detectProvider(dto.map_url) ?? dto.provider, teacherId: t.id },
    });
  }

  async updateLocation(userId: number, id: number, dto: Partial<LocationDto>) {
    await this.ownLocation(userId, id);
    return this.prisma.teacherLocation.update({ where: { id }, data: dto });
  }

  async removeLocation(userId: number, id: number) {
    await this.ownLocation(userId, id);
    return this.prisma.teacherLocation.delete({ where: { id } });
  }

  private async ownLocation(userId: number, id: number) {
    const t = await this.requireTeacher(userId);
    const loc = await this.prisma.teacherLocation.findUnique({ where: { id } });
    if (!loc || loc.teacherId !== t.id) throw new NotFoundException('Manzil topilmadi');
    return loc;
  }
}
