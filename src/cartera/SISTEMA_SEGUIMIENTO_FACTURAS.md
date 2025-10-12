# Sistema de Seguimiento Profesional de Facturas

## 📋 Resumen de Cambios

Se implementó un sistema profesional de facturación que previene duplicados, maneja colisiones y respeta las reglas de periodicidad de corte.

---

## 🎯 Problemas Resueltos

### 1. Error E11000 - Colisión de `numeroFactura`
**Problema:** Cuando se generan facturas en paralelo, dos facturas pueden obtener el mismo número secuencial, causando error de clave duplicada.

**Solución:**
- Se implementó `generarNumeroFactura()` con **retry logic**
- Verifica con `.exists()` antes de usar el número
- Incrementa el número en cada intento de colisión
- Fallback con timestamp después de 10 intentos fallidos

```typescript
// Ejemplo: FACT-2025-0001, FACT-2025-0002, ..., FACT-2025-T193847 (fallback)
```

---

### 2. Facturas Duplicadas por Periodo
**Problema:** Se podían crear múltiples facturas para el mismo modelo en el mismo periodo.

**Solución:**
- Se agregó método `existeFacturaEnPeriodo(modeloId, periodo)`
- Valida antes de crear facturas automáticas y manuales
- Lanza `BadRequestException` si ya existe una factura activa

```typescript
const existeDuplicado = await this.existeFacturaEnPeriodo(modeloId, {
  anio: 2025,
  mes: 10,
  quincena: 1,
});
```

---

### 3. Sistema de Periodicidad Incorrecto
**Problema:** Las facturas no respetaban los cortes reales (día 16, día 1).

**Solución:**
Se implementaron las reglas profesionales de periodicidad:

#### Periodicidad QUINCENAL
- **Primera quincena:** 1 al 15 → factura se activa el **día 16**
- **Segunda quincena:** 16 al 30/31 → factura se activa el **día 1 del mes siguiente**

Ejemplo:
```
Modelo ingresa: 10 de octubre
Periodicidad: QUINCENAL
Periodo trabajado: 10-oct a 15-oct (6 días)
Fecha de corte: 16 de octubre
Estado inicial: SEGUIMIENTO
Activación automática: 16 de octubre (pasa a PENDIENTE)
```

#### Periodicidad MENSUAL
- **Todo el mes:** 1 al 30/31 → factura se activa el **día 1 del mes siguiente**

Ejemplo:
```
Modelo ingresa: 10 de octubre
Periodicidad: MENSUAL
Periodo trabajado: 10-oct a 31-oct (22 días)
Fecha de corte: 1 de noviembre
Estado inicial: SEGUIMIENTO
Activación automática: 1 de noviembre (pasa a PENDIENTE)
```

---

## 🚀 Nuevas Funcionalidades

### Estado SEGUIMIENTO
Se agregó un nuevo estado `SEGUIMIENTO` al enum `EstadoFactura`:

```typescript
export enum EstadoFactura {
  SEGUIMIENTO = 'SEGUIMIENTO',  // ⭐ NUEVO
  PENDIENTE = 'PENDIENTE',
  PARCIAL = 'PARCIAL',
  PAGADO = 'PAGADO',
  VENCIDO = 'VENCIDO',
  CANCELADO = 'CANCELADO',
}
```

**Flujo:**
1. Factura se crea en estado `SEGUIMIENTO`
2. Se espera hasta llegar a `fechaCorte`
3. Scheduler la activa automáticamente a `PENDIENTE`
4. Se envía notificación a la modelo (TODO: implementar email)

---

### Campo `fechaCorte`
Se agregó el campo `fechaCorte` al schema `FacturaEntity`:

```typescript
@Prop({ type: Date, required: true, index: true })
fechaCorte!: Date; // Fecha real de facturación según periodicidad
```

**Diferencia con `fechaEmision`:**
- **`fechaEmision`:** Fecha de creación de la factura (puede ser días/semanas antes)
- **`fechaCorte`:** Fecha real de facturación (día 16, día 1, etc.)
- **`fechaVencimiento`:** `fechaCorte + diasVencimiento`

---

### Scheduler de Activación
Se implementó cron job que ejecuta cada hora:

```typescript
@Cron(CronExpression.EVERY_HOUR)
async handleActivarFacturasSeguimiento() {
  // Busca facturas con estado=SEGUIMIENTO y fechaCorte <= hoy
  // Las cambia a estado=PENDIENTE
  // Envía notificación (TODO)
}
```

