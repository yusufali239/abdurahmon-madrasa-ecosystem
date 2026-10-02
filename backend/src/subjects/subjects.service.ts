import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SubjectInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ'‘’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.subject.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { lessons: { where: { isActive: true } }, teachers: true } } },
    });
  }

  create(dto: SubjectInput) {
    return this.prisma.subject.create({ data: { ...dto, slug: dto.slug || slugify(dto.name) } });
  }

  update(id: number, dto: Partial<SubjectInput>) {
    return this.prisma.subject.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.subject.delete({ where: { id } });
  }
}
