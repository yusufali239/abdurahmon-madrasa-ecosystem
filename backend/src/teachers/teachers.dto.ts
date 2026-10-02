import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';
import { MapProvider } from '@prisma/client';

const PHONE_RE = /^\+?\d[\d\s-]{7,16}$/;

export class UpdateTeacherProfileDto {
  @IsOptional()
  @Matches(PHONE_RE, { message: 'Telegram raqami noto\'g\'ri' })
  telegramPhone?: string;

  @IsOptional()
  @Matches(PHONE_RE, { message: 'MBank raqami noto\'g\'ri' })
  mbankNumber?: string;

  /** Необязательная ссылка на перевод в MBank */
  @IsOptional()
  @IsString()
  @Length(0, 500)
  mbankLink?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  subjectIds?: number[];
}

export class LocationDto {
  @IsString()
  @Length(2, 120)
  title: string;

  @IsString()
  @Length(2, 300)
  address: string;

  @IsUrl({ require_protocol: true }, { message: 'Xarita havolasi noto\'g\'ri' })
  map_url: string;

  @IsOptional()
  @IsNumber()
  lat?: number | null;

  @IsOptional()
  @IsNumber()
  lng?: number | null;

  @IsEnum(MapProvider)
  provider: MapProvider;
}