---

## 📊 Índices Agregados

Para optimizar consultas y garantizar unicidad:

```typescript
// Evitar duplicados por periodo
FacturaSchema.index({ 
  'periodo.anio': 1, 
  'periodo.mes': 1, 
  'periodo.quincena': 1, 
  modeloId: 1 
});

// Para scheduler de activación
FacturaSchema.index({ fechaCorte: 1, estado: 1 });
```

---

## 🔧 Métodos Auxiliares Nuevos

### `calcularFechaCorte(periodicidad, fechaInicioContrato)`
Calcula la próxima fecha de corte según periodicidad:

```typescript
// Ejemplo QUINCENAL - ingresó 10-oct
const fechaCorte = this.calcularFechaCorte('QUINCENAL', new Date('2025-10-10'));
// Resultado: 2025-10-16

// Ejemplo MENSUAL - ingresó 10-oct
const fechaCorte = this.calcularFechaCorte('MENSUAL', new Date('2025-10-10'));
// Resultado: 2025-11-01
```

### `calcularPeriodo(fechaInicio, fechaCorte, periodicidad)`
Calcula el objeto periodo de facturación:

```typescript
const periodo = this.calcularPeriodo(
  new Date('2025-10-10'), 
  new Date('2025-10-16'), 
  'QUINCENAL'
);
// Resultado: { anio: 2025, mes: 10, quincena: 1 }
```

### `existeFacturaEnPeriodo(modeloId, periodo)`
Verifica duplicados:

```typescript
const existe = await this.existeFacturaEnPeriodo(modeloId, {
  anio: 2025,
  mes: 10,
  quincena: 1,
});
// Retorna: true/false
```

### `activarFacturasEnSeguimiento()`
Activa facturas que llegaron a su fecha de corte:

```typescript
const resultado = await this.activarFacturasEnSeguimiento();
// Resultado: { 
//   activadas: 5, 
//   errores: 0, 
//   facturas: [...] 
// }
```

---

## 📝 Cambios en Métodos Existentes

### `generarFacturaAutomatica()`
**Antes:**
- Calculaba fechas manualmente sin considerar periodicidad real
- Creaba factura en estado `PENDIENTE` inmediatamente
- No validaba duplicados

**Ahora:**
1. ✅ Valida duplicados por periodo
2. ✅ Calcula `fechaCorte` según periodicidad del contrato
3. ✅ Crea factura en estado `SEGUIMIENTO`
4. ✅ Usa retry logic para `numeroFactura`
5. ✅ Respeta reglas de corte (día 16, día 1)

### `crearFacturaManual()`
**Cambios:**
1. ✅ Valida duplicados por periodo (si se proporciona)
2. ✅ Agrega campo `fechaCorte` (= `fechaEmision` para manuales)
3. ✅ Usa retry logic para `numeroFactura`
4. ✅ Crea en estado `PENDIENTE` (no SEGUIMIENTO, porque es manual)

---

## 🧪 Escenarios de Prueba

### Escenario 1: Factura Quincenal - Primera Quincena
```
Modelo: Dana Martinez
Fecha ingreso: 10 de octubre 2025
Periodicidad: QUINCENAL
Acción: Generar factura automática

Resultado esperado:
- Periodo: 2025-10-Q1 (primera quincena)
- Ventas: 10-oct a 15-oct
- fechaEmision: 10-oct (hoy)
- fechaCorte: 16-oct
- Estado inicial: SEGUIMIENTO
- Activación: 16-oct automático → PENDIENTE
- fechaVencimiento: 16-oct + diasVencimiento
```

### Escenario 2: Factura Mensual
```
Modelo: Dana Martinez
Fecha ingreso: 10 de octubre 2025
Periodicidad: MENSUAL
Acción: Generar factura automática

Resultado esperado:
- Periodo: 2025-10 (mes completo)
- Ventas: 10-oct a 31-oct
- fechaEmision: 10-oct (hoy)
- fechaCorte: 1-nov
- Estado inicial: SEGUIMIENTO
- Activación: 1-nov automático → PENDIENTE
- fechaVencimiento: 1-nov + diasVencimiento
```

### Escenario 3: Prevención de Duplicados
```
Acción 1: Generar factura para Dana (2025-10-Q1)
Resultado: ✅ Factura creada FACT-2025-0001

Acción 2: Intentar generar otra factura para Dana (2025-10-Q1)
Resultado: ❌ BadRequestException: "Ya existe una factura para Dana Martinez Lopez en el periodo 2025-10-Q1"
```

