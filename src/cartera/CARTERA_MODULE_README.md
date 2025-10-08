# Módulo de Cartera - OnlyTop

## 📚 Descripción General

El **Módulo de Cartera** gestiona la facturación, pagos y cobranza de las modelos en OnlyTop. Implementa un sistema completo de cuentas por cobrar con:

- ✅ **Facturación automática** por modelo basada en contratos y ventas reales
- ✅ **Registro de pagos** con comprobantes digitales (Cloudinary)
- ✅ **Estado de cuenta** detallado con exportación PDF
- ✅ **Alertas y recordatorios** automáticos por email
- ✅ **Dashboard de cartera** con estadísticas en tiempo real
- ✅ **Integración completa** con Modelos, Contratos, Ventas, Finanzas

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    MÓDULO DE CARTERA                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Factura    │  │     Pago     │  │ Recordatorio │         │
│  │   Entity     │  │   Entity     │  │   Entity     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                 │
│                            │                                     │
│                   ┌────────▼─────────┐                          │
│                   │ CarteraService   │                          │
│                   └────────┬─────────┘                          │
│                            │                                     │
│         ┌──────────────────┼──────────────────┐                │
│         │                  │                  │                 │
│    ┌────▼─────┐    ┌──────▼──────┐    ┌─────▼──────┐          │
│    │ Modelos  │    │  Contratos  │    │   Ventas   │          │
│    │ Entity   │    │   Modelo    │    │  (Chatter  │          │
│    └──────────┘    │   Entity    │    │   Sales)   │          │
│                    └─────────────┘    └────────────┘          │
│                                                                  │
│  Servicios Externos:                                            │
│  • CloudinaryService → Comprobantes de pago                    │
│  • EmailService → Recordatorios y alertas                      │
│  • PDFService → Estado de cuenta exportable                    │
│  • MoneyService → Cálculos monetarios precisos                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Schemas (Modelos de Datos)

### 1. FacturaEntity

```typescript
{
  numeroFactura: string;           // "FACT-2025-001"
  modeloId: ObjectId;               // Ref → ModeloEntity
  contratoId: ObjectId;             // Ref → ContratoModeloEntity
  periodo: {
    anio: number;
    mes: number;
    quincena?: 1 | 2;
  };
  fechaEmision: Date;
  fechaVencimiento: Date;
  estado: 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO' | 'CANCELADO';
  
  items: [
    {
      concepto: string;              // "Comisión ventas 2025-01"
      cantidad: number;
      valorUnitario: bigint;         // USD escalado
      subtotal: bigint;              // USD escalado
      notas?: string;
    }
  ];
  
  subtotalUSD: bigint;
  descuentoUSD?: bigint;
  totalUSD: bigint;
  
  // Formateados para frontend
  subtotalFormateado: string;
  totalFormateado: string;
  
  pagos: ObjectId[];                 // Refs → PagoEntity
  saldoPendienteUSD: bigint;
  
  notas?: string;
  creadaPor: ObjectId;               // Ref → UserEntity
  meta?: Record<string, any>;
}
```

### 2. PagoEntity

```typescript
{
  facturaId: ObjectId;               // Ref → FacturaEntity
  numeroRecibo: string;              // "REC-2025-001"
  fechaPago: Date;
  montoUSD: bigint;                  // Escalado
  montoFormateado: string;
  metodoPago: 'TRANSFERENCIA' | 'EFECTIVO' | 'CHEQUE' | 'OTRO';
  referencia?: string;
  
  comprobante?: {
    publicId: string;                // Cloudinary ID
    url: string;
    downloadUrl: string;
    format: string;                  // jpg, png
    size: number;
  };
  
  observaciones?: string;
  registradoPor: ObjectId;           // Ref → UserEntity
  meta?: Record<string, any>;
}
```

### 3. RecordatorioEntity

```typescript
{
  facturaId: ObjectId;               // Ref → FacturaEntity
  tipo: 'PROXIMO_VENCIMIENTO' | 'VENCIDO' | 'MORA';
  fechaEnvio: Date;
  emailDestino: string;
  asunto: string;
  contenidoHTML: string;
  estado: 'ENVIADO' | 'ERROR' | 'PENDIENTE';
  errorMensaje?: string;
  enviadoPor: ObjectId | 'SISTEMA';
}
```

