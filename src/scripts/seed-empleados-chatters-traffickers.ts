import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { EmpleadosService } from '../rrhh/empleados.service.js';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CargoEntity, CargoDocument } from '../rrhh/cargo.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../rrhh/empleado.schema.js';

type SimpleEmpleado = {
  nombre: string;
  apellido: string;
  correoElectronico: string;
  telefono: string;
  fechaInicio: string; // ISO date
  salario: { monto: number; moneda: string };
  tipoContrato: 'PRESTACION_SERVICIOS' | 'TERMINO_FIJO' | 'TERMINO_INDEFINIDO' | 'OBRA_LABOR' | 'APRENDIZAJE';
  numeroIdentificacion: string;
  direccion: string;
  ciudad: string;
  pais?: string;
  contactoEmergencia: { nombre: string; telefono: string; relacion?: string };
  fechaNacimiento: string; // ISO date
  informacionBancaria: { nombreBanco: string; numeroCuenta: string; tipoCuenta: 'AHORROS' | 'CORRIENTE' };
  fotoPerfil?: string | null;
};

const FOTO_PERFIL = 'https://img.freepik.com/vector-gratis/circulo-azul-usuario-blanco_78370-4707.jpg';

async function main() {
  console.log('🚀 Seed: Creando empleados (Chatters, Traffickers, Chatter Supernumerario) ...');

  const app = await NestFactory.createApplicationContext(AppModule);

  const empleadosService = app.get(EmpleadosService);
  const cargoModel = app.get<Model<CargoDocument>>(getModelToken(CargoEntity.name));
  const empleadoModel = app.get<Model<EmpleadoDocument>>(getModelToken(EmpleadoEntity.name));

  try {
    // Buscar cargos por código
    const cargoChatter = await cargoModel.findOne({ code: 'SLS_CHT', isActive: true }).exec();
    const cargoTrafficker = await cargoModel.findOne({ code: 'TRF_TRF', isActive: true }).exec();
    const cargoChatterSup = await cargoModel.findOne({ code: 'SLS_CHS', isActive: true }).exec();

    if (!cargoChatter || !cargoTrafficker || !cargoChatterSup) {
      throw new Error(
        'No se encontraron los cargos requeridos (SLS_CHT, TRF_TRF, SLS_CHS). Ejecuta primero el seed de RRHH: src/scripts/init-rrhh-data.ts'
      );
    }

    // Datos base
    const baseDireccion = 'Calle 123 #45-67';
    const baseBanco = { nombreBanco: 'Bancolombia', tipoCuenta: 'AHORROS' as const };

    const chatters: SimpleEmpleado[] = [
      {
        nombre: 'Ana María',
        apellido: 'López',
        correoElectronico: 'ana.lopez@onlytop.local',
        telefono: '3001112233',
        fechaInicio: new Date().toISOString(),
        salario: { monto: 2000000, moneda: 'COP' },
        tipoContrato: 'TERMINO_FIJO',
        numeroIdentificacion: '100000001',
        direccion: baseDireccion,
        ciudad: 'Bogotá',
        pais: 'Colombia',
        contactoEmergencia: { nombre: 'María López', telefono: '3112223344', relacion: 'Madre' },
        fechaNacimiento: '1995-05-12',
        informacionBancaria: { ...baseBanco, numeroCuenta: '1002003001' },
        fotoPerfil: FOTO_PERFIL,
      },
      {
        nombre: 'Carlos',
        apellido: 'Pérez',
        correoElectronico: 'carlos.perez@onlytop.local',
        telefono: '3002223344',
        fechaInicio: new Date().toISOString(),
        salario: { monto: 2100000, moneda: 'COP' },
        tipoContrato: 'TERMINO_FIJO',
        numeroIdentificacion: '100000002',
        direccion: baseDireccion,
        ciudad: 'Medellín',
        pais: 'Colombia',
        contactoEmergencia: { nombre: 'Luis Pérez', telefono: '3123334455', relacion: 'Hermano' },
        fechaNacimiento: '1994-08-20',
        informacionBancaria: { ...baseBanco, numeroCuenta: '1002003002' },
        fotoPerfil: FOTO_PERFIL,
      },
      {
        nombre: 'Daniela',
        apellido: 'Gómez',
        correoElectronico: 'daniela.gomez@onlytop.local',
        telefono: '3003334455',
        fechaInicio: new Date().toISOString(),
        salario: { monto: 2050000, moneda: 'COP' },
        tipoContrato: 'TERMINO_FIJO',
        numeroIdentificacion: '100000003',
        direccion: baseDireccion,
        ciudad: 'Cali',
        pais: 'Colombia',
        contactoEmergencia: { nombre: 'Sofía Gómez', telefono: '3134445566', relacion: 'Amiga' },
        fechaNacimiento: '1996-02-15',
        informacionBancaria: { ...baseBanco, numeroCuenta: '1002003003' },
        fotoPerfil: FOTO_PERFIL,
      },
      {
        nombre: 'Jorge',
        apellido: 'Torres',
        correoElectronico: 'jorge.torres@onlytop.local',
        telefono: '3004445566',
        fechaInicio: new Date().toISOString(),
        salario: { monto: 2200000, moneda: 'COP' },
        tipoContrato: 'TERMINO_FIJO',
        numeroIdentificacion: '100000004',
        direccion: baseDireccion,
        ciudad: 'Barranquilla',
        pais: 'Colombia',
        contactoEmergencia: { nombre: 'Laura Torres', telefono: '3145556677', relacion: 'Esposa' },
        fechaNacimiento: '1993-11-03',
        informacionBancaria: { ...baseBanco, numeroCuenta: '1002003004' },
        fotoPerfil: FOTO_PERFIL,
      },
    ];

    const traffickers: SimpleEmpleado[] = [
      {
        nombre: 'Laura',
        apellido: 'Martínez',
        correoElectronico: 'laura.martinez@onlytop.local',
        telefono: '3011112233',
        fechaInicio: new Date().toISOString(),
        salario: { monto: 3500000, moneda: 'COP' },
        tipoContrato: 'TERMINO_INDEFINIDO',
        numeroIdentificacion: '200000001',
        direccion: baseDireccion,
        ciudad: 'Bogotá',
        pais: 'Colombia',
        contactoEmergencia: { nombre: 'Carlos Martínez', telefono: '3151112233', relacion: 'Padre' },
        fechaNacimiento: '1992-04-10',
        informacionBancaria: { ...baseBanco, numeroCuenta: '2003004001' },
        fotoPerfil: FOTO_PERFIL,
      },
      {
        nombre: 'Miguel',
        apellido: 'Rodríguez',
        correoElectronico: 'miguel.rodriguez@onlytop.local',
        telefono: '3012223344',
        fechaInicio: new Date().toISOString(),
        salario: { monto: 3600000, moneda: 'COP' },
        tipoContrato: 'TERMINO_INDEFINIDO',
        numeroIdentificacion: '200000002',
        direccion: baseDireccion,
        ciudad: 'Medellín',
        pais: 'Colombia',
        contactoEmergencia: { nombre: 'María Rodríguez', telefono: '3162223344', relacion: 'Madre' },
        fechaNacimiento: '1991-09-25',
        informacionBancaria: { ...baseBanco, numeroCuenta: '2003004002' },
        fotoPerfil: FOTO_PERFIL,
      },
      {
        nombre: 'Sofía',
        apellido: 'Herrera',
        correoElectronico: 'sofia.herrera@onlytop.local',
        telefono: '3013334455',
        fechaInicio: new Date().toISOString(),
        salario: { monto: 3400000, moneda: 'COP' },
        tipoContrato: 'TERMINO_INDEFINIDO',
        numeroIdentificacion: '200000003',
        direccion: baseDireccion,
        ciudad: 'Cali',
        pais: 'Colombia',
        contactoEmergencia: { nombre: 'Andrés Herrera', telefono: '3173334455', relacion: 'Hermano' },
        fechaNacimiento: '1993-01-30',
        informacionBancaria: { ...baseBanco, numeroCuenta: '2003004003' },
        fotoPerfil: FOTO_PERFIL,
      },
      {
        nombre: 'Pedro',
        apellido: 'Sánchez',
        correoElectronico: 'pedro.sanchez@onlytop.local',
        telefono: '3014445566',
        fechaInicio: new Date().toISOString(),
        salario: { monto: 3700000, moneda: 'COP' },
        tipoContrato: 'TERMINO_INDEFINIDO',
        numeroIdentificacion: '200000004',
        direccion: baseDireccion,
        ciudad: 'Barranquilla',
        pais: 'Colombia',
        contactoEmergencia: { nombre: 'Paula Sánchez', telefono: '3184445566', relacion: 'Esposa' },
        fechaNacimiento: '1990-06-18',
        informacionBancaria: { ...baseBanco, numeroCuenta: '2003004004' },
        fotoPerfil: FOTO_PERFIL,
      },
    ];

    const supernumerario: SimpleEmpleado = {
      nombre: 'Luis',
      apellido: 'Ramírez',
      correoElectronico: 'luis.ramirez@onlytop.local',
      telefono: '3021112233',
      fechaInicio: new Date().toISOString(),
      salario: { monto: 1200000, moneda: 'COP' },
      tipoContrato: 'OBRA_LABOR',
      numeroIdentificacion: '300000001',
      direccion: baseDireccion,
      ciudad: 'Bogotá',
      pais: 'Colombia',
      contactoEmergencia: { nombre: 'José Ramírez', telefono: '3191112233', relacion: 'Padre' },
      fechaNacimiento: '2001-03-22',
      informacionBancaria: { ...baseBanco, numeroCuenta: '3004005001' },
      fotoPerfil: FOTO_PERFIL,
    };

    // Helper para crear empleados de un cargo
    const crearEmpleados = async (empleados: SimpleEmpleado[], cargoId: string, areaId: string) => {
      for (const e of empleados) {
        try {
          // idempotencia básica por email
          const existe = await empleadoModel.findOne({ correoElectronico: e.correoElectronico.toLowerCase() }).exec();
          if (existe) {
            console.log(`⏭️  Ya existe: ${e.correoElectronico}, se omite.`);
            continue;
          }

          const dto: any = {
            ...e,
            cargoId,
            areaId,
            jefeInmediatoId: null,
            estado: 'ACTIVO',
          };

          const creado = await empleadosService.createEmpleado(dto);
          console.log(`✅ Creado empleado: ${creado.nombre} ${creado.apellido} (${e.correoElectronico})`);
        } catch (error: any) {
          console.error(`❌ Error creando empleado ${e.correoElectronico}:`, error?.message || error);
        }
      }
    };

    // Crear 4 Chatters
    await crearEmpleados(chatters, String(cargoChatter._id), String(cargoChatter.areaId));
    // Crear 4 Traffickers
    await crearEmpleados(traffickers, String(cargoTrafficker._id), String(cargoTrafficker.areaId));
    // Crear 1 Chatter Supernumerario
    await crearEmpleados([supernumerario], String(cargoChatterSup._id), String(cargoChatterSup.areaId));

    console.log('🎉 Seed completado.');
  } catch (err) {
    console.error('❌ Falló el seed:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
