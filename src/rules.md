# Reglas de desarrollo backend

## Rutas REST
- Define rutas REST con segmentos explícitos y evita parámetros comodín como `/:id` en niveles padre cuando existan subrutas (`/goals`, `/commissions`, etc.). Prefiere prefijos específicos (por ejemplo, `/campaign/:id`) para eliminar colisiones y mantener validaciones limpias.

## Validación de DTOs
- Usa `@IsOptional()` para campos opcionales y `skipMissingProperties: true` en ValidationPipe global para manejar query parameters opcionales sin Transform decorators.
- Valida enums con `@IsEnum()` y arrays con `@IsArray()` + validadores específicos.
- Para fechas, usa `@IsDateString()` y convierte a Date en el servicio.
- Valida URLs con `@IsUrl()` y números con `@IsNumber()` + `@Min()`.

## Schemas de Mongoose
- Define enums antes del schema para reutilizarlos en DTOs.
- Usa subdocumentos (`_id: false`) para estructuras anidadas complejas.
- Crea índices compuestos para queries frecuentes (por modelo, fecha, estado).
- Documenta cada campo con comentarios inline.

## Servicios
- Valida ObjectIds con `Types.ObjectId.isValid()` antes de queries.
- Usa `populate()` para traer datos relacionados en respuestas.
- Lanza `BadRequestException` para validaciones de negocio.
- Lanza `NotFoundException` cuando no se encuentre el recurso.
- Usa `Logger` para registrar operaciones críticas (creación, actualización, eliminación).

## Controladores
- Agrupa endpoints relacionados bajo un prefijo común (ej: `/api/traffic/campaigns`).
- Usa prefijos específicos para evitar colisiones: `/campaign/:id` en lugar de `/:id`.
- Aplica `@RequirePermissions()` a cada endpoint con permisos granulares.
- Usa `@HttpCode(HttpStatus.NO_CONTENT)` para DELETE exitoso.
- Inyecta `@User()` decorator para obtener el usuario autenticado.

## Permisos RBAC
- Nomenclatura: `modulo:submodulo:recurso:accion` (ej: `ventas:traffic:campaigns:create`).
- Agrupa permisos por módulo en `rbac.constants.ts`.
- Define permisos granulares: `create`, `read`, `update`, `delete`, `export`, `stats`, `approve`, `pay`.

## Dinero y Banco (Regla General)

Objetivo: Estandarizar el manejo de montos monetarios y la actualización del banco corporativo para todos los módulos. Estas reglas son obligatorias.

### 1) Moneda y montos (MoneyService)

- Unidad interna: todos los montos se almacenan en USD como enteros escalados a 5 decimales (×100000) usando `MoneyService.toDatabase`. Nunca guardes `Number` en Mongo para dinero.
- Tipado en Schemas: los campos monetarios deben terminar en `USD` y ser `BigInt` con `default: 0n`. Ejemplos: `montoUSD`, `precioUSD`, `totalGastosUSD`, `gananciaUSD`.
- Entrada (DTO): acepta números con 2–5 decimales y moneda de origen opcional. Convierte SIEMPRE en el servicio: valida con `validatePositive/validateRange` y transforma a escalado con `toDatabase`. Si se recibe en moneda distinta a USD, convierte con `convert` (tasa requerida) ANTES de `toDatabase`.
- Cálculo interno: 
	- Para agregaciones en BD, opera con `bigint` (sumas/restas directas de campos `BigInt`).
	- Para lógica de dominio en memoria, usa `big.js` a través de `MoneyService.add/subtract/multiply/divide` SOLO tras convertir con `fromDatabase` y vuelve a escalar al persistir.
