# Módulo de Traffic/Trafficker - Campañas de Marketing

## Descripción

Módulo para controlar y analizar campañas de marketing digital ejecutadas por Traffickers para captar modelos o generar suscripciones. Permite registrar campañas con segmentación detallada, presupuestos, rendimiento y seguimiento completo.

## Características Implementadas

### ✅ CRUD Completo de Campañas
- Crear campaña asociada a una modelo y trafficker
- Listar campañas con filtros avanzados
- Obtener detalle de campaña por ID
- Actualizar campaña (presupuesto, estado, rendimiento, etc.)
- Eliminar campaña

### ✅ Filtros Avanzados
- Por modelo
- Por trafficker
- Por plataforma (Reddit, Instagram, TikTok, etc.)
- Por estado (Activa, Pausada, Finalizada)
- Por rango de fechas
- Por país de segmentación

### ✅ Histórico y Estadísticas
- Histórico completo de campañas por modelo
- Estadísticas generales:
  - Total de campañas (activas, pausadas, finalizadas)
  - Presupuesto total asignado vs gastado
  - Promedio de presupuesto por campaña
  - Distribución por plataforma
  - Top países objetivo

### ✅ Validaciones y Seguridad
- Validación de ObjectIds
- Validación de presupuestos (gastado no puede exceder asignado)
- Validación de fechas (publicación no puede ser antes de activación)
- Permisos RBAC granulares
- Logs de operaciones críticas

## Schemas

### TrafficCampaignEntity

```typescript
{
  modeloId: ObjectId,           // Modelo objetivo
  traffickerId: ObjectId,        // Trafficker responsable
  plataforma: enum,              // REDDIT_ORGANICO, REDDIT_ADS, INSTAGRAM, X_TWITTER, TIKTOK, APP_DATES
  segmentaciones: {
    descripcion: string,
    paises: string[],
    regiones: string[],
    edadObjetivo: { min, max },
    intereses: string[]
  },
  fechaActivacion: Date,
  fechaPublicacion: Date,
  fechaFinalizacion: Date,
  presupuesto: {
    asignado: number,
    gastado: number,
    moneda: string
  },
  estado: enum,                  // ACTIVA, PAUSADA, FINALIZADA
  copyUtilizado: string,
  linkPauta: string,
  trackLinkOF: string,
  acortadorUtilizado: enum,      // BITLY, TINYURL, REBRANDLY, etc.
  rendimiento: string,
  notas: string
}
```

## Endpoints

### POST `/api/traffic/campaigns`
Crear nueva campaña
- Permiso: `ventas:traffic:campaigns:create`
- Body: `CreateCampaignDto`

### GET `/api/traffic/campaigns`
Listar campañas con filtros
- Permiso: `ventas:traffic:campaigns:read`
- Query params: `modeloId`, `traffickerId`, `plataforma`, `estado`, `fechaInicio`, `fechaFin`, `pais`

### GET `/api/traffic/campaigns/statistics`
Obtener estadísticas generales
- Permiso: `ventas:traffic:campaigns:read`
- Query params: filtros opcionales

### GET `/api/traffic/campaigns/modelo/:modeloId`
Histórico de campañas por modelo
- Permiso: `ventas:traffic:campaigns:read`

### GET `/api/traffic/campaigns/campaign/:id`
Detalle de campaña
- Permiso: `ventas:traffic:campaigns:read`

### PATCH `/api/traffic/campaigns/campaign/:id`
Actualizar campaña
- Permiso: `ventas:traffic:campaigns:update`
- Body: `UpdateCampaignDto`

### DELETE `/api/traffic/campaigns/campaign/:id`
Eliminar campaña
- Permiso: `ventas:traffic:campaigns:delete`

## Permisos RBAC

```
ventas:traffic:campaigns:create   - Crear campañas
ventas:traffic:campaigns:read     - Ver campañas
ventas:traffic:campaigns:update   - Actualizar campañas
ventas:traffic:campaigns:delete   - Eliminar campañas
ventas:traffic:campaigns:export   - Exportar campañas (futuro)
ventas:traffic:campaigns:stats    - Ver estadísticas (futuro)
```

## Próximas Funcionalidades

