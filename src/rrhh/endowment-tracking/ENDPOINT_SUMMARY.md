# Resumen de Endpoints - Sistema de Seguimiento de Dotación

## 📋 Información General

El sistema de seguimiento de dotación permite gestionar elementos entregados a empleados, incluyendo uniformes, equipos, celulares, etc. con seguimiento completo de entregas, devoluciones y mantenimientos.

## 🎯 Ejemplo de Caso de Uso

**Empleado**: Juan Pérez  
**Área**: Marketing  
**Elemento**: Laptop HP  
**Fecha de entrega**: 08/10/2025  
**Observaciones**: Equipo en buen estado  
**Categoría**: Equipo de cómputo  
**Historial**: Listado completo de entregas y devoluciones

## 🔗 Endpoints Disponibles

### 📁 Categorías de Dotación

| Método | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| `POST` | `/api/rrhh/endowment/categories` | Crear nueva categoría | `rrhh:endowment:create` |
| `GET` | `/api/rrhh/endowment/categories` | Listar todas las categorías | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/categories/:id` | Obtener categoría específica | `rrhh:endowment:read` |
| `PATCH` | `/api/rrhh/endowment/categories/:id` | Actualizar categoría | `rrhh:endowment:update` |
| `DELETE` | `/api/rrhh/endowment/categories/:id` | Eliminar categoría | `rrhh:endowment:delete` |

### 📦 Elementos de Dotación

| Método | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| `POST` | `/api/rrhh/endowment/items` | Crear nuevo elemento | `rrhh:endowment:create` |
| `GET` | `/api/rrhh/endowment/items` | Listar todos los elementos | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/items/:id` | Obtener elemento específico | `rrhh:endowment:read` |
| `PATCH` | `/api/rrhh/endowment/items/:id` | Actualizar elemento | `rrhh:endowment:update` |
| `DELETE` | `/api/rrhh/endowment/items/:id` | Eliminar elemento | `rrhh:endowment:delete` |

### 📊 Seguimiento de Dotación

| Método | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| `POST` | `/api/rrhh/endowment/tracking` | Registrar seguimiento | `rrhh:endowment:create` |
| `GET` | `/api/rrhh/endowment/tracking` | Listar seguimientos | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/tracking/:id` | Obtener seguimiento específico | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/tracking/empleado/:empleadoId` | Historial por empleado | `rrhh:endowment:read` |
| `PATCH` | `/api/rrhh/endowment/tracking/:id` | Actualizar seguimiento | `rrhh:endowment:update` |
| `DELETE` | `/api/rrhh/endowment/tracking/:id` | Eliminar seguimiento | `rrhh:endowment:delete` |

### 📈 Estadísticas y Reportes

| Método | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| `GET` | `/api/rrhh/endowment/stats` | Estadísticas generales | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/empleados/:empleadoId/historial` | Historial completo empleado | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/empleados/:empleadoId/items-activos` | Items activos empleado | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/empleados/:empleadoId/resumen` | Resumen dotación empleado | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/areas/:areaId/estadisticas` | Estadísticas por área | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/areas/:areaId/empleados-con-dotacion` | Empleados con dotación por área | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/reportes/entregas-pendientes` | Entregas pendientes de devolución | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/reportes/items-mas-entregados` | Items más entregados | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/endowment/reportes/valor-total-dotacion` | Valor total de dotación | `rrhh:endowment:read` |

### 👥 Integración con Empleados

| Método | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| `GET` | `/api/rrhh/empleados/:id/dotacion/historial` | Historial de dotación del empleado | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/empleados/:id/dotacion/activa` | Dotación activa del empleado | `rrhh:endowment:read` |
| `GET` | `/api/rrhh/empleados/:id/dotacion/resumen` | Resumen de dotación del empleado | `rrhh:endowment:read` |

## 🔧 Tipos de Acciones de Seguimiento

- **ENTREGA**: Entrega de elemento a empleado
- **DEVOLUCION**: Devolución de elemento por empleado
- **MANTENIMIENTO**: Mantenimiento preventivo o correctivo
- **REPARACION**: Reparación de elemento dañado
- **REEMPLAZO**: Reemplazo de elemento

## 📝 Ejemplos de Uso

### Crear Categoría
```bash
POST /api/rrhh/endowment/categories
{
  "name": "Equipo de cómputo",
  "description": "Laptops, computadoras, tablets",
  "icon": "laptop",
  "color": "#3B82F6"
}
```

### Crear Elemento
```bash
POST /api/rrhh/endowment/items
{
  "name": "Laptop HP Pavilion 15",
  "description": "Laptop HP Pavilion 15 pulgadas",
  "categoryId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "brand": "HP",
  "model": "Pavilion 15",
  "serialNumber": "HP123456789",
  "estimatedValue": {
    "monto": 2500000,
    "moneda": "COP"
  }
}
```

### Registrar Entrega
```bash
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

### Obtener Historial de Empleado
```bash
GET /api/rrhh/endowment/tracking/empleado/64f1a2b3c4d5e6f7g8h9i0j2
```

### Obtener Resumen de Empleado
```bash
GET /api/rrhh/empleados/64f1a2b3c4d5e6f7g8h9i0j2/dotacion/resumen
```

## 🎯 Casos de Uso Principales

1. **Registro de Entrega**: Registrar cuando se entrega un elemento a un empleado
2. **Seguimiento de Devolución**: Registrar cuando un empleado devuelve un elemento
3. **Historial Completo**: Ver todo el historial de dotación de un empleado
4. **Reportes por Área**: Ver estadísticas de dotación por área
5. **Control de Inventario**: Gestionar elementos disponibles y entregados
6. **Mantenimiento**: Registrar mantenimientos y reparaciones

## 🔐 Seguridad

- Todos los endpoints requieren autenticación
- Control de permisos granular por operación
- Validación de datos de entrada
- Prevención de eliminación de datos con dependencias

## 📊 Métricas Disponibles

- Total de elementos y categorías
- Entregas y devoluciones por período
- Items pendientes de devolución
- Distribución por categorías
- Valor total estimado de dotación
- Items más entregados
- Entregas por mes
- Estadísticas por área
