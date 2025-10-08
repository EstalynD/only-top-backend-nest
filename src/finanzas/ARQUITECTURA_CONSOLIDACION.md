# 🏦 Arquitectura de Consolidación Financiera

## 📊 Visión General

Sistema contable profesional que separa el **flujo de caja en movimiento** del **capital consolidado histórico**, permitiendo un control preciso del crecimiento financiero en tiempo real sin afectar el balance consolidado.

---

## 🗂️ Estructura de Colecciones

### 1. **finanzas_modelos** (Transacciones Individuales)
Documento por cada modelo, mes y año. Representa las finanzas calculadas de una modelo en un periodo específico.

```json
{
  "_id": ObjectId,
  "modeloId": ObjectId,
  "mes": 10,
  "anio": 2025,
  "periodoId": "2025-10",  // ← Referencia al periodo consolidado
  "ventasNetasUSD": BigInt,
  "comisionAgenciaUSD": BigInt,
  "comisionBancoUSD": BigInt,
  "gananciaModeloUSD": BigInt,
  "gananciaOnlyTopUSD": BigInt,
  "estado": "CALCULADO" | "PENDIENTE_REVISION" | "APROBADO" | "PAGADO",
  "contratoId": ObjectId,
  "meta": { ... }
}
```

**Características:**
- ✅ Un documento único por (modeloId, mes, anio) → índice único
- ✅ Se actualiza automáticamente al registrar ventas
- ✅ Campo `periodoId` se asigna al consolidar el periodo
- ✅ BigInt escalado × 100,000 para precisión decimal

---

### 2. **finanzas_periodos_consolidados** (Cierres Oficiales)
Documento por cada mes contable cerrado. Representa el cierre oficial de un periodo.

```json
{
  "_id": ObjectId,
  "periodo": "2025-10",  // Identificador único (YYYY-MM)
  "mes": 10,
  "anio": 2025,
  "totalVentasNetasUSD": BigInt,
  "totalComisionAgenciaUSD": BigInt,
  "totalComisionBancoUSD": BigInt,
  "totalGananciaModelosUSD": BigInt,
  "totalGananciaOnlyTopUSD": BigInt,
  "cantidadModelos": 15,
  "cantidadVentas": 450,
  "promedioVentasPorModelo": 2500.00,
  "estado": "ABIERTO" | "EN_REVISION" | "CONSOLIDADO" | "CERRADO",
  "fechaConsolidacion": Date,
  "consolidadoPor": ObjectId,
  "notasCierre": String,
  "meta": {
    "topModelos": [...],
    "desglosePorEstado": {...}
  },
  "finanzasIds": [ObjectId, ObjectId, ...]
}
```

**Características:**
- ✅ Se genera automáticamente al consolidar un periodo
- ✅ Una vez `estado: "CONSOLIDADO"`, los datos son inmutables
- ✅ Contiene referencias a todos los documentos de finanzas_modelos del periodo
- ✅ Permite auditoría y trazabilidad histórica

---

### 3. **bank_onlytop** (Balance General - Documento Único)
Caja fuerte global de la empresa. **Solo existe un documento** con `_id: "onlytop_bank"`.

```json
{
  "_id": "onlytop_bank",  // ← ID fijo
  "empresa": "OnlyTop",
  "dineroConsolidadoUSD": BigInt,  // Capital histórico inmutable
  "dineroMovimientoUSD": BigInt,   // Dinero del periodo actual
  "periodoActual": "2025-10",
  "ultimaConsolidacion": Date,
  "totalPeriodosConsolidados": 12,
  "totalModelosHistorico": 180,
  "totalVentasHistorico": 5400,
  "meta": {
    "mejorMes": {...},
    "promedioMensual": 50000.00,
    "tendencia": "CRECIENTE"
  }
}
```

**Características:**
- ✅ **Documento único** (singleton pattern)
- ✅ Se inicializa automáticamente al arrancar el servicio
- ✅ `dineroConsolidadoUSD`: suma de periodos cerrados (histórico)
- ✅ `dineroMovimientoUSD`: suma de ganancias del mes actual
- ✅ Se actualiza en tiempo real al calcular finanzas
- ✅ Al consolidar: `consolidado += movimiento; movimiento = 0;`

---

## 🔄 Flujo de Datos

### 📥 **1. Registro de Venta**
```
ChatterSale creada
    ↓
FinanzasService.calcularFinanzas()
    ↓
Actualiza/Crea documento en finanzas_modelos
    ↓
Suma todas las ganancias OT del periodo
    ↓
Actualiza bank_onlytop.dineroMovimientoUSD
```

