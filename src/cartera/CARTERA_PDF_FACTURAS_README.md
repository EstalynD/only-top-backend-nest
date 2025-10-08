# 📄 Sistema de Generación de PDFs de Facturas - Módulo Cartera

## 📋 Descripción General

Sistema profesional para generar PDFs de facturas individuales del módulo de cartera. Separado del servicio de estado de cuenta para mantener claridad y evitar sobrecarga del código.

## 🏗️ Arquitectura

### Archivos Principales

1. **`cartera-factura-pdf.service.ts`** (NUEVO)
   - Servicio dedicado exclusivamente a PDFs de facturas individuales
   - Diseño profesional con el mismo nivel de calidad que estado de cuenta
   - Integración completa con MoneyService para formateo dinámico

2. **`cartera-pdf.service.ts`** (EXISTENTE)
   - Servicio para PDFs de estado de cuenta
   - Genera reportes completos con múltiples facturas y pagos

3. **`cartera.service.ts`** (ACTUALIZADO)
   - Nuevo método: `obtenerFacturaParaPdf(id)` 
   - Prepara todos los datos necesarios para el PDF

4. **`cartera.controller.ts`** (ACTUALIZADO)
   - Nuevo endpoint: `GET /api/cartera/facturas/:id/pdf`

## 🚀 Funcionalidades Implementadas

### ✅ PDF de Factura Individual

**Endpoint:** `GET /api/cartera/facturas/:id/pdf`

**Permisos requeridos:** `cartera:facturas:read`

**Query params:**
- `download`: `'true'` para forzar descarga (opcional, default: abrir en navegador)

**Ejemplo de uso:**
```bash
# Ver en navegador
GET /api/cartera/facturas/507f1f77bcf86cd799439011/pdf

# Forzar descarga
GET /api/cartera/facturas/507f1f77bcf86cd799439011/pdf?download=true
```

**Respuesta:**
- Content-Type: `application/pdf`
- Archivo PDF profesional con:
  - Header con branding y badge de estado
  - Información de factura y modelo
  - Periodo de facturación (quincenal/mensual)
  - Tabla detallada de items/comisiones
  - Resumen de totales con formato destacado
  - Historial de pagos aplicados
  - Notas adicionales (si existen)
  - Términos y condiciones
  - Footer con metadata en todas las páginas

## 📐 Diseño del PDF

### Estructura Visual

```
┌─────────────────────────────────────────────────────┐
│ [HEADER AZUL]                    [BADGE ESTADO]     │
│ FACTURA                                             │
│ OnlyTop - Sistema de Cartera                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌──────────────────┐  ┌──────────────────┐        │
│ │ INFO FACTURA     │  │ FACTURADO A      │        │
│ │ • N° Factura     │  │ • Nombre         │        │
│ │ • F. Emisión     │  │ • Identificación │        │
│ │ • F. Vencimiento │  │ • Email          │        │
│ │ • Moneda         │  │ • Teléfono       │        │
│ └──────────────────┘  └──────────────────┘        │
│                                                     │
│ ┌───────────────────────────────────────────────┐  │
│ │ PERIODO: Primera Quincena - Enero 2025        │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ DETALLE DE COMISIONES                              │
│ ┌───────────────────────────────────────────────┐  │
│ │ Cant. │ Concepto │ Valor Unit. │ Subtotal    │  │
│ ├───────────────────────────────────────────────┤  │
│ │   1   │ Comisión │   $1,500.00 │ $1,500.00   │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│                      ┌──────────────────┐          │
│                      │ Subtotal: $1,500 │          │
│                      │ TOTAL:   $1,500  │          │
│                      │ Pagado:   $750   │          │
│                      │ Saldo:    $750   │          │
│                      └──────────────────┘          │
│                                                     │
│ HISTORIAL DE PAGOS                                 │
│ ┌───────────────────────────────────────────────┐  │
│ │ Recibo │ Fecha │ Monto │ Método │ Estado     │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ TÉRMINOS Y CONDICIONES                             │
│ Esta factura refleja las comisiones generadas...   │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [FOOTER]                                            │
│ Factura FACT-2025-001 · María Modelo               │
│ Documento generado digitalmente                    │
│ Pág. 1 de 1                                        │
└─────────────────────────────────────────────────────┘
```

### Colores y Estilos

- **Primary:** `#1e40af` (Azul para títulos y branding)
- **Success:** `#10b981` (Verde para pagos y estados exitosos)
- **Warning:** `#f59e0b` (Naranja para saldos pendientes)
- **Danger:** `#ef4444` (Rojo para facturas vencidas)
- **Gray Scale:** 50-900 (Para textos y fondos)

### Estados de Factura

