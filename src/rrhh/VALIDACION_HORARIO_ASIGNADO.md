# Corrección Final: Validación de Horario Asignado

## 🐛 Problemas Identificados

### 1. Sistema permitía marcar asistencia sin horario asignado
- Cuando un área/cargo no tenía horario configurado
- El sistema usaba un "horario por defecto" (09:00-18:00)
- Esto generaba confusión y datos inconsistentes

### 2. Mensajes de error poco informativos
```json
{
  "message": "No puedes marcar entrada tan temprano. El horario laboral inicia a las 09:00..."
}
```
- No indicaba el **tipo de horario** (fijo vs turno rotativo)
- No especificaba el **nombre del turno** en caso de turnos rotativos

### 3. Frontend mostraba advertencias en lugar de bloquear
- Mostraba mensaje amarillo: "Horario por Defecto"
- Permitía continuar con operaciones que fallarían
- Experiencia confusa para el usuario

## ✅ Soluciones Implementadas

### 1. Backend: Rechazo de Marcación Sin Horario

**Archivo**: `attendance.service.ts`

**ANTES**:
```typescript
// Default schedule if no assignment
if (!assignedSchedule) {
  this.logger.warn(`No schedule assignment found...`);
  
  assignedSchedule = {
    type: 'DEFAULT',
    schedule: { /* horario hardcodeado */ },
    name: 'Horario Estándar',
    description: 'Horario estándar de oficina'
  };
  scheduleType = 'FIXED';
  
  return {
    userId,
    scheduleType,
    assignedSchedule,
    // ...
    isUsingDefaultSchedule: true,
    configurationMessage: '...'
  };
}
```

**DESPUÉS**:
```typescript
// No schedule assigned - reject attendance marking
if (!assignedSchedule) {
  this.logger.error(`No schedule assignment found for user ${userId} (area: ${userAreaId}, cargo: ${userCargoId}). Cannot mark attendance.`);
  
  throw new BadRequestException(
    `Tu área o cargo no tiene un horario asignado. No puedes marcar asistencia hasta que Recursos Humanos configure tu horario. ` +
    `Por favor contacta a RRHH para resolver esta situación.`
  );
}

return {
  userId,
  scheduleType,
  assignedSchedule,
  // ...
  isUsingDefaultSchedule: false
};
```

**Resultado**:
- ❌ **NO** permite marcar asistencia sin horario
- ✅ Lanza error claro y específico
- ✅ Log de error en el servidor
- ✅ Usuario sabe exactamente qué hacer

### 2. Backend: Mensajes de Error Mejorados

**Archivo**: `attendance.service.ts` - Método `validateWorkingHours()`

**ANTES**:
```typescript
throw new BadRequestException(
  `No puedes marcar entrada tan temprano. El horario laboral inicia a las ${workStart}...`
);
```

**DESPUÉS**:
```typescript
const scheduleTypeName = scheduleInfo.scheduleType === 'ROTATING' && scheduleInfo.schedule
  ? `turno "${scheduleInfo.schedule.name}"` 
  : 'horario fijo';

throw new BadRequestException(
  `No puedes marcar entrada tan temprano. Tu ${scheduleTypeName} inicia a las ${workStart}...`
);
```

**Ejemplos de Mensajes**:

**Horario Fijo**:
```
No puedes marcar entrada tan temprano. Tu horario fijo inicia a las 09:00 
(con 15 min de tolerancia). Estás intentando marcar 475 minutos antes del horario permitido.
```

**Turno Rotativo**:
```
No puedes marcar entrada tan temprano. Tu turno "Turno Mañana" inicia a las 06:00 
(con 15 min de tolerancia). Estás intentando marcar 120 minutos antes del horario permitido.
```

### 3. Frontend: Pantalla Bloqueante Sin Horario

**Archivo**: `MarcadorAsistencia.tsx`