**Resultado**: 
- ✅ Finanzas actualizadas
- ✅ Dinero en movimiento refleja ventas actuales
- ✅ Dinero consolidado NO cambia

---

### 🔒 **2. Consolidación de Periodo**
```
Usuario hace clic en "Consolidar Periodo"
    ↓
FinanzasService.consolidarPeriodo(mes, anio)
    ↓
1. Suma todas las finanzas del periodo
2. Crea documento en finanzas_periodos_consolidados
3. Actualiza finanzas_modelos con periodoId
4. Transfiere dinero:
   - bank.dineroConsolidadoUSD += bank.dineroMovimientoUSD
   - bank.dineroMovimientoUSD = 0
5. Actualiza estadísticas globales
6. Cambia periodoActual al siguiente mes
```

**Resultado**:
- ✅ Periodo cerrado oficialmente
- ✅ Dinero transferido a consolidado
- ✅ Movimiento reseteado para el nuevo periodo
- ✅ Histórico inmutable preservado

---

## 📊 Cálculos Financieros

### Fórmulas (Correctas)

```typescript
// 1. Comisión de Agencia
comisionAgencia = ventasNetas × (porcentajeComisionAgencia / 100)

// 2. Ganancia Modelo (NO afectada por comisión banco)
gananciaModelo = ventasNetas - comisionAgencia

// 3. Comisión Banco (SOLO sobre comisión agencia)
comisionBanco = comisionAgencia × (porcentajeComisionBanco / 100)

// 4. Ganancia OnlyTop (después de comisión banco)
gananciaOnlyTop = comisionAgencia - comisionBanco
```

### Ejemplo Numérico

```
Ventas Netas: $2,500.00
Comisión Agencia (10%): $250.00
────────────────────────────────
Ganancia Modelo: $2,250.00  ✅ (NO se resta comisión banco)

Comisión Agencia: $250.00
Comisión Banco (2% de $250): $5.00
────────────────────────────────
Ganancia OnlyTop: $245.00  ✅ (comisión banco SOLO aquí)
```

---

## 🔐 Estados y Flujo

### Estados de Finanzas (finanzas_modelos)
1. **CALCULADO** - Finanzas calculadas automáticamente
2. **PENDIENTE_REVISION** - En revisión manual
3. **APROBADO** - Aprobadas por administrador
4. **PAGADO** - Pagadas a la modelo

### Estados de Periodo (finanzas_periodos_consolidados)
1. **ABIERTO** - Periodo en curso, aún se pueden modificar finanzas
2. **EN_REVISION** - Periodo cerrado, en revisión antes de consolidar
3. **CONSOLIDADO** - Periodo consolidado oficialmente, datos inmutables
4. **CERRADO** - Periodo archivado

---

## 🛡️ Seguridad y Validaciones

### Reglas de Negocio

1. **Unicidad de Finanzas**: Una modelo solo puede tener un registro por (mes, anio)
   ```typescript
   FinanzasModeloSchema.index({ modeloId: 1, mes: 1, anio: 1 }, { unique: true });
   ```

2. **Periodo ya Consolidado**: No se puede consolidar dos veces
   ```typescript
   if (existente && existente.estado === 'CONSOLIDADO') {
     throw new BadRequestException('Periodo ya consolidado');
   }
   ```

3. **Finanzas Requeridas**: No se puede consolidar sin finanzas calculadas
   ```typescript
   if (finanzas.length === 0) {
     throw new BadRequestException('No hay finanzas para consolidar');
   }
   ```

4. **Bank OnlyTop Único**: Solo existe un documento global
   ```typescript
   _id: 'onlytop_bank' // ID fijo
   ```

---

## 📡 API Endpoints

### Consolidación

```http
# Obtener estado del bank
GET /api/finanzas/bank
Authorization: Bearer {token}

# Consolidar periodo
POST /api/finanzas/consolidar/:mes/:anio
Authorization: Bearer {token}
Content-Type: application/json
{
  "notasCierre": "Cierre mensual octubre 2025"
}

# Listar periodos consolidados
GET /api/finanzas/periodos-consolidados
Authorization: Bearer {token}
```

### Respuestas

