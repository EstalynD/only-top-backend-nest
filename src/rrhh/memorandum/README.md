# Sistema de Asistencia - Nuevas Funcionalidades

## 📋 Resumen de Implementación

Se han implementado exitosamente las siguientes funcionalidades para el sistema de asistencia:

### 1. ✅ Validación de Horario Laboral

**Backend** (`attendance.service.ts`):
- Se agregó el método `validateWorkingHours()` que valida que la marcación esté dentro del horario permitido
- Respeta la tolerancia configurada (`toleranceMinutes`, por defecto 15 minutos)
- Valida tanto horarios fijos como turnos rotativos
- Maneja horarios que cruzan medianoche
- Rechaza marcaciones fuera del horario con mensajes descriptivos

**Comportamiento**:
- **CHECK_IN**: Permite marcar desde `startTime - toleranceMinutes` hasta `endTime + toleranceMinutes`
- **CHECK_OUT**: Permite marcar desde `startTime` en adelante (con la tolerancia aplicada)
- **BREAKS**: No tienen restricción de horario (más flexibles)

**Mensajes de error**:
- "No puedes marcar entrada tan temprano. El horario laboral inicia a las XX:XX..."
- "No puedes marcar entrada tan tarde. El horario laboral termina a las XX:XX..."
- "No puedes marcar salida antes del inicio del horario laboral..."

### 2. 📄 Sistema de Generación de Memorandos

Se creó un sistema completo para generar memorandos en formato PDF para casos disciplinarios.

#### Backend

**Nuevos Archivos**:
- `src/rrhh/memorandum/memorandum.service.ts`: Servicio para generar PDFs
- `src/rrhh/memorandum/memorandum.controller.ts`: Endpoints REST
- `src/rrhh/memorandum/memorandum.module.ts`: Módulo de NestJS

**Dependencias Instaladas**:
- `pdfkit`: Librería para generación de PDFs
- `@types/pdfkit`: Tipos de TypeScript

**Endpoint**:
```
POST /api/rrhh/memorandum/generate?type=TIPO&userId=ID&date=FECHA
```

**Tipos de Memorando**:
1. **AUSENCIA**: Ausencia Injustificada
2. **LLEGADA_TARDE**: Llegada Tarde
3. **SALIDA_ANTICIPADA**: Salida Anticipada

**Formato del PDF**:
- Encabezado con número de memorando
- Fecha y lugar (Lima, Perú)
- Datos del empleado (PARA/DE/ASUNTO)
- Cuerpo del memorando con descripción detallada
- Firma del jefe/administrador

**Permisos Requeridos**:
- `rrhh.attendance.admin`: Solo administradores pueden generar memorandos

#### Frontend

**Nuevos Archivos**:
- `lib/service-rrhh/memorandum.api.ts`: API client para memorandos
- `components/rrhh/attendance/MemorandumActions.tsx`: Componente UI

**Características del Componente**:
- Detecta automáticamente qué memorandos son aplicables según el registro:
  - **Ausencia**: Si no hay CHECK_IN registrado
  - **Llegada Tarde**: Si `isLate = true`
  - **Salida Anticipada**: Si trabajó menos horas de las esperadas
- Botones con colores distintivos por tipo
- Modal de confirmación antes de generar
- Descarga automática del PDF
- Integrado en el historial de asistencia

**Ubicación en la UI**:
- El componente `MemorandumActions` se muestra en la vista de "Resumen" del modal de historial
- Aparece en una columna "Acciones" de la tabla
- Solo muestra botones para los tipos de memorando aplicables

### 3. 🔗 Integración Completa

**App Module**:
- Se agregó `MemorandumModule` al `AppModule` para activar las rutas

**Flujo Completo**:
1. Usuario administrador abre el historial de asistencia de un empleado
2. Ve el resumen diario con indicadores de ausencias, tardanzas, etc.
3. Para cada día problemático, aparecen botones de "Generar Memorando"
4. Al hacer clic, se muestra un modal de confirmación con los detalles
5. Al confirmar, se genera y descarga automáticamente el PDF
6. El PDF no se almacena en base de datos (solo generación on-demand)

## 📊 Ejemplo de Uso

### Validación de Horario

```typescript
// Horario laboral: 09:00 - 18:00
// Tolerancia: 15 minutos

// ✅ Permitido: 08:45 (15 min antes)
// ✅ Permitido: 09:00 (puntual)
// ✅ Permitido: 09:10 (tarde pero dentro de tolerancia)
// ❌ Rechazado: 08:30 (muy temprano)
// ❌ Rechazado: 18:30 (muy tarde para entrada)
```

### Generación de Memorando

```typescript
// Frontend
await generateMemorandum(token, {
  type: 'LLEGADA_TARDE',
  userId: '68db3ec6ac1c48b4c01aa96b',
  date: '2025-01-10'
});

// Descarga automática: memorandum-llegada_tarde-2025-01-10.pdf
```

## 🔒 Seguridad

- **Autenticación**: Todos los endpoints requieren token JWT válido
- **Autorización**: Solo usuarios con permiso `rrhh.attendance.admin` pueden generar memorandos
- **Validación**: Todos los parámetros son validados en el backend
- **Auditoría**: Los memorandos incluyen quién los generó y cuándo

## 🎨 Estilo de Memorandos

Los PDFs generados siguen un formato profesional y formal:
- Papel tamaño A4
- Márgenes de 72 puntos (1 pulgada)
- Fuente Helvetica
- Numeración automática de memorandos
- Formato oficial con secciones claras

## 🚀 Testing

Para probar el sistema:

1. **Validación de Horario**:
   - Intenta marcar asistencia fuera del horario configurado
   - Verifica que se muestre un mensaje claro de rechazo

2. **Memorandos**:
   - Genera registros de asistencia con problemas (tardanza, ausencia, etc.)
   - Abre el historial de asistencia como administrador
   - Verifica que aparezcan los botones de memorando correspondientes
   - Genera un memorando y verifica que se descargue el PDF

## 📝 Notas Técnicas

- Los PDFs se generan en memoria y se envían directamente al cliente
- No se almacenan en disco ni en base de datos
- La generación es rápida (menos de 1 segundo)
- Compatible con todos los navegadores modernos
- El sistema maneja correctamente horarios que cruzan medianoche (turnos nocturnos)

## 🔄 Próximas Mejoras Sugeridas

1. Agregar configuración de plantillas de memorando por empresa
2. Permitir personalizar el texto del memorando antes de generar
3. Agregar firma digital o código QR para verificación
4. Sistema de seguimiento de memorandos entregados
5. Historial de memorandos generados por empleado
6. Notificación automática al empleado cuando se genera un memorando
7. Integración con sistema de email para envío automático

---

**Fecha de Implementación**: Octubre 2025  
**Desarrollado por**: Sistema Only Top  
**Estado**: ✅ Completado y Funcional
