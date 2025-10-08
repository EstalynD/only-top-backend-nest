# Sistema de Generación de PDFs On-Demand

## Descripción General

Este módulo implementa un sistema profesional de generación de PDFs dinámicos que **NO depende de servicios externos** como Cloudinary. Los PDFs se generan **on-demand** cuando son solicitados, utilizando los datos actuales de la base de datos.

## Arquitectura

```
┌──────────────────┐
│  Frontend/Client │
└────────┬─────────┘
         │ Request PDF
         ▼
┌─────────────────────────────────────┐
│      PdfController                  │
│  GET /api/pdf/contratos-modelo/... │
└────────┬────────────────────────────┘
         │
         ▼
┌──────────────────────────┐
│     PdfService           │
│  - Obtiene datos         │
│  - Prepara información   │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  PdfGeneratorService     │
│  - Genera PDF con PDFKit │
│  - Retorna Buffer        │
└──────────────────────────┘
```

## Componentes

### 1. PdfGeneratorService (`pdf-generator.service.ts`)

**Responsabilidad**: Generar PDFs usando PDFKit.

**Método Principal**:
```typescript
async generateContratoModeloPdf(contratoData: any): Promise<Buffer>
```

**Características**:
- ✅ Genera PDFs profesionales en formato A4
- ✅ Diseño estructurado con encabezados, secciones y pie de página
- ✅ Soporte para comisiones fijas y escalonadas
- ✅ Inclusión de firma digital con metadatos
- ✅ Colores corporativos y tipografía profesional
- ✅ Totalmente personalizable

**Secciones del PDF**:
1. **Encabezado**: Logo/título, número de contrato
2. **Información del Contrato**: Fechas, periodicidad, estado
3. **Información de la Modelo**: Datos personales completos
4. **Términos y Condiciones**: Cláusulas del contrato
5. **Estructura de Comisión**: Fija o escalonada con detalles
6. **Firma Digital**: Metadatos de la firma (si existe)
7. **Pie de Página**: Información legal y timestamp

### 2. PdfService (`pdf.service.ts`)

**Responsabilidad**: Obtener datos de la base de datos y coordinar la generación.

**Métodos Principales**:
```typescript
// Genera el PDF de un contrato
async generateContratoModeloPdf(contratoId: string): Promise<Buffer>

// Genera PDF con nombre de archivo sugerido
async generateContratoModeloPdfWithFilename(contratoId: string): Promise<{ pdfBuffer: Buffer; filename: string }>

// Obtiene información básica del contrato
async getContratoInfo(contratoId: string): Promise<any>
```

**Operaciones**:
1. Valida el ID del contrato
2. Obtiene el contrato con todas las relaciones pobladas:
   - Modelo
   - Procesador de pago
   - Escala de comisión (si aplica)
   - Sales Closer asignado
3. Prepara los datos en el formato esperado por el generador
4. Llama al `PdfGeneratorService`
5. Retorna el Buffer del PDF

### 3. PdfController (`pdf.controller.ts`)

**Responsabilidad**: Exponer endpoints HTTP para servir PDFs.

**Endpoints**:

#### Ver PDF con URL Personalizada
```
GET /api/pdf/contratos-modelo/:contratoId/:size/:filename
```

**Ejemplo**:
```
GET /api/pdf/contratos-modelo/507f1f77bcf86cd799439011/A4/CTMO-2025-00001.pdf
```

**Características**:
- ✅ URL amigable y personalizable
- ✅ Soporte para diferentes tamaños (actualmente A4)
- ✅ Nombre de archivo personalizado en la URL
- ✅ Headers configurados para visualización inline
- ✅ Cache de 1 hora (`max-age=3600`)

#### Descargar PDF
```
GET /api/pdf/contratos-modelo/:contratoId/download
```

**Características**:
- ✅ Descarga automática del PDF
- ✅ Nombre de archivo basado en el número de contrato
- ✅ Header `Content-Disposition: attachment`

#### Obtener Información del Contrato
```
GET /api/pdf/contratos-modelo/:contratoId/info
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "contratoId": "507f1f77bcf86cd799439011",
    "numeroContrato": "CTMO-2025-00001",
    "estado": "FIRMADO",
    "fechaInicio": "2025-01-15",
    "periodicidadPago": "MENSUAL",
    "modelo": {
      "nombreCompleto": "María García",
      "numeroIdentificacion": "1234567890",
      "correoElectronico": "maria@example.com"
    },
    "firmado": true,
    "fechaFirma": "2025-01-20T10:30:00Z",
    "pdfUrl": "http://api.onlytop.com/api/pdf/contratos-modelo/507f1f77bcf86cd799439011/A4/CTMO-2025-00001.pdf"
  }
}
```

## Ventajas del Sistema

### 1. **Sin Dependencias Externas**
- ❌ No requiere Cloudinary para PDFs
- ❌ No requiere servicios de terceros
- ✅ Control total sobre la generación
- ✅ Reduce costos operativos

### 2. **Generación On-Demand**
- ✅ PDFs siempre actualizados con los datos más recientes
- ✅ No se almacenan archivos obsoletos
- ✅ Ahorro de espacio en disco/cloud
- ✅ Cambios en el diseño se reflejan inmediatamente

### 3. **URLs Personalizables**
- ✅ URLs amigables para SEO y compartir
- ✅ Formato: `/api/pdf/tipo/:id/:size/:filename.pdf`
- ✅ Fácil integración con emails y notificaciones

