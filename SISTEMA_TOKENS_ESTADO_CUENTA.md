# Sistema de Acceso Seguro a Estados de Cuenta con Tokens

## Resumen

Sistema profesional de acceso temporal a estados de cuenta mediante tokens firmados que se envían por email. Permite a las modelos acceder a su estado de cuenta sin necesidad de autenticación tradicional, solo con el enlace temporal recibido en el correo.

## Arquitectura

```
┌─────────────────────┐
│  Recordatorio Pago  │
│   (Trigger)         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ CarteraEmailService │
│  - Genera Token     │ ◄──────── CarteraTokenService
│  - Construye URL    │           (HMAC-SHA256)
│  - Envía Email      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Email con Token   │
│  ┌───────────────┐  │
│  │ 📄 Ver Estado │  │ ◄──── Botón con tokenUrl
│  └───────────────┘  │
└──────────┬──────────┘
           │
           ▼ (Clic en enlace)
┌─────────────────────┐
│  Endpoint Público   │
│  /cartera/estado-   │
│  cuenta/token/:token│
│  /pdf               │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Valida Token        │ ◄──────── CarteraTokenService
│ (firma + expiración)│           .validateToken()
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Genera PDF          │ ◄──────── CarteraPdfService
│ Retorna documento   │
└─────────────────────┘
```

## Componentes

### 1. CarteraTokenService

**Ubicación**: `src/cartera/cartera-token.service.ts`

**Responsabilidades**:
- Generar tokens firmados con HMAC-SHA256
- Validar tokens (firma + expiración)
- Construir URLs completas con token

**Métodos principales**:

```typescript
// Generar token
generateToken(options: GenerateTokenOptions): string

// Validar token
validateToken(token: string): TokenPayload

// Construir URL
generateEstadoCuentaUrl(token: string): string
```

**Estructura del Token**:

```typescript
interface TokenPayload {
  modeloId: string;         // ID de la modelo
  facturaId?: string;       // ID de la factura (opcional)
  tipo: 'ESTADO_CUENTA';    // Tipo de acceso
  email: string;            // Email del destinatario
  generadoEn: number;       // Timestamp de generación
  expiraEn: number;         // Timestamp de expiración
}
```

**Formato del Token**:
```
base64url(payload).base64url(hmac-sha256-signature)
```

**Configuración**:
- Variable de entorno: `CARTERA_TOKEN_SECRET` o `JWT_SECRET`
- Expiración por defecto: 7 días
- Algoritmo: HMAC-SHA256

### 2. Endpoint Público

**Ruta**: `GET /api/cartera/estado-cuenta/token/:token/pdf`

**Características**:
- ✅ Sin autenticación (AuthGuard no aplicado)
- ✅ Valida token automáticamente
- ✅ Genera PDF on-demand
- ✅ Headers de caché configurados
- ✅ Página HTML amigable si token expiró

**Parámetros de Query**:
- `download=true`: Fuerza descarga en lugar de visualización inline

**Headers de Respuesta**:
```http
Content-Type: application/pdf
Content-Disposition: inline; filename="estado-cuenta-{modeloId}-{fecha}.pdf"
Cache-Control: private, no-cache, no-store, must-revalidate
X-Token-Expira: 2025-01-15T08:00:00Z
```

**Manejo de Errores**:

Si el token es inválido o expiró, retorna página HTML 401:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <title>Enlace Expirado - OnlyTop</title>
</head>
<body>
  <div class="container">
    <div class="icon">🔒</div>
    <h1>Enlace Expirado</h1>
    <p>El enlace que intentas acceder ha expirado...</p>
    <a href="mailto:finanzas@onlytop.com">Solicitar nuevo enlace</a>
  </div>