- Salida (API): nunca expongas `bigint` crudo. Convierte con `fromDatabase` a `number` (2 decimales). El formateo para UI (símbolo, separadores) debe ocurrir en frontend. Si necesitas formateo en backend (logs, PDFs), usa `formatForUser`.
- Redondeo: usa `round` (banker's rounding) para valores de presentación, no para almacenamiento.

Patrón mínimo en servicios:
- Recibir DTO con `monto` (number) y opcional `currency`/`exchangeRate`.
- Convertir a USD si aplica y luego `toDatabase` → asignar a `...USD: bigint`.
- En totales, acumular en `bigint` y persistir. Para responder, mapear con `fromDatabase`.

### 2) Banco corporativo (BankOnlyTop)

- Documento único: colección `bank_onlytop`, `_id: 'onlytop_bank'`. Campos clave: `dineroConsolidadoUSD` (histórico), `dineroMovimientoUSD` (periodo en curso), ambos `BigInt`.
- Única puerta de entrada: crea/usa un servicio de dominio (p.ej. `BankOnlyTopService`) para cualquier modificación; NUNCA escribir directamente al modelo desde módulos.
- Operaciones soportadas (contrato sugerido):
	- `aplicarMovimiento({ tipo: 'INGRESO' | 'EGRESO', montoUSD: bigint, motivo: string, referencia?: string, meta?: any })` → actualiza `dineroMovimientoUSD` con `$inc` (egreso aplica como monto negativo).
	- `consolidarPeriodo({ periodo: 'YYYY-MM', usuarioId: string, meta?: any })` → mueve atómicamente `dineroMovimientoUSD` a `dineroConsolidadoUSD` y resetea movimiento. Actualiza `ultimaConsolidacion`, `periodoActual` y contadores.
	- `getEstado()` → retorna snapshot (nunca exponer `bigint` sin `fromDatabase`).
- Consistencia: usa `findOneAndUpdate` atómico o transacciones cuando la consolidación involucre múltiples colecciones. Los montos siempre llegan como `bigint` ya escalados por `MoneyService`.
- Integración de módulos: cualquier flujo que afecte la ganancia neta debe invocar `aplicarMovimiento`:
	- Ingresos (ventas/comisiones) → `INGRESO` con monto positivo.
	- Costos/egresos (costos fijos, pagos, compras) → `EGRESO` con monto positivo (el servicio lo convierte a negativo).
	- Consolidaciones mensuales → llamar a `consolidarPeriodo` al cerrar.

### 3) Convenciones de nombres y DTOs

- Campos de dinero en BD: `*USD: bigint` (ej: `montoUSD`, `costoUSD`, `saldoUSD`).
- En respuestas: `*USD: number` (2 decimales). Si necesitas ambos, define objetos `raw` y `view` explícitos.
- DTO de entrada mínimo:
	- `monto: number` (2–5 decimales)
	- `currency?: 'USD' | 'COP' | string` (default `USD`)
	- `exchangeRate?: number` (requerido si `currency !== 'USD'`)

### 4) Reglas de validación y errores

- Lanza `BadRequestException` ante:
	- Más de 5 decimales en entrada antes de escalar.
	- `exchangeRate` faltante para moneda != USD.
	- Montos negativos cuando no corresponda.
- Logs críticos deben registrar tanto el `bigint` como el valor humano: `montoUSD=123450n (~1.2345 USD)`.

### 5) Checklist obligatorio en PRs

- [ ] Todos los campos monetarios en Schemas son `BigInt` y terminan en `USD`.
- [ ] Se usa `MoneyService.toDatabase/fromDatabase` en los límites (persistencia/response).
- [ ] No hay `Number` almacenado para dinero.
- [ ] Actualizaciones al banco pasan por `BankOnlyTopService` (sin escrituras directas).
- [ ] Consolidación mueve `movimiento → consolidado` de forma atómica.
- [ ] Tests de ida y vuelta: `fromDatabase(toDatabase(x)) == x` para valores representativos.

### 6) Ejemplos rápidos

Entrada y guardado:
- `montoDecimal = 123.45` → `montoUSD = MoneyService.toDatabase(123.45, 'USD') // 12345000n`
- Guardar: `doc.montoUSD = montoUSD;` y acumular totales con `bigint`.

Salida:
- `view.monto = MoneyService.fromDatabase(doc.montoUSD) // 123.45`
- UI formatea: `MoneyService.formatForUser(view.monto, 'USD') // "$ 123.45"`

Banco (egreso de costos fijos):
- `BankOnlyTopService.aplicarMovimiento({ tipo: 'EGRESO', montoUSD: costoUSD, motivo: 'Costos fijos mes 2025-10', referencia: costosId })`

Consolidación:
- `BankOnlyTopService.consolidarPeriodo({ periodo: '2025-10', usuarioId })`

Estas reglas garantizan precisión monetaria, consistencia entre módulos y un único estado de verdad del dinero corporativo.

## Transacciones y Flujo de Caja (Obligatorio)

Objetivo: Auditoría completa de cada peso que entra o sale del banco OnlyTop antes de consolidar. Sistema de transacciones permite rastrear, revertir y generar reportes detallados del flujo de efectivo.

### 1) Sistema de Transacciones (TransaccionMovimiento)

- Colección: `finanzas_transacciones_movimiento` registra cada ingreso/egreso como documento individual.
- Campos clave: `tipo` (INGRESO/EGRESO), `origen` (GANANCIA_MODELO, COSTO_FIJO, etc.), `montoUSD` (BigInt × 100,000), `estado` (EN_MOVIMIENTO/CONSOLIDADO/REVERTIDO), `referencia` (ID del documento origen), `periodo`, `descripcion`, `meta`.
- Estado: EN_MOVIMIENTO para transacciones del periodo activo; CONSOLIDADO tras cerrar mes; REVERTIDO si se corrige.
- Auditoría: cada transacción tiene `creadoPor`, `fechaCreacion`, y metadatos con contexto completo (ej: ventasNetas, porcentaje comisión).

### 2) Flujo de registro (obligatorio para todos los módulos)

**Al generar dinero (ingresos)**:
- FinanzasService.calcularFinanzas → llama a `BankOnlyTopService.aplicarMovimiento({ tipo: 'INGRESO', montoUSD, origen: GANANCIA_MODELO, referencia, modeloId, meta })`.
- BankOnlyTopService registra transacción EN_MOVIMIENTO y actualiza `dineroMovimientoUSD` atómicamente con `$inc`.

**Al gastar dinero (egresos)**:
- CostosFijosService.registrarGasto → llama a `BankOnlyTopService.aplicarMovimiento({ tipo: 'EGRESO', montoUSD, origen: COSTO_FIJO, referencia, meta })`.
- BankOnlyTopService registra transacción EN_MOVIMIENTO y decrementa `dineroMovimientoUSD`.

**Otros orígenes soportados**: COSTO_VARIABLE, AJUSTE_MANUAL, CONSOLIDACION_COSTOS, RECALCULO_PERIODO, OTRO.

### 3) Consolidación de periodo (cierre mensual)

- FinanzasService.consolidarPeriodo → llama a `BankOnlyTopService.consolidarPeriodo({ periodo, mes, anio, usuarioId, notas })`.
- BankOnlyTopService:
  1. Verifica que haya transacciones EN_MOVIMIENTO.
  2. Transfiere atómicamente `dineroMovimientoUSD → dineroConsolidadoUSD` y resetea movimiento a 0.
  3. Marca todas las transacciones del periodo como CONSOLIDADO (vía TransaccionesService).
  4. Actualiza contadores globales (`totalPeriodosConsolidados`, etc.).
- Resultado: periodo cerrado oficialmente, transacciones inmutables, saldo histórico actualizado.

### 4) Consultas y reportes (TransaccionesService)

- `obtenerTransacciones(filtros)`: lista paginada con filtros por periodo, tipo, origen, estado, modeloId.
- `obtenerResumenPeriodo(mes, anio)`: totales de ingresos/egresos, desglose por origen, estado del periodo.
- `obtenerSaldoMovimiento(periodo?)`: saldo actual en movimiento, última transacción, cantidad de transacciones activas.
- `generarFlujoCaja(mes, anio)`: reporte completo con saldo inicial, movimientos detallados, saldo final, cambio relativo.
- `generarComparativa(periodos)`: compara múltiples periodos, calcula promedios, identifica tendencia (CRECIENTE/ESTABLE/DECRECIENTE).
- `revertirTransaccion(id, motivo, userId)`: crea transacción inversa y marca original como REVERTIDO (solo si EN_MOVIMIENTO).

### 5) Ventajas del sistema de transacciones

- **Auditoría total**: cada peso tiene registro con fecha, usuario, origen, referencias.
- **Reversibilidad**: errores se corrigen con transacciones inversas (no se borran datos).
- **Reportes precisos**: flujo de caja, comparativas, desglose por tipo/origen sin recalcular.
- **Debugging fácil**: logs estructurados, estado de cada transacción, trazabilidad completa.
- **Integridad**: consolidación solo procede si saldo de transacciones coincide con `dineroMovimientoUSD`.
- **Escalabilidad**: nuevo tipo de ingreso/egreso → solo agregar origen en enum y registrar transacción.

### 6) Reglas de implementación

- NUNCA modificar `dineroMovimientoUSD` o `dineroConsolidadoUSD` directamente desde módulos; SIEMPRE usar `BankOnlyTopService.aplicarMovimiento`.
- Cada operación que afecte dinero DEBE registrar transacción (excepto consolidación, que solo marca estado).
- Validar que transacciones no se creen en periodos consolidados (lanzar BadRequestException).
- Logs DEBEN incluir: tipo, origen, monto (BigInt y decimal), descripción, periodo.
- Tests de integración deben verificar: transacción creada, banco actualizado, saldo correcto tras consolidación.

### 7) Checklist de PR con transacciones

- [ ] Operación que genera/gasta dinero llama a `BankOnlyTopService.aplicarMovimiento`.
- [ ] Origen de transacción es claro y específico (no usar OTRO a menos que sea necesario).
- [ ] Meta incluye contexto relevante (ej: para GANANCIA_MODELO incluir ventasNetas, comisión, etc.).
- [ ] Consolidación marca transacciones EN_MOVIMIENTO como CONSOLIDADO.
- [ ] No hay escrituras directas a `bank_onlytop` fuera de BankOnlyTopService.
- [ ] Logs estructurados de cada transacción (tipo, monto, origen, descripción).
- [ ] Tests verifican creación de transacción y actualización correcta del banco.

### 8) Ejemplo de flujo completo

1. **Calcular finanzas de modelo** (Octubre 2025):
   - Ventas netas: $10,000
   - Comisión agencia (20%): $2,000
   - Comisión banco (2% de $2,000): $40
   - Ganancia OnlyTop: $1,960
   - → `BankOnlyTopService.aplicarMovimiento({ tipo: 'INGRESO', montoUSD: 196000000n, origen: GANANCIA_MODELO, motivo: 'Ganancia OnlyTop - Ana Pérez - 2025-10', ... })`
   - Resultado: transacción creada, `dineroMovimientoUSD += 196000000n`.

2. **Registrar gasto fijo**:
   - Concepto: "Hosting servidor"
   - Monto: $200
   - → `BankOnlyTopService.aplicarMovimiento({ tipo: 'EGRESO', montoUSD: 20000000n, origen: COSTO_FIJO, motivo: 'Gasto fijo - Hosting servidor (Administrativos)', ... })`
   - Resultado: transacción creada, `dineroMovimientoUSD -= 20000000n`.

3. **Consolidar periodo** (fin de Octubre):
   - → `BankOnlyTopService.consolidarPeriodo({ periodo: '2025-10', mes: 10, anio: 2025, usuarioId })`
   - Saldo en movimiento: $1,760 (ingreso $1,960 - egreso $200)
   - Resultado: `dineroConsolidadoUSD += 176000000n`, `dineroMovimientoUSD = 0n`, todas las transacciones del mes marcadas CONSOLIDADO.

4. **Consultar flujo de caja**:
   - `TransaccionesService.generarFlujoCaja(10, 2025)`
   - Retorna: saldo inicial $0, ingresos $1,960, egresos $200, saldo final $1,760, cambio +100%.

Este sistema garantiza que cada centavo esté auditado y que la consolidación sea precisa y transparente.
