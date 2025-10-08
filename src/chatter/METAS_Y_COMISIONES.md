# Sistema de Metas y Comisiones para Chatters

## 📋 Resumen General

Este módulo implementa un sistema completo de gestión de metas y comisiones para chatters, similar al sistema de recruitment pero adaptado específicamente para equipos de chatters organizados por modelos.

## 🏗️ Arquitectura

### Schemas Implementados

#### 1. **ChatterGoalSchema** (`chatter-goal.schema.ts`)
Define las metas de ventas para grupos de chatters (equipo de una modelo).

**Características principales:**
- Meta en USD con periodo definido (fechaInicio - fechaFin)
- Estados: ACTIVA, COMPLETADA, VENCIDA, CANCELADA
- Tracking automático de progreso (montoActual, porcentajeCumplimiento)
- Sistema de notificaciones configurables (25%, 50%, 75%, 90%, 100%)
- Historial de notificaciones enviadas
- Auditoría completa (creado/cerrado por)

#### 2. **ChatterCommissionSchema** (`chatter-commission.schema.ts`)
Registra las comisiones calculadas para cada chatter.

**Características principales:**
- Asociada a un chatter, modelo y opcionalmente a una meta
- Dos tipos de comisión: SUPERNUMERARIO (fijo) y ESCALABLE (según cumplimiento)
- Información del periodo y ventas del chatter
- Datos de la meta del grupo (si aplica)
- Estados: PENDIENTE, APROBADA, PAGADA, CANCELADA
- Tracking de aprobación y pago con referencias

#### 3. **ChatterCommissionScaleSchema** (`chatter-commission-scale.schema.ts`)
Define las escalas comisionales para chatters.

**Características principales:**
- Porcentaje fijo para supernumerarios (por defecto 1%)
- Reglas de performance basadas en % de cumplimiento de meta:
  - 90-100%: 2%
  - 80-89%: 1.5%
  - 70-79%: 1%
  - 60-69%: 0.5%
  - <60%: 0%
- Solo una escala puede estar activa
- Validaciones automáticas de overlaps

## 🔧 Servicios Implementados

### 1. **ChatterGoalsService** (`chatter-goals.service.ts`)

#### Funcionalidades Principales

**CRUD de Metas:**
- `createGoal()` - Crear meta para un grupo
- `findGoals()` - Listar metas con filtros
- `findGoalById()` - Obtener meta por ID
- `updateGoal()` - Actualizar meta activa
- `closeGoal()` - Cerrar meta manualmente
- `cancelGoal()` - Cancelar meta
- `deleteGoal()` - Eliminar meta cancelada

**Tracking y Progreso:**
- `updateGoalProgress()` - Actualizar progreso de una meta
- `calculateGoalProgress()` - Calcular % de cumplimiento
- `getActiveGoalForModel()` - Obtener meta activa de un grupo

**Notificaciones Automáticas:**
- `sendGoalNotification()` - Enviar emails motivacionales
- `generateMotivationalMessage()` - Generar mensajes personalizados
- Mensajes adaptados según % de cumplimiento

**Cron Jobs:**
- `@Cron(EVERY_HOUR)` - Actualizar progreso de metas activas
- `@Cron(EVERY_DAY_AT_MIDNIGHT)` - Cerrar metas vencidas

**Estadísticas:**
- `getGoalStatistics()` - Estadísticas globales de metas

### 2. **ChatterCommissionsService** (`chatter-commissions.service.ts`)

#### Funcionalidades Principales

**Generación de Comisiones:**
- `generateCommissions()` - Generar comisiones para un periodo
- `generateCommissionsForModel()` - Generar para un grupo específico
- `calculateCommissionForChatter()` - Calcular comisión individual

**Proceso de Cálculo:**
1. Obtener meta del grupo (si existe)
2. Calcular % de cumplimiento del grupo
3. Por cada chatter:
   - Si es SUPERNUMERARIO: 1% fijo de sus ventas
   - Si es principal (AM/PM/MADRUGADA): 
     - Obtener escala según % cumplimiento del grupo
     - Aplicar % de comisión a sus ventas individuales

