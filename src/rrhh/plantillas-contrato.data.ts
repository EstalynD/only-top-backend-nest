// Plantillas predefinidas de contratos por área y cargo
export const DEFAULT_PLANTILLAS_CONTRATO = [
  // Marketing - Community Manager
  {
    nombre: 'Contrato Community Manager - Prestación de Servicios',
    descripcion: 'Plantilla para Community Manager con contrato de prestación de servicios',
    areaCode: 'MKT',
    cargoCode: 'MKT_CM',
    tipoContrato: 'PRESTACION_SERVICIOS',
    contenidoPlantilla: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  <h1 style="text-align: center; color: #333;">CONTRATO DE PRESTACIÓN DE SERVICIOS</h1>
  <h2 style="text-align: center; color: #666;">COMMUNITY MANAGER</h2>
  
  <p><strong>Fecha:</strong> {{fechaActual}}</p>
  <p><strong>Número de Contrato:</strong> {{numeroContrato}}</p>
  
  <h3>PARTES</h3>
  <p><strong>CONTRATANTE:</strong> OnlyTop S.A.S.</p>
  <p><strong>CONTRATISTA:</strong> {{nombreCompleto}}</p>
  <p><strong>Identificación:</strong> {{numeroIdentificacion}}</p>
  <p><strong>Correo:</strong> {{correoElectronico}}</p>
  <p><strong>Teléfono:</strong> {{telefono}}</p>
  <p><strong>Dirección:</strong> {{direccion}}, {{ciudad}}, {{pais}}</p>
  
  <h3>OBJETO DEL CONTRATO</h3>
  <p>El contratista se compromete a prestar servicios profesionales como <strong>{{cargo}}</strong> en el área de <strong>{{area}}</strong>, desarrollando estrategias de contenido y gestión de redes sociales.</p>
  
  <h3>OBLIGACIONES DEL CONTRATISTA</h3>
  <ul>
    <li>Crear y gestionar contenido para redes sociales</li>
    <li>Desarrollar estrategias de engagement</li>
    <li>Monitorear métricas y reportar resultados</li>
    <li>Mantener la imagen corporativa en todas las publicaciones</li>
  </ul>
  
  <h3>REMUNERACIÓN</h3>
  <p>El valor mensual del contrato será de <strong>{{moneda}} {{salario}}</strong>, pagaderos mes vencido.</p>
  
  <h3>VIGENCIA</h3>
  <p>El presente contrato inicia el <strong>{{fechaInicio}}</strong> y tendrá vigencia indefinida hasta que alguna de las partes decida terminarlo.</p>
  
  <div style="margin-top: 50px;">
    <div style="display: flex; justify-content: space-between;">
      <div style="text-align: center; width: 45%;">
        <hr style="border-top: 1px solid #333;">
        <p><strong>OnlyTop S.A.S.</strong><br>Representante Legal</p>
      </div>
      <div style="text-align: center; width: 45%;">
        <hr style="border-top: 1px solid #333;">
        <p><strong>{{nombreCompleto}}</strong><br>Contratista</p>
      </div>
    </div>
  </div>
</div>
    `,
    variables: ['nombre', 'apellido', 'nombreCompleto', 'correoElectronico', 'telefono', 'numeroIdentificacion', 'direccion', 'ciudad', 'pais', 'area', 'cargo', 'salario', 'moneda', 'fechaInicio', 'fechaActual', 'numeroContrato']
  },
  
  // Sales - Chatter
  {
    nombre: 'Contrato Chatter - Prestación de Servicios',
    descripcion: 'Plantilla para Chatter con contrato de prestación de servicios',
    areaCode: 'SLS',
    cargoCode: 'SLS_CHT',
    tipoContrato: 'PRESTACION_SERVICIOS',
    contenidoPlantilla: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  <h1 style="text-align: center; color: #333;">CONTRATO DE PRESTACIÓN DE SERVICIOS</h1>
  <h2 style="text-align: center; color: #666;">CHATTER - VENTAS</h2>
  
  <p><strong>Fecha:</strong> {{fechaActual}}</p>
  <p><strong>Número de Contrato:</strong> {{numeroContrato}}</p>
  
  <h3>PARTES</h3>
  <p><strong>CONTRATANTE:</strong> OnlyTop S.A.S.</p>
  <p><strong>CONTRATISTA:</strong> {{nombreCompleto}}</p>
  <p><strong>Identificación:</strong> {{numeroIdentificacion}}</p>
  <p><strong>Correo:</strong> {{correoElectronico}}</p>
  <p><strong>Teléfono:</strong> {{telefono}}</p>
  <p><strong>Dirección:</strong> {{direccion}}, {{ciudad}}, {{pais}}</p>
  
  <h3>OBJETO DEL CONTRATO</h3>
  <p>El contratista se compromete a prestar servicios profesionales como <strong>{{cargo}}</strong> en el área de <strong>{{area}}</strong>, realizando actividades de venta y atención al cliente a través de chat.</p>
  
  <h3>OBLIGACIONES DEL CONTRATISTA</h3>
  <ul>
    <li>Atender clientes potenciales vía chat</li>
    <li>Realizar seguimiento de leads</li>
    <li>Cumplir metas de conversión establecidas</li>
    <li>Mantener registro detallado de interacciones</li>
    <li>Seguir protocolos de atención establecidos</li>
  </ul>
  
  <h3>REMUNERACIÓN</h3>
  <p>El valor mensual del contrato será de <strong>{{moneda}} {{salario}}</strong>, pagaderos mes vencido, más comisiones por ventas según política vigente.</p>
  
  <h3>VIGENCIA</h3>
  <p>El presente contrato inicia el <strong>{{fechaInicio}}</strong> y tendrá vigencia indefinida hasta que alguna de las partes decida terminarlo.</p>
  
  <div style="margin-top: 50px;">
    <div style="display: flex; justify-content: space-between;">
      <div style="text-align: center; width: 45%;">
        <hr style="border-top: 1px solid #333;">
        <p><strong>OnlyTop S.A.S.</strong><br>Representante Legal</p>
      </div>
      <div style="text-align: center; width: 45%;">
        <hr style="border-top: 1px solid #333;">
        <p><strong>{{nombreCompleto}}</strong><br>Contratista</p>
      </div>
    </div>
  </div>
</div>
    `,
    variables: ['nombre', 'apellido', 'nombreCompleto', 'correoElectronico', 'telefono', 'numeroIdentificacion', 'direccion', 'ciudad', 'pais', 'area', 'cargo', 'salario', 'moneda', 'fechaInicio', 'fechaActual', 'numeroContrato']
  },

  // Administrativo - Manager
  {
    nombre: 'Contrato Manager - Término Indefinido',
    descripcion: 'Plantilla para Manager con contrato a término indefinido',
    areaCode: 'ADM',
    cargoCode: 'ADM_MGR',
    tipoContrato: 'TERMINO_INDEFINIDO',
    contenidoPlantilla: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  <h1 style="text-align: center; color: #333;">CONTRATO LABORAL A TÉRMINO INDEFINIDO</h1>
  <h2 style="text-align: center; color: #666;">MANAGER ADMINISTRATIVO</h2>
  
  <p><strong>Fecha:</strong> {{fechaActual}}</p>
  <p><strong>Número de Contrato:</strong> {{numeroContrato}}</p>
  
  <h3>PARTES</h3>
  <p><strong>EMPLEADOR:</strong> OnlyTop S.A.S.</p>
  <p><strong>TRABAJADOR:</strong> {{nombreCompleto}}</p>
  <p><strong>Identificación:</strong> {{numeroIdentificacion}}</p>
  <p><strong>Correo:</strong> {{correoElectronico}}</p>
  <p><strong>Teléfono:</strong> {{telefono}}</p>
  <p><strong>Dirección:</strong> {{direccion}}, {{ciudad}}, {{pais}}</p>
  
  <h3>OBJETO DEL CONTRATO</h3>
  <p>El trabajador se compromete a prestar servicios laborales como <strong>{{cargo}}</strong> en el área <strong>{{area}}</strong>, ejerciendo funciones de dirección, coordinación y supervisión administrativa.</p>
  
  <h3>OBLIGACIONES DEL TRABAJADOR</h3>
  <ul>
    <li>Dirigir y coordinar las operaciones administrativas</li>
    <li>Supervisar el cumplimiento de objetivos departamentales</li>
    <li>Gestionar equipos de trabajo</li>
    <li>Elaborar informes gerenciales</li>
    <li>Participar en la toma de decisiones estratégicas</li>
  </ul>
  
  <h3>REMUNERACIÓN</h3>
  <p>El salario mensual será de <strong>{{moneda}} {{salario}}</strong>, sujeto a las deducciones de ley.</p>
  
  <h3>JORNADA LABORAL</h3>
  <p>La jornada laboral será de lunes a viernes de 8:00 AM a 6:00 PM, con flexibilidad según las necesidades del cargo.</p>
  
  <h3>VIGENCIA</h3>
  <p>El presente contrato inicia el <strong>{{fechaInicio}}</strong> y es a término indefinido.</p>
  
  <div style="margin-top: 50px;">
    <div style="display: flex; justify-content: space-between;">
      <div style="text-align: center; width: 45%;">
        <hr style="border-top: 1px solid #333;">
        <p><strong>OnlyTop S.A.S.</strong><br>Empleador</p>
      </div>
      <div style="text-align: center; width: 45%;">
        <hr style="border-top: 1px solid #333;">
        <p><strong>{{nombreCompleto}}</strong><br>Trabajador</p>
      </div>
    </div>
  </div>
</div>
    `,
    variables: ['nombre', 'apellido', 'nombreCompleto', 'correoElectronico', 'telefono', 'numeroIdentificacion', 'direccion', 'ciudad', 'pais', 'area', 'cargo', 'salario', 'moneda', 'fechaInicio', 'fechaActual', 'numeroContrato']
  }
];
