import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RegistrationHandler } from '../bot/handlers/registration.handler';
import { MenuService } from '../bot/menu.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menu: MenuService,
    private readonly registration: RegistrationHandler,
  ) {}

  list(filter: { status?: string; role?: string; q?: string }) {
    return this.prisma.user.findMany({
      where: {
        status: (filter.status as any) || undefined,
        role: (filter.role as any) || undefined,
        regStep: filter.status === 'PENDING' ? 'DONE' : undefined,
        OR: filter.q
          ? [
              { fullName: { contains: filter.q, mode: 'insensitive' } },
              { phone: { contains: filter.q } },
              { passportId: { contains: filter.q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { teacher: { include: { subjects: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  /** Подтверждение пользователя. Для учителя создаётся профиль и личный фонд. */
  async approve(userId: number, role?: Role) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.regStep !== 'DONE') throw new BadRequestException('Ro\'yxatdan o\'tish yakunlanmagan');
    const finalRole = role ?? user.role;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'APPROVED', role: finalRole, approvedAt: new Date() },
    });
    if (finalRole === 'TEACHER') await this.ensureTeacher(userId);
    await this.menu.show(updated, false, '🎉 <b>Arizangiz tasdiqlandi!</b> Madrasamizga xush kelibsiz.');
    return updated;
  }

  async ensureTeacher(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const teacher = await this.prisma.teacher.upsert({
      where: { userId },
      update: {},
      create: { userId, telegramPhone: user.phone || '', mbankNumber: user.phone || '' },
    });
    await this.prisma.donationFund.upsert({
      where: { teacherId: teacher.id },
      update: {},
      create: { teacherId: teacher.id },
    });
    return teacher;
  }

  async reject(userId: number) {
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { status: 'REJECTED' } });
    await this.registration.prompt(updated);
    return updated;
  }

  async setStatus(userId: number, status: 'APPROVED' | 'BLOCKED' | 'REJECTED') {
    if (status === 'APPROVED') return this.approve(userId);
    if (status === 'REJECTED') return this.reject(userId);
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { status } });
    await this.registration.prompt(updated);
    return updated;
  }

  async setRole(userId: number, role: Role) {
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { role } });
    if (role === 'TEACHER') await this.ensureTeacher(userId);
    return updated;
  }
}
