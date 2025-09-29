import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserEntity, type UserDocument } from './user.schema.js';
import { createHash } from 'crypto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(UserEntity.name) private readonly userModel: Model<UserDocument>) {}

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Usuario no encontrado');
    const user = await this.userModel.findById(id).lean().exec();
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async updateProfile(id: string, data: Partial<Pick<UserEntity, 'displayName' | 'email' | 'avatarUrl'>>) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Usuario no encontrado');
    const updated = await this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { displayName: data.displayName ?? null, email: data.email ?? null, avatarUrl: data.avatarUrl ?? null } },
        { new: true, lean: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Usuario no encontrado');
    return updated;
  }

  async searchUsers(params: { q?: string; page: number; limit: number }) {
    const { q, page, limit } = params;
    const filter: any = {};
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { username: regex },
        { displayName: regex },
        { email: regex },
      ];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  async createUser(data: { username: string; password: string; displayName?: string | null; email?: string | null }) {
    const username = String(data.username || '').trim();
    const password = String(data.password || '');
    if (!username || !password) {
      throw new Error('username y password son requeridos');
    }
    const exists = await this.userModel.findOne({ username }).lean().exec();
    if (exists) {
      throw new Error('El usuario ya existe');
    }
    const passwordHash = createHash('sha256').update(password).digest('hex');
    const doc = await this.userModel.create({
      username,
      passwordHash,
      displayName: data.displayName ?? null,
      email: data.email ?? null,
      roles: [],
      permissions: [],
    });
    const { passwordHash: _, ...obj } = doc.toObject();
    return obj;
  }
}
