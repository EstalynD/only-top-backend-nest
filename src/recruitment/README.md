# Módulo de Recruitment (Sales Closers) - CRM Ligero

## Descripción General

Este módulo implementa un CRM ligero para la gestión de actividades de prospección y cierre de modelos por parte del equipo de Sales Closers. Funciona como un sistema de tracking del embudo de reclutamiento (pipeline) desde el primer contacto hasta el cierre final.

## Arquitectura

```
┌──────────────────────────────────────────────────┐
│         Módulo de Recruitment                    │
│  (Agenda Operativa de Sales Closers)           │
└─────────────────┬────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   ┌────▼────┐       ┌─────▼─────┐
   │ Schema  │       │  Service  │
   │ Activity│       │ Recruitment│
   └────┬────┘       └─────┬─────┘
        │                  │
   ┌────▼──────────────────▼────┐
   │     RecruitmentController   │
   │   REST API Endpoints        │
   └─────────────────────────────┘
```

## Componentes

### 1. Schema (`recruitment-activity.schema.ts`)

**Entidades Principales**:

#### `RecruitmentActivityEntity`
- **Propósito**: Registro diario de actividades de prospección
- **Campos principales**:
  - `fechaActividad`: Fecha del registro
  - `salesCloserId`: Referencia al empleado (Sales Closer)
  - Métricas de Instagram:
    - `cuentasTexteadas`: DMs enviados
    - `likesRealizados`: Likes dados
    - `comentariosRealizados`: Comentarios dejados
  - `contactosObtenidos`: Array de contactos obtenidos (WhatsApp, etc.)
  - Reuniones:
    - `reunionesAgendadas`: Cantidad programada
    - `reunionesRealizadas`: Cantidad efectiva
  - `modelosCerradas`: Array de modelos cerradas
  - `notasDia`: Notas generales

#### `ModeloCerrada`
- **Propósito**: Información de cada modelo cerrada
- **Campos**:
  - `nombreModelo`: Nombre completo
  - `perfilInstagram`: Username o URL
  - `facturacionUltimosTresMeses`: Array de 3 números
  - `promedioFacturacion`: Calculado automáticamente
  - `fechaCierre`: Fecha de cierre
  - `estado`: EN_ESPERA | REGISTRADA | FIRMADA
  - `modeloId`: Referencia a `ModeloEntity` (opcional)
  - `notas`: Observaciones

#### `ContactoObtenido`
- **Propósito**: Lead obtenido
- **Campos**:
  - `numero`: Teléfono de contacto
  - `perfilInstagram`: Username o URL (opcional)
  - `nombreProspecto`: Nombre (opcional)
  - `fechaObtencion`: Timestamp

### 2. DTOs (`dto/recruitment-activity.dto.ts`)

**DTOs Disponibles**:

- `CreateRecruitmentActivityDto`: Crear nueva actividad
- `UpdateRecruitmentActivityDto`: Actualizar actividad existente
- `VincularModeloDto`: Vincular modelo cerrada con modelo registrada
- `ContactoObtenidoDto`: Datos de contacto obtenido
- `ModeloCerradaDto`: Datos de modelo cerrada

### 3. Service (`recruitment.service.ts`)

**Métodos Principales**:

#### CRUD
```typescript
createActivity(dto, userId?, salesCloserId?): Promise<RecruitmentActivityDocument>
findAllActivities(filters?): Promise<RecruitmentActivityDocument[]>
findActivityById(id): Promise<RecruitmentActivityDocument>
updateActivity(id, dto): Promise<RecruitmentActivityDocument>
deleteActivity(id): Promise<void>
```

#### Vinculación
```typescript
vincularModelo(dto: VincularModeloDto): Promise<RecruitmentActivityDocument>
```
- Permite vincular una modelo cerrada (estado EN_ESPERA) con una modelo ya registrada en el sistema

#### Estadísticas
```typescript
getStatsBySalesCloser(salesCloserId, fechaDesde?, fechaHasta?): Promise<RecruitmentStats>
```
Retorna:
- Totales de todas las métricas
- Tasas de conversión:
  - Contacto → Reunión
  - Reunión → Cierre
  - Agendada → Realizada