### 4. ConfiguracionCarteraEntity

```typescript
{
  diasVencimientoFactura: number;    // Default: 15 días
  diasAntesAlerta1: number;          // Default: 5 días antes
  diasAntesAlerta2: number;          // Default: 2 días antes
  diasDespuesAlertaMora: number;     // Default: 3 días después
  emailCC?: string[];
  activo: boolean;
  meta?: Record<string, any>;
}
```

---

## 🔄 Flujos de Negocio

### Flujo 1: Generación Automática de Facturas

```
1. Trigger: Fin de periodo (quincenal/mensual) o manual
   ↓
2. Consultar ContratoModeloEntity para obtener:
   - Tipo de comisión (FIJA o ESCALONADA)
   - Porcentaje o escala de comisión
   - Periodicidad de pago
   ↓
3. Consultar ChatterSales del periodo para la modelo
   ↓
4. Calcular monto usando MoneyService:
   - Ventas totales × % comisión
   - Aplicar escala si es ESCALONADA
   - Restar descuentos si aplica
   ↓
5. Crear FacturaEntity con:
   - Items detallados (concepto, cantidad, valor)
   - Total en USD escalado
   - Estado PENDIENTE
   - FechaVencimiento = FechaEmision + diasVencimiento
   ↓
6. Retornar factura generada
```

### Flujo 2: Registro de Pago

```
1. Recibir: facturaId, monto, fecha, método, comprobante (file)
   ↓
2. Validar factura existe y está PENDIENTE o PARCIAL
   ↓
3. Subir comprobante a Cloudinary:
   - Carpeta: cartera/comprobantes/{modeloId}
   - Formatos permitidos: jpg, png
   - Max size: 5MB
   ↓
4. Crear PagoEntity con:
   - Monto escalado USD
   - Ref a factura
   - URL comprobante Cloudinary
   ↓
5. Actualizar FacturaEntity:
   - Agregar pago a array pagos[]
   - Recalcular saldoPendiente
   - Si saldo = 0 → estado = PAGADO
   - Si saldo < total → estado = PARCIAL
   ↓
6. Enviar email de confirmación a modelo
   ↓
7. Retornar pago registrado
```

### Flujo 3: Alertas Automáticas (Cron Diario)

```
1. Ejecutar diariamente a las 8:00 AM
   ↓
2. Obtener ConfiguracionCartera
   ↓
3. Buscar facturas próximas a vencer:
   - (fechaVencimiento - hoy) <= diasAntesAlerta1
   - Estado = PENDIENTE o PARCIAL
   - Sin recordatorio reciente
   ↓
4. Buscar facturas vencidas:
   - fechaVencimiento < hoy
   - Estado = PENDIENTE o PARCIAL
   - Marcar estado = VENCIDO
   ↓
5. Por cada factura:
   - Generar plantilla HTML personalizada
   - Enviar email a modelo
   - Registrar RecordatorioEntity
   ↓
6. Log de resultados
```

---

## 🔌 API Endpoints

### Facturas

```typescript
// Generar factura manual
POST /api/cartera/facturas
Body: {
  modeloId: string;
  periodo: { anio: number; mes: number; quincena?: 1 | 2 };
  items?: Array<{ concepto, cantidad, valorUnitario, notas? }>;
  notas?: string;
}
Response: FacturaEntity

// Generar facturas por periodo (lote)
POST /api/cartera/facturas/periodo
Body: {
  anio: number;
  mes: number;
  quincena?: 1 | 2;
  modeloIds?: string[];  // Si se omite, procesa todas las activas
}
Response: { generadas: number; facturas: FacturaEntity[] }

// Listar facturas con filtros
GET /api/cartera/facturas
Query: {
  modeloId?: string;
  estado?: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  limit?: number;
}
Response: { total: number; facturas: FacturaEntity[] }

// Obtener factura por ID
GET /api/cartera/facturas/:id
Response: FacturaEntity (populated)

// Actualizar factura
PATCH /api/cartera/facturas/:id
Body: { notas?, estado? }
Response: FacturaEntity

// Cancelar factura
DELETE /api/cartera/facturas/:id
Response: 204 No Content
```

### Pagos

