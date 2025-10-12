# Sistema de Justificaciones de Asistencia

## Descripción General

El sistema de justificaciones permite a los empleados justificar sus tardanzas y ausencias, y a los administradores de RRHH aprobar o rechazar estas justificaciones. El sistema incluye exportación de reportes a Excel para análisis administrativo.

## Características Principales

### Para Empleados
- **Justificación Automática**: Los registros de tardanza o ausencia se marcan automáticamente como `PENDING`
- **Justificación Manual**: Los empleados pueden justificar sus registros hasta 7 días después
- **Alertas Visuales**: Notificaciones en el marcador de asistencia sobre justificaciones pendientes
- **Historial**: Visualización de justificaciones en el historial de registros

### Para Administradores
- **Panel de Justificaciones**: Vista centralizada de todas las justificaciones pendientes
- **Aprobación/Rechazo**: Capacidad de aprobar o rechazar justificaciones con comentarios
- **Filtros Avanzados**: Filtrado por área, cargo, empleado, estado y fechas
- **Exportación Excel**: Generación de reportes detallados en formato Excel
- **Indicadores de Urgencia**: Código de colores según días pendientes

## Arquitectura del Sistema

### Backend

#### Schema de Asistencia
```typescript
// Campos agregados al AttendanceEntity
justification?: string;           // Texto de justificación
justifiedBy?: string;            // Username quien justificó
justifiedByUserId?: string;      // User ID quien justificó
justifiedAt?: Date;              // Fecha de justificación
justificationStatus?: 'PENDING' | 'JUSTIFIED' | 'REJECTED';
```

#### DTOs
- `JustifyAttendanceDto`: Para justificaciones de empleados
- `AdminJustifyAttendanceDto`: Para justificaciones administrativas (incluye status)

#### Servicios
- `AttendanceService`: Métodos de justificación
- `AttendanceExportService`: Exportación a Excel

#### Endpoints

**Empleados:**
- `POST /empleado/justificar/:recordId` - Justificar registro propio
- `GET /empleado/mis-pendientes` - Ver registros pendientes

**Administradores:**
- `POST /admin/justificar/:recordId` - Justificar cualquier registro
- `GET /admin/pendientes` - Ver todos los pendientes
- `GET /admin/justificaciones` - Historial de justificaciones
- `GET /admin/export/excel` - Exportar a Excel
- `GET /admin/export/individual/:userId` - Exportar individual
- `GET /admin/export/team` - Exportar por equipo

### Frontend

#### Componentes Principales
- `JustificationModal`: Modal para empleados
- `AdminJustificationModal`: Modal para administradores
- `PendingJustificationsPanel`: Panel de justificaciones pendientes
- `ExportPanel`: Panel de exportación Excel

#### Páginas Actualizadas
- `mi-asistencia/page.tsx`: Agregado botón de justificación
- `rrhh/attendance/page.tsx`: Agregado tabs para justificaciones y reportes

## Flujo de Trabajo

### 1. Marcación con Tardanza/Ausencia
1. Empleado marca asistencia tarde o falta
2. Sistema asigna automáticamente `justificationStatus: 'PENDING'`
3. Empleado recibe alerta visual en el marcador

### 2. Justificación por Empleado
1. Empleado accede a "Mis Registros"
2. Ve registros con indicador de justificación pendiente
3. Hace clic en "Justificar"
4. Completa formulario con descripción
5. Sistema actualiza registro con `justificationStatus: 'JUSTIFIED'`

### 3. Revisión Administrativa
1. Administrador accede a tab "Justificaciones"
2. Ve lista de registros pendientes con indicadores de urgencia
3. Selecciona registro para revisar
4. Aprueba o rechaza con comentario administrativo
5. Sistema actualiza registro con decisión final

### 4. Exportación de Reportes
1. Administrador accede a tab "Reportes"
2. Selecciona tipo de reporte (general, individual, equipo)
3. Aplica filtros (fechas, área, cargo, etc.)
4. Descarga archivo Excel con datos detallados

## Estados de Justificación

- **PENDING**: Requiere justificación (automático para LATE/ABSENT)
- **JUSTIFIED**: Justificación aprobada por empleado o admin
- **REJECTED**: Justificación rechazada por admin

## Indicadores de Urgencia

- **Verde**: 0-1 días pendientes (Reciente)
- **Amarillo**: 2-3 días pendientes (Pendiente)
- **Rojo**: 4+ días pendientes (Urgente)

## Permisos

- **Empleados**: Solo pueden justificar sus propios registros
- **Administradores**: Pueden justificar cualquier registro
- **Exportación**: Solo administradores con permiso `rrhh.attendance.admin`

## Validaciones

### Empleados
- Solo pueden justificar registros propios
- Máximo 7 días de antigüedad
- Justificación mínima 10 caracteres
- Solo registros con status PENDING

### Administradores
- Pueden justificar cualquier registro
- Deben proporcionar comentario administrativo
- Deben seleccionar decisión (JUSTIFIED/REJECTED)

## Exportación Excel

### Tipos de Reporte
1. **General**: Todos los registros con filtros aplicados
2. **Individual**: Resumen detallado de un empleado específico
3. **Equipo**: Estadísticas por área o cargo

### Hojas del Excel
- **Resumen**: Estadísticas generales
- **Registros Detallados**: Lista completa con justificaciones
- **Justificaciones Pendientes**: Solo registros pendientes

### Filtros Disponibles
- Rango de fechas
- Área específica
- Cargo específico
- Empleado específico
- Estado de asistencia
- Estado de justificación

## Consideraciones Técnicas

### Performance
- Paginación en listas de justificaciones
- Streaming para exportaciones grandes
- Índices en campos de justificación

### Seguridad
- Validación de permisos en todos los endpoints
- Sanitización de inputs de justificación
- Logs de auditoría para cambios administrativos

### Usabilidad
- Alertas visuales para registros pendientes
- Indicadores de urgencia por colores
- Formularios intuitivos con validación en tiempo real

## Configuración

### Variables de Entorno
```env
# Tiempo límite para justificaciones (días)
ATTENDANCE_JUSTIFICATION_DAYS_LIMIT=7

# Tamaño máximo de justificación (caracteres)
ATTENDANCE_JUSTIFICATION_MAX_LENGTH=500
```

### Configuración de Exportación
- Límite de registros por exportación: 10,000
- Timeout de exportación: 5 minutos
- Formato de archivo: Excel (.xlsx)

## Monitoreo y Logs

### Eventos Registrados
- Creación de justificación por empleado
- Aprobación/rechazo por administrador
- Exportación de reportes
- Errores de validación

### Métricas Importantes
- Tiempo promedio de resolución de justificaciones
- Tasa de aprobación por área/cargo
- Volumen de justificaciones por período
- Uso de exportaciones

## Mantenimiento

### Tareas Regulares
- Limpieza de justificaciones antiguas (opcional)
- Optimización de índices de base de datos
- Revisión de logs de auditoría
- Actualización de documentación

### Troubleshooting Común
- **Error de permisos**: Verificar roles de usuario
- **Exportación lenta**: Revisar filtros y volumen de datos
- **Justificaciones no aparecen**: Verificar status PENDING
- **Modal no se abre**: Verificar estado del componente

## Roadmap Futuro

### Funcionalidades Planificadas
- Notificaciones automáticas por email
- Dashboard de métricas de justificaciones
- API para integración con sistemas externos
- Reportes programados automáticos
- Aprobación en cascada por supervisores

### Mejoras Técnicas
- Cache de justificaciones frecuentes
- Compresión de exportaciones grandes
- API GraphQL para consultas complejas
- Integración con sistema de notificaciones push