| Estado | Color | Badge |
|--------|-------|-------|
| PENDIENTE | Warning (Naranja) | PENDIENTE DE PAGO |
| PARCIAL | Secondary (Azul) | PARCIALMENTE PAGADO |
| PAGADO | Success (Verde) | PAGADO |
| VENCIDO | Danger (Rojo) | VENCIDO |
| CANCELADO | Gray | CANCELADO |

## 💰 Integración con MoneyService

Todo el formateo monetario usa `MoneyService.formatForUser()` que:

1. ✅ Lee configuración dinámica desde MongoDB
2. ✅ Respeta decimales por moneda (USD: 2, COP: 0)
3. ✅ Usa separadores correctos según moneda
4. ✅ Agrega símbolo/código de moneda según configuración

**Ejemplo:**
```typescript
// USD: 2 decimales, separador coma
$1,500.00

// COP: 0 decimales, separador punto
$1.500.000
```

## 🔄 Flujo de Generación

```
1. Usuario solicita PDF
   ↓
2. Controller valida permisos (cartera:facturas:read)
   ↓
3. CarteraService.obtenerFacturaParaPdf(id)
   - Consulta factura + modelo + contrato
   - Consulta pagos relacionados
   - Formatea valores con MoneyService
   - Retorna objeto estructurado
   ↓
4. CarteraFacturaPdfService.generateFacturaPdf(data)
   - Construye PDF con PDFKit
   - Aplica diseño profesional
   - Genera Buffer
   ↓
5. Controller envía respuesta
   - Content-Type: application/pdf
   - inline (navegador) o attachment (descarga)
```

## 📊 Método: obtenerFacturaParaPdf()

Nuevo método en `CarteraService` que prepara todos los datos necesarios:

```typescript
async obtenerFacturaParaPdf(id: string): Promise<{
  factura: {
    numeroFactura: string;
    fechaEmision: Date;
    fechaVencimiento: Date;
    estado: EstadoFactura;
    moneda: 'USD' | 'COP';
    items: ItemFactura[];
    subtotal: number;
    descuento: number;
    total: number;
    saldoPendiente: number;
    montoPagado: number;
    notas?: string;
    periodo: PeriodoFacturacion;
  };
  modelo: ModeloInfo;
  contrato: ContratoInfo;
  pagos: PagoInfo[];
}>
```

### Características

- ✅ Convierte BigInt de BD a números decimales
- ✅ Formatea todos los valores monetarios
- ✅ Incluye información completa del modelo
- ✅ Incluye datos del contrato
- ✅ Lista todos los pagos aplicados
- ✅ Calcula monto pagado total

## 🎨 Características Visuales

