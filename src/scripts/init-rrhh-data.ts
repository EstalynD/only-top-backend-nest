import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { RrhhSeederService } from '../rrhh/rrhh.seeder.js';

async function initRrhhData() {
  console.log('🚀 Initializing RRHH default data...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const seederService = app.get(RrhhSeederService);

  try {
    await seederService.seedDefaultData();
    console.log('✅ RRHH default data initialized successfully!');
    console.log('📋 Created areas: Marketing, Traffic, Sales, Recruitment, Administrativo');
    console.log('👥 Created positions for each area with predefined data');
  } catch (error) {
    console.error('❌ Error initializing RRHH data:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

async function resetRrhhData() {
  console.log('🔄 Resetting RRHH data...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const seederService = app.get(RrhhSeederService);

  try {
    await seederService.resetData();
    console.log('✅ RRHH data reset and reinitialized successfully!');
  } catch (error) {
    console.error('❌ Error resetting RRHH data:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Ejecutar según el argumento
const action = process.argv[2];

if (action === 'reset') {
  resetRrhhData();
} else {
  initRrhhData();
}