**Nueva Pantalla**:
```tsx
// Si hay un error crítico (sin horario asignado), mostrar solo el error
if (error && error.includes('no tiene un horario asignado')) {
  return (
    <div className="space-y-4">
      {/* Reloj sigue visible */}
      <div>...</div>

      {/* Error Crítico - Bloquea toda la UI */}
      <div className="rounded-xl p-6 border bg-red-50">
        <AlertCircle className="w-6 h-6" />
        <h3>No puedes marcar asistencia</h3>
        <p>{error}</p>
        
        <div>
          <p>¿Qué debes hacer?</p>
          <ul>
            <li>Contacta al departamento de Recursos Humanos</li>
            <li>Solicita que configuren el horario para tu área o cargo</li>
            <li>Una vez configurado, podrás marcar asistencia normalmente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

**Resultado**:
- ❌ No muestra botones de marcación
- ❌ No muestra última marcación
- ❌ No permite ninguna acción
- ✅ Mensaje claro y específico
- ✅ Instrucciones claras para el usuario

### 4. Frontend: Error en Mi Horario

**Archivo**: `MiHorario.tsx`

Similar al marcador, muestra mensaje bloqueante específico cuando no hay horario asignado.

## 📊 Flujo Completo Actualizado

### Caso 1: Área/Cargo SIN Horario Asignado

```
1. Usuario intenta ver "Mi Asistencia"
   ↓
2. Frontend llama a empleadoObtenerEstadoActual(token)
   ↓
3. Backend intenta obtener getUserAssignedSchedule()
   ↓
4. Backend busca en fixedSchedule.assignedAreas → No encuentra
   ↓
5. Backend busca en rotatingShifts.assignedAreas → No encuentra
   ↓
6. Backend lanza BadRequestException:
   "Tu área o cargo no tiene un horario asignado..."
   ↓
7. Frontend captura el error
   ↓
8. Frontend muestra pantalla bloqueante roja
   ↓
9. Usuario contacta a RRHH
```

### Caso 2: Área/Cargo CON Horario Asignado

```
1. Usuario intenta marcar asistencia
   ↓
2. Frontend llama a empleadoMarcarAsistencia(token, {type: 'CHECK_IN'})
   ↓
3. Backend obtiene getUserAssignedSchedule()
   ↓
4. Backend encuentra horario configurado (fijo o rotativo)
   ↓
5. Backend valida hora actual vs horario permitido
   ↓
6. SI está fuera de horario:
   → Error con nombre del turno: "Tu turno 'Turno Mañana' inicia a las 06:00..."
   ↓
7. SI está dentro de horario:
   → Registra asistencia exitosamente