</body>
</html>
```

### 3. Integración con Emails

**Flujo de envío**:

1. `CarteraService.enviarRecordatorioPago()` se ejecuta
2. `CarteraEmailService` genera token único:
   ```typescript
   const token = this.tokenService.generateToken({
     modeloId: modelo._id.toString(),
     facturaId: factura._id.toString(),
     tipo: 'ESTADO_CUENTA',
     email: modelo.correoElectronico,
     expiresInDays: 7,
   });
   ```
3. Construye URL completa:
   ```typescript
   const tokenUrl = this.tokenService.generateEstadoCuentaUrl(token);
   // Resultado: https://backend.onlytop.com/api/cartera/estado-cuenta/token/eyJtb2RlbG9JZC...
   ```
4. Inyecta URL en plantillas HTML y texto plano
5. Guarda token en `recordatorio.meta.tokenAcceso` para auditoría

**Plantillas actualizadas**:
- ✅ `generateProximoVencimientoTemplate()`
- ✅ `generateFacturaVencidaTemplate()`
- ✅ `generateMoraTemplate()`
- ✅ `generateConfirmacionPagoTemplate()`
- ✅ Versiones de texto plano

**Diseño del botón**:

```html
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
  <tr>
    <td align="center">
      <a href="${tokenUrl}" 
         style="display: inline-block; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: #ffffff; 
                text-decoration: none; 
                padding: 14px 32px; 
                border-radius: 6px; 
                font-size: 16px; 
                font-weight: bold; 
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
        📄 Ver Mi Estado de Cuenta
      </a>
    </td>
  </tr>
</table>
```

### 4. Auditoría y Trazabilidad

**Campo en Schema de Recordatorio**:

```typescript
@Prop({ type: SchemaTypes.Mixed, default: {} })
meta?: Record<string, any>;
```

**Estructura guardada en `meta`**:

```typescript
{
  tokenAcceso: "eyJtb2RlbG9JZC...",  // Token generado
  messageId: "msg-123",               // ID del mensaje de email
  modeloId: "60d5ec49f1b2c8b4f8e4a1b2",
  facturaNumero: "FACT-2025-001"
}
```

**Ventajas**:
- ✅ Trazabilidad completa: qué token se envió y a quién
- ✅ Posibilidad de revocar tokens (futuro)
- ✅ Auditoría de accesos (vincular con logs)
- ✅ Debugging facilitado

## Seguridad

### Firma HMAC-SHA256

- **Algoritmo**: HMAC con SHA-256
- **Secret Key**: Variable de entorno `CARTERA_TOKEN_SECRET`
- **Ventajas**:
  - No requiere librerías externas (crypto nativo de Node.js)
  - Más rápido que RSA
  - Suficientemente seguro para tokens temporales

### Expiración

- **Tiempo por defecto**: 7 días
- **Validación**: Timestamp incluido en payload firmado
- **Inmutabilidad**: Cualquier modificación invalida la firma

### Protecciones

1. **No reutilizable tras expiración**: Token caduca automáticamente
2. **Vinculado a email**: Payload contiene el email destinatario
3. **Auditable**: Guardado en BD con metadata del envío
4. **Sin datos sensibles**: Token solo contiene IDs y timestamps

### Mejoras Futuras

- [ ] Rate limiting por IP (prevenir scraping)
- [ ] Revocación manual de tokens
- [ ] Registro de accesos exitosos en tabla separada
- [ ] Notificación por email si se accede múltiples veces
- [ ] Rotación automática del SECRET_KEY

## Variables de Entorno

### Backend

```bash
# Token Secret (REQUERIDO para producción)
CARTERA_TOKEN_SECRET=tu-secret-key-muy-segura-y-larga

# URL del backend (para construir enlaces)
BACKEND_URL=https://api.onlytop.com

# Alternativa: usar JWT_SECRET existente
JWT_SECRET=tu-jwt-secret
```

### Generación de Secret Seguro

```bash
# Opción 1: OpenSSL
openssl rand -base64 64

# Opción 2: Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## Testing

### 1. Generar Token Manualmente

```bash
# Desde NestJS CLI o script
const token = carteraTokenService.generateToken({
  modeloId: '60d5ec49f1b2c8b4f8e4a1b2',
  email: 'modelo@example.com',
  tipo: 'ESTADO_CUENTA',
  expiresInDays: 7,
});

console.log('Token:', token);
console.log('URL:', carteraTokenService.generateEstadoCuentaUrl(token));
```

### 2. Validar Token

```bash
curl -I "http://localhost:3041/api/cartera/estado-cuenta/token/eyJtb2RlbG9JZ..."
```

