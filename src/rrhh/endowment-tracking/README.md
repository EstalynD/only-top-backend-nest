# Módulo de Seguimiento de Dotación

Este módulo proporciona un sistema completo para el seguimiento de dotación por áreas, permitiendo registrar elementos entregados, fechas de entrega, observaciones y mantener un historial completo por empleado.

## Características Principales

### ✅ Funcionalidades Implementadas

- **Registro de elementos entregados** (uniforme, equipo, celular, etc.)
- **Fecha de entrega** con validación
- **Observaciones** detalladas
- **Posibilidad de agregar nueva categoría de dotación**
- **Historial por empleado** completo
- **Seguimiento de devoluciones**
- **Estadísticas y reportes**

## Estructura del Módulo

### Schemas

1. **EndowmentCategoryEntity** - Categorías de dotación
   - Nombre, descripción, icono, color
   - Estado activo/inactivo

2. **EndowmentItemEntity** - Elementos de dotación
   - Nombre, descripción, marca, modelo
   - Número de serie, valor estimado
   - Categoría asociada

3. **EndowmentTrackingEntity** - Seguimiento de dotación
   - Empleado, elemento, categoría
   - Acción (ENTREGA, DEVOLUCION, MANTENIMIENTO, REPARACION, REEMPLAZO)
   - Fecha, observaciones, condición
   - Usuario que procesó la acción

### DTOs

- **CreateEndowmentCategoryDto** - Crear categorías
- **CreateEndowmentItemDto** - Crear elementos
- **CreateEndowmentTrackingDto** - Registrar seguimiento
- **EndowmentTrackingQueryDto** - Consultas con filtros
- **EndowmentStatsQueryDto** - Estadísticas

### Servicios

- **EndowmentService** - Lógica de negocio principal
  - CRUD para categorías, elementos y seguimiento
  - Estadísticas y reportes
  - Validaciones de negocio

## Endpoints Disponibles

### Categorías
- `POST /api/rrhh/endowment/categories` - Crear categoría
- `GET /api/rrhh/endowment/categories` - Listar categorías
- `GET /api/rrhh/endowment/categories/:id` - Obtener categoría
- `PATCH /api/rrhh/endowment/categories/:id` - Actualizar categoría
- `DELETE /api/rrhh/endowment/categories/:id` - Eliminar categoría

### Elementos
- `POST /api/rrhh/endowment/items` - Crear elemento
- `GET /api/rrhh/endowment/items` - Listar elementos
- `GET /api/rrhh/endowment/items/:id` - Obtener elemento
- `PATCH /api/rrhh/endowment/items/:id` - Actualizar elemento
- `DELETE /api/rrhh/endowment/items/:id` - Eliminar elemento

### Seguimiento
- `POST /api/rrhh/endowment/tracking` - Registrar seguimiento
- `GET /api/rrhh/endowment/tracking` - Listar seguimientos
- `GET /api/rrhh/endowment/tracking/:id` - Obtener seguimiento
- `GET /api/rrhh/endowment/tracking/empleado/:empleadoId` - Historial por empleado
- `PATCH /api/rrhh/endowment/tracking/:id` - Actualizar seguimiento
- `DELETE /api/rrhh/endowment/tracking/:id` - Eliminar seguimiento

### Estadísticas y Reportes
- `GET /api/rrhh/endowment/stats` - Estadísticas generales
- `GET /api/rrhh/endowment/empleados/:empleadoId/historial` - Historial empleado
- `GET /api/rrhh/endowment/empleados/:empleadoId/items-activos` - Items activos
- `GET /api/rrhh/endowment/empleados/:empleadoId/resumen` - Resumen empleado
- `GET /api/rrhh/endowment/areas/:areaId/estadisticas` - Estadísticas por área
- `GET /api/rrhh/endowment/areas/:areaId/empleados-con-dotacion` - Empleados con dotación
- `GET /api/rrhh/endowment/reportes/entregas-pendientes` - Entregas pendientes
- `GET /api/rrhh/endowment/reportes/items-mas-entregados` - Items más entregados
- `GET /api/rrhh/endowment/reportes/valor-total-dotacion` - Valor total dotación

### Integración con Empleados
- `GET /api/rrhh/empleados/:id/dotacion/historial` - Historial de dotación
- `GET /api/rrhh/empleados/:id/dotacion/activa` - Dotación activa
- `GET /api/rrhh/empleados/:id/dotacion/resumen` - Resumen de dotación

## Ejemplo de Uso

### Crear una categoría
```json
POST /api/rrhh/endowment/categories
{
  "name": "Equipo de cómputo",
  "description": "Laptops, computadoras, tablets",
  "icon": "laptop",
  "color": "#3B82F6"
}
```

### Crear un elemento
```json
POST /api/rrhh/endowment/items
{
  "name": "Laptop HP",
  "description": "Laptop HP Pavilion 15",
  "categoryId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "brand": "HP",
  "model": "Pavilion 15",
  "serialNumber": "HP123456789",
  "estimatedValue": {
    "monto": 2500000,
    "moneda": "COP"
  },
  "condition": "NUEVO"
}
```

### Registrar entrega
```json
POST /api/rrhh/endowment/tracking
{
  "empleadoId": "64f1a2b3c4d5e6f7g8h9i0j2",
  "itemId": "64f1a2b3c4d5e6f7g8h9i0j3",
  "action": "ENTREGA",
  "actionDate": "2025-01-08T10:00:00.000Z",
  "observations": "Equipo en buen estado",
  "condition": "NUEVO",
  "location": "Oficina principal"
}
```

## Permisos Requeridos

- `rrhh:endowment:read` - Leer información de dotación
- `rrhh:endowment:create` - Crear categorías, elementos y seguimientos
- `rrhh:endowment:update` - Actualizar información
- `rrhh:endowment:delete` - Eliminar registros

## Validaciones de Negocio

1. **Categorías**: No se pueden eliminar si tienen elementos asociados
2. **Elementos**: No se pueden eliminar si tienen seguimientos asociados
3. **Seguimiento**: Validación de empleados activos y elementos activos
4. **Números de serie**: Únicos por elemento
5. **Fechas**: Validación de formato y lógica temporal

## Estadísticas Disponibles

- Total de elementos y categorías
- Entregas y devoluciones por período
- Items pendientes de devolución
- Distribución por categorías
- Valor total estimado
- Items más entregados
- Entregas por mes

## Integración

El módulo está completamente integrado con:
- **Sistema de Empleados**: Para obtener información de empleados
- **Sistema de Usuarios**: Para tracking de quién procesó las acciones
- **Sistema de Áreas**: Para reportes por área
- **Sistema de RBAC**: Para control de permisos

## Base de Datos

Las colecciones creadas son:
- `rrhh_endowment_categories` - Categorías de dotación
- `rrhh_endowment_items` - Elementos de dotación
- `rrhh_endowment_tracking` - Seguimiento de dotación

Cada colección incluye índices optimizados para consultas frecuentes.
