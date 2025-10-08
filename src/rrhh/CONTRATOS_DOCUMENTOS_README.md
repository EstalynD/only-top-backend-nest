# Sistema de Contratos y Documentos - RRHH

## Descripción General

Este módulo implementa un sistema completo para la gestión de contratos laborales y documentos de empleados, incluyendo:

- ✅ Subida de contratos laborales (PDF)
- ✅ Adjuntar documentos (cédula, RUT, diplomas, certificados, etc.)
- ✅ Gestión de fechas de firma, vencimiento y renovación
- ✅ Integración con Cloudinary para almacenamiento de archivos
- ✅ Sistema de validación y aprobación
- ✅ Alertas de vencimiento
- ✅ Renovación automática de documentos

## Estructura del Sistema

### 1. Schemas (Modelos de Datos)

#### DocumentoEntity (`documento.schema.ts`)
- **Campos principales:**
  - `empleadoId`: Referencia al empleado
  - `contratoId`: Referencia al contrato (opcional)
  - `nombre`, `nombreOriginal`: Nombres del documento
  - `tipoDocumento`: Tipo de documento (CEDULA_IDENTIDAD, RUT, DIPLOMA, etc.)
  - `urlArchivo`, `publicId`: Información de Cloudinary
  - `fechaEmision`, `fechaVencimiento`: Fechas importantes
  - `estado`: PENDIENTE, APROBADO, RECHAZADO, VENCIDO, RENOVADO
  - `validacion`: Información de validación
  - `renovacion`: Configuración de renovación

#### ContratoEntity (`contrato.schema.ts`)
- **Campos principales:**
  - `empleadoId`: Referencia al empleado
  - `numeroContrato`: Número único del contrato
  - `tipoContrato`: Tipo de contrato laboral
  - `fechaInicio`, `fechaFin`: Fechas del contrato
  - `estado`: EN_REVISION, APROBADO, RECHAZADO, TERMINADO
  - `contenidoContrato`: Contenido HTML/texto del contrato
  - `aprobacion`: Información de aprobación

### 2. DTOs (Data Transfer Objects)

#### CreateDocumentoDto
```typescript
{
  empleadoId: ObjectId;
  contratoId?: ObjectId;
  nombre: string;
  nombreOriginal: string;
  tipoDocumento: string;
  descripcion: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  esConfidencial?: boolean;
  tags?: string[];
  requiereRenovacion?: boolean;
  diasAntesVencimiento?: number;
}
```

#### CreateContratoDto
```typescript
{
  empleadoId: ObjectId;
  numeroContrato: string;
  tipoContrato: string;
  fechaInicio: string;
  fechaFin?: string;
  contenidoContrato: string;
  plantillaId: ObjectId;
}
```

### 3. Servicios

#### DocumentosService
- `crearDocumento()`: Crear nuevo documento
- `obtenerDocumentosPorEmpleado()`: Obtener documentos de un empleado
- `validarDocumento()`: Aprobar/rechazar documento
- `renovarDocumento()`: Renovar documento vencido
- `eliminarDocumento()`: Eliminar documento
- `obtenerDocumentosProximosAVencer()`: Alertas de vencimiento
- `marcarDocumentosVencidos()`: Marcar documentos vencidos
- `obtenerEstadisticasDocumentos()`: Estadísticas por empleado

#### ContratosService
- `crearContrato()`: Crear nuevo contrato
- `obtenerContratos()`: Obtener todos los contratos
- `aprobarContrato()`: Aprobar/rechazar contrato
- `renovarContrato()`: Renovar contrato
- `obtenerContratosProximosAVencer()`: Alertas de vencimiento
- `marcarContratosVencidos()`: Marcar contratos vencidos
- `obtenerEstadisticasContratos()`: Estadísticas generales

### 4. Controladores

#### DocumentosController (`/rrhh/documentos`)
- `POST /`: Crear documento (con upload de archivo)
- `GET /empleado/:empleadoId`: Obtener documentos por empleado
- `GET /:id`: Obtener documento por ID
- `PUT /:id`: Actualizar documento
- `PUT /:id/validar`: Validar documento
- `POST /:id/renovar`: Renovar documento
- `DELETE /:id`: Eliminar documento
- `GET /alertas/proximos-vencer`: Documentos próximos a vencer
- `GET /alertas/vencidos`: Documentos vencidos
- `POST /alertas/marcar-vencidos`: Marcar documentos vencidos
- `GET /estadisticas/empleado/:empleadoId`: Estadísticas por empleado
- `GET /buscar/criterios`: Búsqueda avanzada
- `GET /:id/descargar`: Descargar documento

