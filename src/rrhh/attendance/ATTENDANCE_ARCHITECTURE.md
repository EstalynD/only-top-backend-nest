# 📊 Arquitectura de Endpoints - Sistema de Asistencia

## 🗺️ Mapa de Rutas

```
/rrhh/attendance
│
├── /mark [POST]                                    🔐 rrhh.attendance.marcar
│   └── Marcación general (legacy/admin)
│
├── /empleado/                                      👤 ENDPOINTS PARA EMPLEADOS
│   ├── /marcar [POST]                             🔐 rrhh.attendance.empleado.marcar
│   │   └── Marcar asistencia propia
│   │
│   ├── /mi-resumen [GET]                          🔐 rrhh.attendance.empleado.ver
│   │   └── Resumen del día actual
│   │
│   ├── /mi-resumen/:date [GET]                    🔐 rrhh.attendance.empleado.ver
│   │   └── Resumen de fecha específica
│   │
│   ├── /mis-registros [GET]                       🔐 rrhh.attendance.empleado.ver
│   │   └── Historial de registros con filtros
│   │
│   ├── /mi-horario [GET]                          🔐 rrhh.attendance.empleado.ver
│   │   └── Horario de trabajo asignado
│   │
│   ├── /estado-actual [GET]                       🔐 rrhh.attendance.empleado.ver
│   │   └── Estado actual + próxima acción
│   │
│   ├── /tiempo-restante [GET]                     🔐 rrhh.attendance.empleado.ver
│   │   └── Tiempo para check-in
│   │
│   └── /mi-reporte [GET]                          🔐 rrhh.attendance.empleado.ver
│       └── Reporte de rango de fechas
│
├── /records [GET]                                  🔐 rrhh.attendance.ver
│   └── Registros del usuario autenticado
│
├── /summary/:date [GET]                            🔐 rrhh.attendance.ver
│   └── Resumen de fecha
│
├── /summary/today [GET]                            🔐 rrhh.attendance.ver
│   └── Resumen del día actual
│
├── /time-remaining [GET]                           🔐 rrhh.attendance.ver
│   └── Tiempo restante para check-in
│
├── /user-schedule [GET]                            🔐 rrhh.attendance.ver
│   └── Horario del usuario autenticado
│
├── /user-schedule/:userId [GET]                    🔐 rrhh.attendance.ver
│   └── Horario de usuario específico
│
├── /report [GET]                                   🔐 rrhh.attendance.ver
│   └── Reporte del usuario autenticado
│
└── /admin/                                         👑 ENDPOINTS ADMINISTRATIVOS
    ├── /records/:userId [GET]                     🔐 rrhh.attendance.admin
    │   └── Registros de cualquier usuario
    │
    ├── /summary/:userId/:date [GET]               🔐 rrhh.attendance.admin
    │   └── Resumen de usuario específico
    │
    ├── /user-schedule/:userId [GET]               🔐 rrhh.attendance.admin
    │   └── Horario de usuario específico
    │
    ├── /report/:userId [GET]                      🔐 rrhh.attendance.admin
    │   └── Reporte de usuario específico
    │
    ├── /mark/:userId [POST]                       🔐 rrhh.attendance.admin
    │   └── Marcar asistencia de cualquier usuario
    │
    └── /stats/today [GET]                         🔐 rrhh.attendance.admin
        └── Estadísticas del día (placeholder)
```

---

## 🎭 Comparación: Empleado vs Admin

| Característica | Endpoints Empleado | Endpoints Admin |
|----------------|-------------------|-----------------|
| **Prefijo** | `/empleado/` | `/admin/` |
| **Permisos** | `empleado.marcar/ver` | `admin` |
| **Alcance** | Solo usuario propio | Cualquier usuario |
| **userId** | Desde JWT (automático) | Parámetro de ruta `:userId` |
| **Uso típico** | Autoservicio diario | Gestión y auditoría |
| **Seguridad** | Alta (no puede ver otros) | Alta (requiere permiso admin) |

---

## 🔐 Matriz de Permisos

| Endpoint | Permiso Requerido | Tipo de Usuario |
|----------|-------------------|-----------------|
| `POST /empleado/marcar` | `rrhh.attendance.empleado.marcar` | 👤 Empleado |
| `GET /empleado/mi-resumen` | `rrhh.attendance.empleado.ver` | 👤 Empleado |
| `GET /empleado/mis-registros` | `rrhh.attendance.empleado.ver` | 👤 Empleado |
| `GET /empleado/mi-horario` | `rrhh.attendance.empleado.ver` | 👤 Empleado |
| `GET /empleado/estado-actual` | `rrhh.attendance.empleado.ver` | 👤 Empleado |
| `GET /empleado/tiempo-restante` | `rrhh.attendance.empleado.ver` | 👤 Empleado |
| `GET /empleado/mi-reporte` | `rrhh.attendance.empleado.ver` | 👤 Empleado |
| `POST /mark` | `rrhh.attendance.marcar` | 👤 Empleado / 👑 Admin |
| `GET /records` | `rrhh.attendance.ver` | 👤 Empleado / 👑 Admin |
| `GET /admin/*` | `rrhh.attendance.admin` | 👑 Admin |

---

## 🔄 Flujos de Trabajo

### Flujo 1: Empleado Marca Asistencia Normal

