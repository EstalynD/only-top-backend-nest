# Sistema de Asistencia para Empleados (Autoservicio)

## 📋 Descripción General

Este módulo proporciona endpoints específicos para que los empleados puedan marcar su propia asistencia y consultar su información de forma autónoma, sin requerir permisos administrativos.

## 🔐 Permisos Requeridos

Los empleados necesitan los siguientes permisos:

- `rrhh.attendance.empleado.marcar` - Para marcar asistencia
- `rrhh.attendance.empleado.ver` - Para ver su propia información de asistencia

## 🚀 Endpoints Disponibles

### 1. Marcar Asistencia

**POST** `/rrhh/attendance/empleado/marcar`

Permite al empleado marcar su propia asistencia (CHECK_IN, CHECK_OUT, BREAK_START, BREAK_END).

**Request Body:**
```json
{
  "type": "CHECK_IN",
  "notes": "Llegada a tiempo",
  "location": {
    "latitude": 4.6097,
    "longitude": -74.0817,
    "address": "Bogotá, Colombia"
  },
  "deviceInfo": {
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "192.168.1.1",
    "platform": "Windows"
  }
}
```

**Tipos de Marcación:**
- `CHECK_IN` - Entrada al trabajo
- `CHECK_OUT` - Salida del trabajo
- `BREAK_START` - Inicio de descanso
- `BREAK_END` - Fin de descanso

**Response:**
```json
{
  "id": "673f8a9b5c4e3d2a1b0e9f8a",
  "type": "CHECK_IN",
  "timestamp": "2025-10-09T08:30:00.000Z",
  "status": "PRESENT",
  "message": "Entrada registrada correctamente",
  "empleadoNombre": "Juan Pérez",
  "areaId": "673f8a9b5c4e3d2a1b0e9f8b",
  "cargoId": "673f8a9b5c4e3d2a1b0e9f8c"
}
```

**Validaciones:**
- ✅ Solo puede marcar su propia asistencia
- ✅ Debe seguir la secuencia: CHECK_IN → BREAK_START → BREAK_END → CHECK_OUT
- ✅ Valida horarios según el schedule asignado
- ✅ Aplica tolerancia configurada
- ✅ Calcula automáticamente si llegó tarde

---

### 2. Ver Resumen del Día Actual

**GET** `/rrhh/attendance/empleado/mi-resumen`

Obtiene el resumen de asistencia del día actual del empleado autenticado.

**Response:**
```json
{
  "userId": "673f8a9b5c4e3d2a1b0e9f8a",
  "empleadoId": "673f8a9b5c4e3d2a1b0e9f8b",
  "empleadoNombre": "Juan Pérez",
  "date": "2025-10-09",
  "checkIn": "2025-10-09T08:30:00.000Z",
  "checkOut": "2025-10-09T17:00:00.000Z",
  "breakStart": "2025-10-09T12:00:00.000Z",
  "breakEnd": "2025-10-09T13:00:00.000Z",
  "totalHours": 8.5,
  "workedHours": 7.5,
  "breakHours": 1.0,
  "status": "PRESENT",
  "isLate": false,
  "expectedHours": 8,
  "scheduleName": "FIXED",
  "areaName": "Desarrollo",
  "cargoName": "Desarrollador"
}
```

---

### 3. Ver Resumen de Fecha Específica

**GET** `/rrhh/attendance/empleado/mi-resumen/:date`

Obtiene el resumen de asistencia de una fecha específica.

**Parámetros:**
- `date` - Fecha en formato ISO (YYYY-MM-DD)

**Ejemplo:**
```
GET /rrhh/attendance/empleado/mi-resumen/2025-10-08
```

---

### 4. Ver Mis Registros

**GET** `/rrhh/attendance/empleado/mis-registros`

Obtiene todos los registros de asistencia del empleado con filtros opcionales.

**Query Parameters:**
- `startDate` (opcional) - Fecha inicial en formato ISO
- `endDate` (opcional) - Fecha final en formato ISO
- `populate` (opcional) - `"true"` para incluir datos poblados

**Ejemplo:**
```
GET /rrhh/attendance/empleado/mis-registros?startDate=2025-10-01&endDate=2025-10-09&populate=true
```

**Response:**
```json
[
  {
    "_id": "673f8a9b5c4e3d2a1b0e9f8a",
    "userId": "673f8a9b5c4e3d2a1b0e9f8b",
    "type": "CHECK_IN",
    "timestamp": "2025-10-09T08:30:00.000Z",
    "status": "PRESENT",
    "empleadoId": {
      "nombre": "Juan",
      "apellido": "Pérez"
    }
  }
]
```

---

### 5. Ver Mi Horario Asignado

**GET** `/rrhh/attendance/empleado/mi-horario`

Obtiene el horario de trabajo asignado al empleado.