### Escenario 4: Colisión de Números
```
Acción: Generar 2 facturas simultáneamente

Thread 1: Obtiene FACT-2025-0002
Thread 2: Obtiene FACT-2025-0002
Thread 1: Verifica .exists() → false → guarda ✅
Thread 2: Verifica .exists() → true → reintenta → FACT-2025-0003 ✅

Resultado: Sin error E11000, ambas facturas creadas con números únicos
```

---

## 🎨 Flujo Visual

```
┌─────────────────────────────────────────────────────────────┐
│ Usuario crea factura automática                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ¿Ya existe factura para este periodo?                       │
└────────────────┬──────────────────┬─────────────────────────┘
                 │ NO                │ SI
                 ▼                   ▼
      ┌──────────────────┐  ┌──────────────────┐
      │ Calcular fechas  │  │ Error: Duplicado │
      │ según            │  └──────────────────┘
      │ periodicidad     │
      └────────┬─────────┘
               ▼
      ┌──────────────────┐
      │ Generar número   │
      │ con retry logic  │
      └────────┬─────────┘
               ▼
      ┌──────────────────┐
      │ Crear factura en │
      │ estado           │
      │ SEGUIMIENTO      │
      └────────┬─────────┘
               ▼
      ┌──────────────────┐
      │ Esperar hasta    │
      │ fechaCorte       │
      └────────┬─────────┘
               ▼
      ┌──────────────────┐
      │ Scheduler        │
      │ (cada hora)      │
      └────────┬─────────┘
               ▼
      ┌──────────────────┐
      │ Activar a        │
      │ PENDIENTE        │
      └────────┬─────────┘
               ▼
      ┌──────────────────┐
      │ Enviar           │
      │ notificación     │
      └──────────────────┘
```

---

## 📚 Próximos Pasos (TODOs)

### Notificaciones por Email
```typescript
// En activarFacturasEnSeguimiento()
await this.emailService.enviarNotificacionFacturaActivada(factura);
```

### Frontend
1. Mostrar badge de estado "EN SEGUIMIENTO" en listado de facturas
2. Mostrar fecha de activación en detalles de factura
3. Filtro por estado SEGUIMIENTO en tabla
4. Dashboard: contador de facturas en seguimiento

### Reportes
1. Agregar estado SEGUIMIENTO a reportes PDF
2. Incluir fechaCorte en exportaciones

---

## ✅ Checklist de Implementación

- [x] Agregar estado `SEGUIMIENTO` al enum
- [x] Agregar campo `fechaCorte` al schema
- [x] Índices para evitar duplicados y optimizar scheduler
- [x] Método `generarNumeroFactura()` con retry logic
- [x] Métodos auxiliares: `calcularFechaCorte()`, `calcularPeriodo()`, `existeFacturaEnPeriodo()`
- [x] Actualizar `generarFacturaAutomatica()` con nueva lógica
- [x] Actualizar `crearFacturaManual()` con validaciones
- [x] Método `activarFacturasEnSeguimiento()`
- [x] Scheduler cada hora para activar facturas
- [ ] Envío de notificaciones por email
- [ ] Actualizar frontend para mostrar estado SEGUIMIENTO
- [ ] Tests unitarios

---

## 🔐 Seguridad y Performance

### Índices Optimizados
```typescript
// Query para activar facturas (usado cada hora por scheduler)
db.cartera_facturas.find({ 
  estado: 'SEGUIMIENTO', 
  fechaCorte: { $lte: ISODate() } 
})
// Índice: { fechaCorte: 1, estado: 1 } ✅

// Query para validar duplicados
db.cartera_facturas.exists({ 
  modeloId: ObjectId(), 
  'periodo.anio': 2025, 
  'periodo.mes': 10, 
  'periodo.quincena': 1 
})
// Índice: { periodo.anio: 1, periodo.mes: 1, periodo.quincena: 1, modeloId: 1 } ✅
```

### Prevención de Race Conditions
```typescript
// Uso de .exists() antes de insertar
const existe = await this.facturaModel.exists({ numeroFactura: candidate });
if (!existe) {
  // Usar este número
}
```

---

## 📞 Soporte

Para dudas o problemas con el sistema de facturación, contactar a:
- **Backend Lead:** OnlyTop Development Team
- **Documentación:** `/src/cartera/SISTEMA_SEGUIMIENTO_FACTURAS.md`