**Gestión de Comisiones:**
- `findCommissions()` - Listar con filtros
- `findCommissionById()` - Detalle de comisión
- `getCommissionsForChatter()` - Comisiones de un chatter

**Aprobación:**
- `approveCommission()` - Aprobar comisión individual
- `rejectCommission()` - Rechazar comisión
- `bulkApproveCommissions()` - Aprobar múltiples

**Pago:**
- `payCommission()` - Marcar como pagada
- `bulkPayCommissions()` - Pagar múltiples
- Incluye referencia de pago

**Estadísticas:**
- `getCommissionStatistics()` - Resumen de comisiones

### 3. **FinanceConfigService** (Extendido)

Ahora incluye gestión de escalas comisionales de chatters:

**Nuevos Métodos:**
- `createChatterCommissionScale()` - Crear escala
- `updateChatterCommissionScale()` - Actualizar escala
- `deleteChatterCommissionScale()` - Eliminar escala
- `getChatterCommissionScales()` - Listar todas
- `getActiveChatterCommissionScale()` - Obtener activa
- `setActiveChatterCommissionScale()` - Activar una escala
- `calculateChatterCommissionPercent()` - Calcular % según cumplimiento
- `createDefaultChatterCommissionScale()` - Crear escala por defecto
- `validateChatterCommissionRules()` - Validar reglas

## 🎯 Endpoints API

### Metas de Chatters

```
POST   /api/chatter/sales/goals                        - Crear meta
GET    /api/chatter/sales/goals                        - Listar metas
GET    /api/chatter/sales/goals/statistics             - Estadísticas
GET    /api/chatter/sales/goals/modelo/:modeloId/active - Meta activa
GET    /api/chatter/sales/goals/:id                    - Detalle
PATCH  /api/chatter/sales/goals/:id                    - Actualizar
POST   /api/chatter/sales/goals/:id/close              - Cerrar
POST   /api/chatter/sales/goals/:id/cancel             - Cancelar
DELETE /api/chatter/sales/goals/:id                    - Eliminar
POST   /api/chatter/sales/goals/:id/update-progress    - Actualizar progreso
```

### Comisiones de Chatters

```
POST   /api/chatter/sales/commissions/generate          - Generar comisiones
GET    /api/chatter/sales/commissions                   - Listar
GET    /api/chatter/sales/commissions/statistics        - Estadísticas
GET    /api/chatter/sales/commissions/chatter/:chatterId - Por chatter
GET    /api/chatter/sales/commissions/:id               - Detalle
POST   /api/chatter/sales/commissions/:id/approve       - Aprobar
POST   /api/chatter/sales/commissions/:id/reject        - Rechazar
POST   /api/chatter/sales/commissions/:id/pay           - Marcar como pagada
POST   /api/chatter/sales/commissions/bulk-approve      - Aprobar múltiples
POST   /api/chatter/sales/commissions/bulk-pay          - Pagar múltiples
DELETE /api/chatter/sales/commissions/:id               - Eliminar
```

## 🔐 Permisos Requeridos

```
ventas:chatting:goals:create         - Crear metas
ventas:chatting:goals:read           - Ver metas
ventas:chatting:goals:update         - Modificar metas
ventas:chatting:goals:delete         - Eliminar metas

ventas:chatting:commissions:create   - Generar comisiones
ventas:chatting:commissions:read     - Ver comisiones
ventas:chatting:commissions:approve  - Aprobar/rechazar comisiones
ventas:chatting:commissions:pay      - Marcar como pagadas
ventas:chatting:commissions:delete   - Eliminar comisiones
```

## 📊 Flujo de Trabajo

### 1. Configuración Inicial

```typescript
// 1. Crear/verificar escala comisional activa
await financeConfigService.createDefaultChatterCommissionScale();

// O crear una personalizada
await financeConfigService.createChatterCommissionScale({
  name: 'Escala Q1 2025',
  isActive: true,
  supernumerarioPercent: 1,
  performanceRules: [
    { minPercent: 90, maxPercent: 100, commissionPercent: 2 },
    { minPercent: 80, maxPercent: 89, commissionPercent: 1.5 },
    { minPercent: 70, maxPercent: 79, commissionPercent: 1 },
    { minPercent: 60, maxPercent: 69, commissionPercent: 0.5 },
  ],
});
```

