# Arquitectura Centralizada de PDFs - Módulo de Cartera

## 📋 Resumen de Cambios

Se implementó una **arquitectura centralizada y profesional** para la generación de PDFs en el módulo de cartera, siguiendo el patrón ya establecido en `pdf.service.ts`.

---

## 🏗️ Arquitectura Implementada

### **Antes (Problema)**
```
CarteraController
  ├─ obtenerFacturaParaPdf() → CarteraService
  ├─ generateFacturaPdf() → CarteraFacturaPdfService
  ├─ exportarEstadoCuentaPDF() → CarteraService
  └─ Lógica duplicada en múltiples lugares
```

❌ **Problemas:**
- Lógica de obtención de datos duplicada entre controller y service
- No hay separación clara de responsabilidades
- Difícil mantenimiento y testing
- No sigue el patrón del módulo PDF existente

---

### **Después (Solución)**
```
CarteraController (Solo HTTP Response)
  └─ CarteraPdfCoreService (Orquestador Central)
       ├─ Obtiene datos de BD (facturas, pagos, modelos)
       ├─ Transforma datos para PDFs
       ├─ Coordina generación de PDFs
       │   ├─ CarteraPdfService (Estado de cuenta)
       │   └─ CarteraFacturaPdfService (Facturas individuales)
       └─ Genera URLs públicas y de descarga
```

✅ **Beneficios:**
- **Separación clara de responsabilidades**
- **Código reutilizable** entre endpoints autenticados y públicos (con token)
- **Fácil testing** (servicios independientes)
- **Consistencia** con la arquitectura existente (`pdf.service.ts`)

---

## 📁 Archivos Creados/Modificados

### ✨ **Nuevo: `cartera-pdf-core.service.ts`**
Servicio centralizado que maneja toda la lógica de PDFs.

**Responsabilidades:**
1. **Obtención de datos:** Consulta BD y prepara datos para PDFs
2. **Coordinación:** Llama a servicios visuales (CarteraPdfService, CarteraFacturaPdfService)
3. **Generación de URLs:** Centraliza lógica de URLs públicas
4. **Validaciones:** Verifica permisos y existencia de datos

**Métodos principales:**
```typescript
// Generación de PDFs
generateFacturaPdf(facturaId: string): Promise<Buffer>
generateEstadoCuentaPdf(modeloId: string, desde?, hasta?): Promise<Buffer>
generateFacturaPdfWithFilename(facturaId: string): Promise<{ pdfBuffer, filename }>
generateEstadoCuentaPdfWithFilename(modeloId: string): Promise<{ pdfBuffer, filename }>

// Obtención de datos
obtenerFacturaParaPdf(facturaId: string): Promise<FacturaData>
obtenerEstadoCuentaParaPdf(modeloId: string, desde?, hasta?): Promise<EstadoCuentaData>

// Información y metadatos
getFacturaInfo(facturaId: string): Promise<InfoBasica>
getEstadoCuentaInfo(modeloId: string): Promise<InfoBasica>

// Generación de URLs
generateFacturaPdfUrl(facturaId: string): string
generateFacturaDownloadUrl(facturaId: string): string
generateEstadoCuentaPdfUrl(modeloId: string): string
generateEstadoCuentaDownloadUrl(modeloId: string): string
```

---

### 🔧 **Modificado: `cartera.controller.ts`**

**Antes:**
```typescript
@Get('facturas/:id/pdf')
async descargarFacturaPdf(@Param('id') id: string, @Res() res: Response) {
  const facturaData = await this.carteraService.obtenerFacturaParaPdf(id);
  const pdfBuffer = await this.facturaPdfService.generateFacturaPdf(facturaData);
  const filename = `Factura_${facturaData.factura.numeroFactura}.pdf`;
  // ... configurar headers y enviar
}
```

**Después:**
```typescript
@Get('facturas/:id/pdf')
async descargarFacturaPdf(@Param('id') id: string, @Res() res: Response) {
  const { pdfBuffer, filename } = await this.pdfCoreService.generateFacturaPdfWithFilename(id);
  // ... configurar headers y enviar
}
```

✅ **Mejoras:**
- **50% menos de código** en el controller
- **Responsabilidad única:** Solo maneja HTTP
- **Reutilización:** Misma lógica para endpoints autenticados y públicos

---

### 🔧 **Modificado: `cartera.module.ts`**

**Agregado:**
```typescript
providers: [
  // ... otros providers
  CarteraPdfCoreService, // ← NUEVO
],
exports: [
  // ... otros exports
  CarteraPdfCoreService, // ← Disponible para otros módulos
]
```

---

### 🧹 **Limpieza: `cartera-pdf.service.ts` y `cartera-factura-pdf.service.ts`**

**Eliminado:** Métodos duplicados de generación de URLs

