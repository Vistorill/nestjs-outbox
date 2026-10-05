import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createOrderSchema = z.object({
  customerEmail: z.email(),
  amount: z.number().positive(),
});

export class CreateOrderDto extends createZodDto(createOrderSchema) {}
