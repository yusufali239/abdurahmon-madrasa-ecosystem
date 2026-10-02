import { PaymentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PRICE_TIERS } from '../common/pricing';

export class CreateLessonDto {
  @IsInt()
  subjectId: number;

  @IsOptional()
  @IsInt()
  locationId?: number | null;

  @IsOptional()
  @IsBoolean()
  isContinuous?: boolean;

  @IsInt()
  @Min(1)
  @Max(7)
  weekDay: number;

  @IsString()
  @Length(1, 60)
  startTime: string;

  @IsString()
  @Length(1, 60)
  endTime: string;

  @IsOptional()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, { message: 'Vaqt HH:mm formatida bo\'lsin' })
  startClock?: string | null;

  @IsString()
  @Length(1, 200)
  bookTitle: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  bookTotalPages: number;

  @IsInt()
  @Min(1)
  currentPageFrom: number;

  @IsInt()
  @Min(1)
  currentPageTo: number;

  @IsString()
  @Length(1, 200)
  topic: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  nextTopic?: string | null;

  @IsIn(PRICE_TIERS as unknown as number[], { message: 'Narx 0, 50, 100 yoki 200 bo\'lishi kerak' })
  priceTier: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  customPrice?: number | null;

  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLessonDto implements Partial<CreateLessonDto> {
  @IsOptional() @IsInt() subjectId?: number;
  @IsOptional() @IsInt() locationId?: number | null;
  @IsOptional() @IsBoolean() isContinuous?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(7) weekDay?: number;
  @IsOptional() @IsString() @Length(1, 60) startTime?: string;
  @IsOptional() @IsString() @Length(1, 60) endTime?: string;
  @IsOptional() @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/) startClock?: string | null;
  @IsOptional() @IsString() @Length(1, 200) bookTitle?: string;
  @IsOptional() @IsInt() @Min(1) bookTotalPages?: number;
  @IsOptional() @IsInt() @Min(1) currentPageFrom?: number;
  @IsOptional() @IsInt() @Min(1) currentPageTo?: number;
  @IsOptional() @IsString() @Length(1, 200) topic?: string;
  @IsOptional() @IsString() @Length(0, 200) nextTopic?: string | null;
  @IsOptional() @IsIn(PRICE_TIERS as unknown as number[]) priceTier?: number;
  @IsOptional() @IsInt() @Min(0) customPrice?: number | null;
  @IsOptional() @IsEnum(PaymentType) paymentType?: PaymentType;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** Переход к следующему уроку (продвижение по книге) */
export class AdvanceLessonDto {
  @IsOptional() @IsInt() @Min(1) currentPageFrom?: number;
  @IsOptional() @IsInt() @Min(1) currentPageTo?: number;
  @IsOptional() @IsString() @Length(1, 200) topic?: string;
  @IsOptional() @IsString() @Length(0, 200) nextTopic?: string | null;
}

class AttendanceItem {
  @IsInt() studentId: number;
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']) status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  @IsOptional() @IsString() note?: string;
}

export class SetAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceItem)
  items: AttendanceItem[];

  @IsOptional() @IsBoolean() finish?: boolean;
}

export class CreateGradeDto {
  @IsInt() studentId: number;
  @IsInt() @Min(1) @Max(5) score: number;
  @IsOptional() @IsString() @Length(0, 500) comment?: string;
  @IsOptional() @IsInt() sessionId?: number;
}
