# Configuración de Email con Brevo (Sendinblue)

## 📧 Variables de Entorno Requeridas

Para que el sistema de emails funcione correctamente, debes configurar las siguientes variables en tu archivo `.env`:

```env
# ========== CONFIGURACIÓN DE BREVO SMTP ==========
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@onlytop.com
SMTP_PASS=tu-clave-smtp-brevo
SMTP_FROM=finanzas@onlytop.com
SMTP_FROM_NAME=OnlyTop Finanzas
SMTP_REPLY_TO=soporte@onlytop.com
```

---

## 🔑 Cómo Obtener las Credenciales de Brevo

### 1. **Crear una cuenta en Brevo**
   - Ve a [https://www.brevo.com](https://www.brevo.com)
   - Regístrate o inicia sesión

### 2. **Obtener la Clave SMTP**
   1. Ve al menú **SMTP & API**
   2. Click en **SMTP** en el menú lateral
   3. Encontrarás:
      - **Servidor SMTP**: `smtp-relay.brevo.com`
      - **Puerto**: `587` (recomendado)
      - **Login**: Tu email de Brevo
      - **Password**: Click en "Crear una nueva clave SMTP"

### 3. **Copiar las Credenciales**
   ```env
   SMTP_USER=tu-email@brevo.com
   SMTP_PASS=xsmtpsib-a1b2c3d4e5f6... (la clave generada)
   ```

---

## 📋 Ejemplo Completo de `.env`

```env
# Base de datos
MONGODB_URI=mongodb://localhost:27017/onlytop

# JWT
JWT_SECRET=tu-secreto-super-seguro-aqui

# ========== EMAIL BREVO ==========
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contacto@onlytop.com
SMTP_PASS=xsmtpsib-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
SMTP_FROM=finanzas@onlytop.com
SMTP_FROM_NAME=OnlyTop Finanzas
SMTP_REPLY_TO=soporte@onlytop.com

# Otros...
```

---

## ✅ Verificar la Configuración

### 1. **Verificar variables cargadas**
```typescript
// En cualquier servicio
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '✓ Configurado' : '✗ Falta');
```

### 2. **Probar envío de email**
Endpoint de prueba:
```http
POST http://localhost:3041/api/cartera/recordatorios/{facturaId}
Authorization: Bearer tu-token-jwt
```

---

## 🚨 Errores Comunes

### Error: "Brevo SMTP auth incompleto: user/pass requerido"
**Causa**: Faltan las variables `SMTP_USER` o `SMTP_PASS` en el `.env`

**Solución**:
1. Verifica que el archivo `.env` exista en la raíz del proyecto
2. Asegúrate de que las variables estén configuradas
3. Reinicia el servidor backend

### Error: "Invalid login"
**Causa**: Credenciales incorrectas

**Solución**:
1. Verifica que `SMTP_USER` sea tu email de Brevo
2. Genera una nueva clave SMTP en Brevo
3. Actualiza `SMTP_PASS` en `.env`

### Error: "Connection timeout"
**Causa**: Puerto bloqueado o firewall

**Solución**:
1. Usa el puerto `587` (TLS)
2. Si no funciona, prueba con puerto `465` (SSL) y `SMTP_SECURE=true`
3. Verifica que tu firewall permita conexiones salientes al puerto

---

## 📊 Funcionalidades del Módulo de Email

### Recordatorios de Cartera
- ✅ **Próximo vencimiento**: 5 días antes (configurable)
- ✅ **Factura vencida**: El día que vence
- ✅ **Mora**: 3 días después de vencimiento
- ✅ **Confirmación de pago**: Al registrar un pago

### Plantillas Incluidas
1. `enviarRecordatorioProximoVencimiento()` - Alerta temprana
2. `enviarAlertaFacturaVencida()` - Urgente
3. `enviarAlertaMora()` - Cuenta en mora
4. `enviarConfirmacionPago()` - Recibo de pago

---

## 🔧 Configuración Avanzada

### Personalizar remitente
```env
SMTP_FROM=tu-nombre@tudominio.com
SMTP_FROM_NAME=Tu Empresa
SMTP_REPLY_TO=respuestas@tudominio.com
```

### Usar dominio personalizado
1. Configura los registros SPF, DKIM y DMARC en tu dominio
2. Verifica el dominio en Brevo
3. Usa tu dominio verificado en `SMTP_FROM`

### Límites de Brevo (Plan Gratuito)
- **300 emails/día**
- **Máximo tamaño**: 25MB por email
- **Sin límite de contactos**

---

## 📝 Notas Importantes

1. **Nunca commitees el `.env`**: Asegúrate de que esté en `.gitignore`
2. **Usa variables de entorno**: En producción usa secretos de tu proveedor (Heroku, Railway, etc.)
3. **Logs de seguridad**: Las credenciales nunca se imprimen en logs
4. **Backoff automático**: El sistema reintenta automáticamente si falla

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs del backend: `[CarteraEmailService]`
2. Verifica que la modelo tenga email registrado
3. Consulta la documentación de Brevo: https://developers.brevo.com/docs

---

**Última actualización**: Octubre 2025  
**Versión del módulo**: 2.0.0
