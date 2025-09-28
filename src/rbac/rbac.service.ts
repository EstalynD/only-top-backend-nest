import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoleEntity, type RoleDocument } from './role.schema.js';
import { UsersService } from '../users/users.service.js';
import { PERMISSIONS, ROLES } from './rbac.constants.js';
import { UserEntity, type UserDocument } from '../users/user.schema.js';

@Injectable()
export class RbacService {
  constructor(
    @InjectModel(RoleEntity.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(UserEntity.name) private readonly userModel: Model<UserDocument>,
    private readonly usersService: UsersService,
  ) {}

  // Catálogo de permisos del sistema (estático)
  getPermissionsCatalog() {
    return PERMISSIONS;
  }

  // Seed opcional de roles estáticos definidos en código
  async ensureSeedRoles(): Promise<void> {
    for (const r of ROLES) {
      await this.roleModel.updateOne(
        { key: r.key },
        { $setOnInsert: { key: r.key, name: r.name, permissions: r.permissions, meta: r.meta ?? {} } },
        { upsert: true },
      );
    }
  }

  // CRUD Roles
  async createRole(data: { key: string; name: string; permissions?: string[]; meta?: Record<string, any> }) {
    if (!data || typeof data !== 'object') throw new BadRequestException('Body requerido');
    if (!data.key || !data.name) throw new BadRequestException('key y name son requeridos');
    const key = String(data.key).trim().toUpperCase();
    const name = String(data.name).trim();
    const catalog = new Set(this.getPermissionsCatalog().map((p) => p.key));
    const permissions = Array.isArray(data.permissions)
      ? data.permissions.filter((p) => typeof p === 'string').map((p) => p.trim()).filter(Boolean)
      : [];
    const invalid = permissions.filter((p) => !catalog.has(p));
    if (invalid.length) throw new BadRequestException(`Permisos inválidos: ${invalid.join(', ')}`);

    const exists = await this.roleModel.findOne({ key }).lean().exec();
    if (exists) throw new BadRequestException('El role.key ya existe');
    const doc = await this.roleModel.create({ key, name, permissions, meta: data.meta ?? {} });
    return doc.toObject();
  }

  async listRoles() {
    return this.roleModel.find().lean().exec();
  }

  async getRole(key: string) {
    const role = await this.roleModel.findOne({ key }).lean().exec();
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  async updateRole(key: string, data: Partial<Pick<RoleEntity, 'name' | 'permissions' | 'meta'>>) {
    const patch: any = {};
    if (data && typeof data === 'object') {
      if (typeof data.name === 'string') patch.name = data.name.trim();
      if (Array.isArray(data.permissions)) {
        const catalog = new Set(this.getPermissionsCatalog().map((p) => p.key));
        const permissions = data.permissions.filter((p) => typeof p === 'string').map((p) => p.trim()).filter(Boolean);
        const invalid = permissions.filter((p) => !catalog.has(p));
        if (invalid.length) throw new BadRequestException(`Permisos inválidos: ${invalid.join(', ')}`);
        patch.permissions = permissions;
      }
      if (data.meta && typeof data.meta === 'object') patch.meta = data.meta;
    }
    const updated = await this.roleModel.findOneAndUpdate({ key }, { $set: patch }, { new: true, lean: true }).exec();
    if (!updated) throw new NotFoundException('Rol no encontrado');
    return updated;
  }

  async deleteRole(key: string) {
    const res = await this.roleModel.deleteOne({ key }).exec();
    return { deletedCount: res.deletedCount ?? 0 };
  }

  // Asignación de roles a usuario
  async assignRolesToUser(userId: string, rolesToAdd: string[]) {
    // Validar roles existen (en colección o en ROLES estáticos)
    const found = await this.roleModel.find({ key: { $in: rolesToAdd } }).lean().exec();
    const staticKeys = new Set(ROLES.map((r) => r.key));
    const ok = rolesToAdd.every((k) => found.some((f) => f.key === k) || staticKeys.has(k));
    if (!ok) throw new BadRequestException('Alguno de los roles no existe');

    // Cargar usuario, mergear roles y recomputar permisos efectivos
    const user = await this.usersService.getById(userId);
    const roles = Array.from(new Set([...(user.roles ?? []), ...rolesToAdd]));
    const permissions = await this.computeEffectivePermissions(roles, user.permissions ?? []);

    // Guardar
    await this.userModel.findByIdAndUpdate(userId, { $set: { roles, permissions } }).exec();
    return { roles, permissions };
  }

  async revokeRolesFromUser(userId: string, rolesToRemove: string[]) {
    const user = await this.usersService.getById(userId);
    const roles = (user.roles ?? []).filter((r) => !rolesToRemove.includes(r));
    const permissions = await this.computeEffectivePermissions(roles, user.permissions ?? []);
    await this.userModel.findByIdAndUpdate(userId, { $set: { roles, permissions } }).exec();
    return { roles, permissions };
  }

  // Otorgar o quitar permisos directos (además de los heredados por roles)
  async grantPermissionsToUser(userId: string, directPermsToAdd: string[]) {
    const user = await this.usersService.getById(userId);
    const direct = Array.from(new Set([...(user.permissions ?? []), ...directPermsToAdd]));
    const permissions = await this.computeEffectivePermissions(user.roles ?? [], direct);
    await this.userModel.findByIdAndUpdate(userId, { $set: { permissions } }).exec();
    return { permissions };
  }

  async revokePermissionsFromUser(userId: string, directPermsToRemove: string[]) {
    const user = await this.usersService.getById(userId);
    const direct = (user.permissions ?? []).filter((p) => !directPermsToRemove.includes(p));
    const permissions = await this.computeEffectivePermissions(user.roles ?? [], direct);
    await this.userModel.findByIdAndUpdate(userId, { $set: { permissions } }).exec();
    return { permissions };
  }

  // Calcula permisos efectivos: union(directos, de cada rol)
  async computeEffectivePermissions(roles: string[], direct: string[]) {
    const roleDocs = await this.roleModel.find({ key: { $in: roles } }).lean().exec();
    const staticMap = new Map(ROLES.map((r) => [r.key, r.permissions] as const));
    const fromRoles = roles.flatMap((k) => roleDocs.find((d) => d.key === k)?.permissions ?? staticMap.get(k) ?? []);
    const effective = Array.from(new Set([...(direct ?? []), ...fromRoles]));
    return effective;
  }
}
