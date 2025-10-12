// Datos predefinidos para áreas y cargos de RRHH
export const DEFAULT_AREAS = [
  {
    name: 'Marketing',
    code: 'MKT',
    description: 'Área encargada de la estrategia de marketing y comunicación',
    color: '#F59E0B',
    sortOrder: 1
  },
  {
    name: 'Traffic',
    code: 'TRF',
    description: 'Área especializada en tráfico digital y gestión de campañas',
    color: '#8B5CF6',
    sortOrder: 2
  },
  {
    name: 'Sales',
    code: 'SLS',
    description: 'Área de ventas y atención al cliente',
    color: '#10B981',
    sortOrder: 3
  },
  {
    name: 'Recruitment',
    code: 'REC',
    description: 'Área de reclutamiento y selección de personal',
    color: '#3B82F6',
    sortOrder: 4
  },
  {
    name: 'Administrativo',
    code: 'ADM',
    description: 'Área administrativa y de gestión empresarial',
    color: '#6B7280',
    sortOrder: 5
  }
];

export const DEFAULT_CARGOS = [
  // Marketing
  {
    name: 'Community Manager',
    code: 'MKT_CM',
    areaCode: 'MKT',
    description: 'Gestión de redes sociales y comunidades digitales',
    hierarchyLevel: 2,
    sortOrder: 1
  },
  {
    name: 'Fotógrafo/Productor Audiovisual',
    code: 'MKT_FPA',
    areaCode: 'MKT',
    description: 'Creación de contenido visual y audiovisual para campañas',
    hierarchyLevel: 2,
    sortOrder: 2
  },
  // Traffic
  {
    name: 'Trafficker',
    code: 'TRF_TRF',
    areaCode: 'TRF',
    description: 'Especialista en gestión de tráfico digital y optimización de campañas',
    hierarchyLevel: 2,
    sortOrder: 1
  },
  // Sales
  {
    name: 'Chatter',
    code: 'SLS_CHT',
    areaCode: 'SLS',
    description: 'Especialista en conversaciones y ventas por chat',
    hierarchyLevel: 3,
    sortOrder: 1
  },
  {
    name: 'Chatter Supernumerario',
    code: 'SLS_CHS',
    areaCode: 'SLS',
    description: 'Chatter de apoyo para picos de demanda',
    hierarchyLevel: 4,
    sortOrder: 2
  },
  {
    name: 'Team Leader Chatters',
    code: 'SLS_TLC',
    areaCode: 'SLS',
    description: 'Líder de equipo de chatters, supervisión y entrenamiento',
    hierarchyLevel: 2,
    sortOrder: 3
  },
  // Recruitment
  {
    name: 'Sales Closer',
    code: 'REC_SC',
    areaCode: 'REC',
    description: 'Especialista en cierre de ventas de alto valor',
    hierarchyLevel: 2,
    sortOrder: 1
  },
  // Administrativo
  {
    name: 'Manager',
    code: 'ADM_MGR',
    areaCode: 'ADM',
    description: 'Gerente administrativo, supervisión general de operaciones',
    hierarchyLevel: 1,
    sortOrder: 1
  },
  {
    name: 'Manager Assistant',
    code: 'ADM_MA',
    areaCode: 'ADM',
    description: 'Asistente de gerencia, apoyo administrativo y organizacional',
    hierarchyLevel: 2,
    sortOrder: 2
  }
];
