import { PERMISSIONS, PERMISSION_ALIASES, type ModuleKey, type PermissionDef } from './rbac.constants.js';

export function normalizePermissionKey(key: string): string {
  return PERMISSION_ALIASES[key] ?? key;
}

export function isValidPermission(key: string): boolean {
  const k = normalizePermissionKey(key);
  return PERMISSIONS.some((p) => p.key === k);
}

export function getPermissionInfo(key: string): PermissionDef | undefined {
  const k = normalizePermissionKey(key);
  return PERMISSIONS.find((p) => p.key === k);
}

export function getPermissionsByModule(module: ModuleKey): PermissionDef[] {
  return PERMISSIONS.filter((p) => p.module === module);
}

export function getModulesWithCount(): Array<{ module: ModuleKey; count: number }> {
  const counts = new Map<ModuleKey, number>();
  for (const p of PERMISSIONS) {
    counts.set(p.module as ModuleKey, (counts.get(p.module as ModuleKey) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([module, count]) => ({ module, count }));
}