- Promedio de facturación de modelos cerradas
- Modelos por estado
- Cantidad de actividades

```typescript
getGeneralStats(fechaDesde?, fechaHasta?): Promise<GeneralStats>
```
Retorna:
- Totales generales del equipo
- Top 10 Sales Closers
- Cantidad de Sales Closers activos
- Cantidad total de actividades

### 4. Controller (`recruitment.controller.ts`)

**Endpoints**:

#### CRUD de Actividades
```
POST   /api/recruitment/activities
GET    /api/recruitment/activities
GET    /api/recruitment/activities/:id
PATCH  /api/recruitment/activities/:id
DELETE /api/recruitment/activities/:id
```

#### Estadísticas
```
GET /api/recruitment/activities/stats
GET /api/recruitment/activities/stats/:salesCloserId
GET /api/recruitment/activities/sales-closers
```

#### Vinculación
```
POST /api/recruitment/activities/vincular-modelo
```

#### Exportación
```
GET /api/recruitment/activities/export/excel
GET /api/recruitment/activities/export/pdf
```

## Flujo de Trabajo

### 1. Registro Diario de Actividad

```typescript
// Sales Closer registra su actividad del día
const activity = await createActivity({
  fechaActividad: '2025-01-20',
  // salesCloserId se obtiene del usuario logueado
  cuentasTexteadas: 25,
  likesRealizados: 50,
  comentariosRealizados: 15,
  contactosObtenidos: [
    {
      numero: '+57300123456',
      perfilInstagram: '@modelo_prospecto',
      nombreProspecto: 'María García',
    }
  ],
  reunionesAgendadas: 3,
  reunionesRealizadas: 2,
  modelosCerradas: [],
  notasDia: 'Buen día de prospección en nicho fitness',
});
```

### 2. Registro de Cierre

```typescript
// Sales Closer cierra una modelo
await updateActivity(activityId, {
  modelosCerradas: [
    {
      nombreModelo: 'María García',
      perfilInstagram: '@maria_fitness',
      facturacionUltimosTresMeses: [2500, 2800, 3200],
      // promedioFacturacion se calcula automáticamente: 2833.33
      fechaCierre: '2025-01-20',
      estado: 'EN_ESPERA', // Aún no registrada en el sistema
      notas: 'Modelo de fitness con buen engagement',
    }
  ],
});
```

### 3. Vinculación con Modelo Registrada

```typescript
// Cuando la modelo firma contrato y se registra
await vincularModelo({
  actividadId: '507f1f77bcf86cd799439011',
  modeloCerradaIndex: 0,
  modeloId: '507f191e810c19729de860ea', // ID de la modelo en el sistema
});
// El estado cambia automáticamente a 'REGISTRADA'
```

### 4. Consulta de Estadísticas

```typescript
// Stats de un Sales Closer específico
const stats = await getStatsBySalesCloser(
  salesCloserId,
  '2025-01-01',
  '2025-01-31'
);

console.log(stats.tasasConversion.reunionCierre); // "15.50%"
console.log(stats.promedioFacturacionModelosCerradas); // "2833.33"
```

## Estados de Modelo Cerrada

### EN_ESPERA
- Modelo recién cerrada
- Aún no registrada en el sistema
- En proceso de firma/documentación

### REGISTRADA
- Modelo ya existe en el sistema (`ModeloEntity`)
- Vinculada con `modeloId`
- Aún no ha firmado contrato

### FIRMADA
- Modelo ha firmado contrato
- Proceso completo
- Se actualiza cuando el contrato cambia a estado FIRMADO

## Métricas y KPIs

### Embudo de Conversión

```
Cuentas Texteadas (DM)
    ↓
Contactos Obtenidos
    ↓ Tasa: Contacto → Reunión
Reuniones Agendadas
    ↓ Tasa: Agendada → Realizada
Reuniones Realizadas
    ↓ Tasa: Reunión → Cierre
Modelos Cerradas
```

