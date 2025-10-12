# Plantillas de Contratos Laborales

Este módulo implementa un sistema centralizado de plantillas de contratos laborales para OnlyTop, permitiendo la generación automática de contratos personalizados según el área y cargo de cada empleado.

## Características

- **Plantillas Especializadas**: Contratos específicos para cada área y cargo
- **Generación Automática**: Contratos generados automáticamente al crear empleados
- **Integración con Horarios**: Utiliza la configuración de asistencia para definir horarios de trabajo
- **PDF Profesional**: Generación de PDFs con formato profesional y legal
- **Gestión Centralizada**: Sistema unificado para todas las plantillas

## Plantillas Disponibles

### 1. Community Manager (Marketing)
- **ID**: `community_manager_contract`
- **Área**: MARKETING
- **Cargo**: COMMUNITY_MANAGER
- **Responsabilidades**: Gestión de redes sociales, creación de contenido, análisis de métricas
- **Horario**: Fijo 9:00 AM - 6:00 PM (L-V), 9:00 AM - 2:00 PM (S)

### 2. Trafficker (Traffic)
- **ID**: `trafficker_contract`
- **Área**: TRAFFIC
- **Cargo**: TRAFFICKER
- **Responsabilidades**: SEO/SEM, campañas publicitarias, análisis de tráfico
- **Horario**: Fijo 8:00 AM - 6:00 PM (L-V), 9:00 AM - 3:00 PM (S)

### 3. Chatter (Sales)
- **ID**: `chatter_contract`
- **Área**: SALES
- **Cargo**: CHATTER
- **Responsabilidades**: Gestión de chat, conversión de leads, atención al cliente
- **Horario**: Extendido 9:00 AM - 9:00 PM (L-V), 10:00 AM - 8:00 PM (S), 10:00 AM - 6:00 PM (D)

### 4. Manager (Administrativo)
- **ID**: `manager_contract`
- **Área**: ADMINISTRATIVO
- **Cargo**: MANAGER
- **Responsabilidades**: Supervisión operativa, gestión de equipos, planificación estratégica
- **Horario**: Ejecutivo 8:00 AM - 6:00 PM (L-V), 9:00 AM - 1:00 PM (S)

## Estructura del Módulo

```
contract-templates/
├── contract-template.interface.ts          # Interfaces y tipos
├── base-contract-template.ts               # Clase base abstracta
├── community-manager-contract.template.ts  # Plantilla Marketing
├── trafficker-contract.template.ts         # Plantilla Traffic
├── chatter-contract.template.ts            # Plantilla Sales
├── manager-contract.template.ts            # Plantilla Administrativo
├── contract-templates.service.ts           # Servicio centralizado
├── contract-templates.module.ts            # Módulo NestJS
├── assign-templates.migration.ts           # Migración de asignaciones
└── README.md                               # Documentación
```

## Uso

### Generar Contrato para Empleado

```typescript
// Obtener PDF del contrato
const pdfBuffer = await contractTemplatesService.generateContractForEmployee(empleadoId);

// Obtener información del contrato (sin PDF)
const contractInfo = await contractTemplatesService.getContractInfoForEmployee(empleadoId);
```

### Endpoints Disponibles

#### Generar Contrato
```
GET /api/rrhh/empleados/:id/contrato-laboral
```

#### Información del Contrato
```
GET /api/rrhh/empleados/:id/contrato-laboral/info
```

#### Validar Plantilla Disponible
```
GET /api/rrhh/empleados/:id/contrato-laboral/validar
```

#### Plantillas Disponibles
```
GET /api/rrhh/empleados/contratos/plantillas
GET /api/rrhh/empleados/contratos/plantillas/area/:areaCode
GET /api/rrhh/empleados/contratos/plantillas/cargo/:cargoCode
```

#### Migración de Plantillas
```
POST /api/rrhh/empleados/contratos/plantillas/asignar
GET /api/rrhh/empleados/contratos/plantillas/verificar
DELETE /api/rrhh/empleados/contratos/plantillas/limpiar
```

## Integración con Horarios

El sistema utiliza la configuración de asistencia (`AttendanceConfigService`) para determinar los horarios de trabajo:

1. **Horario Fijo**: Si el área tiene configuración de horario fijo
2. **Turnos Rotativos**: Si el área tiene turnos asignados
3. **Horario por Defecto**: Si no hay configuración específica

## Migración

Para asignar las plantillas a las áreas y cargos existentes:

```typescript
// Ejecutar migración
await assignTemplatesMigration.assignContractTemplates();

// Verificar asignaciones
const report = await assignTemplatesMigration.verifyTemplateAssignments();

// Limpiar asignaciones (rollback)
await assignTemplatesMigration.clearTemplateAssignments();
```

## Extensión

Para agregar nuevas plantillas:

1. Crear nueva clase que extienda `BaseContractTemplate`
2. Implementar el método `getContractTerms()`
3. Registrar en `ContractTemplatesService`
4. Actualizar la migración si es necesario

### Ejemplo de Nueva Plantilla

```typescript
@Injectable()
export class NuevaPlantillaContractTemplate extends BaseContractTemplate {
  readonly id = 'nueva_plantilla_contract';
  readonly name = 'Contrato Nueva Plantilla';
  readonly areaCode = 'NUEVA_AREA';
  readonly cargoCode = 'NUEVO_CARGO';
  readonly description = 'Descripción de la nueva plantilla';

  getContractTerms(data: ContractTemplateData): ContractTerms {
    return {
      workSchedule: { /* ... */ },
      responsibilities: [ /* ... */ ],
      benefits: [ /* ... */ ],
      obligations: [ /* ... */ ],
      termination: { /* ... */ },
      confidentiality: [ /* ... */ ],
      intellectualProperty: [ /* ... */ ]
    };
  }
}
```

## Consideraciones Legales

- Todos los contratos incluyen cláusulas de confidencialidad
- Términos de terminación según legislación laboral colombiana
- Protección de propiedad intelectual
- Cumplimiento con regulaciones de protección de datos

## Seguridad

- Validación de permisos en todos los endpoints
- Confidencialidad de información de empleados
- Protección de datos personales y comerciales
- Auditoría de generación de contratos