### 3. Descargar PDF

```bash
curl -o estado-cuenta.pdf \
  "http://localhost:3041/api/cartera/estado-cuenta/token/eyJtb2RlbG9JZ..."
```

### 4. Verificar Expiración

```bash
# El endpoint retornará 401 con HTML amigable si expiró
curl "http://localhost:3041/api/cartera/estado-cuenta/token/EXPIRED_TOKEN"
```

## Casos de Uso

### 1. Recordatorio de Pago

```typescript
// Trigger: Cron job o manual desde admin
await carteraService.enviarRecordatorioPago(
  facturaId,
  TipoRecordatorio.PROXIMO_VENCIMIENTO
);

// Resultado:
// 1. Genera token único
// 2. Envía email con botón
// 3. Guarda token en recordatorio.meta
// 4. Modelo recibe email y hace clic
// 5. Accede directamente al PDF sin login
```

### 2. Compartir Estado de Cuenta Manualmente

```typescript
// Desde controller o admin panel
const token = await carteraTokenService.generateToken({
  modeloId: '...',
  email: 'modelo@example.com',
  tipo: 'ESTADO_CUENTA',
});

const url = carteraTokenService.generateEstadoCuentaUrl(token);

// Copiar URL y enviar por WhatsApp, Telegram, etc.
```

### 3. Acceso Temporal para Auditoría Externa

```typescript
// Generar token con expiración corta (1 día)
const token = await carteraTokenService.generateToken({
  modeloId: '...',
  email: 'auditor@external.com',
  tipo: 'ESTADO_CUENTA',
  expiresInDays: 1, // Expira en 24 horas
});
```

## Monitoreo

### Logs a Observar

```
✅ Token generado para modelo@example.com - Expira: 2025-01-15T08:00:00Z
🔗 Acceso con token al estado de cuenta - Modelo: 60d5ec..., Email: modelo@example.com
⚠️  Token inválido: Token expirado
```

### Métricas Sugeridas

- Tokens generados por día
- Accesos exitosos vs fallidos
- Tiempo promedio entre envío y primer acceso
- Tokens que nunca se usaron (modelos que no abren emails)

## Troubleshooting

### Problema: "Token inválido o expirado"

**Causas**:
1. Token realmente expiró (>7 días)
2. Secret key cambió en el servidor
3. Token manipulado manualmente

**Solución**:
- Solicitar nuevo recordatorio desde el sistema
- Verificar que `CARTERA_TOKEN_SECRET` no haya cambiado

### Problema: PDF no se genera

**Causas**:
1. ModeloId en token no existe en BD
2. Error en CarteraPdfService
3. Sin datos de facturas para el modelo

**Solución**:
- Revisar logs del backend
- Verificar que la modelo tenga facturas

### Problema: Botón no aparece en email

**Causas**:
1. Cliente de email bloqueando estilos inline
2. Token no se generó correctamente

**Solución**:
- Incluir versión de texto plano con URL directa
- Verificar que `tokenUrl` se pasa a las plantillas

## Roadmap

### v1.0 (Actual) ✅
- ✅ Generación de tokens HMAC
- ✅ Endpoint público con validación
- ✅ Integración con emails
- ✅ Auditoría en recordatorio.meta
- ✅ Página HTML amigable para tokens expirados

### v1.1 (Próximo)
- [ ] Dashboard de auditoría de accesos
- [ ] Endpoint para revocar tokens manualmente
- [ ] Rate limiting por IP
- [ ] Notificación por email si se accede múltiples veces

### v2.0 (Futuro)
- [ ] QR code en emails con el token
- [ ] Acceso a factura individual (no solo estado de cuenta completo)
- [ ] Firma digital del PDF con certificado
- [ ] Multi-idioma en página de token expirado

## Autores

- **OnlyTop Development Team**
- **Versión**: 1.0.0
- **Fecha**: Enero 2025

---

## Referencias

- [HMAC (RFC 2104)](https://datatracker.ietf.org/doc/html/rfc2104)
- [SHA-256](https://en.wikipedia.org/wiki/SHA-2)
- [NestJS Guards](https://docs.nestjs.com/guards)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
