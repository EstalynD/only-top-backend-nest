import { Injectable } from '@nestjs/common';
import type { AuthUser, TokenRecord } from './auth.types.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TokenEntity } from './token.schema.js';


@Injectable()
export class TokenStore {
  constructor(@InjectModel(TokenEntity.name) private readonly tokenModel: Model<TokenEntity>) {}

  async save(rec: TokenRecord): Promise<void> {
    await this.tokenModel.create(rec as any);
  }

  async get(token: string): Promise<TokenRecord | undefined> {
    const doc = await this.tokenModel.findOne({ token }).lean().exec();
    if (!doc) return undefined;
    if (doc.expiresAt <= Math.floor(Date.now() / 1000)) {
      await this.tokenModel.deleteOne({ token }).exec();
      return undefined;
    }
    return doc as unknown as TokenRecord;
  }

  async delete(token: string): Promise<void> {
    await this.tokenModel.deleteOne({ token }).exec();
  }

  async revoke(token: string): Promise<void> {
    await this.tokenModel.updateOne({ token }, { $set: { revoked: true } }).exec();
  }
}
