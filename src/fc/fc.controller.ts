import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FcService } from './fc.service';
import { CreateFcDto } from './dto/create-fc.dto';
import { UpdateFcDto } from './dto/update-fc.dto';

@Controller('fc')
export class FcController {
  constructor(private readonly fcService: FcService) {}

  @Post()
  create(@Body() createFcDto: CreateFcDto) {
    return ""
  }

  // @Get()
  // findAll() {
  //   return this.fcService.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.fcService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateFcDto: UpdateFcDto) {
  //   return this.fcService.update(+id, updateFcDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.fcService.remove(+id);
  // }
}
