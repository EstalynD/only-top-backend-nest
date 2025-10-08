# Módulo de Gestión de Ventas de Chatters

## Descripción

Módulo profesional para la gestión integral de ventas realizadas por el equipo de Chatters. Este sistema permite el registro, análisis y reporte de ventas diarias de contenido digital gestionadas por chatters en diferentes turnos para cada modelo de OnlyFans.

## Características Principales

### 1. **Registro de Ventas**
- Registro manual de ventas diarias por chatter y modelo
- Asociación automática con el turno correspondiente (AM, PM, Madrugada, Supernumerario)
- Validación de asignación chatter-modelo
- Categorización por tipo de venta (Tips, Contenido Personalizado, Suscripciones, PPV, etc.)
- Soporte para múltiples plataformas (OnlyFans, Fansly, etc.)

### 2. **Análisis por Grupos de Chatters**
- Visualización de ventas por grupo (4 chatters asignados a una modelo)
- Desglose por turno: AM, PM, Madrugada, Supernumerario
- Totales y promedios por grupo
- Comparación entre múltiples grupos

### 3. **Estadísticas por Chatter**
- Total de ventas y montos por chatter individual
- Desempeño por tipo de venta
- Distribución de ventas por modelo atendida
- Promedios y rankings

### 4. **Estadísticas Generales**
- Dashboard con métricas globales del sistema
- Top 10 chatters por ventas
- Top 10 modelos por ventas
- Tendencias y análisis comparativos

### 5. **Reportes en PDF**
- Reportes profesionales de ventas por grupo
- Estadísticas individuales de chatters
- Comparación de grupos
- Reporte general del sistema
- Diseño profesional con gráficos y tablas

## Arquitectura

```
chatter/
├── chatter-sale.schema.ts          # Schema de ventas con MongoDB
├── chatter-sales.service.ts        # Lógica de negocio principal
├── chatter-sales.controller.ts     # Endpoints REST API
├── chatter-pdf.service.ts          # Generación de PDFs profesionales
├── chatter.module.ts               # Módulo NestJS
├── dto/
│   ├── create-chatter-sale.dto.ts  # DTO para crear ventas
│   ├── update-chatter-sale.dto.ts  # DTO para actualizar ventas
│   └── filter-sales.dto.ts         # DTO para filtrar ventas
└── README.md                       # Documentación
```

## Modelos de Datos

### ChatterSale (Venta)

```typescript
{
  modeloId: ObjectId,              // Modelo atendida
  chatterId: ObjectId,             // Chatter responsable
  monto: number,                   // Monto en USD
  moneda: string,                  // Moneda (USD por defecto)
  tipoVenta: TipoVenta,            // Tipo de venta
  turno: TurnoChatter,             // Turno del chatter
  fechaVenta: Date,                // Fecha y hora de la venta
  descripcion?: string,            // Descripción opcional
  notasInternas?: string,          // Notas internas
  plataforma?: string,             // Plataforma (OnlyFans, Fansly, etc.)
  registradoPor?: ObjectId,        // Usuario que registró
  meta?: Record<string, any>       // Metadata adicional
}
```

### Tipos de Venta

- `TIP` - Propinas
- `CONTENIDO_PERSONALIZADO` - Contenido personalizado
- `SUSCRIPCION` - Suscripción
- `PPV` - Pay Per View
- `SEXTING` - Sexting
- `VIDEO_CALL` - Videollamada
- `AUDIO_CALL` - Llamada de audio
- `MENSAJE_MASIVO` - Mensaje masivo
- `OTRO` - Otro tipo

### Turnos de Chatters

- `AM` - Turno mañana
- `PM` - Turno tarde
- `MADRUGADA` - Turno madrugada
- `SUPERNUMERARIO` - Chatter de apoyo

## API Endpoints

### Gestión de Ventas

#### Crear Venta
```http
POST /api/chatter/sales
Authorization: Bearer {token}
Content-Type: application/json

{
  "modeloId": "673abc123...",
  "chatterId": "673def456...",
  "monto": 150.50,
  "tipoVenta": "CONTENIDO_PERSONALIZADO",
  "turno": "PM",
  "fechaVenta": "2025-10-03T14:30:00Z",
  "plataforma": "OnlyFans"
}
```

#### Listar Ventas con Filtros
```http
GET /api/chatter/sales?modeloId={id}&fechaInicio={date}&fechaFin={date}
Authorization: Bearer {token}
```

Filtros disponibles:
- `modeloId` - Filtrar por modelo
- `chatterId` - Filtrar por chatter
- `tipoVenta` - Filtrar por tipo de venta
- `turno` - Filtrar por turno
- `fechaInicio` - Fecha de inicio
- `fechaFin` - Fecha de fin
- `plataforma` - Filtrar por plataforma

#### Obtener Venta por ID
```http
GET /api/chatter/sales/{id}
Authorization: Bearer {token}
```

#### Actualizar Venta
```http
PATCH /api/chatter/sales/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "monto": 175.00,
  "notasInternas": "Actualización de monto"
}
```

#### Eliminar Venta
```http
DELETE /api/chatter/sales/{id}
Authorization: Bearer {token}
```

### Análisis y Estadísticas

#### Ventas por Grupo (Modelo + 4 Chatters)
```http
GET /api/chatter/sales/grupo/{modeloId}?fechaInicio={date}&fechaFin={date}
Authorization: Bearer {token}
```

Respuesta:
```json
{
  "modelo": {
    "id": "673abc...",
    "nombreCompleto": "María García",
    "correoElectronico": "maria@example.com"
  },
  "grupo": {
    "AM": {
      "chatter": { "nombre": "Juan", "apellido": "Pérez" },
      "ventas": [...],
      "total": 1250.50
    },
    "PM": { ... },
    "MADRUGADA": { ... },
    "SUPERNUMERARIO": { ... }
  },
  "totalGrupo": 5430.75,
  "totalVentas": 45,
  "periodo": { "fechaInicio": "2025-10-01", "fechaFin": "2025-10-31" }
}
```