### 4. **Performance Optimizado**
- ✅ Cache HTTP de 1 hora
- ✅ PDFKit es liviano y rápido
- ✅ Generación en memoria (sin I/O de disco)
- ✅ Streaming de respuesta al cliente

### 5. **Mantenibilidad**
- ✅ Código centralizado y modular
- ✅ Fácil de extender para nuevos tipos de documentos
- ✅ Plantillas de PDF versionables
- ✅ Testing simplificado

## Uso en el Frontend

### Ver PDF en Nueva Pestaña
```typescript
const pdfUrl = `${API_URL}/api/pdf/contratos-modelo/${contratoId}/A4/${numeroContrato}.pdf`;

<a href={pdfUrl} target="_blank" rel="noopener noreferrer">
  Ver PDF
</a>
```

### Descargar PDF
```typescript
const downloadUrl = `${API_URL}/api/pdf/contratos-modelo/${contratoId}/download`;

<a href={downloadUrl} download>
  Descargar PDF
</a>
```

### Obtener Información Previa
```typescript
const info = await fetch(`${API_URL}/api/pdf/contratos-modelo/${contratoId}/info`);
const data = await info.json();

console.log(data.pdfUrl); // URL lista para usar
```

## Configuración

### Variables de Entorno

```env
# URL base de la API (para generar URLs de PDFs)
API_URL=https://api.onlytop.com

# Frontend URL (opcional, para referencias)
FRONTEND_URL=https://app.onlytop.com
```

## Personalización del PDF

Para personalizar el diseño del PDF, edita `PdfGeneratorService`:

```typescript
// Cambiar colores
.fillColor('#1e40af')  // Azul corporativo

// Cambiar fuente
.fontSize(14)

// Agregar nuevas secciones
private addNewSection(doc: PDFKit.PDFDocument, data: any): void {
  doc
    .fontSize(14)
    .fillColor('#1f2937')
    .text('NUEVA SECCIÓN', { underline: true })
    .moveDown(0.5);
  
  // Tu contenido aquí...
}
```

## Extensión para Otros Tipos de Documentos

Para agregar soporte para otros tipos de documentos (ej: contratos de empleados):

1. **Agregar método en `PdfGeneratorService`**:
```typescript
async generateContratoEmpleadoPdf(contratoData: any): Promise<Buffer> {
  // Lógica de generación...
}
```

2. **Agregar método en `PdfService`**:
```typescript
async generateContratoEmpleadoPdf(contratoId: string): Promise<Buffer> {
  const contrato = await this.contratoEmpleadoModel.findById(contratoId).exec();
  // Preparar datos y generar...
}
```

3. **Agregar endpoint en `PdfController`**:
```typescript
@Get('contratos-empleado/:contratoId/:size/:filename')
async getContratoEmpleadoPdf(...) {
  // Llamar al servicio...
}
```

## Seguridad

### Validaciones Implementadas
- ✅ Validación de ObjectId
- ✅ Verificación de existencia del contrato
- ✅ Control de acceso basado en permisos (implementar si es necesario)
- ✅ Headers seguros en las respuestas

### Recomendaciones Adicionales
- 🔐 Implementar autenticación para acceder a PDFs (si es necesario)
- 🔐 Rate limiting para prevenir abuso
- 🔐 Validación de tamaños permitidos
- 🔐 Sanitización de nombres de archivo

## Performance

### Métricas Estimadas
- Generación de PDF: **~200-500ms** (depende de la complejidad)
- Tamaño promedio del PDF: **~50-100KB**
- Memoria utilizada por PDF: **~1-2MB** (temporal)

### Optimizaciones Aplicadas
- ✅ Cache HTTP (`max-age=3600`)
- ✅ Generación en memoria (sin escritura a disco)
- ✅ Streaming de respuesta
- ✅ Queries optimizadas con población selectiva

### Recomendaciones para Producción
- 📊 Implementar monitoring de tiempos de generación
- 📊 Cache en CDN o proxy reverso (Nginx, CloudFlare)
- 📊 Rate limiting por IP/usuario
- 📊 Logs estructurados para debugging

## Testing

### Tests Recomendados

```typescript
describe('PdfService', () => {
  it('should generate PDF for valid contract', async () => {
    const pdf = await pdfService.generateContratoModeloPdf(contratoId);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('should throw NotFoundException for invalid contract', async () => {
    await expect(pdfService.generateContratoModeloPdf('invalid'))
      .rejects.toThrow(NotFoundException);
  });
});
```

## Troubleshooting

### PDF no se genera
1. Verificar que el contrato existe en la base de datos
2. Verificar que todas las relaciones están pobladas correctamente
3. Revisar logs del servidor para errores de PDFKit

### PDF se ve mal formateado
1. Verificar datos nulos o undefined en la data
2. Ajustar márgenes y espaciados en `PdfGeneratorService`
3. Probar con diferentes tamaños de contenido

### Performance lento
1. Verificar queries de base de datos (usar `.explain()`)
2. Implementar caching a nivel de aplicación
3. Considerar pre-generación para contratos finalizados

## Roadmap

### Próximas Mejoras
- [ ] Soporte para múltiples idiomas
- [ ] Plantillas customizables por cliente
- [ ] Marca de agua opcional
- [ ] Generación asíncrona con workers (para PDFs complejos)
- [ ] Webhooks para notificar cuando PDF está listo
- [ ] Versionado de PDFs (histórico de cambios)

## Soporte

Para dudas o problemas, contactar al equipo de desarrollo de OnlyTop.

---

**Versión**: 1.0.0  
**Última actualización**: Enero 2025  
**Autor**: OnlyTop Development Team

