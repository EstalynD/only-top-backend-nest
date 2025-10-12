# Corrección Crítica: Búsqueda de Empleado por userId

## 🐛 Problema Identificado

El sistema estaba confundiendo dos conceptos diferentes:
- **userId**: ID de la cuenta de usuario en la tabla `users`
- **empleadoId**: ID del registro de empleado en la tabla `rrhh_empleados`

### Síntoma
Cuando un empleado marcaba asistencia, el sistema retornaba:
```json
{
  "areaId": null,
  "cargoId": null,
  "isUsingDefaultSchedule": false
}
```

Esto ocurría porque el sistema intentaba buscar un empleado usando el `userId` directamente, cuando debería:
1. Buscar la cuenta de usuario por `userId`
2. Obtener el `empleadoId` de esa cuenta
3. Buscar el empleado usando el `empleadoId`

### Ejemplo Real
**Usuario en BD:**
```json
{
  "_id": "68e747a82e6baf4133e3e14d",  // <- Este es el userId
  "username": "luis.ramirez",
  "empleadoId": "68de294d29b65fc73020e0fc",  // <- Este es el empleadoId
  "displayName": "Luis Ramírez",
  "email": "luis.ramirez@onlytop.local"
}
```

**Antes**: El sistema usaba `68e747a82e6baf4133e3e14d` para buscar en `rrhh_empleados` → ❌ No encontraba  
**Después**: El sistema busca el user `68e747a82e6baf4133e3e14d`, obtiene el `empleadoId` y busca en `rrhh_empleados` → ✅ Encuentra

## 🔧 Solución Implementada

### 1. Nuevo Método en EmpleadosService

**Archivo**: `empleados.service.ts`

Se creó el método `findEmpleadoByUserId()`:

```typescript
/**
 * Busca un empleado por el ID de su cuenta de usuario
 */
async findEmpleadoByUserId(userId: string): Promise<any> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new BadRequestException('Invalid user ID format');
  }

  // Primero buscar la cuenta de usuario para obtener el empleadoId
  const cuenta = await this.userModel
    .findById(userId)
    .select('empleadoId username email')
    .exec();

  if (!cuenta || !cuenta.empleadoId) {
    throw new NotFoundException(
      `User with ID '${userId}' not found or has no associated employee`
    );
  }

  // Buscar el empleado con populate
  const empleado = await this.empleadoModel
    .findById(cuenta.empleadoId)
    .populate('areaId', 'name code color')
    .populate('cargoId', 'name code hierarchyLevel')
    .populate('jefeInmediatoId', 'nombre apellido correoElectronico')
    .exec();

  if (!empleado) {
    throw new NotFoundException(`Employee with ID '${cuenta.empleadoId}' not found`);
  }

  const plain = empleado.toObject();
  return {
    ...plain,
    hasUserAccount: true,
    userAccount: {
      id: String(cuenta._id),
      username: cuenta.username,
      email: cuenta.email ?? null,
    },
  };
}
```

**Beneficios**:
- ✅ Busca correctamente desde la cuenta de usuario
- ✅ Valida que el usuario tenga empleado asociado
- ✅ Hace populate de área, cargo y jefe inmediato
- ✅ Retorna información completa con validaciones

### 2. Actualización en AttendanceService

**Archivo**: `attendance.service.ts`

Se actualizaron **3 lugares** donde se usaba incorrectamente `findEmpleadoById(userId)`:

#### 2.1. Método `markAttendance()`

**Antes:**
```typescript
// Get employee info
const empleado = await this.empleadosService.findEmpleadoById(userId);
if (!empleado) {
  throw new NotFoundException(`Employee with ID ${userId} not found`);
}
```

**Después:**
```typescript
// Get employee info - userId es el ID de la cuenta de usuario
const empleado = await this.empleadosService.findEmpleadoByUserId(userId);
if (!empleado) {
  throw new NotFoundException(`Employee for user ID ${userId} not found`);
}
```

#### 2.2. Método `getUserAssignedSchedule()`

**Antes:**
```typescript
if (!userAreaId || !userCargoId) {
  try {
    const empleado = await this.empleadosService.findEmpleadoById(userId);
    userAreaId = userAreaId || normalizeId(empleado.areaId);
    userCargoId = userCargoId || normalizeId(empleado.cargoId);
  } catch (err) {
    this.logger.warn(`Could not get employee ${userId} for schedule: ${err.message}`);
  }
}
```

**Después:**
```typescript
if (!userAreaId || !userCargoId) {
  try {
    // userId es el ID de la cuenta de usuario, no del empleado
    const empleado = await this.empleadosService.findEmpleadoByUserId(userId);
    userAreaId = userAreaId || normalizeId(empleado.areaId);
    userCargoId = userCargoId || normalizeId(empleado.cargoId);
  } catch (err) {
    this.logger.warn(`Could not get employee for user ${userId} for schedule: ${err.message}`);
  }
}
```

#### 2.3. Método `getUserScheduleInfo()`

**Antes:**
```typescript
// Use provided employee or fetch it
if (!empleado) {
  empleado = await this.empleadosService.findEmpleadoById(userId).catch(() => null);
}
```

**Después:**
```typescript
// Use provided employee or fetch it
if (!empleado) {
  // userId es el ID de la cuenta de usuario, no del empleado
  empleado = await this.empleadosService.findEmpleadoByUserId(userId).catch(() => null);
}
```