#### ContratosController (`/rrhh/contratos`)
- `POST /`: Crear contrato
- `GET /`: Obtener todos los contratos
- `GET /:id`: Obtener contrato por ID
- `GET /empleado/:empleadoId`: Contratos por empleado
- `PUT /:id`: Actualizar contrato
- `PUT /:id/aprobar`: Aprobar/rechazar contrato
- `POST /:id/renovar`: Renovar contrato
- `DELETE /:id`: Eliminar contrato
- `GET /alertas/proximos-vencer`: Contratos próximos a vencer
- `GET /alertas/vencidos`: Contratos vencidos
- `POST /alertas/marcar-vencidos`: Marcar contratos vencidos
- `GET /estadisticas/generales`: Estadísticas generales
- `GET /buscar/criterios`: Búsqueda avanzada
- `GET /:id/pdf`: Generar PDF del contrato

## Características Principales

### 1. Gestión de Archivos
- Integración completa con Cloudinary
- Soporte para múltiples formatos (PDF, JPG, PNG, DOC, DOCX)
- Validación de tamaño de archivo (máximo 10MB)
- Eliminación automática de archivos al eliminar documentos

### 2. Sistema de Validación
- Estados de documentos: PENDIENTE, APROBADO, RECHAZADO, VENCIDO, RENOVADO
- Estados de contratos: EN_REVISION, APROBADO, RECHAZADO, TERMINADO
- Trazabilidad completa de validaciones
- Comentarios y observaciones en validaciones

### 3. Alertas y Notificaciones
- Documentos próximos a vencer (configurable por días)
- Documentos vencidos
- Contratos próximos a vencer
- Contratos vencidos
- Marcado automático de vencimientos

### 4. Renovación de Documentos
- Sistema de renovación con historial
- Preservación de configuración de renovación
- Referencia al documento anterior
- Actualización automática de estados

### 5. Búsqueda y Filtros
- Búsqueda por empleado, tipo, estado, fechas
- Filtros por confidencialidad
- Búsqueda por tags
- Ordenamiento por fechas

### 6. Estadísticas y Reportes
- Estadísticas por empleado
- Estadísticas generales
- Conteos por estado y tipo
- Documentos próximos a vencer
- Documentos vencidos

## Tipos de Documentos Soportados

- `CEDULA_IDENTIDAD`: Cédula de identidad
- `RUT`: Registro Único Tributario
- `DIPLOMA`: Diplomas académicos
- `CERTIFICADO_ACADEMICO`: Certificados académicos
- `CERTIFICADO_LABORAL`: Certificados laborales
- `CERTIFICADO_MEDICO`: Certificados médicos
- `CERTIFICADO_PENALES`: Certificados penales
- `CERTIFICADO_POLICIA`: Certificados de policía
- `CONTRATO_LABORAL`: Contratos laborales
- `HOJA_VIDA`: Hojas de vida
- `FOTO_PERFIL`: Fotos de perfil
- `OTRO`: Otros documentos

## Tipos de Contratos Soportados

- `PRESTACION_SERVICIOS`: Prestación de servicios
- `TERMINO_FIJO`: Término fijo
- `TERMINO_INDEFINIDO`: Término indefinido
- `OBRA_LABOR`: Obra o labor
- `APRENDIZAJE`: Aprendizaje

## Seguridad

- Autenticación requerida para todos los endpoints
- Validación de permisos por usuario
- Documentos confidenciales con control de acceso
- Eliminación segura de archivos
- Validación de tipos de archivo

## Uso del Sistema

### Crear un Documento
```typescript
// POST /rrhh/documentos
const formData = new FormData();
formData.append('archivo', file);
formData.append('empleadoId', '64f1a2b3c4d5e6f7g8h9i0j1');
formData.append('tipoDocumento', 'CEDULA_IDENTIDAD');
formData.append('descripcion', 'Cédula de identidad del empleado');
formData.append('fechaEmision', '2024-01-15');
formData.append('fechaVencimiento', '2034-01-15');
```

### Crear un Contrato
```typescript
// POST /rrhh/contratos
{
  "empleadoId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "numeroContrato": "CON-2024-0001",
  "tipoContrato": "TERMINO_INDEFINIDO",
  "fechaInicio": "2024-01-15",
  "contenidoContrato": "<html>Contenido del contrato...</html>",
  "plantillaId": "64f1a2b3c4d5e6f7g8h9i0j2"
}
```

### Validar un Documento
```typescript
// PUT /rrhh/documentos/:id/validar
{
  "estado": "APROBADO",
  "observaciones": "Documento válido y completo",
  "esValido": true
}
```

## Consideraciones de Implementación

1. **Rendimiento**: Los índices de MongoDB están optimizados para consultas frecuentes
2. **Escalabilidad**: El sistema está diseñado para manejar grandes volúmenes de documentos
3. **Mantenimiento**: Incluye funciones para limpieza automática de documentos vencidos
4. **Auditoría**: Todos los cambios están registrados con timestamps y usuarios
5. **Backup**: Los archivos se almacenan en Cloudinary con redundancia

## Próximas Mejoras

- [ ] Generación automática de PDFs de contratos
- [ ] Notificaciones por email de vencimientos
- [ ] Integración con sistemas de firma digital
- [ ] Dashboard de estadísticas en tiempo real
- [ ] API de webhooks para integraciones externas
