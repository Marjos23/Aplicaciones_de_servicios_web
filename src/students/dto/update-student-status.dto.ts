import { IsBoolean } from 'class-validator';

export class UpdateStudentStatusDto {
  @IsBoolean()
  isActive: boolean;
}