### 2. Crear Meta Mensual

```typescript
// Inicio de mes: crear meta para un grupo
await chatterGoalsService.createGoal({
  modeloId: '...',
  montoObjetivo: 50000, // $50,000 USD
  fechaInicio: '2025-10-01',
  fechaFin: '2025-10-31',
  descripcion: 'Meta octubre 2025',
  nivelesNotificacion: [25, 50, 75, 90, 100],
  notificacionesActivas: true,
});
```

### 3. Durante el Mes

- **Automático cada hora:** Sistema actualiza progreso de metas
- **Notificaciones:** Se envían emails cuando se alcanzan hitos (25%, 50%, etc.)
- **Consulta en tiempo real:** Frontend muestra % cumplido

### 4. Cierre de Mes

```typescript
// 1. Cerrar meta manualmente o esperar cierre automático
await chatterGoalsService.closeGoal(goalId, {
  notas: 'Cierre mes octubre',
});

// 2. Generar comisiones
const result = await chatterCommissionsService.generateCommissions({
  fechaInicio: '2025-10-01',
  fechaFin: '2025-10-31',
  modeloId: '...', // opcional, si se omite genera para todos
  goalId: '...', // opcional, asocia a meta específica
});

// Resultado:
// {
//   generated: [...], // Comisiones creadas
//   summary: {
//     totalModelos: 10,
//     totalChatters: 40,
//     totalComisiones: 40,
//     montoTotalComisiones: 5000,
//     comisionesPorTipo: {
//       SUPERNUMERARIO: 10,
//       ESCALABLE: 30
//     }
//   }
// }
```

### 5. Aprobación

```typescript
// Aprobar comisiones individualmente
await chatterCommissionsService.approveCommission(commissionId, {
  notas: 'Aprobado para pago',
});

// O en lote
await chatterCommissionsService.bulkApproveCommissions({
  commissionIds: ['id1', 'id2', 'id3'],
  notas: 'Aprobación masiva octubre',
});
```

### 6. Pago

```typescript
// Marcar como pagadas
await chatterCommissionsService.payCommission(commissionId, {
  referenciaPago: 'TRANS-2025-10-001',
  notas: 'Pagado vía nómina',
});

// O en lote
await chatterCommissionsService.bulkPayCommissions({
  commissionIds: ['id1', 'id2'],
  referenciaPago: 'BATCH-2025-10-001',
});
```

## 📈 Ejemplos de Cálculo

### Ejemplo 1: Grupo con 92% de cumplimiento

**Meta:** $50,000 USD  
**Ventas del Grupo:** $46,000 USD  
**Cumplimiento:** 92% → **Escala: 2%**

**Chatters:**
- Chatter AM: Vendió $15,000 → Comisión: $15,000 × 2% = **$300**
- Chatter PM: Vendió $12,000 → Comisión: $12,000 × 2% = **$240**
- Chatter MAD: Vendió $10,000 → Comisión: $10,000 × 2% = **$200**
- Supernumerario: Vendió $9,000 → Comisión: $9,000 × 1% = **$90**

**Total comisiones grupo:** $830 USD

### Ejemplo 2: Grupo con 75% de cumplimiento

**Meta:** $50,000 USD  
**Ventas del Grupo:** $37,500 USD  
**Cumplimiento:** 75% → **Escala: 1%**

**Chatters:**
- Chatter AM: Vendió $12,000 → Comisión: $12,000 × 1% = **$120**
- Chatter PM: Vendió $10,000 → Comisión: $10,000 × 1% = **$100**
- Chatter MAD: Vendió $9,500 → Comisión: $9,500 × 1% = **$95**
- Supernumerario: Vendió $6,000 → Comisión: $6,000 × 1% = **$60**

**Total comisiones grupo:** $375 USD

### Ejemplo 3: Grupo con 55% de cumplimiento

**Meta:** $50,000 USD  
**Ventas del Grupo:** $27,500 USD  
**Cumplimiento:** 55% → **Escala: 0%**

**Chatters principales:** No califican para comisión (0%)  
**Supernumerario:** Vendió $5,000 → Comisión: $5,000 × 1% = **$50**