### Tasa de Conversión: Contacto → Reunión
```
(Reuniones Agendadas / Contactos Obtenidos) × 100
```

### Tasa de Conversión: Reunión → Cierre
```
(Modelos Cerradas / Reuniones Realizadas) × 100
```

### Tasa de Efectividad: Agendada → Realizada
```
(Reuniones Realizadas / Reuniones Agendadas) × 100
```

### Promedio de Facturación
```
Σ (Promedio Facturación de cada Modelo) / Total de Modelos
```

## Permisos RBAC

```typescript
'ventas:recruitment:create'  // Crear actividades
'ventas:recruitment:read'    // Ver actividades
'ventas:recruitment:update'  // Actualizar actividades
'ventas:recruitment:delete'  // Eliminar actividades
'ventas:recruitment:export'  // Exportar actividades
'ventas:recruitment:stats'   // Ver estadísticas
```

## Índices de Base de Datos

Índices optimizados para consultas frecuentes:

```javascript
{ salesCloserId: 1, fechaActividad: -1 }
{ fechaActividad: -1 }
{ 'modelosCerradas.estado': 1 }
{ 'modelosCerradas.modeloId': 1 }
```

## Hooks y Middleware

### Pre-Save Hook
Calcula automáticamente el promedio de facturación:

```javascript
RecruitmentActivitySchema.pre('save', function (next) {
  this.modelosCerradas.forEach(modelo => {
    if (modelo.facturacionUltimosTresMeses.length === 3) {
      const total = modelo.facturacionUltimosTresMeses.reduce((sum, val) => sum + val, 0);
      modelo.promedioFacturacion = total / 3;
    }
  });
  next();
});
```

## Validaciones

- `facturacionUltimosTresMeses` debe tener exactamente 3 elementos
- Todos los números deben ser >= 0
- Sales Closer debe ser un empleado activo con cargo REC_SC
- `modeloId` si se proporciona, debe existir en `ModeloEntity`

## Relaciones con Otros Módulos

### RRHH (Empleados)
- `salesCloserId` → `EmpleadoEntity`
- Validación: Debe ser Sales Closer activo

### Clientes (Modelos)
- `modelosCerradas[].modeloId` → `ModeloEntity`
- Vinculación cuando la modelo se registra completamente

### Clientes (Contratos)
- Cuando un contrato se firma, el estado de la modelo cerrada puede actualizarse a FIRMADA

## Exportación

### Excel
```
GET /api/recruitment/activities/export/excel?salesCloserId=xxx&fechaDesde=xxx&fechaHasta=xxx
```

### PDF
```
GET /api/recruitment/activities/export/pdf?salesCloserId=xxx&fechaDesde=xxx&fechaHasta=xxx
```

## Casos de Uso

### 1. Sales Closer Diario
- Registra métricas de prospección
- Anota contactos obtenidos
- Programa reuniones

### 2. Cierre de Modelo
- Registra datos de la modelo cerrada
- Ingresa facturación de últimos 3 meses
- Sistema calcula promedio automáticamente

### 3. Modelo Firma Contrato
- Se registra en el sistema como `ModeloEntity`
- Se vincula con la actividad de cierre
- Estado cambia a REGISTRADA

### 4. Análisis de Performance
- Supervisor revisa estadísticas por Sales Closer
- Identifica mejores performers
- Detecta cuellos de botella en el embudo

### 5. Reportes Gerenciales
- Exporta datos a Excel para análisis
- Genera reportes PDF para presentaciones
- Trackea tendencias mes a mes

## Roadmap

### Próximas Mejoras
- [ ] Gráficos de tendencias y evolución
- [ ] Alertas de bajo rendimiento
- [ ] Sugerencias automáticas de mejora
- [ ] Integración con Instagram API
- [ ] Seguimiento de conversaciones
- [ ] Recordatorios de follow-up
- [ ] Dashboard en tiempo real

## Soporte

Para dudas o problemas, contactar al equipo de desarrollo de OnlyTop.

---

**Versión**: 1.0.0  
**Última actualización**: Enero 2025  
**Autor**: OnlyTop Development Team