## 📊 Flujo Corregido

### Antes (Incorrecto)
```
Usuario marca asistencia
  ↓
Controller recibe req.user.id = "68e747a82e6baf4133e3e14d" (userId)
  ↓
AttendanceService.markAttendance(userId)
  ↓
empleadosService.findEmpleadoById("68e747a82e6baf4133e3e14d")
  ↓
Busca en rrhh_empleados con _id = "68e747a82e6baf4133e3e14d"
  ↓
❌ No encuentra (porque ese ID es de users, no de rrhh_empleados)
  ↓
Retorna null para areaId y cargoId
```

### Después (Correcto)
```
Usuario marca asistencia
  ↓
Controller recibe req.user.id = "68e747a82e6baf4133e3e14d" (userId)
  ↓
AttendanceService.markAttendance(userId)
  ↓
empleadosService.findEmpleadoByUserId("68e747a82e6baf4133e3e14d")
  ↓
1. Busca en users con _id = "68e747a82e6baf4133e3e14d"
2. Obtiene empleadoId = "68de294d29b65fc73020e0fc"
3. Busca en rrhh_empleados con _id = "68de294d29b65fc73020e0fc"
  ↓
✅ Encuentra el empleado con su área y cargo
  ↓
Retorna horario con areaId y cargoId correctos
```

## 🎯 Resultado Esperado

Ahora cuando un empleado marca asistencia, debería recibir:

```json
{
  "userId": "68e747a82e6baf4133e3e14d",
  "scheduleType": "FIXED",
  "assignedSchedule": {
    "type": "FIXED",
    "schedule": { ... },
    "name": "Horario Fijo",
    "description": "Horario fijo de lunes a viernes"
  },
  "areaId": "68de1a234567890abcdef123",  // ✅ Ahora tiene valor
  "cargoId": "68de1a234567890abcdef456", // ✅ Ahora tiene valor
  "toleranceMinutes": 15,
  "breakDurationMinutes": 30,
  "isUsingDefaultSchedule": false  // ✅ O true con mensaje si no está configurado
}
```

## ✅ Verificaciones

### Test Manual
1. Un empleado con cuenta de usuario marca asistencia
2. El sistema debe obtener correctamente su área y cargo
3. El horario asignado debe ser el específico de su área/cargo (si existe)
4. Si no hay horario específico, debe mostrar el mensaje: "Tu área o cargo no tiene un horario específico asignado..."

### Logs Esperados
```
[AttendanceService] Getting schedule for user 68e747a82e6baf4133e3e14d, area: 68de1a234567890abcdef123, cargo: 68de1a234567890abcdef456
```

**Antes veríamos:**
```
[AttendanceService] Getting schedule for user 68e747a82e6baf4133e3e14d, area: null, cargo: null
```

## 📝 Archivos Modificados

1. **empleados.service.ts**
   - ➕ Agregado método `findEmpleadoByUserId()`
   - Líneas: +74 nuevas

2. **attendance.service.ts**
   - 🔄 Modificado método `markAttendance()` (línea ~86)
   - 🔄 Modificado método `getUserAssignedSchedule()` (línea ~643)
   - 🔄 Modificado método `getUserScheduleInfo()` (línea ~384)
   - Cambios: 3 ubicaciones

## 🚀 Próximos Pasos

1. **Probar con un usuario real**:
   ```bash
   # Marcar asistencia con un usuario que tenga empleadoId
   curl -X POST http://localhost:3000/api/rrhh/attendance/empleado/marcar \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"type": "CHECK_IN"}'
   ```

2. **Verificar el response**:
   - areaId debe tener valor
   - cargoId debe tener valor
   - Si el área/cargo tiene horario configurado: `isUsingDefaultSchedule: false`
   - Si no tiene horario: `isUsingDefaultSchedule: true` con mensaje

3. **Verificar el frontend**:
   - El mensaje de "Horario por Defecto" debe aparecer solo si aplica
   - La información del área y cargo debe mostrarse correctamente

## 🔍 Diferencias Clave

| Concepto | Tabla | Descripción | Cuándo usar |
|----------|-------|-------------|-------------|
| **userId** | `users` | ID de la cuenta de usuario (login) | En autenticación, permisos |
| **empleadoId** | `rrhh_empleados` | ID del registro de empleado | Para datos laborales (área, cargo, salario) |

**Regla de oro**: 
- Si tienes `userId` y necesitas datos del empleado → Usa `findEmpleadoByUserId()`
- Si ya tienes `empleadoId` directamente → Usa `findEmpleadoById()`

## 💡 Lecciones Aprendidas

1. **No asumir IDs**: Siempre validar qué tipo de ID se está pasando
2. **Documentar parámetros**: Los comentarios ayudan a entender el contexto
3. **Métodos específicos**: Crear métodos dedicados para cada caso de uso
4. **Validaciones tempranas**: Fallar rápido con mensajes claros

## 📞 Soporte

Si después de este cambio sigues viendo `areaId: null` o `cargoId: null`:
1. Verificar que la cuenta de usuario tenga `empleadoId` configurado
2. Verificar que el empleado exista en `rrhh_empleados`
3. Verificar que el empleado tenga `areaId` y `cargoId` asignados
4. Revisar los logs del servidor para más detalles
