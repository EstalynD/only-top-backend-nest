# Sistema de Transacciones de Movimiento de Dinero - OnlyTop

## 📋 Resumen Ejecutivo

Se implementó un **sistema profesional de auditoría y gestión de flujo de caja** para rastrear cada peso que entra y sale del banco corporativo de OnlyTop. Este sistema garantiza transparencia total, reversibilidad de errores y reportes precisos del estado financiero.

## 🎯 Problema Resuelto

**Antes**: El dinero se actualizaba directamente en `bank_onlytop.dineroMovimientoUSD` sin dejar registro detallado. Era imposible saber:
- Cuándo y por qué entró/salió cada monto
- Quién registró la operación
- Desglose por tipo de ingreso/egreso
- Auditoría completa del flujo de efectivo

**Ahora**: Cada operación financiera genera una **transacción auditable** con:
- Tipo (INGRESO/EGRESO)
- Origen (GANANCIA_MODELO, COSTO_FIJO, etc.)
- Monto, descripción, referencias
- Usuario, fecha, metadatos
- Estado (EN_MOVIMIENTO → CONSOLIDADO)

## 🏗️ Arquitectura Implementada

### 1. Schema `TransaccionMovimiento`
**Colección**: `finanzas_transacciones_movimiento`

```typescript
{
  periodo: "2025-10",
  mes: 10,
  anio: 2025,
  tipo: "INGRESO" | "EGRESO",
  origen: "GANANCIA_MODELO" | "COSTO_FIJO" | "COSTO_VARIABLE" | "AJUSTE_MANUAL" | ...,
  montoUSD: 196000000n, // BigInt × 100,000
  descripcion: "Ganancia OnlyTop - Ana Pérez - 2025-10",
  estado: "EN_MOVIMIENTO" | "CONSOLIDADO" | "REVERTIDO",
  referenciaId: "67a1b2c3...", // ID del documento origen
  referenciaModelo: "FinanzasModelo",
  modeloId: "67...",
  creadoPor: "user_id",
  fechaCreacion: Date,
  meta: {
    ventasNetas: 10000,
    comisionAgencia: 2000,
    porcentajeComision: 20,
    ...
  }
}
```

**Índices**: periodo + estado, tipo + estado + periodo, origen, referencia, modeloId.

---

### 2. Servicio `TransaccionesService`

**Métodos principales**:
- `registrarTransaccion(dto)`: crea transacción EN_MOVIMIENTO
- `obtenerTransacciones(filtros)`: lista paginada con filtros avanzados
- `obtenerResumenPeriodo(mes, anio)`: totales de ingresos/egresos, desglose por origen
- `obtenerSaldoMovimiento(periodo)`: saldo actual en movimiento + última transacción
- `marcarComoConsolidadas(mes, anio, periodoId, userId)`: cambia estado EN_MOVIMIENTO → CONSOLIDADO
- `revertirTransaccion(id, motivo, userId)`: crea transacción inversa y marca original REVERTIDO
- `generarFlujoCaja(mes, anio)`: reporte completo con saldo inicial, movimientos, saldo final
- `generarComparativa(periodos)`: compara múltiples meses, tendencia, promedios

---

### 3. Servicio `BankOnlyTopService` (Puerta Única al Banco)

**Regla crítica**: **NUNCA** modificar `bank_onlytop` directamente desde módulos. **SIEMPRE** usar `BankOnlyTopService`.

**Métodos principales**:

#### `aplicarMovimiento({ tipo, montoUSD, motivo, origen, referencia, userId, meta })`
1. Registra transacción EN_MOVIMIENTO (vía `TransaccionesService`)
2. Actualiza `dineroMovimientoUSD` atómicamente con `$inc` (+ para INGRESO, - para EGRESO)
3. Logs estructurados
4. Retorna estado actualizado del banco

