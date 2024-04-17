import { PartialType } from '@nestjs/mapped-types';
import { CreateFcDto } from './create-fc.dto';

export class UpdateFcDto extends PartialType(CreateFcDto) {}