**Antes:**
```typescript
generateEstadoCuentaPdfUrl(modeloId: string): string { ... }
generateEstadoCuentaDownloadUrl(modeloId: string): string { ... }
generateFacturaPdfUrl(facturaId: string): string { ... }
generateFacturaDownloadUrl(facturaId: string): string { ... }
```

**Después:**
```typescript
// ========== NOTA SOBRE URLs ==========
// Los métodos de generación de URLs ahora están centralizados en CarteraPdfCoreService
// generateEstadoCuentaPdfUrl() -> pdfCoreService.generateEstadoCuentaPdfUrl()
```

✅ **Beneficios:**
- **DRY (Don't Repeat Yourself):** Una sola fuente de verdad
- **Mantenimiento fácil:** Cambiar URLs en un solo lugar

---

## 🔐 Flujo de Autenticación (Corregido)

### **Endpoints Autenticados** (Requieren JWT)
```
GET /api/cartera/facturas/:id/pdf
└─ @RequirePermissions('cartera:facturas:read')
└─ AuthGuard verifica JWT → ✅ Genera PDF

GET /api/cartera/estado-cuenta/:modeloId/pdf
└─ @RequirePermissions('cartera:export:pdf')
└─ AuthGuard verifica JWT → ✅ Genera PDF
```

### **Endpoints Públicos** (Token temporal)
```
GET /api/cartera/factura/token/:token/pdf
└─ @Public() ← Bypass AuthGuard
└─ CarteraTokenService.validateToken() → ✅ Genera PDF

GET /api/cartera/estado-cuenta/token/:token/pdf
└─ @Public() ← Bypass AuthGuard
└─ CarteraTokenService.validateToken() → ✅ Genera PDF
```

✅ **Problema resuelto:**
- Antes: Endpoints públicos fallaban por falta de JWT
- Ahora: `@Public()` decorator permite acceso sin autenticación
- Seguridad: Token HMAC-SHA256 con expiración de 7 días

---

## 🧪 Testing Sugerido

### **1. Endpoints Autenticados**
```bash
# Con JWT válido
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3041/api/cartera/facturas/677580bbdb8de82a046d79de/pdf

# Sin JWT (debe fallar con 401)
curl http://localhost:3041/api/cartera/facturas/677580bbdb8de82a046d79de/pdf
```

### **2. Endpoints Públicos (con Token)**
```bash
# Generar token (endpoint autenticado)
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3041/api/cartera/facturas/677580bbdb8de82a046d79de/pdf/link

# Usar token público (sin JWT)
curl http://localhost:3041/api/cartera/factura/token/$TOKEN/pdf
```

### **3. Estados de Cuenta**
```bash
# Autenticado
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3041/api/cartera/estado-cuenta/677580bbdb8de82a046d79de/pdf

# Público con token
curl http://localhost:3041/api/cartera/estado-cuenta/token/$TOKEN/pdf
```

---

## 📊 Comparación con `pdf.service.ts`

| Aspecto | `pdf.service.ts` (Contratos) | `cartera-pdf-core.service.ts` (Cartera) |
|---------|------------------------------|------------------------------------------|
| **Arquitectura** | ✅ Servicio centralizado | ✅ Servicio centralizado |
| **Separación lógica** | ✅ Datos vs. Visual | ✅ Datos vs. Visual |
| **Generación URLs** | ✅ Centralizada | ✅ Centralizada |
| **Soporte multi-PDF** | ✅ Un tipo (contrato) | ✅ Dos tipos (factura, estado cuenta) |
| **Integración MoneyService** | ❌ No necesaria | ✅ Conversión BigInt → Number |
| **Endpoints públicos** | ❌ No implementado | ✅ Con tokens HMAC |

---

## 🎯 Próximos Pasos (Opcional)

1. **Cacheo de PDFs:**
   - Cachear PDFs generados para reducir carga de BD
   - Invalidar cache cuando cambian datos

2. **Webhooks:**
   - Notificar a modelos cuando se genera nueva factura
   - Integrar con sistema de notificaciones push

3. **Analytics:**
   - Registrar accesos a PDFs (logs de auditoría)
   - Métricas de cuántos modelos descargan sus facturas

4. **Optimización:**
   - Generación asíncrona de PDFs pesados
   - Queue de generación para múltiples facturas

---

## 📝 Conclusión

✅ **Logros:**
- Arquitectura profesional y escalable
- Código limpio y mantenible
- Consistencia con módulo PDF existente
- Problema de autenticación resuelto

✅ **Beneficios:**
- **Desarrolladores:** Código más fácil de entender y modificar
- **QA:** Testing más sencillo y robusto
- **Usuarios:** Acceso confiable a PDFs sin errores de autenticación
- **Negocio:** Sistema preparado para crecer

🚀 **Sistema listo para producción!**