### Header Profesional
- Fondo azul (#1e40af)
- Badge de estado en esquina superior derecha
- Título grande "FACTURA"
- Subtítulo con branding

### Información en Cajas
- Dos columnas lado a lado
- Bordes redondeados (5px)
- Fondo gris claro (#f9fafb)
- Borde gris (#d1d5db)

### Periodo Destacado
- Caja con fondo celeste (#e0f2fe)
- Borde azul (#0284c7)
- Texto descriptivo del periodo

### Tabla de Items
- Header azul con texto blanco
- Filas alternadas (gris 50 / blanco)
- Tipografía clara y legible
- Alineación correcta (números a la derecha)

### Caja de Totales
- Posicionada a la derecha
- Sombra simulada para profundidad
- Línea separadora antes del total
- Total en tamaño más grande
- Colores condicionales según estado

### Tabla de Pagos
- Header verde (#10b981)
- Muestra todos los pagos aplicados
- Incluye método de pago y referencia
- Estado "APLICADO" en verde

### Footer Consistente
- Separador superior
- Múltiples líneas de metadata
- Información legal
- Paginación centrada
- Presente en todas las páginas

## 🔐 Seguridad y Permisos

### Endpoint Protegido
```typescript
@Get('facturas/:id/pdf')
@RequirePermissions('cartera:facturas:read')
```

**Usuarios autorizados:**
- Administradores
- Personal de finanzas/cartera
- Usuarios con permiso específico

### Validaciones
- ✅ Token JWT válido requerido
- ✅ Permiso `cartera:facturas:read` requerido
- ✅ Factura debe existir
- ✅ Datos completos de modelo y contrato

## 📱 Uso desde el Frontend

### React/Next.js

```typescript
// Abrir en nueva pestaña
const handleVerFactura = (facturaId: string) => {
  const url = `${API_URL}/api/cartera/facturas/${facturaId}/pdf`;
  window.open(url, '_blank');
};

// Descargar archivo
const handleDescargarFactura = async (facturaId: string) => {
  const url = `${API_URL}/api/cartera/facturas/${facturaId}/pdf?download=true`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `Factura_${numeroFactura}.pdf`;
  a.click();
};
```

## 🛠️ Métodos Auxiliares del Servicio

### Formateo de Fechas
```typescript
formatDate(date: Date): string
// Output: "15 ene 2025"

formatDateTime(date: Date): string
// Output: "15 de enero de 2025, 14:30 GMT-5"
```

### Formateo de Moneda
```typescript
formatCurrency(amount: number, currency: 'USD' | 'COP'): string
// Usa MoneyService con configuración dinámica de BD
```

### Validación de Vencimiento
```typescript
isVencida(fechaVencimiento: Date): boolean
// Compara con fecha actual
```

### Helpers de Periodo
```typescript
getNombreMes(mes: number): string
// 1 → "Enero", 2 → "Febrero", etc.

getDiasEnMes(anio: number, mes: number): number
// Calcula días en el mes (28, 29, 30, o 31)
```

## 📈 URLs Generadas

El servicio incluye helpers para generar URLs:

```typescript
// URL para ver PDF
facturaPdfService.generateFacturaPdfUrl(facturaId)
// → http://localhost:3041/api/cartera/facturas/{id}/pdf

// URL para descargar PDF
facturaPdfService.generateFacturaDownloadUrl(facturaId)
// → http://localhost:3041/api/cartera/facturas/{id}/pdf/download
```

## 🔄 Diferencias con Estado de Cuenta

| Característica | Estado de Cuenta | Factura Individual |
|----------------|------------------|-------------------|
| **Servicio** | CarteraPdfService | CarteraFacturaPdfService |
| **Endpoint** | `/estado-cuenta/:modeloId/pdf` | `/facturas/:id/pdf` |
| **Alcance** | Múltiples facturas + periodo | Una factura específica |
| **Datos** | Resumen financiero completo | Detalle de una factura |
| **Pagos** | Todos los pagos del periodo | Pagos de esa factura |
| **Uso** | Reportes mensuales/trimestrales | Comprobante individual |

## 🎯 Casos de Uso

### 1. Envío de Factura por Email
```typescript
// En CarteraEmailService
const pdfBuffer = await this.facturaPdfService.generateFacturaPdf(facturaData);
// Adjuntar a email
```

### 2. Descarga desde Dashboard
```typescript
// Usuario hace clic en "Descargar PDF"
// Frontend llama: GET /api/cartera/facturas/:id/pdf?download=true
```

### 3. Visualización Rápida
```typescript
// Usuario hace clic en "Ver Factura"
// Frontend abre: GET /api/cartera/facturas/:id/pdf
// Se abre en nueva pestaña del navegador
```

### 4. Compartir con Modelo
```typescript
// Generar token de acceso temporal
const token = tokenService.generateToken({ 
  facturaId, 
  modeloId, 
  tipo: 'FACTURA_INDIVIDUAL' 
});
const url = tokenService.generateFacturaUrl(token);
// Enviar URL por email/WhatsApp
```

## ⚡ Performance

### Optimizaciones Implementadas

1. **Buffer Pages:** PDFKit usa `bufferPages: true` para renderizado eficiente
2. **Consultas Lean:** Mongoose `.lean()` para reducir overhead
3. **Población Selectiva:** Solo se populan campos necesarios
4. **Cache de MoneyService:** Configuración de monedas se cachea en memoria

### Métricas Esperadas

- **Tiempo de generación:** 100-300ms (factura simple)
- **Tamaño de PDF:** 15-50 KB (dependiendo de items/pagos)
- **Memoria:** ~5-10 MB por generación

## 🐛 Manejo de Errores

### Errores Comunes

```typescript
// 404 - Factura no encontrada
{
  success: false,
  message: 'Error al generar el PDF de la factura',
  error: 'Factura con ID xxx no encontrada'
}

// 500 - Error en generación
{
  success: false,
  message: 'Error al generar el PDF de la factura',
  error: 'PDFKit error: ...'
}

// 403 - Sin permisos
{
  statusCode: 403,
  message: 'Forbidden resource',
  error: 'Forbidden'
}
```

### Logging

El servicio incluye logging detallado:

```
[CarteraFacturaPdfService] Generando PDF de factura: FACT-2025-001
[CarteraFacturaPdfService] ✅ PDF generado: 23.45 KB
```

## 📝 TODOs Futuros

- [ ] Agregar QR code con link a verificación online
- [ ] Soporte para múltiples idiomas (ES/EN)
- [ ] Personalización de logo por empresa
- [ ] Firma digital del emisor
- [ ] Watermark para facturas canceladas
- [ ] Exportación a otros formatos (Excel, CSV)
- [ ] Caché de PDFs generados

## 📚 Referencias

- **PDFKit Documentation:** http://pdfkit.org/
- **MoneyService:** `src/money/money.service.ts`
- **Estado de Cuenta PDF:** `src/cartera/cartera-pdf.service.ts`
- **Factura Schema:** `src/cartera/factura.schema.ts`

---

**Versión:** 1.0.0  
**Fecha:** Enero 2025  
**Autor:** OnlyTop Development Team
