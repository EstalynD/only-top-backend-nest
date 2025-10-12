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
  
  // Permisos RRHH - Áreas
  { key: 'rrhh:areas:create', name: 'Crear áreas RRHH', module: 'rrhh' },
  { key: 'rrhh:areas:read', name: 'Ver áreas RRHH', module: 'rrhh' },
  { key: 'rrhh:areas:update', name: 'Actualizar áreas RRHH', module: 'rrhh' },
  { key: 'rrhh:areas:delete', name: 'Eliminar áreas RRHH', module: 'rrhh' },
  
  // Permisos RRHH - Cargos
  { key: 'rrhh:cargos:create', name: 'Crear cargos RRHH', module: 'rrhh' },
  { key: 'rrhh:cargos:read', name: 'Ver cargos RRHH', module: 'rrhh' },
  { key: 'rrhh:cargos:update', name: 'Actualizar cargos RRHH', module: 'rrhh' },
  { key: 'rrhh:cargos:delete', name: 'Eliminar cargos RRHH', module: 'rrhh' },
  
  // Permisos RRHH - Empleados
  { key: 'rrhh:empleados:create', name: 'Crear empleados', module: 'rrhh' },
  { key: 'rrhh:empleados:read', name: 'Ver empleados', module: 'rrhh' },
  { key: 'rrhh:empleados:update', name: 'Actualizar empleados', module: 'rrhh' },
  { key: 'rrhh:empleados:delete', name: 'Eliminar empleados', module: 'rrhh' },
  { key: 'sistema.empleados.crear_cuenta', name: 'Crear cuenta de usuario para empleado', module: 'sistema' },
  { key: 'rrhh:empleados:manage_account', name: 'Administrar cuenta de empleado', module: 'rrhh' },
  
  // Permisos RRHH - Contratos
  { key: 'rrhh:contratos:read', name: 'Ver contratos', module: 'rrhh' },
  { key: 'rrhh:contratos:approve', name: 'Aprobar contratos', module: 'rrhh' },
  
  // Permisos RRHH - Horas Extras
  { key: 'rrhh:horas_extras:create', name: 'Crear registros de horas extras', module: 'rrhh' },
  { key: 'rrhh:horas_extras:read', name: 'Ver registros de horas extras', module: 'rrhh' },
  { key: 'rrhh:horas_extras:update', name: 'Actualizar registros de horas extras', module: 'rrhh' },
  { key: 'rrhh:horas_extras:delete', name: 'Eliminar registros de horas extras', module: 'rrhh' },
  { key: 'rrhh:horas_extras:approve', name: 'Aprobar horas extras', module: 'rrhh' },
  { key: 'rrhh:horas_extras:stats', name: 'Ver estadísticas de horas extras', module: 'rrhh' },

  // Permisos RRHH - Dotación (Endowment)
  { key: 'rrhh:endowment:create', name: 'Crear registros de dotación', module: 'rrhh' },
  { key: 'rrhh:endowment:read', name: 'Ver dotación', module: 'rrhh' },
  { key: 'rrhh:endowment:update', name: 'Actualizar registros de dotación', module: 'rrhh' },
  { key: 'rrhh:endowment:delete', name: 'Eliminar registros de dotación', module: 'rrhh' },
  { key: 'rrhh:endowment:stats', name: 'Ver estadísticas de dotación', module: 'rrhh' },
  
  // Permisos Clientes - Modelos
  { key: 'clientes:modelos:create', name: 'Crear modelos/clientes', module: 'clientes' },
  { key: 'clientes:modelos:read', name: 'Ver modelos/clientes', module: 'clientes' },
  { key: 'clientes:modelos:update', name: 'Actualizar modelos/clientes', module: 'clientes' },
  { key: 'clientes:modelos:delete', name: 'Eliminar modelos/clientes', module: 'clientes' },
  { key: 'clientes:modelos:stats', name: 'Ver estadísticas de modelos', module: 'clientes' },
  { key: 'clientes:modelos:assign', name: 'Asignar equipo a modelos', module: 'clientes' },
  
  // Permisos Ventas - Modelos
  { key: 'ventas:modelos:read', name: 'Ver ventas de modelos', module: 'ventas' },
  { key: 'ventas:modelos:stats', name: 'Ver estadísticas de ventas de modelos', module: 'ventas' },
  { key: 'ventas:modelos:compare', name: 'Comparar ventas entre modelos', module: 'ventas' },
  { key: 'ventas:modelos:export', name: 'Exportar ventas de modelos', module: 'ventas' },
  
  // Permisos Clientes - Contratos
  { key: 'clientes:contratos:create', name: 'Crear contratos de modelos', module: 'clientes' },
  { key: 'clientes:contratos:read', name: 'Ver contratos de modelos', module: 'clientes' },
  { key: 'clientes:contratos:update', name: 'Actualizar contratos de modelos', module: 'clientes' },
  { key: 'clientes:contratos:delete', name: 'Eliminar contratos de modelos', module: 'clientes' },
  { key: 'clientes:contratos:send', name: 'Enviar contratos para firma', module: 'clientes' },
  { key: 'clientes:contratos:sign', name: 'Firmar contratos', module: 'clientes' },
  
  // Permisos Ventas - Chatters
  { key: 'ventas:chatting:create', name: 'Registrar ventas de chatters', module: 'chatting' },
  { key: 'ventas:chatting:read', name: 'Ver ventas de chatters', module: 'chatting' },
  { key: 'ventas:chatting:update', name: 'Actualizar ventas de chatters', module: 'chatting' },
  { key: 'ventas:chatting:delete', name: 'Eliminar ventas de chatters', module: 'chatting' },

  // Permisos Ventas - Chatters: Metas (Goals)
  { key: 'ventas:chatting:goals:create', name: 'Crear metas de chatters', module: 'chatting' },
  { key: 'ventas:chatting:goals:read', name: 'Ver metas de chatters', module: 'chatting' },
  { key: 'ventas:chatting:goals:update', name: 'Actualizar metas de chatters', module: 'chatting' },
  { key: 'ventas:chatting:goals:delete', name: 'Eliminar metas de chatters', module: 'chatting' },

  // Permisos Ventas - Chatters: Comisiones
  { key: 'ventas:chatting:commissions:create', name: 'Generar comisiones de chatters', module: 'chatting' },
  { key: 'ventas:chatting:commissions:read', name: 'Ver comisiones de chatters', module: 'chatting' },
  { key: 'ventas:chatting:commissions:approve', name: 'Aprobar comisiones de chatters', module: 'chatting' },
  { key: 'ventas:chatting:commissions:pay', name: 'Pagar comisiones de chatters', module: 'chatting' },
  { key: 'ventas:chatting:commissions:delete', name: 'Eliminar comisiones de chatters', module: 'chatting' },

  // Permisos Ventas - Traffic/Trafficker: Campañas
  { key: 'ventas:traffic:campaigns:create', name: 'Crear campañas de marketing', module: 'traffic' },
  { key: 'ventas:traffic:campaigns:read', name: 'Ver campañas de marketing', module: 'traffic' },
  { key: 'ventas:traffic:campaigns:update', name: 'Actualizar campañas de marketing', module: 'traffic' },
  { key: 'ventas:traffic:campaigns:delete', name: 'Eliminar campañas de marketing', module: 'traffic' },
  { key: 'ventas:traffic:campaigns:export', name: 'Exportar campañas de marketing', module: 'traffic' },
  { key: 'ventas:traffic:campaigns:stats', name: 'Ver estadísticas de campañas', module: 'traffic' },

  // Permisos Ventas - Recruitment (Sales Closers)
  { key: 'ventas:recruitment:create', name: 'Crear actividades de recruitment', module: 'ventas' },
  { key: 'ventas:recruitment:read', name: 'Ver actividades de recruitment', module: 'ventas' },
  { key: 'ventas:recruitment:update', name: 'Actualizar actividades de recruitment', module: 'ventas' },
  { key: 'ventas:recruitment:delete', name: 'Eliminar actividades de recruitment', module: 'ventas' },
  { key: 'ventas:recruitment:export', name: 'Exportar actividades de recruitment', module: 'ventas' },
  { key: 'ventas:recruitment:stats', name: 'Ver estadísticas de recruitment', module: 'ventas' },

  // Permisos Finanzas - Gestión Financiera
  { key: 'finanzas:read', name: 'Ver finanzas de modelos', module: 'finanzas' },
  { key: 'finanzas:calculate', name: 'Calcular finanzas', module: 'finanzas' },
  { key: 'finanzas:recalculate', name: 'Recalcular finanzas existentes', module: 'finanzas' },
  { key: 'finanzas:update', name: 'Actualizar finanzas', module: 'finanzas' },
  { key: 'finanzas:approve', name: 'Aprobar finanzas', module: 'finanzas' },
  { key: 'finanzas:pay', name: 'Marcar como pagado', module: 'finanzas' },
  { key: 'finanzas:stats', name: 'Ver estadísticas financieras', module: 'finanzas' },
  { key: 'finanzas:export', name: 'Exportar finanzas', module: 'finanzas' },
  { key: 'finanzas:admin', name: 'Administración completa de finanzas', module: 'finanzas' },

  // Permisos Cartera - Facturación
  { key: 'cartera:facturas:create', name: 'Crear facturas manualmente', module: 'cartera' },
  { key: 'cartera:facturas:read', name: 'Ver facturas', module: 'cartera' },
  { key: 'cartera:facturas:update', name: 'Actualizar facturas', module: 'cartera' },
  { key: 'cartera:facturas:delete', name: 'Cancelar facturas', module: 'cartera' },
  { key: 'cartera:facturas:generate', name: 'Generar facturas automáticas', module: 'cartera' },
  
  // Permisos Cartera - Pagos
  { key: 'cartera:pagos:create', name: 'Registrar pagos', module: 'cartera' },
  { key: 'cartera:pagos:read', name: 'Ver pagos', module: 'cartera' },
  { key: 'cartera:pagos:update', name: 'Actualizar pagos', module: 'cartera' },
  { key: 'cartera:pagos:delete', name: 'Eliminar pagos', module: 'cartera' },
  
  // Permisos Cartera - Estado de Cuenta
  { key: 'cartera:estado-cuenta:read', name: 'Ver estado de cuenta', module: 'cartera' },
  { key: 'cartera:export:pdf', name: 'Exportar estado de cuenta en PDF', module: 'cartera' },
  
  // Permisos Cartera - Recordatorios
  { key: 'cartera:recordatorios:read', name: 'Ver recordatorios', module: 'cartera' },
  { key: 'cartera:recordatorios:send', name: 'Enviar recordatorios de pago', module: 'cartera' },
  
  // Permisos Cartera - Configuración
  { key: 'cartera:config:read', name: 'Ver configuración de cartera', module: 'cartera' },
  { key: 'cartera:config:update', name: 'Actualizar configuración de cartera', module: 'cartera' },
  
  // Permisos Cartera - Dashboard
  { key: 'cartera:dashboard:read', name: 'Ver dashboard de cartera', module: 'cartera' },
  { key: 'cartera:admin', name: 'Administración completa de cartera', module: 'cartera' },
  { key: 'cartera:read', name: 'Acceso a sidebar de cartera', module: 'cartera' },
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
    permissions: [
      'system.admin',
      'sistema.config.ver',
      // Accesos RRHH - Dotación
      'rrhh:endowment:read',
      'rrhh:endowment:create',
      'rrhh:endowment:update',
      'rrhh:endowment:delete',
      'rrhh:endowment:stats',
      // Accesos RRHH - Administración de Cuentas
      'rrhh:empleados:manage_account',
    ],
    meta: { department: 'sistema', level: 100, color: '#ff4757' },
  },
  {
    key: 'USUARIO_NORMAL',
    name: 'Usuario Normal',
    permissions: ['dashboard.general.ver', 'sistema.perfil.ver'],
    meta: { department: 'general', level: 1, color: '#2ed573' },
  },
];
