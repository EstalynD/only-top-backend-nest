/*
  Script: Crear/actualizar administrador
  Uso:
    node dist/scripts/create-admin.js --username admin --password secret
  Variables:
    MONGO_URI (opcional) - si no se define, usa mongodb://127.0.0.1:27017/onlytop
*/
import mongoose, { connect, model } from 'mongoose';
import { UserEntity, UserSchema } from '../users/user.schema.js';
import { createHash } from 'crypto';

function hashPassword(pw: string): string {
  // Hash simple con SHA-256 para placeholder; en producción usar bcrypt/argon2
  return createHash('sha256').update(pw).digest('hex');
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const username = args.username || args.user || 'admin';
  const password = args.password || args.pw || 'admin123';
  // Usar el mismo valor por defecto que DatabaseModule
  const uri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/onlytop-v2';

  if (!username || !password) {
    console.error('Debe proporcionar --username y --password');
    process.exit(1);
  }

  console.log(`[create-admin] Conectando a MongoDB: ${uri}`);
  await connect(uri);
  console.log(`[create-admin] Conectado. Base de datos: ${mongoose.connection.name}`);
  const UserModel = model<UserEntity>('UserEntity', UserSchema);
  await UserModel.init(); // asegura índices (p.ej., unique username)
  console.log(`[create-admin] Colección destino: ${UserModel.collection.name}`);

  const passwordHash = hashPassword(password);
  const adminData = {
    username,
    passwordHash,
    roles: ['ADMIN_GLOBAL'],
    permissions: ['system.admin'],
  };

  const existing = await UserModel.findOne({ username }).exec();
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.roles = Array.from(new Set([...(existing.roles ?? []), 'ADMIN_GLOBAL']));
    existing.permissions = Array.from(new Set([...(existing.permissions ?? []), 'system.admin']));
    await existing.save();
    console.log(`Administrador actualizado: ${username}`);
  } else {
    await UserModel.create(adminData);
    console.log(`Administrador creado: ${username}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