**Response:**
```json
{
  "userId": "673f8a9b5c4e3d2a1b0e9f8a",
  "scheduleType": "FIXED",
  "assignedSchedule": {
    "type": "FIXED",
    "schedule": {
      "name": "Horario Estándar",
      "startTime": "08:00",
      "endTime": "17:00",
      "workDays": [1, 2, 3, 4, 5]
    },
    "name": "Horario Estándar",
    "description": "Lunes a Viernes 8:00 AM - 5:00 PM"
  },
  "areaId": "673f8a9b5c4e3d2a1b0e9f8b",
  "cargoId": "673f8a9b5c4e3d2a1b0e9f8c",
  "toleranceMinutes": 15,
  "breakDurationMinutes": 60
}
```

---

### 6. Ver Estado Actual

**GET** `/rrhh/attendance/empleado/estado-actual`

Obtiene el estado actual de asistencia del empleado, incluyendo la última marca y el próximo tipo esperado.

**Response:**
```json
{
  "lastRecord": {
    "id": "673f8a9b5c4e3d2a1b0e9f8a",
    "type": "CHECK_IN",
    "timestamp": "2025-10-09T08:30:00.000Z",
    "status": "PRESENT",
    "notes": "Llegada a tiempo"
  },
  "nextExpectedType": "CHECK_OUT",
  "todayRecords": [
    {
      "id": "673f8a9b5c4e3d2a1b0e9f8a",
      "type": "CHECK_IN",
      "timestamp": "2025-10-09T08:30:00.000Z",
      "status": "PRESENT"
    }
  ],
  "summary": {
    "userId": "673f8a9b5c4e3d2a1b0e9f8a",
    "date": "2025-10-09",
    "totalHours": 0,
    "workedHours": 0,
    "status": "PRESENT"
  },
  "scheduleInfo": {
    "scheduleType": "FIXED",
    "assignedSchedule": { ... }
  },
  "canMarkAttendance": true,
  "allowedTypes": ["BREAK_START", "CHECK_OUT"]
}
```

**Campo `allowedTypes`:** Indica los tipos de marcación que el empleado puede realizar en este momento según su estado actual.

---

### 7. Ver Tiempo Restante para Check-In

**GET** `/rrhh/attendance/empleado/tiempo-restante`

Calcula cuánto tiempo le queda al empleado para hacer check-in antes de la hora límite (con tolerancia).

**Response (si aún no ha marcado):**
```json
{
  "minutesRemaining": 25,
  "deadline": "2025-10-09T08:15:00.000Z",
  "isUrgent": false
}
```

**Response (si ya marcó o pasó la hora):**
```json
null
```

---

### 8. Ver Mi Reporte

**GET** `/rrhh/attendance/empleado/mi-reporte`

Genera un reporte de asistencia del empleado para un rango de fechas.

**Query Parameters (Requeridos):**
- `startDate` - Fecha inicial en formato ISO
- `endDate` - Fecha final en formato ISO

**Ejemplo:**
```
GET /rrhh/attendance/empleado/mi-reporte?startDate=2025-10-01&endDate=2025-10-09
```

**Response:**
```json
[
  {
    "userId": "673f8a9b5c4e3d2a1b0e9f8a",
    "date": "2025-10-01",
    "totalHours": 8.5,
    "workedHours": 7.5,
    "status": "PRESENT",
    "isLate": false
  },
  {
    "userId": "673f8a9b5c4e3d2a1b0e9f8a",
    "date": "2025-10-02",
    "totalHours": 8.0,
    "workedHours": 7.0,
    "status": "LATE",
    "isLate": true,
    "lateMinutes": 20
  }
]
```

---

## 🔄 Flujo de Uso Típico

### Día Laboral Normal

1. **Llegada al trabajo**
   ```
   POST /rrhh/attendance/empleado/marcar
   { "type": "CHECK_IN" }
   ```

2. **Verificar estado**
   ```
   GET /rrhh/attendance/empleado/estado-actual
   ```

3. **Inicio de almuerzo**
   ```
   POST /rrhh/attendance/empleado/marcar
   { "type": "BREAK_START" }
   ```

4. **Fin de almuerzo**
   ```
   POST /rrhh/attendance/empleado/marcar
   { "type": "BREAK_END" }
   ```

5. **Salida del trabajo**
   ```
   POST /rrhh/attendance/empleado/marcar
   { "type": "CHECK_OUT" }
   ```

6. **Ver resumen del día**
   ```
   GET /rrhh/attendance/empleado/mi-resumen
   ```

---

## ⚠️ Validaciones y Restricciones

### Secuencia de Marcación

El sistema valida que se siga esta secuencia:

```
CHECK_IN → BREAK_START → BREAK_END → CHECK_OUT
```

**Errores comunes:**
- ❌ No se puede hacer CHECK_OUT sin CHECK_IN
- ❌ No se puede hacer BREAK_START sin CHECK_IN
- ❌ No se puede hacer BREAK_END sin BREAK_START
- ❌ No se puede marcar dos veces el mismo tipo en el mismo día

### Validación de Horarios

- ✅ El sistema valida que la marcación esté dentro del horario asignado
- ✅ Se aplica tolerancia configurada (por defecto 15 minutos)
- ✅ Si llega tarde, se marca automáticamente como `LATE`

