/**
 * Script de prueba para verificar la consulta de ventas en ChatterSales
 * Ejecutar con: npx ts-node test-ventas-query.ts
 */

import { Types } from 'mongoose';

// Simular la consulta que ahora hace el servicio
function buildVentasQuery(modeloId: string, periodo: { anio: number; mes: number; quincena?: number }) {
  let fechaInicio: Date;
  let fechaFin: Date;

  if (periodo.quincena === 1) {
    // Primera quincena: día 1 al 15
    fechaInicio = new Date(periodo.anio, periodo.mes - 1, 1, 0, 0, 0);
    fechaFin = new Date(periodo.anio, periodo.mes - 1, 15, 23, 59, 59);
  } else if (periodo.quincena === 2) {
    // Segunda quincena: día 16 al fin de mes
    fechaInicio = new Date(periodo.anio, periodo.mes - 1, 16, 0, 0, 0);
    // Último día del mes
    fechaFin = new Date(periodo.anio, periodo.mes, 0, 23, 59, 59);
  } else {
    // Mes completo
    fechaInicio = new Date(periodo.anio, periodo.mes - 1, 1, 0, 0, 0);
    // Último día del mes
    fechaFin = new Date(periodo.anio, periodo.mes, 0, 23, 59, 59);
  }

  return {
    modeloId: new Types.ObjectId(modeloId),
    fechaVenta: {
      $gte: fechaInicio,
      $lte: fechaFin,
    },
  };
}

// Pruebas
console.log('=== TEST 1: Mes completo (Septiembre 2025) ===');
const query1 = buildVentasQuery('68de29aa8be53744b459d1a7', { anio: 2025, mes: 9 });
console.log(JSON.stringify(query1, null, 2));
console.log('Rango:', query1.fechaVenta.$gte, 'hasta', query1.fechaVenta.$lte);

console.log('\n=== TEST 2: Primera quincena (Septiembre 2025) ===');
const query2 = buildVentasQuery('68de29aa8be53744b459d1a7', { anio: 2025, mes: 9, quincena: 1 });
console.log(JSON.stringify(query2, null, 2));
console.log('Rango:', query2.fechaVenta.$gte, 'hasta', query2.fechaVenta.$lte);

console.log('\n=== TEST 3: Segunda quincena (Septiembre 2025) ===');
const query3 = buildVentasQuery('68de29aa8be53744b459d1a7', { anio: 2025, mes: 9, quincena: 2 });
console.log(JSON.stringify(query3, null, 2));
console.log('Rango:', query3.fechaVenta.$gte, 'hasta', query3.fechaVenta.$lte);

console.log('\n=== QUERY ANTERIOR (INCORRECTO) ===');
const queryAntiguo = {
  modeloId: new Types.ObjectId('68de29aa8be53744b459d1a7'),
  year: 2025,
  month: 9,
};
console.log(JSON.stringify(queryAntiguo, null, 2));
console.log('❌ Este query NO funcionaría porque ChatterSale no tiene campos year/month/day');

console.log('\n✅ Ahora el query usa fechaVenta con $gte y $lte correctamente');