**Total comisiones grupo:** $50 USD (solo supernumerario)

## 🔔 Sistema de Notificaciones

### Mensajes Motivacionales

El sistema genera mensajes personalizados según el % de cumplimiento:

**100%+:**
```
🎉 ¡FELICITACIONES! El grupo de [Modelo] ha alcanzado la meta de $50,000 USD. 
¡Excelente trabajo en equipo!
```

**90-99%:**
```
🔥 ¡Casi ahí! El grupo de [Modelo] va al 92% de la meta. 
Solo faltan $4,000 USD. ¡Un último empujón y lo logran!
```

**75-89%:**
```
💪 ¡Gran progreso! El grupo de [Modelo] ha alcanzado el 85% de la meta. 
Quedan $7,500 USD y 10 días. ¡Sigan así!
```

**50-74%:**
```
📈 ¡Vamos bien! El grupo de [Modelo] va al 65% de la meta. 
Faltan $17,500 USD. Quedan 15 días, ¡aún hay tiempo!
```

**25-49%:**
```
🚀 ¡Buen comienzo! El grupo de [Modelo] ha logrado el 35% de la meta. 
Faltan $32,500 USD y quedan 20 días. ¡Sigamos adelante!
```

### Destinatarios

Los emails se envían a todos los chatters del grupo:
- Chatter AM
- Chatter PM  
- Chatter Madrugada
- Chatter Supernumerario

## 🎨 Integraciones

### Con Módulo de Finanzas
- Usa configuración centralizada de escalas comisionales
- Validaciones consistentes
- Auditoría unificada

### Con Módulo de RRHH
- Vinculación con empleados (chatters)
- Vinculación con modelos
- Validaciones de estados activos

### Con Módulo de Ventas
- Consulta de ventas por chatter
- Cálculos basados en ventas reales
- Filtros por periodo

## ⚙️ Cron Jobs

### Actualización de Progreso (Cada Hora)
```typescript
@Cron(CronExpression.EVERY_HOUR)
async updateAllActiveGoalsProgress()
```
- Actualiza `montoActual` y `porcentajeCumplimiento` de metas activas
- Verifica si deben enviarse notificaciones
- Envía emails motivacionales cuando se alcanzan hitos

### Cierre de Metas Vencidas (Diario a medianoche)
```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async closeExpiredGoals()
```
- Marca como VENCIDA las metas cuya `fechaFin` ya pasó
- Registra fecha de cierre automático

## 📝 Consideraciones Importantes

1. **Comisión Supernumerario:** Siempre recibe 1% fijo, independiente del cumplimiento del grupo

2. **Comisión Individual:** Cada chatter recibe % de sus propias ventas, no del total del grupo

3. **Sin Meta = Sin Comisión Escalable:** Si no hay meta definida, los chatters principales no recibirían comisión (o se podría definir un % default)

4. **Overlaps de Metas:** No se permite crear metas con periodos que se solapen para el mismo grupo

5. **Eliminación:** Solo se pueden eliminar metas CANCELADAS y comisiones no PAGADAS

6. **Auditoría Completa:** Todos los cambios de estado registran usuario y fecha

## 🚀 Próximos Pasos Sugeridos

1. **Integración con Email Service:** Conectar notificaciones con servicio de emails real

2. **Dashboard Frontend:** Crear vistas para:
   - Panel de metas con progreso en tiempo real
   - Calculadora de comisiones
   - Historial de comisiones por chatter

3. **Reportes PDF:** Extender ChatterPdfService para incluir:
   - Reporte de cumplimiento de meta
   - Detalle de comisiones por periodo

4. **Webhooks:** Notificar sistemas externos cuando:
   - Se alcanza una meta
   - Se generan comisiones
   - Se aprueban/pagan comisiones

5. **Analytics:** Dashboard de métricas:
   - Tendencias de cumplimiento
   - Comisiones promedio por chatter
   - Grupos top performers

## 📚 Referencias

- Sistema similar implementado en `recruitment/recruitment-goals.service.ts`
- Configuración financiera en `sistema/finance-config.service.ts`
- Schema de ventas en `chatter/chatter-sale.schema.ts`

---

**Desarrollado profesionalmente con arquitectura escalable y mantenible** ✨