```
┌─────────────┐
│  Empleado   │
│  Llega al   │
│   Trabajo   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│ GET /empleado/estado-actual         │
│ Verificar si ya marcó entrada       │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ POST /empleado/marcar               │
│ { type: "CHECK_IN" }                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Response: Status PRESENT/LATE       │
│ + Información de horario            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ ... Trabaja ...                     │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ POST /empleado/marcar               │
│ { type: "BREAK_START" }             │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ ... Almuerza ...                    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ POST /empleado/marcar               │
│ { type: "BREAK_END" }               │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ ... Trabaja ...                     │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ POST /empleado/marcar               │
│ { type: "CHECK_OUT" }               │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ GET /empleado/mi-resumen            │
│ Ver resumen del día completo        │
└─────────────────────────────────────┘
```

### Flujo 2: Admin Gestiona Asistencia de Empleado

```
┌─────────────┐
│    Admin    │
│   Revisa    │
│ Asistencias │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ GET /admin/records/:userId              │
│ Ver todos los registros del empleado   │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ GET /admin/summary/:userId/:date        │
│ Ver resumen de día específico           │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Detecta que empleado olvidó marcar     │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ POST /admin/mark/:userId                │
│ { type: "CHECK_IN", notes: "..." }     │
│ Marcar asistencia en nombre del user   │
└─────────────────────────────────────────┘
```

### Flujo 3: Empleado Consulta su Historial

```
┌─────────────┐
│  Empleado   │
│   Quiere    │
│ Ver Reporte │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ GET /empleado/mi-horario                    │
│ Ver su horario asignado                     │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ GET /empleado/mis-registros                 │
│ ?startDate=2025-10-01&endDate=2025-10-09   │
│ Ver registros del mes                       │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ GET /empleado/mi-reporte                    │
│ ?startDate=2025-10-01&endDate=2025-10-09   │
│ Ver reporte con estadísticas                │
└─────────────────────────────────────────────┘
```

---

## 🧩 Componentes del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                   AttendanceController                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Empleado Endpoints                    │  │
│  │  - marcar, mi-resumen, mis-registros, etc.        │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Admin Endpoints                       │  │
│  │  - admin/mark/:userId, admin/records/:userId       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   AttendanceService                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Core Methods                                      │  │
│  │  - markAttendance()                               │  │
│  │  - getUserAttendance()                            │  │
│  │  - getAttendanceSummary()                         │  │
│  │  - getUserAssignedSchedule()                      │  │
│  │  - getAttendanceReport()                          │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  New Methods (v2.0)                               │  │
│  │  - getCurrentAttendanceStatus()                   │  │
│  │  - getAllowedAttendanceTypes()                    │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Validation Methods                               │  │
│  │  - validateAttendanceType()                       │  │
│  │  - validateWorkingHours()                         │  │
│  │  - determineAttendanceStatus()                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│              AttendanceConfigService                     │
│  - getAttendanceConfig()                                │
│  - ensureAttendanceAllowed()                            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   EmpleadosService                       │
│  - findEmpleadoById()                                   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                MongoDB: attendance_records               │
│  {                                                       │
│    userId, empleadoId, type, timestamp,                 │
│    status, shiftId, areaId, cargoId,                    │
│    location, deviceInfo, markedBy                       │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 📈 Estadísticas de Uso Esperadas

### Distribución de Llamadas por Endpoint (Estimación)

```
POST /empleado/marcar              ████████████████████ 40%
GET  /empleado/estado-actual       ████████████ 25%
GET  /empleado/mi-resumen          ████████ 15%
GET  /empleado/mis-registros       ████ 8%
GET  /empleado/mi-horario          ███ 6%
GET  /empleado/tiempo-restante     ██ 4%
GET  /empleado/mi-reporte          █ 2%
```

### Horarios Pico de Uso

```
Check-In:  07:00-09:00  ████████████████████
Break:     12:00-13:00  ██████████
Check-Out: 16:00-18:00  ████████████████████
```

---

## 🔍 Debugging Guide

### Verificar Estado de Asistencia

```bash
# 1. Ver estado actual
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/rrhh/attendance/empleado/estado-actual

# 2. Verificar horario
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/rrhh/attendance/empleado/mi-horario

# 3. Ver registros del día
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/rrhh/attendance/empleado/mis-registros?startDate=2025-10-09
```

### Logs Importantes

```typescript
// En AttendanceService
this.logger.log(`Attendance marked: ${type} for user ${userId} at ${timestamp}`);
this.logger.log(`Getting schedule for user ${userId}, area: ${areaId}, cargo: ${cargoId}`);
```

---

## 🎯 KPIs del Sistema

| Métrica | Objetivo | Actual |
|---------|----------|--------|
| Tasa de marcación a tiempo | > 85% | - |
| Uso de app móvil | > 60% | - |
| Tiempo promedio de marcación | < 30s | - |
| Errores de validación | < 5% | - |
| Satisfacción del usuario | > 4.0/5.0 | - |

---

## 🔮 Roadmap Futuro

### Fase 2 (Q1 2026)
- [ ] Notificaciones push
- [ ] Geofencing automático
- [ ] Reconocimiento facial
- [ ] Widget de home screen

### Fase 3 (Q2 2026)
- [ ] Integración con control de acceso físico
- [ ] Dashboard analytics avanzado
- [ ] Predicciones con ML
- [ ] App móvil nativa

---

**Última actualización**: 9 de Octubre de 2025  
**Versión**: 2.0.0  
**Mantenedor**: Backend Team
