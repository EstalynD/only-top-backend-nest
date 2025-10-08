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
    requirements: {
      education: ['Comunicación Social', 'Marketing Digital', 'Publicidad'],
      experience: '1-2 años en manejo de redes sociales',
      skills: ['Creatividad', 'Redacción', 'Diseño básico', 'Análisis de métricas'],
      languages: ['Español nativo', 'Inglés básico']
    },
    sortOrder: 1
  },
  {
    name: 'Fotógrafo/Productor Audiovisual',
    code: 'MKT_FPA',
    areaCode: 'MKT',
    description: 'Creación de contenido visual y audiovisual para campañas',
    hierarchyLevel: 2,
    requirements: {
      education: ['Comunicación Audiovisual', 'Diseño Gráfico', 'Fotografía'],
      experience: '2-3 años en producción audiovisual',
      skills: ['Fotografía', 'Edición de video', 'Iluminación', 'Post-producción'],
      languages: ['Español nativo']
    },
    sortOrder: 2
  },
  // Traffic
  {
    name: 'Trafficker',
    code: 'TRF_TRF',
    areaCode: 'TRF',
    description: 'Especialista en gestión de tráfico digital y optimización de campañas',
    hierarchyLevel: 2,
    requirements: {
      education: ['Marketing Digital', 'Publicidad', 'Ingeniería de Sistemas'],
      experience: '2-4 años en traffic digital',
      skills: ['Google Ads', 'Facebook Ads', 'Analytics', 'Optimización de conversiones'],
      languages: ['Español nativo', 'Inglés intermedio']
    },
    sortOrder: 1
  },
  // Sales
  {
    name: 'Chatter',
    code: 'SLS_CHT',
    areaCode: 'SLS',
    description: 'Especialista en conversaciones y ventas por chat',
    hierarchyLevel: 3,
    requirements: {
      education: ['Bachillerato completo'],
      experience: '6 meses - 1 año en ventas o atención al cliente',
      skills: ['Comunicación escrita', 'Persuasión', 'Empatía', 'Multitasking'],
      languages: ['Español nativo']
    },
    sortOrder: 1
  },
  {
    name: 'Chatter Supernumerario',
    code: 'SLS_CHS',
    areaCode: 'SLS',
    description: 'Chatter de apoyo para picos de demanda',
    hierarchyLevel: 4,
    requirements: {
      education: ['Bachillerato en curso o completo'],
      experience: 'Sin experiencia requerida',
      skills: ['Comunicación básica', 'Disponibilidad horaria', 'Aprendizaje rápido'],
      languages: ['Español nativo']
    },
    sortOrder: 2
  },
  {
    name: 'Team Leader Chatters',
    code: 'SLS_TLC',
    areaCode: 'SLS',
    description: 'Líder de equipo de chatters, supervisión y entrenamiento',
    hierarchyLevel: 2,
    requirements: {
      education: ['Técnico en ventas', 'Administración', 'Psicología'],
      experience: '2-3 años en ventas y 1 año en liderazgo',
      skills: ['Liderazgo', 'Coaching', 'Análisis de métricas', 'Resolución de conflictos'],
      languages: ['Español nativo']
    },
    sortOrder: 3
  },
  // Recruitment
  {
    name: 'Sales Closer',
    code: 'REC_SC',
    areaCode: 'REC',
    description: 'Especialista en cierre de ventas de alto valor',
    hierarchyLevel: 2,
    requirements: {
      education: ['Administración', 'Psicología', 'Comunicación'],
      experience: '3-5 años en ventas consultivas',
      skills: ['Cierre de ventas', 'Negociación', 'CRM', 'Análisis de objeciones'],
      languages: ['Español nativo', 'Inglés intermedio-avanzado']
    },
    sortOrder: 1
  },
  // Administrativo
  {
    name: 'Manager',
    code: 'ADM_MGR',
    areaCode: 'ADM',
    description: 'Gerente administrativo, supervisión general de operaciones',
    hierarchyLevel: 1,
    requirements: {
      education: ['Administración de Empresas', 'Ingeniería Industrial', 'MBA'],
      experience: '5+ años en gestión administrativa',
      skills: ['Liderazgo', 'Planificación estratégica', 'Gestión de equipos', 'Análisis financiero'],
      languages: ['Español nativo', 'Inglés avanzado']
    },
    sortOrder: 1
  },
  {
    name: 'Manager Assistant',
    code: 'ADM_MA',
    areaCode: 'ADM',
    description: 'Asistente de gerencia, apoyo administrativo y organizacional',
    hierarchyLevel: 2,
    requirements: {
      education: ['Técnico en administración', 'Secretariado ejecutivo'],
      experience: '2-3 años como asistente administrativo',
      skills: ['Organización', 'Microsoft Office avanzado', 'Comunicación', 'Gestión de agenda'],
      languages: ['Español nativo', 'Inglés intermedio']
    },
    sortOrder: 2
  }
];