```typescript
// Registrar pago
POST /api/cartera/pagos
Content-Type: multipart/form-data
Body: {
  facturaId: string;
  fechaPago: string;       // ISO 8601
  monto: number;
  metodoPago: string;
  referencia?: string;
  observaciones?: string;
  file?: File;             // Comprobante (jpg, png)
}
Response: PagoEntity

// Listar pagos
GET /api/cartera/pagos
Query: {
  facturaId?: string;
  modeloId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}
Response: PagoEntity[]

// Obtener pagos de una factura
GET /api/cartera/facturas/:facturaId/pagos
Response: PagoEntity[]

// Ver comprobante de pago
GET /api/cartera/pagos/:id/comprobante
Response: Redirect to Cloudinary signed URL
```

### Estado de Cuenta

```typescript
// Obtener estado de cuenta JSON
GET /api/cartera/estado-cuenta/:modeloId
Query: {
  fechaInicio?: string;
  fechaFin?: string;
}
Response: {
  modelo: ModeloEntity;
  periodo: { inicio: string; fin: string };
  facturas: FacturaEntity[];
  pagos: PagoEntity[];
  totales: {
    totalFacturado: string;
    totalPagado: string;
    saldoPendiente: string;
    facturasPendientes: number;
    facturasVencidas: number;
  };
}

// Exportar estado de cuenta PDF
GET /api/cartera/estado-cuenta/:modeloId/pdf
Query: { fechaInicio?, fechaFin? }
Response: application/pdf (download)
Headers: Content-Disposition: attachment; filename="estado_cuenta_modelo_2025-01.pdf"
```

### Recordatorios

```typescript
// Enviar recordatorio manual
POST /api/cartera/recordatorios/:facturaId
Body: { tipo?: 'PROXIMO_VENCIMIENTO' | 'VENCIDO'; mensaje?: string }
Response: RecordatorioEntity

// Obtener historial de recordatorios
GET /api/cartera/recordatorios
Query: {
  facturaId?: string;
  modeloId?: string;
  tipo?: string;
  fechaDesde?: string;
}
Response: RecordatorioEntity[]
```

### Estadísticas

```typescript
// Dashboard de cartera
GET /api/cartera/dashboard
Query: { anio?: number; mes?: number }
Response: {
  periodo: { anio, mes };
  totalFacturado: string;
  totalRecaudado: string;
  carteraPendiente: string;
  carteraVencida: string;
  tasaCobranza: number;      // %
  diasPromedioCobranza: number;
  topModelos: Array<{
    modelo: ModeloEntity;
    totalFacturado: string;
    totalPagado: string;
    saldoPendiente: string;
  }>;
  evolucionMensual: Array<{
    mes: string;
    facturado: number;
    recaudado: number;
  }>;
}

// Estadísticas generales
GET /api/cartera/estadisticas
Response: {
  totalFacturas: number;
  facturasPendientes: number;
  facturasVencidas: number;
  totalCartera: string;
  carteraPendiente: string;
  carteraVencida: string;
}
```

### Configuración

```typescript
// Obtener configuración
GET /api/cartera/configuracion
Response: ConfiguracionCarteraEntity

// Actualizar configuración
PATCH /api/cartera/configuracion
Body: {
  diasVencimientoFactura?: number;
  diasAntesAlerta1?: number;
  diasAntesAlerta2?: number;
  diasDespuesAlertaMora?: number;
  emailCC?: string[];
  activo?: boolean;
}
Response: ConfiguracionCarteraEntity
```

---

## 🔐 Permisos RBAC

| Permiso | Descripción |
|---------|-------------|
| `cartera:facturas:read` | Ver facturas |
| `cartera:facturas:create` | Generar facturas |
| `cartera:facturas:update` | Editar facturas |
| `cartera:facturas:delete` | Cancelar facturas |
| `cartera:pagos:read` | Ver pagos |
| `cartera:pagos:create` | Registrar pagos |
| `cartera:recordatorios:read` | Ver recordatorios |
| `cartera:recordatorios:send` | Enviar recordatorios |
| `cartera:config:update` | Modificar configuración |
| `cartera:export` | Exportar estado de cuenta PDF |
| `cartera:dashboard` | Ver dashboard de cartera |

**Roles sugeridos:**
- **ADMIN**: Todos los permisos
- **FINANZAS**: Todos excepto config:update
- **SALES_CLOSER**: Solo read de sus modelos asignadas
- **MODELO**: Solo read de sus propias facturas/pagos