- [ ] Exportación a Excel de campañas filtradas
- [ ] Exportación a PDF de reportes de campaña
- [ ] Dashboard de métricas de rendimiento por plataforma
- [ ] Alertas de presupuesto (cuando se exceda cierto % del asignado)
- [ ] Integración con APIs de plataformas para métricas automáticas
- [ ] Comparación de rendimiento entre campañas
- [ ] Recomendaciones de segmentación basadas en histórico

## Ejemplos de Uso

### Crear Campaña

```typescript
POST /api/traffic/campaigns
Authorization: Bearer <token>

{
  "modeloId": "507f1f77bcf86cd799439011",
  "plataforma": "INSTAGRAM",
  "descripcionSegmentacion": "Público femenino joven interesado en fitness",
  "segmentaciones": {
    "paises": ["United States", "Canada"],
    "regiones": ["California", "New York", "Ontario"],
    "edadMin": "18",
    "edadMax": "34",
    "intereses": ["fitness", "wellness", "lifestyle"]
  },
  "fechaActivacion": "2025-01-15T10:00:00Z",
  "fechaPublicacion": "2025-01-15T12:00:00Z",
  "presupuestoAsignado": 500,
  "presupuestoGastado": 0,
  "estado": "ACTIVA",
  "copyUtilizado": "Transform your fitness journey with exclusive content! 💪✨",
  "linkPauta": "https://instagram.com/p/abc123",
  "trackLinkOF": "https://onlyfans.com/modelo123?utm_source=ig&utm_campaign=jan2025",
  "acortadorUtilizado": "BITLY",
  "notas": "Primera campaña de prueba en Instagram"
}
```

### Filtrar Campañas

```typescript
GET /api/traffic/campaigns?plataforma=INSTAGRAM&estado=ACTIVA&fechaInicio=2025-01-01
Authorization: Bearer <token>
```

### Estadísticas

```typescript
GET /api/traffic/campaigns/statistics?modeloId=507f1f77bcf86cd799439011
Authorization: Bearer <token>

Response:
{
  "totalCampaigns": 15,
  "activeCampaigns": 5,
  "pausedCampaigns": 2,
  "finishedCampaigns": 8,
  "totalBudgetAssigned": 7500,
  "totalBudgetSpent": 6200,
  "avgBudgetPerCampaign": 500,
  "campaignsByPlatform": {
    "INSTAGRAM": 8,
    "REDDIT_ADS": 4,
    "TIKTOK": 3
  },
  "topCountries": [
    { "pais": "United States", "campañas": 12 },
    { "pais": "Canada", "campañas": 8 },
    { "pais": "Mexico", "campañas": 5 }
  ]
}
```

## Arquitectura

```
traffic/
├── traffic-campaign.schema.ts       # Schema de Mongoose con enums
├── dto/
│   ├── create-campaign.dto.ts       # DTO de creación con validaciones
│   ├── update-campaign.dto.ts       # DTO de actualización (PartialType)
│   └── filter-campaigns.dto.ts      # DTO de filtros para queries
├── traffic-campaigns.service.ts     # Lógica de negocio y queries
├── traffic-campaigns.controller.ts  # Endpoints REST
├── traffic.module.ts                # Módulo NestJS
└── README.md                        # Documentación (este archivo)
```

## Convenciones Aplicadas

✅ Rutas con prefijos específicos (`/campaign/:id`) para evitar colisiones  
✅ ValidationPipe con `skipMissingProperties: true` para query params opcionales  
✅ Validación de ObjectIds antes de queries  
✅ Populate de datos relacionados en respuestas  
✅ Permisos RBAC granulares por operación  
✅ Logs de operaciones críticas  
✅ Índices compuestos en Mongoose para queries frecuentes  
✅ DTOs con validaciones exhaustivas usando class-validator  

## Notas Técnicas

- Las fechas se validan con `@IsDateString()` en DTOs y se convierten a `Date` en el servicio
- Los presupuestos se validan para que `gastado` nunca exceda `asignado`
- El `traffickerId` se obtiene del usuario autenticado al crear campañas
- Los estados de campaña se manejan con enum para type safety
- Las segmentaciones se almacenan como subdocumento para mejor estructura