### Seguridad

- 🔒 El empleado **solo puede marcar su propia asistencia**
- 🔒 El `userId` se obtiene del token JWT, no del request body
- 🔒 No se puede marcar asistencia de otros empleados

---

## 🆚 Diferencias con Endpoints Admin

| Característica | Endpoints Empleado | Endpoints Admin |
|---------------|-------------------|-----------------|
| Ruta base | `/empleado/` | `/admin/` |
| Permisos | `empleado.marcar/ver` | `admin` |
| Scope | Solo propio usuario | Cualquier usuario |
| userId | Desde JWT (automático) | Parámetro de ruta |

### Ejemplos de Comparación

**Empleado:**
```
GET /rrhh/attendance/empleado/mi-resumen
```

**Admin:**
```
GET /rrhh/attendance/admin/summary/673f8a9b5c4e3d2a1b0e9f8a/2025-10-09
```

---

## 🛠️ Integración Frontend

### Ejemplo con fetch

```javascript
// Marcar entrada
async function marcarEntrada() {
  const response = await fetch('/rrhh/attendance/empleado/marcar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'CHECK_IN',
      location: await getLocation(), // Obtener geolocalización
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      }
    })
  });
  
  return await response.json();
}

// Obtener estado actual
async function obtenerEstado() {
  const response = await fetch('/rrhh/attendance/empleado/estado-actual', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
}
```

---

## 📊 Estados de Asistencia

| Estado | Descripción |
|--------|-------------|
| `PRESENT` | Asistió a tiempo |
| `LATE` | Llegó tarde (después de tolerancia) |
| `ABSENT` | No asistió |
| `EXCUSED` | Falta justificada |

---

## 🔍 Troubleshooting

### Error: "User ID not found in request"
- Verificar que el token JWT sea válido
- Verificar que el token contenga `id` o `userId`

### Error: "Cannot mark CHECK_OUT without CHECK_IN"
- Verificar la secuencia de marcación
- Llamar a `/estado-actual` para ver el estado

### Error: "Marking outside allowed working hours"
- Verificar el horario asignado en `/mi-horario`
- Contactar con RRHH para ajustar horario

---

## 📝 Sistema de Justificaciones

### Justificar Asistencia
**POST** `/rrhh/attendance/empleado/justificar/:recordId`

Permite al empleado justificar un registro de asistencia (tardanza o ausencia).

**Request Body:**
```json
{
  "justification": "Tráfico pesado en la autopista norte"
}
```

**Response:**
```json
{
  "id": "673f8a9b5c4e3d2a1b0e9f8a",
  "justification": "Tráfico pesado en la autopista norte",
  "justificationStatus": "JUSTIFIED",
  "justifiedAt": "2024-01-15T10:30:00.000Z",
  "message": "Justificación agregada correctamente"
}
```

### Ver Justificaciones Pendientes
**GET** `/rrhh/attendance/empleado/mis-pendientes`

Obtiene los registros del empleado que requieren justificación.

**Response:**
```json
[
  {
    "_id": "673f8a9b5c4e3d2a1b0e9f8a",
    "type": "CHECK_IN",
    "timestamp": "2024-01-15T08:45:00.000Z",
    "status": "LATE",
    "justificationStatus": "PENDING",
    "empleadoId": {
      "nombre": "Juan",
      "apellido": "Pérez"
    },
    "areaId": {
      "name": "Ventas",
      "code": "VTS"
    }
  }
]
```

### Reglas de Justificación
- Solo se pueden justificar registros propios
- Máximo 7 días de antigüedad
- Justificación mínima 10 caracteres
- Solo registros con status LATE o ABSENT
- Una vez justificado, no se puede modificar

### Estados de Justificación
| Estado | Descripción |
|--------|-------------|
| `PENDING` | Requiere justificación (automático para LATE/ABSENT) |
| `JUSTIFIED` | Justificación aprobada |
| `REJECTED` | Justificación rechazada por admin |

---

## 📝 Notas Importantes

1. **Geolocalización**: Es opcional pero recomendada para auditoría
2. **Device Info**: Se captura automáticamente del request, pero puede enviarse explícitamente
3. **IP Address**: Se normaliza automáticamente (maneja IPv6, localhost, etc.)
4. **Timestamps**: Todos los timestamps son en UTC
5. **Tolerancia**: Configurable por el admin, por defecto 15 minutos
6. **Justificaciones**: Los registros de tardanza o ausencia se marcan automáticamente como pendientes

---

## 🚀 Próximas Mejoras

- [ ] Notificaciones push cuando se acerca la hora de entrada
- [ ] Recordatorios para marcar salida
- [ ] Integración con calendario
- [ ] Dashboard personal de estadísticas
- [ ] Exportación de reportes en PDF

---

## 📞 Soporte

Para problemas o consultas sobre el sistema de asistencia, contactar al departamento de RRHH o abrir un ticket en el sistema interno.
