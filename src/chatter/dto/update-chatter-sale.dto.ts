import { PartialType } from '@nestjs/mapped-types';
import { CreateChatterSaleDto } from './create-chatter-sale.dto.js';

export class UpdateChatterSaleDto extends PartialType(CreateChatterSaleDto) {}

