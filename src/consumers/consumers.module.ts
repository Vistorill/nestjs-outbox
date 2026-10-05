import { Module } from "@nestjs/common";
import { OrderCreatedConsumer } from "./order.created.consumers";


@Module({
    providers: [OrderCreatedConsumer]
})
export class ConsumersModule {}