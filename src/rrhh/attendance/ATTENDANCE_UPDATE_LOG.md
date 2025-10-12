# Actualización: Sistema de Asistencia para Empleados

## 📅 Fecha de Actualización
9 de Octubre de 2025

## 🎯 Objetivo
Implementar endpoints específicos para que los empleados puedan marcar su propia asistencia de forma autónoma, sin necesidad de permisos administrativos.

---

## ✅ Cambios Implementados

### 1. **Nuevos Endpoints en AttendanceController**

Se agregaron 7 nuevos endpoints bajo la ruta `/empleado/`:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/empleado/marcar` | POST | Marcar asistencia propia |
| `/empleado/mi-resumen` | GET | Resumen del día actual |
| `/empleado/mi-resumen/:date` | GET | Resumen de fecha específica |
| `/empleado/mis-registros` | GET | Historial de registros |
| `/empleado/mi-horario` | GET | Horario asignado |
| `/empleado/estado-actual` | GET | Estado actual de asistencia |
| `/empleado/tiempo-restante` | GET | Tiempo para check-in |
| `/empleado/mi-reporte` | GET | Reporte de rango de fechas |

### 2. **Nuevos Métodos en AttendanceService**

#### `getCurrentAttendanceStatus(userId: string)`
Obtiene el estado completo de asistencia del día, incluyendo:
- Último registro del día
- Próximo tipo de marca esperado
- Todos los registros del día
- Resumen de horas
- Tipos de marcación permitidos

#### `getAllowedAttendanceTypes(...)`
Determina qué tipos de marcación están permitidos según el estado actual del empleado.

---

## 🔒 Nuevos Permisos Requeridos

Se deben crear los siguientes permisos en el sistema RBAC:

```typescript
// Permisos para empleados
'rrhh.attendance.empleado.marcar'  // Para marcar asistencia
'rrhh.attendance.empleado.ver'     // Para ver información propia
```

### Script SQL/MongoDB para crear permisos

```javascript
// Insertar en la colección de permisos
db.permissions.insertMany([
  {
    code: 'rrhh.attendance.empleado.marcar',
    name: 'Marcar Asistencia Propia',
    description: 'Permite al empleado marcar su propia asistencia',
    module: 'rrhh',
    category: 'attendance',
    isActive: true
  },
  {
    code: 'rrhh.attendance.empleado.ver',
    name: 'Ver Asistencia Propia',
    description: 'Permite al empleado ver su propia información de asistencia',
    module: 'rrhh',
    category: 'attendance',
    isActive: true
  }
]);
```

### Asignar permisos a roles de empleados

```javascript
// Actualizar roles de empleados para incluir los nuevos permisos
db.roles.updateMany(
  { code: { $in: ['EMPLEADO', 'TRABAJADOR', 'STAFF'] } },
  {
    $push: {
      permissions: {
        $each: [
          'rrhh.attendance.empleado.marcar',
          'rrhh.attendance.empleado.ver'
        ]
      }
    }
  }
);
```

---

## 🛡️ Validaciones de Seguridad Implementadas

### 1. **Autoservicio Obligatorio**
- El `userId` siempre se extrae del token JWT (`req.user`)
- No se permite especificar el usuario en el body o query
- Cada empleado solo puede ver/modificar su propia asistencia

### 2. **Validaciones Existentes Mantenidas**
- ✅ Secuencia de marcación (CHECK_IN → BREAK → CHECK_OUT)
- ✅ Validación de horarios de trabajo
- ✅ Tolerancia configurable
- ✅ Cálculo automático de tardanzas
- ✅ Verificación de que la asistencia esté habilitada globalmente

---

## 📊 Impacto en el Sistema

### ✅ Sin Cambios Destructivos
- **Los endpoints existentes NO fueron modificados**
- Los endpoints admin (`/admin/*`) siguen funcionando igual
- El endpoint general `/mark` se mantiene sin cambios
- La lógica del servicio se amplió, no se modificó

### 📈 Beneficios
1. **Separación de Responsabilidades**: Endpoints claros para empleados vs admin
2. **Mejor Seguridad**: Autoservicio forzado, no se puede marcar por otros
3. **Mejor UX**: Endpoints específicos con nombres descriptivos
4. **Auditoría Mejorada**: Los registros mantienen quién marcó (`markedBy`)

---

## 🔄 Compatibilidad con Versiones Anteriores

### ✅ Totalmente Compatible
- Los clientes existentes que usan `/mark`, `/records`, etc. siguen funcionando
- No se eliminó ni modificó ningún endpoint existente
- No se modificaron schemas ni interfaces existentes
- Los permisos antiguos siguen válidos

---

## 📝 Archivos Modificados

```
src/rrhh/attendance/
├── attendance.controller.ts     [MODIFICADO] +196 líneas
├── attendance.service.ts        [MODIFICADO] +104 líneas
├── ATTENDANCE_EMPLEADO_README.md [NUEVO]
└── ATTENDANCE_UPDATE_LOG.md     [NUEVO - este archivo]
```

---

## 🧪 Testing Recomendado

### 1. Pruebas de Endpoints Empleado

```bash
# 1. Marcar entrada
curl -X POST http://localhost:3000/rrhh/attendance/empleado/marcar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "CHECK_IN"}'

# 2. Ver estado actual
curl -X GET http://localhost:3000/rrhh/attendance/empleado/estado-actual \
  -H "Authorization: Bearer $TOKEN"

# 3. Ver resumen del día
curl -X GET http://localhost:3000/rrhh/attendance/empleado/mi-resumen \
  -H "Authorization: Bearer $TOKEN"

# 4. Ver mi horario
curl -X GET http://localhost:3000/rrhh/attendance/empleado/mi-horario \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Pruebas de Seguridad

```bash
# Intentar marcar asistencia de otro usuario (debe fallar)
# El sistema ignora cualquier userId en el body y usa el del token
curl -X POST http://localhost:3000/rrhh/attendance/empleado/marcar \
  -H "Authorization: Bearer $TOKEN_USER_A" \
  -H "Content-Type: application/json" \
  -d '{"type": "CHECK_IN", "userId": "otro_usuario_id"}'
# Resultado: Marca la asistencia de USER_A, no de otro_usuario_id
```

### 3. Pruebas de Validación de Secuencia

```bash
# 1. Intentar CHECK_OUT sin CHECK_IN (debe fallar)
curl -X POST http://localhost:3000/rrhh/attendance/empleado/marcar \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type": "CHECK_OUT"}'
# Error esperado: "Cannot mark CHECK_OUT without CHECK_IN"

# 2. Secuencia correcta
curl -X POST http://localhost:3000/rrhh/attendance/empleado/marcar \
  -d '{"type": "CHECK_IN"}' && \
curl -X POST http://localhost:3000/rrhh/attendance/empleado/marcar \
  -d '{"type": "BREAK_START"}' && \
curl -X POST http://localhost:3000/rrhh/attendance/empleado/marcar \
  -d '{"type": "BREAK_END"}' && \
curl -X POST http://localhost:3000/rrhh/attendance/empleado/marcar \
  -d '{"type": "CHECK_OUT"}'
```

---

## 🚀 Pasos para Deployment

### 1. Pre-deployment
```bash
# 1. Backup de la base de datos
mongodump --db=onlytop --collection=attendance_records

# 2. Revisar cambios
git diff src/rrhh/attendance/

# 3. Correr tests
npm run test:e2e
```

### 2. Deployment
```bash
# 1. Pull del código
git pull origin main

# 2. Instalar dependencias (si hay nuevas)
npm install

# 3. Compilar
npm run build

# 4. Reiniciar el servidor
pm2 restart only-top-backend
```

### 3. Post-deployment
```bash
# 1. Crear los nuevos permisos (ver sección "Nuevos Permisos")
# 2. Asignar permisos a roles de empleados
# 3. Verificar que los endpoints funcionan
# 4. Monitorear logs por 24 horas
```

---

## 📊 Métricas a Monitorear

Después del deployment, monitorear:

1. **Uso de Endpoints**
   - Cantidad de llamadas a `/empleado/marcar`
   - Errores de validación de secuencia
   - Errores de permisos

2. **Performance**
   - Tiempo de respuesta de endpoints
   - Carga en la base de datos
   - Uso de memoria

3. **Errores**
   - Errores de autenticación
   - Errores de validación de horarios
   - Excepciones no manejadas

---

## 🐛 Rollback Plan

Si es necesario revertir los cambios:

### Opción 1: Revertir Commit
```bash
git revert <commit-hash>
git push origin main
npm run build
pm2 restart only-top-backend
```

### Opción 2: Desactivar Endpoints
En `attendance.controller.ts`, comentar los métodos `@Post('empleado/marcar')` y similares.

### Opción 3: Desactivar Permisos
```javascript
db.permissions.updateMany(
  { code: { $regex: /^rrhh\.attendance\.empleado/ } },
  { $set: { isActive: false } }
);
```

---

## 📚 Documentación Adicional

- Ver `ATTENDANCE_EMPLEADO_README.md` para documentación completa de API
- Ver `CARTERA_MODULE_README.md` para arquitectura general del módulo RRHH
- Ver `/rbac/` para gestión de permisos

---

## 👥 Equipo Responsable

- **Backend**: Implementación completada
- **Frontend**: Pendiente de implementación
- **RRHH**: Revisión de procesos y validaciones
- **DevOps**: Deployment y monitoreo

---

## ✅ Checklist de Implementación

### Backend
- [x] Implementar endpoints de empleado
- [x] Implementar validaciones de seguridad
- [x] Implementar método `getCurrentAttendanceStatus`
- [x] Crear documentación de API
- [x] Testing local

### Permisos
- [ ] Crear permisos en base de datos
- [ ] Asignar permisos a roles de empleados
- [ ] Verificar que los permisos funcionan

### Frontend
- [ ] Crear componentes de UI para marcar asistencia
- [ ] Integrar con endpoints nuevos
- [ ] Testing de integración
- [ ] Diseño de UX/UI

### Deployment
- [ ] Backup de base de datos
- [ ] Deploy a staging
- [ ] Testing en staging
- [ ] Deploy a producción
- [ ] Monitoreo post-deployment

### Documentación
- [x] README de API
- [x] Log de cambios
- [ ] Actualizar wiki interna
- [ ] Training para empleados

---

## 💡 Recomendaciones

1. **Comunicación**: Informar a empleados sobre el nuevo sistema
2. **Training**: Realizar sesión de capacitación
3. **Gradual Rollout**: Considerar habilitar por áreas/departamentos
4. **Feedback**: Recopilar feedback de usuarios en las primeras semanas
5. **Mejoras Continuas**: Iterar basado en feedback

---

## 📞 Contacto

Para preguntas o problemas relacionados con esta actualización:
- Email: dev@onlytop.com
- Slack: #rrhh-attendance
- Wiki: https://wiki.onlytop.com/rrhh/attendance

---

**Versión del Sistema**: 2.0.0  
**Fecha de Implementación**: 9 de Octubre de 2025  
**Estado**: ✅ Implementación Backend Completa
