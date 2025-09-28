export type ModuleKey =
  | 'sistema'
  | 'rrhh'
  | 'finanzas'
  | 'cartera'
  | 'ventas'
  | 'chatting'
  | 'traffic'
  | 'clientes'
  | 'dashboard';

export interface PermissionDef {
  key: string; // ej: sistema.usuarios.ver
  name: string; // ej: Ver usuarios
  module: ModuleKey; // ej: sistema
}

// Catálogo centralizado de permisos
export const PERMISSIONS: PermissionDef[] = [
  // Permiso global solicitado
  { key: 'system.admin', name: 'Administrador del sistema', module: 'sistema' },
  // Algunos ejemplos base mínimos
  { key: 'dashboard.general.ver', name: 'Ver dashboard general', module: 'dashboard' },
  { key: 'sistema.perfil.ver', name: 'Ver perfil', module: 'sistema' },
];

// Alias de permisos (equivalencias)
export const PERMISSION_ALIASES: Record<string, string> = {
  'traffic.campañas.crear': 'traffic.campaigns.crear',
};

export interface RoleMeta {
  department?: string;
  level?: number;
  color?: string;
}

export interface RoleDef {
  key: string; // ej: ADMIN_GLOBAL
  name: string; // ej: Administrador Global
  permissions: string[]; // keys de permisos
  meta?: RoleMeta;
}

export const ROLES: RoleDef[] = [
  {
    key: 'ADMIN_GLOBAL',
    name: 'Administrador Global',
    permissions: ['system.admin'],
    meta: { department: 'sistema', level: 100, color: '#ff4757' },
  },
  {
    key: 'USUARIO_NORMAL',
    name: 'Usuario Normal',
    permissions: ['dashboard.general.ver', 'sistema.perfil.ver'],
    meta: { department: 'general', level: 1, color: '#2ed573' },
  },
];