```json
// GET /api/finanzas/bank
{
  "success": true,
  "data": {
    "empresa": "OnlyTop",
    "dinero": {
      "consolidado": "$ 50,000.00",
      "movimiento": "$ 3,240.75",
      "total": "$ 53,240.75"
    },
    "periodoActual": "2025-10",
    "ultimaConsolidacion": "2025-09-30T23:59:59Z",
    "estadisticas": {
      "totalPeriodosConsolidados": 12,
      "totalModelosHistorico": 180,
      "totalVentasHistorico": 5400
    }
  }
}

// POST /api/finanzas/consolidar/10/2025
{
  "success": true,
  "message": "Periodo 2025-10 consolidado exitosamente",
  "data": {
    "periodo": "2025-10",
    "totales": {
      "ventasNetas": "$ 37,500.00",
      "gananciaOnlyTop": "$ 3,675.00"
    },
    "cantidadModelos": 15,
    "fechaConsolidacion": "2025-10-31T23:59:59Z"
  }
}
```

---

## 🎯 Permisos RBAC

```typescript
// Leer finanzas y bank
'finanzas:read'

// Calcular/recalcular finanzas
'finanzas:write'

// Consolidar periodos (acción crítica)
'finanzas:admin'
```

---

## 📈 Métricas y Auditoría

### Trazabilidad Completa

Cada operación financiera registra:
- ✅ **Usuario**: `calculadoPor`, `consolidadoPor`
- ✅ **Timestamp**: `fechaUltimoCalculo`, `fechaConsolidacion`
- ✅ **Referencias**: `periodoId`, `finanzasIds[]`
- ✅ **Metadatos**: `meta` con desglose detallado

### Reportes Disponibles

1. **Histórico de Consolidaciones**: Lista de todos los periodos cerrados
2. **Top Modelos por Periodo**: Mejores performers mensuales
3. **Tendencias de Crecimiento**: Análisis de incremento/decremento
4. **Distribución por Estado**: Finanzas calculadas vs aprobadas vs pagadas

---

## 🚀 Ventajas de esta Arquitectura

1. **📊 Contabilidad Profesional**: Separación clara entre capital consolidado e ingresos corrientes
2. **⚡ Tiempo Real**: Dinero en movimiento se actualiza instantáneamente
3. **🔒 Inmutabilidad**: Periodos consolidados no pueden modificarse
4. **🔍 Auditoría**: Trazabilidad completa de todas las operaciones
5. **📈 Escalabilidad**: Maneja millones de transacciones sin degradación
6. **💰 Precisión**: BigInt × 100,000 evita errores de redondeo
7. **🎯 Simplicidad**: Un documento global (bank_onlytop) centraliza el balance

---

## 🔧 Mantenimiento

### Inicialización Automática

El servicio inicializa el bank_onlytop automáticamente al arrancar:

```typescript
constructor(...) {
  this.inicializarBankOnlyTop();
}
```

### Migración de Datos Existentes

Para consolidar periodos históricos sin banco:

```bash
# Script de migración (ejecutar en mongo shell)
db.finanzas_modelos.aggregate([
  { $match: { periodoId: null } },
  { $group: {
      _id: { mes: "$mes", anio: "$anio" },
      totalGananciaOT: { $sum: "$gananciaOnlyTopUSD" }
    }
  }
]).forEach(periodo => {
  // Consolidar periodo retroactivamente
  // POST /api/finanzas/consolidar/:mes/:anio
});
```

---

## ✅ Checklist de Implementación

- [x] Schema `periodo-consolidado.schema.ts`
- [x] Schema `bank-onlytop.schema.ts`
- [x] Actualizar `finanzas-modelo.schema.ts` con `periodoId`
- [x] Service: `inicializarBankOnlyTop()`
- [x] Service: `actualizarDineroMovimiento()`
- [x] Service: `consolidarPeriodo()`
- [x] Service: `obtenerBankOnlyTop()`
- [x] Service: `obtenerPeriodosConsolidados()`
- [x] Controller: `GET /api/finanzas/bank`
- [x] Controller: `POST /api/finanzas/consolidar/:mes/:anio`
- [x] Controller: `GET /api/finanzas/periodos-consolidados`
- [ ] Frontend: Dashboard con visualización de bank
- [ ] Frontend: Botón "Consolidar Periodo"
- [ ] Frontend: Modal de confirmación
- [ ] Frontend: Lista de periodos consolidados
- [ ] Tests unitarios
- [ ] Tests de integración
- [ ] Documentación de usuario

---

**Arquitectura diseñada e implementada el 4 de octubre de 2025** 🎯