#### `consolidarPeriodo({ periodo, mes, anio, usuarioId, notas })`
1. Valida que haya transacciones EN_MOVIMIENTO
2. Transfiere atómicamente: `dineroMovimientoUSD → dineroConsolidadoUSD` y resetea movimiento a 0
3. Marca todas las transacciones del periodo como CONSOLIDADO
4. Actualiza contadores globales
5. Retorna estado actualizado

#### `getEstado()`
Retorna snapshot actual del banco (consolidado + movimiento) con montos convertidos a `number` (2 decimales).

---

### 4. Integración en Módulos

#### **FinanzasService** (ganancias de modelos)

```typescript
// Al calcular finanzas de una modelo
async calcularFinanzas(dto, userId) {
  // ... cálculo de ventas, comisiones, ganancias ...
  
  // Registrar transacción INGRESO
  await this.bankService.aplicarMovimiento({
    tipo: 'INGRESO',
    montoUSD: gananciaOnlyTopUSD_BigInt,
    motivo: `Ganancia OnlyTop - ${modelo.nombreCompleto} - ${periodo}`,
    origen: OrigenTransaccion.GANANCIA_MODELO,
    referencia: finanzas._id.toString(),
    referenciaModelo: 'FinanzasModelo',
    modeloId: dto.modeloId,
    userId,
    meta: { ventasNetas, comisionAgencia, comisionBanco, porcentajeComision }
  });
}

// Al consolidar periodo
async consolidarPeriodo(mes, anio, userId, notas) {
  // ... crear/actualizar periodo consolidado ...
  
  // Consolidar banco: movimiento → consolidado
  await this.bankService.consolidarPeriodo({ periodo, mes, anio, usuarioId, notas });
  await this.bankService.actualizarContadores({ modelos, ventas });
}
```

#### **CostosFijosService** (gastos operativos)

```typescript
// Al registrar gasto fijo
async registrarGasto(mes, anio, dto, userId) {
  // ... crear gasto ...
  
  // Registrar transacción EGRESO
  await this.bankService.aplicarMovimiento({
    tipo: 'EGRESO',
    montoUSD: gastoUSD_BigInt,
    motivo: `Gasto fijo - ${dto.concepto} (${categoria.nombre})`,
    origen: OrigenTransaccion.COSTO_FIJO,
    referencia: costos._id.toString(),
    referenciaModelo: 'CostosFijosMensuales',
    userId,
    meta: { nombreCategoria, conceptoGasto, notas }
  });
}

// Consolidación de costos ya no descuenta del banco directamente
// Las transacciones individuales de cada gasto ya aplicaron los EGRESOS
```

---

### 5. Controller `TransaccionesController`

