/**
 * Script para configurar el modo de supernumerarios
 * 
 * Ejecutar con: node scripts/fix-supernumerary-config.js
 */

const mongoose = require('mongoose');

// ========== CONFIGURACIÓN ==========
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/only-top';

// Opción 1: Modo REPLACEMENT (turnos flexibles)
const CONFIG_REPLACEMENT = {
  supernumeraryMode: 'REPLACEMENT',
  allowedReplacementShifts: ['shift_am', 'shift_pm', 'shift_madrugada'],
  supernumeraryFixedSchedule: null // No necesita horario fijo
};

// Opción 2: Modo FIXED_SCHEDULE (horario específico)
const CONFIG_FIXED = {
  supernumeraryMode: 'FIXED_SCHEDULE',
  allowedReplacementShifts: ['shift_am', 'shift_pm', 'shift_madrugada'], // No se usa
  supernumeraryFixedSchedule: {
    monday: { startTime: '10:00', endTime: '20:00' },
    tuesday: { startTime: '10:00', endTime: '20:00' },
    wednesday: { startTime: '10:00', endTime: '20:00' },
    thursday: { startTime: '10:00', endTime: '20:00' },
    friday: { startTime: '10:00', endTime: '20:00' },
    saturday: { startTime: '10:00', endTime: '15:00' },
    sunday: null,
    lunchBreakEnabled: true,
    lunchBreak: { startTime: '13:00', endTime: '14:00' }
  }
};

// ========== SELECCIONA LA CONFIGURACIÓN ==========
const MODO_SELECCIONADO = 'REPLACEMENT'; // Cambiar a 'FIXED' si quieres horario fijo

async function main() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const AttendanceConfig = mongoose.connection.collection('attendance_configs');

    // Verificar configuración actual
    const current = await AttendanceConfig.findOne({ key: 'attendance_config' });
    
    if (!current) {
      console.error('❌ No existe configuración de asistencia');
      process.exit(1);
    }

    console.log('\n📋 Configuración actual:');
    console.log('   Modo:', current.supernumeraryMode || 'No configurado');
    console.log('   Turnos permitidos:', current.allowedReplacementShifts || 'No configurado');
    console.log('   Horario fijo:', current.supernumeraryFixedSchedule ? '✅ Configurado' : '❌ No configurado');

    // Aplicar nueva configuración
    const newConfig = MODO_SELECCIONADO === 'FIXED' ? CONFIG_FIXED : CONFIG_REPLACEMENT;

    console.log('\n🔧 Aplicando nueva configuración:');
    console.log('   Modo seleccionado:', MODO_SELECCIONADO);

    const result = await AttendanceConfig.updateOne(
      { key: 'attendance_config' },
      { 
        $set: {
          ...newConfig,
          updatedBy: 'script-fix',
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      console.log('⚠️  No se modificó ningún documento (puede que ya esté configurado)');
    } else {
      console.log('✅ Configuración actualizada exitosamente');
    }

    // Verificar resultado
    const updated = await AttendanceConfig.findOne({ key: 'attendance_config' });
    
    console.log('\n📊 Configuración final:');
    console.log('   Modo:', updated.supernumeraryMode);
    console.log('   Turnos permitidos:', updated.allowedReplacementShifts);
    
    if (updated.supernumeraryMode === 'FIXED_SCHEDULE') {
      if (updated.supernumeraryFixedSchedule) {
        console.log('   Horario fijo: ✅ Configurado');
        console.log('     Lunes-Viernes:', 
          `${updated.supernumeraryFixedSchedule.monday.startTime} - ${updated.supernumeraryFixedSchedule.monday.endTime}`
        );
      } else {
        console.log('   Horario fijo: ❌ FALTA CONFIGURAR');
      }
    } else {
      console.log('   Modo REPLACEMENT: Los supernumerarios pueden cubrir cualquier turno permitido');
    }

    console.log('\n✨ Configuración completada');
    console.log('\n💡 Recomendación:');
    if (MODO_SELECCIONADO === 'REPLACEMENT') {
      console.log('   - Los supernumerarios podrán cubrir AM, PM y MADRUGADA');
      console.log('   - Verán todos los turnos disponibles en su timeline');
      console.log('   - Pueden marcar asistencia en cualquier turno permitido');
    } else {
      console.log('   - Los supernumerarios tienen horario fijo 10:00-20:00');
      console.log('   - Solo pueden marcar asistencia en ese horario');
      console.log('   - Tienen 1 hora de almuerzo (13:00-14:00)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

main();