#### Estadísticas por Chatter
```http
GET /api/chatter/sales/chatter/{chatterId}/stats?fechaInicio={date}&fechaFin={date}
Authorization: Bearer {token}
```

#### Estadísticas por Modelo
```http
GET /api/chatter/sales/modelo/{modeloId}/stats?fechaInicio={date}&fechaFin={date}
Authorization: Bearer {token}
```

#### Estadísticas Generales
```http
GET /api/chatter/sales/stats/general?fechaInicio={date}&fechaFin={date}
Authorization: Bearer {token}
```

#### Comparar Grupos
```http
POST /api/chatter/sales/comparar-grupos
Authorization: Bearer {token}
Content-Type: application/json

{
  "modeloIds": ["673abc...", "673def...", "673ghi..."],
  "fechaInicio": "2025-10-01",
  "fechaFin": "2025-10-31"
}
```

### Chatters

#### Chatters Activos
```http
GET /api/chatter/sales/chatters/active
Authorization: Bearer {token}
```

#### Chatters de una Modelo
```http
GET /api/chatter/sales/modelo/{modeloId}/chatters
Authorization: Bearer {token}
```

### Exportación a PDF

#### Exportar Reporte de Grupo
```http
GET /api/chatter/sales/grupo/{modeloId}/pdf?fechaInicio={date}&fechaFin={date}
Authorization: Bearer {token}
```

#### Exportar Estadísticas de Chatter
```http
GET /api/chatter/sales/chatter/{chatterId}/stats/pdf?fechaInicio={date}&fechaFin={date}
Authorization: Bearer {token}
```

#### Exportar Comparación de Grupos
```http
POST /api/chatter/sales/comparar-grupos/pdf
Authorization: Bearer {token}
Content-Type: application/json

{
  "modeloIds": ["673abc...", "673def..."],
  "fechaInicio": "2025-10-01",
  "fechaFin": "2025-10-31"
}
```

#### Exportar Reporte General
```http
GET /api/chatter/sales/stats/general/pdf?fechaInicio={date}&fechaFin={date}
Authorization: Bearer {token}
```

## Permisos Requeridos

Todos los endpoints requieren autenticación mediante JWT token y los siguientes permisos RBAC:

- `ventas:chatting:create` - Crear ventas
- `ventas:chatting:read` - Leer ventas y estadísticas
- `ventas:chatting:update` - Actualizar ventas
- `ventas:chatting:delete` - Eliminar ventas

## Validaciones de Negocio

1. **Validación de Asignación**: El chatter debe estar asignado a la modelo en el equipo de chatters
2. **Validación de Estado**: Solo chatters activos pueden registrar ventas
3. **Validación de Modelo**: Solo modelos activas pueden tener ventas registradas
4. **Validación de Turno**: El turno debe coincidir con la asignación del chatter en el grupo

## Integración con Otros Módulos

- **RRHH Module**: Utiliza `ModeloEntity` y `EmpleadoEntity` para asociar ventas
- **Auth Module**: Integración completa con `AuthGuard` para seguridad
- **RBAC Module**: Sistema de permisos granular con `RequirePermissions`
- **PDF Module**: Reutiliza estilos y estructura para generación de PDFs

## Índices de Base de Datos

Para optimizar el rendimiento, se crean los siguientes índices:

```typescript
// Índices simples
- modeloId (index)
- chatterId (index)
- fechaVenta (index)
- tipoVenta (index)
- turno (index)

// Índices compuestos
- { modeloId: 1, fechaVenta: -1 }
- { chatterId: 1, fechaVenta: -1 }
- { modeloId: 1, chatterId: 1, fechaVenta: -1 }
- { tipoVenta: 1, fechaVenta: -1 }
- { turno: 1, fechaVenta: -1 }
```

## Flujo de Trabajo Típico

### 1. Registro Manual de Venta
```
Usuario Admin/Supervisor
  ↓
  Selecciona Modelo
  ↓
  Sistema muestra Chatters del Grupo
  ↓
  Selecciona Chatter + Turno
  ↓
  Ingresa datos de venta
  ↓
  Sistema valida y guarda
  ↓
  Venta registrada exitosamente
```

### 2. Consulta de Rendimiento por Grupo
```
Supervisor/Admin
  ↓
  Selecciona Modelo
  ↓
  Selecciona Periodo
  ↓
  Sistema genera análisis por grupo
  ↓
  Visualiza ventas por chatter/turno
  ↓
  Opción de exportar a PDF
```

### 3. Comparación de Grupos
```
Admin/Gerencia
  ↓
  Selecciona múltiples Modelos
  ↓
  Define periodo de análisis
  ↓
  Sistema compara rendimiento
  ↓
  Genera ranking y comparativas
  ↓
  Exporta reporte profesional
```

## Próximas Mejoras

- [ ] Importación masiva desde Excel
- [ ] Tracking de sesiones activas en tiempo real
- [ ] Notificaciones automáticas de objetivos alcanzados
- [ ] Dashboard con gráficos interactivos
- [ ] API para integración con herramientas externas
- [ ] Exportación a Excel con análisis avanzados
- [ ] Predicciones basadas en históricos

## Soporte y Mantenimiento

Para reportar bugs o solicitar nuevas funcionalidades, contactar al equipo de desarrollo de OnlyTop.

**Versión**: 1.0.0  
**Última actualización**: Octubre 2025  
**Autor**: OnlyTop Development Team

