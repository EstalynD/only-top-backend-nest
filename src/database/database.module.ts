import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

const uri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/onlytop-v2';

@Module({
  imports: [MongooseModule.forRoot(uri)],
  exports: [MongooseModule],
})
export class DatabaseModule {}