```

## 🎯 Configuración Requerida

Para que un empleado pueda marcar asistencia, **DEBE** existir UNA de estas configuraciones:

### Opción 1: Horario Fijo Asignado
```json
{
  "fixedSchedule": {
    "assignedAreas": ["68dab39fd497e4ebc8c948ba"],  // ← ID del área
    // O bien:
    "assignedCargos": ["68dab39fd497e4ebc8c948ce"]  // ← ID del cargo
  }
}
```

### Opción 2: Turno Rotativo Asignado
```json
{
  "rotatingShifts": [
    {
      "id": "shift_am",
      "name": "Turno Mañana",
      "assignedAreas": ["68dab39fd497e4ebc8c948ba"],  // ← ID del área
      // O bien:
      "assignedCargos": ["68dab39fd497e4ebc8c948ce"]  // ← ID del cargo
    }
  ]
}
```

### ❌ Configuración Inválida (Actual en tu BD)
```json
{
  "fixedSchedule": {
    "assignedAreas": [],  // ← VACÍO - Nadie puede usar este horario
    "assignedCargos": []  // ← VACÍO - Nadie puede usar este horario
  },
  "rotatingShifts": [
    {
      "id": "shift_am",
      "assignedAreas": [],  // ← VACÍO - Nadie puede usar este turno
      "assignedCargos": []  // ← VACÍO - Nadie puede usar este turno
    }
  ]
}
```

## 🔧 Cómo Corregir la Configuración

### Paso 1: Identificar IDs
```javascript
// En tu BD, encuentra:
Area ID: "68dab39fd497e4ebc8c948ba"
Cargo ID: "68dab39fd497e4ebc8c948ce"
```

### Paso 2: Asignar al Horario Fijo
```javascript
// En MongoDB:
db.attendance_configs.updateOne(
  { key: 'attendance_config' },
  {
    $set: {
      'fixedSchedule.assignedAreas': ['68dab39fd497e4ebc8c948ba']
    }
  }
)
```

### Paso 3: O Asignar a un Turno
```javascript
// En MongoDB:
db.attendance_configs.updateOne(
  { 
    key: 'attendance_config',
    'rotatingShifts.id': 'shift_am'
  },
  {
    $set: {
      'rotatingShifts.$.assignedAreas': ['68dab39fd497e4ebc8c948ba']
    }
  }
)
```

## 📝 Logs del Servidor

### Log de Error (Sin Horario)
```
[AttendanceService] ERROR: No schedule assignment found for user 68e747a82e6baf4133e3e14d 
(area: 68dab39fd497e4ebc8c948ba, cargo: 68dab39fd497e4ebc8c948ce). Cannot mark attendance.
```

**Acción**: Administrador debe configurar horario para esa área/cargo

### Log Exitoso (Con Horario)
```
[AttendanceService] Getting schedule for user 68e747a82e6baf4133e3e14d, 
area: 68dab39fd497e4ebc8c948ba, cargo: 68dab39fd497e4ebc8c948ce
[AttendanceService] Attendance marked: CHECK_IN for user 68e747a82e6baf4133e3e14d (Luis Ramírez) at 2025-10-09T14:30:00.000Z
```

## ✅ Beneficios

### Para el Usuario
- ✅ **Claridad total**: Sabe exactamente por qué no puede marcar
- ✅ **Acción clara**: Sabe a quién contactar (RRHH)
- ✅ **No confusión**: No ve opciones que no funcionarán
- ✅ **Mensajes específicos**: Sabe qué turno/horario tiene asignado

### Para RRHH
- ✅ **Proactivo**: Logs muestran quién necesita configuración
- ✅ **Prevención**: No se generan datos inconsistentes
- ✅ **Control**: Solo empleados con horario pueden marcar
- ✅ **Trazabilidad**: Logs claros de intentos rechazados

### Para el Sistema
- ✅ **Integridad**: No hay datos con horarios "por defecto" inventados
- ✅ **Consistencia**: Todos los registros tienen horario real asignado
- ✅ **Validación**: Errores específicos y tempranos
- ✅ **Mantenibilidad**: Código más claro y predecible

## 🚨 Casos de Uso

### Caso A: Empleado Nuevo
1. Se crea el empleado con área y cargo
2. **FALTA**: Asignar horario al área/cargo
3. Empleado intenta marcar → ❌ Error bloqueante
4. RRHH configura horario para el área
5. Empleado puede marcar → ✅ Exitoso

### Caso B: Nueva Área Creada
1. Se crea nueva área "Desarrollo"
2. Se asignan empleados a esa área
3. Empleados intentan marcar → ❌ Error bloqueante
4. RRHH asigna horario fijo o turno a "Desarrollo"
5. Todos los empleados del área pueden marcar → ✅ Exitoso

### Caso C: Cambio de Turno
1. Empleado tiene turno AM (06:00-14:00)
2. Empleado marca a las 05:30 → ❌ Error: "Tu turno 'Turno Mañana' inicia a las 06:00..."
3. Empleado espera hasta 05:45 (dentro de tolerancia)
4. Empleado marca → ✅ Exitoso con estado PRESENT

## 📞 Mensajes al Usuario

### Error: Sin Horario Asignado
```
Tu área o cargo no tiene un horario asignado. 
No puedes marcar asistencia hasta que Recursos Humanos configure tu horario. 
Por favor contacta a RRHH para resolver esta situación.
```

### Error: Muy Temprano (Horario Fijo)
```
No puedes marcar entrada tan temprano. 
Tu horario fijo inicia a las 09:00 (con 15 min de tolerancia). 
Estás intentando marcar 475 minutos antes del horario permitido.
```

### Error: Muy Temprano (Turno Rotativo)
```
No puedes marcar entrada tan temprano. 
Tu turno "Turno Mañana" inicia a las 06:00 (con 15 min de tolerancia). 
Estás intentando marcar 120 minutos antes del horario permitido.
```

## 🎨 Interfaz de Usuario

### Pantalla Normal (Con Horario)
```
┌────────────────────────────────┐
│ 🕐 14:30:45                    │
│ miércoles, 9 de octubre 2025  │
└────────────────────────────────┘