---

## 🧮 Cálculos de Facturación

### Comisión Fija

```typescript
// Ejemplo: Comisión 60% sobre ventas
const ventasTotalesUSD = 10000.00;
const porcentajeComision = 60;

const montoFactura = this.moneyService.multiply(
  ventasTotalesUSD,
  porcentajeComision / 100
);
// Resultado: 6000.00 USD
```

### Comisión Escalonada

```typescript
// Ejemplo: Escala según ventas
// 0 - 5000: 50%
// 5001 - 10000: 60%
// 10001+: 70%

const ventasTotalesUSD = 12000.00;
let montoFactura = 0;

if (ventasTotalesUSD <= 5000) {
  montoFactura = this.moneyService.multiply(ventasTotalesUSD, 0.50);
} else if (ventasTotalesUSD <= 10000) {
  const tramo1 = this.moneyService.multiply(5000, 0.50);
  const tramo2 = this.moneyService.multiply(ventasTotalesUSD - 5000, 0.60);
  montoFactura = this.moneyService.add(tramo1, tramo2);
} else {
  const tramo1 = this.moneyService.multiply(5000, 0.50);
  const tramo2 = this.moneyService.multiply(5000, 0.60);
  const tramo3 = this.moneyService.multiply(ventasTotalesUSD - 10000, 0.70);
  montoFactura = this.moneyService.add(tramo1, this.moneyService.add(tramo2, tramo3));
}
// Resultado: 2500 + 3000 + 1400 = 6900.00 USD
```

---

## 📧 Plantillas de Email

### Recordatorio Pago Próximo

```html
<h2>Recordatorio de Pago - OnlyTop</h2>
<p>Hola <strong>{{nombreModelo}}</strong>,</p>
<p>Te recordamos que tienes una factura próxima a vencer:</p>
<table>
  <tr><td>Número:</td><td>{{numeroFactura}}</td></tr>
  <tr><td>Fecha Emisión:</td><td>{{fechaEmision}}</td></tr>
  <tr><td>Fecha Vencimiento:</td><td>{{fechaVencimiento}}</td></tr>
  <tr><td>Monto Total:</td><td>{{totalFormateado}}</td></tr>
  <tr><td>Saldo Pendiente:</td><td>{{saldoFormateado}}</td></tr>
</table>
<p>Por favor, realiza tu pago antes del {{fechaVencimiento}}.</p>
<a href="{{linkEstadoCuenta}}">Ver Estado de Cuenta</a>
```

### Recordatorio Pago Vencido

```html
<h2>Factura Vencida - Acción Requerida</h2>
<p>Hola <strong>{{nombreModelo}}</strong>,</p>
<p>Tu factura <strong>{{numeroFactura}}</strong> está vencida desde el {{fechaVencimiento}}.</p>
<p><strong>Monto Pendiente:</strong> {{saldoFormateado}}</p>
<p>Te pedimos que realices el pago a la brevedad para evitar inconvenientes.</p>
<p>Si ya realizaste el pago, por favor envía el comprobante.</p>
```

### Confirmación Pago Recibido

```html
<h2>Pago Recibido - OnlyTop</h2>
<p>Hola <strong>{{nombreModelo}}</strong>,</p>
<p>Hemos recibido tu pago correctamente:</p>
<table>
  <tr><td>Recibo:</td><td>{{numeroRecibo}}</td></tr>
  <tr><td>Factura:</td><td>{{numeroFactura}}</td></tr>
  <tr><td>Monto Pagado:</td><td>{{montoPagadoFormateado}}</td></tr>
  <tr><td>Fecha Pago:</td><td>{{fechaPago}}</td></tr>
  <tr><td>Método:</td><td>{{metodoPago}}</td></tr>
  <tr><td>Saldo Restante:</td><td>{{saldoFormateado}}</td></tr>
</table>
<p>¡Gracias por tu pago!</p>
```

---

## 🔧 Configuración

### Variables de Entorno

```env
# Cloudinary (ya configurado)
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# Email (ya configurado)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=xxx
EMAIL_PASS=xxx
EMAIL_FROM="OnlyTop Cartera <cartera@onlytop.com>"

# Cartera
CARTERA_DIAS_VENCIMIENTO_DEFAULT=15
CARTERA_EMAIL_CC=finanzas@onlytop.com,admin@onlytop.com
```