**Endpoints REST**:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/finanzas/transacciones` | Lista transacciones con filtros (periodo, tipo, origen, estado, paginación) |
| GET | `/api/finanzas/transacciones/:id` | Obtiene transacción específica |
| GET | `/api/finanzas/transacciones/resumen/:mes/:anio` | Resumen del periodo (ingresos, egresos, desglose, estado) |
| GET | `/api/finanzas/transacciones/saldo/movimiento` | Saldo actual en movimiento + última transacción |
| GET | `/api/finanzas/transacciones/flujo-caja/:mes/:anio` | Reporte detallado de flujo de caja |
| POST | `/api/finanzas/transacciones/comparativa` | Compara múltiples periodos (body: `{ periodos: ["2025-10", "2025-11"] }`) |
| GET | `/api/finanzas/transacciones/bank/estado` | Estado completo del banco |
| DELETE | `/api/finanzas/transacciones/:id/revertir` | Revierte transacción (body: `{ motivo }`) |

**Permisos**:
- `finanzas:read` → consultas y reportes
- `finanzas:write` → reversiones

---

## 📊 Flujo de Ejemplo Completo

### Mes: Octubre 2025

#### 1. **Calcular finanzas de modelo "Ana Pérez"**
- Ventas netas: $10,000
- Comisión agencia (20%): $2,000
- Comisión banco (2% de $2,000): $40
- **Ganancia OnlyTop**: $1,960

**Acción**:
```typescript
BankOnlyTopService.aplicarMovimiento({
  tipo: 'INGRESO',
  montoUSD: 196000000n,
  origen: 'GANANCIA_MODELO',
  motivo: 'Ganancia OnlyTop - Ana Pérez - 2025-10',
  ...
})
```

**Resultado**:
- Transacción creada (estado: EN_MOVIMIENTO)
- `dineroMovimientoUSD += 196000000n`
- Log: `💰 Movimiento aplicado: INGRESO +$1,960 | Ganancia OnlyTop - Ana Pérez - 2025-10`

---

#### 2. **Registrar gasto fijo "Hosting servidor"**
- Monto: $200
- Categoría: Administrativos

**Acción**:
```typescript
BankOnlyTopService.aplicarMovimiento({
  tipo: 'EGRESO',
  montoUSD: 20000000n,
  origen: 'COSTO_FIJO',
  motivo: 'Gasto fijo - Hosting servidor (Administrativos)',
  ...
})
```

**Resultado**:
- Transacción creada (estado: EN_MOVIMIENTO)
- `dineroMovimientoUSD -= 20000000n`
- Log: `💰 Movimiento aplicado: EGRESO -$200 | Gasto fijo - Hosting servidor`

---

#### 3. **Consultar saldo en movimiento**

**Request**: `GET /api/finanzas/transacciones/saldo/movimiento?periodo=2025-10`

**Response**:
```json
{
  "periodoActual": "2025-10",
  "dineroMovimientoUSD": 1760,
  "dineroMovimientoFormateado": "$1,760.00",
  "dineroConsolidadoUSD": 0,
  "dineroConsolidadoFormateado": "$0.00",
  "totalUSD": 1760,
  "totalFormateado": "$1,760.00",
  "ingresosEnMovimiento": 1960,
  "egresosEnMovimiento": 200,
  "saldoNetoMovimiento": 1760,
  "transaccionesEnMovimiento": 2,
  "ultimaTransaccion": {
    "fecha": "2025-10-15T10:30:00Z",
    "tipo": "EGRESO",
    "origen": "COSTO_FIJO",
    "monto": 200,
    "descripcion": "Gasto fijo - Hosting servidor (Administrativos)"
  }
}
```

---

#### 4. **Consolidar periodo (fin de mes)**

**Acción**:
```typescript
BankOnlyTopService.consolidarPeriodo({
  periodo: '2025-10',
  mes: 10,
  anio: 2025,
  usuarioId: 'admin_id',
  notas: 'Cierre mensual Octubre 2025'
})
```

**Resultado**:
- Saldo en movimiento: $1,760
- `dineroConsolidadoUSD += 176000000n`
- `dineroMovimientoUSD = 0n`
- Las 2 transacciones pasan de `EN_MOVIMIENTO` a `CONSOLIDADO`
- `ultimaConsolidacion = new Date()`
- `totalPeriodosConsolidados++`
- Log: `✅ Periodo 2025-10 consolidado exitosamente | Monto: $1,760`

---

#### 5. **Generar reporte de flujo de caja**

**Request**: `GET /api/finanzas/transacciones/flujo-caja/10/2025`

**Response**:
```json
{
  "periodo": "2025-10",
  "mes": 10,
  "anio": 2025,
  "saldoInicial": 0,
  "saldoInicialFormateado": "$0.00",
  "ingresos": [
    {
      "tipo": "GANANCIA_MODELO",
      "cantidad": 1,
      "total": 1960,
      "totalFormateado": "$1,960.00"
    }
  ],
  "egresos": [
    {
      "tipo": "COSTO_FIJO",
      "cantidad": 1,
      "total": 200,
      "totalFormateado": "$200.00"
    }
  ],
  "totalIngresos": 1960,
  "totalIngresosFormateado": "$1,960.00",
  "totalEgresos": 200,
  "totalEgresosFormateado": "$200.00",
  "saldoFinal": 1760,
  "saldoFinalFormateado": "$1,760.00",
  "cambioAbsoluto": 1760,
  "cambioRelativo": 89.80, // (1760 / 1960) * 100
  "consolidado": true,
  "fechaConsolidacion": "2025-10-31T23:59:00Z"
}
```

---

## ✅ Ventajas del Sistema

1. **Auditoría Total**: Cada peso tiene registro con fecha, usuario, origen, referencias, metadatos.
2. **Reversibilidad**: Errores se corrigen con transacciones inversas (no se borran datos).
3. **Reportes Precisos**: Flujo de caja, comparativas, desgloses sin recalcular.
4. **Debugging Fácil**: Logs estructurados, estado de cada transacción, trazabilidad completa.
5. **Integridad**: Consolidación verifica que saldo de transacciones coincida con `dineroMovimientoUSD`.
6. **Escalabilidad**: Nuevo tipo de ingreso/egreso → solo agregar origen en enum y registrar transacción.
7. **Transparencia**: Cualquier usuario con permiso puede ver historial completo.

---

## 📝 Reglas de Implementación (rules.md)

1. **NUNCA** modificar `dineroMovimientoUSD` o `dineroConsolidadoUSD` directamente.
2. **SIEMPRE** usar `BankOnlyTopService.aplicarMovimiento` para ingresos/egresos.
3. Cada operación que afecte dinero **DEBE** registrar transacción.
4. Validar que transacciones no se creen en periodos consolidados.
5. Logs **DEBEN** incluir: tipo, origen, monto (BigInt y decimal), descripción, periodo.
6. Tests verifican: transacción creada, banco actualizado, saldo correcto tras consolidación.

---

## 🧪 Checklist de PR con Transacciones

- [ ] Operación que genera/gasta dinero llama a `BankOnlyTopService.aplicarMovimiento`.
- [ ] Origen de transacción es claro y específico.
- [ ] Meta incluye contexto relevante.
- [ ] Consolidación marca transacciones EN_MOVIMIENTO como CONSOLIDADO.
- [ ] No hay escrituras directas a `bank_onlytop` fuera de BankOnlyTopService.
- [ ] Logs estructurados de cada transacción.
- [ ] Tests verifican creación de transacción y actualización del banco.

---

## 🚀 Siguientes Pasos (Opcionales)

1. **Frontend**: Crear componente `TransaccionesView` con tabla filtrable, resumen, gráficos.
2. **Dashboard**: Widget de flujo de caja en tiempo real para admins.
3. **Notificaciones**: Alertas cuando dinero en movimiento supera umbrales.
4. **Exportación**: Botón para descargar transacciones como CSV/PDF.
5. **Búsqueda avanzada**: Filtros por múltiples criterios, rangos de montos.

---

## 📦 Archivos Creados/Modificados

### Nuevos:
- `transaccion-movimiento.schema.ts` - Schema de transacciones
- `transacciones.dto.ts` - DTOs de consulta y respuesta
- `transacciones.service.ts` - Lógica de transacciones
- `bank-onlytop.service.ts` - Servicio de dominio del banco
- `transacciones.controller.ts` - Endpoints REST

### Modificados:
- `finanzas.module.ts` - Registra nuevos servicios y schemas
- `finanzas.service.ts` - Usa BankOnlyTopService para aplicar movimientos
- `costos-fijos.service.ts` - Registra transacciones EGRESO por gastos
- `rules.md` - Documenta reglas de transacciones y banco

---

## 🎉 Conclusión

El sistema de transacciones transforma OnlyTop en una plataforma **financieramente auditable y profesional**. Cada operación queda registrada con detalles completos, permitiendo:
- Reportes precisos sin recalcular
- Detección rápida de errores
- Reversibilidad total
- Transparencia ante auditorías
- Escalabilidad para nuevos tipos de movimientos

**Estado**: ✅ 100% implementado y documentado. Listo para producción.