┌────────────────────────────────┐
│ ✅ Última: ENTRADA - 08:55     │
│    Estado: PUNTUAL             │
└────────────────────────────────┘

┌────────────────────────────────┐
│ [SALIDA ALMUERZO] [SALIDA]    │
└────────────────────────────────┘
```

### Pantalla Bloqueada (Sin Horario)
```
┌────────────────────────────────┐
│ 🕐 14:30:45                    │
│ miércoles, 9 de octubre 2025  │
└────────────────────────────────┘

┌────────────────────────────────┐
│ ⚠️ No puedes marcar asistencia│
│                                │
│ Tu área o cargo no tiene un    │
│ horario asignado. No puedes    │
│ marcar asistencia hasta que    │
│ Recursos Humanos configure tu  │
│ horario.                       │
│                                │
│ ¿Qué debes hacer?              │
│ • Contacta a RRHH              │
│ • Solicita configuración       │
│ • Espera confirmación          │
└────────────────────────────────┘
```

## 📁 Archivos Modificados

1. **Backend**:
   - `attendance.service.ts` (3 cambios)
     - Rechazo de marcación sin horario
     - Mensajes mejorados con tipo de horario
     - findEmpleadoByUserId para búsqueda correcta

2. **Frontend**:
   - `MarcadorAsistencia.tsx` (2 cambios)
     - Pantalla bloqueante para error crítico
     - Manejo específico de error sin horario
   - `MiHorario.tsx` (1 cambio)
     - Mensaje bloqueante específico

## 🔍 Testing

### Test 1: Sin Horario Asignado
```bash
# Configuración: assignedAreas = [], assignedCargos = []
# Resultado esperado: Error 400
POST /api/rrhh/attendance/empleado/marcar
{
  "type": "CHECK_IN"
}

Response:
{
  "statusCode": 400,
  "message": "Tu área o cargo no tiene un horario asignado..."
}
```

### Test 2: Con Horario Fijo
```bash
# Configuración: fixedSchedule.assignedAreas = ["68dab39..."]
# Resultado esperado: Success
POST /api/rrhh/attendance/empleado/marcar
{
  "type": "CHECK_IN"
}

Response:
{
  "message": "Entrada registrada exitosamente. Estado: PUNTUAL"
}
```

### Test 3: Muy Temprano
```bash
# Hora actual: 05:30, Turno inicia: 06:00
# Resultado esperado: Error 400 con nombre del turno
POST /api/rrhh/attendance/empleado/marcar
{
  "type": "CHECK_IN"
}

Response:
{
  "statusCode": 400,
  "message": "No puedes marcar entrada tan temprano. Tu turno 'Turno Mañana' inicia..."
}
```

## 🎓 Lecciones Aprendidas

1. **No inventar datos por defecto**: Es mejor rechazar la operación que crear datos inconsistentes
2. **Errores específicos**: Los mensajes deben indicar qué tipo de horario/turno tiene el usuario
3. **Bloqueo visual**: En el frontend, errores críticos deben bloquear la UI completamente
4. **Logs informativos**: Los errores deben loggearse con toda la información contextual
5. **userId vs empleadoId**: Siempre usar el método correcto para buscar empleados

## 📞 Soporte

Si después de configurar el horario sigues viendo errores:
1. Verificar que el área/cargo existe en la BD
2. Verificar que el área/cargo está en `assignedAreas` o `assignedCargos`
3. Revisar logs del servidor para más detalles
4. Verificar que el usuario tiene `empleadoId` configurado