### Configuración Inicial

```typescript
// Seed inicial de configuración
await this.configuracionModel.create({
  diasVencimientoFactura: 15,
  diasAntesAlerta1: 5,
  diasAntesAlerta2: 2,
  diasDespuesAlertaMora: 3,
  emailCC: ['finanzas@onlytop.com'],
  activo: true,
});
```

---

## 📝 Ejemplos de Uso

### Generar Facturas del Mes

```typescript
// Desde controller o service
const resultado = await this.carteraService.generarFacturasPorPeriodo({
  anio: 2025,
  mes: 1,
  quincena: 1, // Opcional
});

console.log(`Generadas ${resultado.generadas} facturas`);
```

### Registrar Pago con Comprobante

```typescript
// En controller con multer
@Post('pagos')
@UseInterceptors(FileInterceptor('file'))
async registrarPago(
  @Body() dto: RegistrarPagoDto,
  @UploadedFile() file: Express.Multer.File,
) {
  return await this.carteraService.registrarPago(dto, file);
}
```

### Obtener Estado de Cuenta

```typescript
const estadoCuenta = await this.carteraService.obtenerEstadoCuentaModelo(
  '507f1f77bcf86cd799439011',
  '2025-01-01',
  '2025-01-31'
);

console.log(`Total facturado: ${estadoCuenta.totales.totalFacturado}`);
console.log(`Saldo pendiente: ${estadoCuenta.totales.saldoPendiente}`);
```

### Exportar PDF

```typescript
const pdfBuffer = await this.carteraService.exportarEstadoCuentaPDF(
  '507f1f77bcf86cd799439011',
  '2025-01-01',
  '2025-01-31'
);

// Enviar como respuesta
res.set({
  'Content-Type': 'application/pdf',
  'Content-Disposition': `attachment; filename="estado_cuenta_2025-01.pdf"`,
});
res.send(pdfBuffer);
```

---

## 🐛 Troubleshooting

### Problema: Facturas no se generan automáticamente

**Solución:**
1. Verificar que las modelos tengan contrato activo
2. Verificar que existan ventas en el periodo
3. Revisar logs del servicio de generación
4. Confirmar que la configuración de periodicidad sea correcta

### Problema: Comprobante no se sube a Cloudinary

**Solución:**
1. Verificar formato de archivo (solo jpg, png permitidos)
2. Verificar tamaño (max 5MB)
3. Revisar credenciales de Cloudinary en .env
4. Verificar logs de CloudinaryService

### Problema: Emails de recordatorio no se envían

**Solución:**
1. Verificar configuración SMTP en .env
2. Verificar que ConfiguracionCartera.activo = true
3. Revisar logs del EmailService
4. Verificar que el cron esté ejecutándose (logs diarios a las 8:00 AM)

### Problema: Saldo pendiente incorrecto

**Solución:**
1. Verificar que los pagos estén correctamente asociados a la factura
2. Recalcular saldo: suma de pagos vs total factura
3. Usar MoneyService para operaciones monetarias
4. Revisar que los valores estén escalados correctamente (BigInt)

---

## 📊 Métricas de Rendimiento

- **Generación de facturas**: ~50ms por factura
- **Registro de pago**: ~200ms (incluye upload Cloudinary)
- **Estado de cuenta JSON**: ~100ms
- **Estado de cuenta PDF**: ~500ms
- **Envío de recordatorio**: ~300ms por email

---

## 🔄 Próximas Mejoras

- [ ] Pagos parciales con plan de cuotas
- [ ] Integración con pasarelas de pago (Stripe, PayPal)
- [ ] Reportes avanzados de cartera por periodo
- [ ] Exportación masiva de estados de cuenta
- [ ] Dashboard de cartera con gráficos en tiempo real
- [ ] Notificaciones push además de email
- [ ] Historial de negociaciones de pago

---

## 📚 Referencias

- [MoneyService Documentation](../money/CURRENCY_FORMAT_SYSTEM.md)
- [CloudinaryService Documentation](../cloudinary/cloudinary.service.ts)
- [EmailService Documentation](../email/email.service.ts)
- [PDFService Documentation](../pdf/pdf.service.ts)

---

**Versión:** 1.0.0  
**Última actualización:** Octubre 2025  
**Mantenedor:** Equipo OnlyTop
