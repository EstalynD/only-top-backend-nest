# Módulo RRHH (Recursos Humanos)

Este módulo gestiona las áreas y cargos de la empresa, proporcionando una estructura organizacional completa.

## Características

### Áreas
- **Gestión completa**: Crear, leer, actualizar y eliminar áreas
- **Datos predefinidos**: 5 áreas principales ya configuradas
- **Validación**: Códigos únicos y validaciones de datos
- **Estado**: Activación/desactivación de áreas
- **Ordenamiento**: Sistema de orden personalizable

### Cargos
- **Gestión completa**: CRUD completo para cargos
- **Relación con áreas**: Cada cargo pertenece a un área específica
- **Jerarquía**: Sistema de niveles jerárquicos
- **Requisitos**: Educación, experiencia, habilidades y idiomas
- **Rangos salariales**: Información salarial opcional

## Estructura de Datos

### Áreas Predefinidas
1. **Marketing** (MKT) - Estrategia de marketing y comunicación
2. **Traffic** (TRF) - Tráfico digital y gestión de campañas  
3. **Sales** (SLS) - Ventas y atención al cliente
4. **Recruitment** (REC) - Reclutamiento y selección
5. **Administrativo** (ADM) - Gestión administrativa

### Cargos Predefinidos
- **Marketing**: Community Manager, Fotógrafo/Productor Audiovisual
- **Traffic**: Trafficker
- **Sales**: Chatter, Chatter Supernumerario, Team Leader Chatters
- **Recruitment**: Sales Closer
- **Administrativo**: Manager, Manager Assistant

## API Endpoints

### Áreas
- `POST /api/rrhh/areas` - Crear área
- `GET /api/rrhh/areas` - Listar áreas
- `GET /api/rrhh/areas/with-cargos` - Áreas con cargos incluidos
- `GET /api/rrhh/areas/:id` - Obtener área por ID
- `GET /api/rrhh/areas/code/:code` - Obtener área por código
- `PATCH /api/rrhh/areas/:id` - Actualizar área
- `DELETE /api/rrhh/areas/:id` - Eliminar área

### Cargos
- `POST /api/rrhh/cargos` - Crear cargo
- `GET /api/rrhh/cargos` - Listar cargos (con filtro por área)
- `GET /api/rrhh/cargos/:id` - Obtener cargo por ID
- `GET /api/rrhh/cargos/code/:code` - Obtener cargo por código
- `PATCH /api/rrhh/cargos/:id` - Actualizar cargo
- `DELETE /api/rrhh/cargos/:id` - Eliminar cargo

## Permisos RBAC

### Áreas
- `rrhh:areas:create` - Crear áreas
- `rrhh:areas:read` - Ver áreas
- `rrhh:areas:update` - Actualizar áreas
- `rrhh:areas:delete` - Eliminar áreas

### Cargos
- `rrhh:cargos:create` - Crear cargos
- `rrhh:cargos:read` - Ver cargos
- `rrhh:cargos:update` - Actualizar cargos
- `rrhh:cargos:delete` - Eliminar cargos

## Inicialización de Datos

### Cargar datos predefinidos
```bash
npm run start:dev -- --exec "node dist/scripts/init-rrhh-data.js"
```

### Resetear y recargar datos
```bash
npm run start:dev -- --exec "node dist/scripts/init-rrhh-data.js reset"
```

## Validaciones

### Áreas
- Nombre: 2-100 caracteres, requerido
- Código: 2-20 caracteres, mayúsculas y guiones bajos, único
- Color: Formato hexadecimal válido
- Descripción: Máximo 500 caracteres

### Cargos
- Nombre: 2-100 caracteres, requerido
- Código: 2-30 caracteres, mayúsculas y guiones bajos, único
- Área: Referencia válida a área existente y activa
- Nivel jerárquico: Número positivo (1 = más alto)
- Requisitos: Validación de estructura completa

## Características Técnicas

- **Base de datos**: MongoDB con Mongoose
- **Validación**: class-validator y class-transformer
- **Autenticación**: Guards de autenticación requeridos
- **Autorización**: Sistema RBAC con permisos granulares
- **Logging**: Registro completo de operaciones
- **Índices**: Optimización de consultas con índices compuestos
- **Poblado**: Relaciones automáticas entre cargos y áreas
