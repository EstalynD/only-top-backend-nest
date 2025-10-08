// Script de prueba para verificar ventas en MongoDB
// Ejecutar en MongoDB Shell o Compass

// 1. Ver todas las ventas de la modelo
db.chatter_sales.find({ 
  modeloId: ObjectId("68de29aa8be53744b459d1a7") 
}).pretty();

// 2. Contar ventas por mes
db.chatter_sales.aggregate([
  {
    $match: {
      modeloId: ObjectId("68de29aa8be53744b459d1a7")
    }
  },
  {
    $group: {
      _id: {
        anio: { $year: "$fechaVenta" },
        mes: { $month: "$fechaVenta" }
      },
      totalVentas: { $sum: "$monto" },
      cantidadVentas: { $count: {} }
    }
  },
  {
    $sort: { "_id.anio": -1, "_id.mes": -1 }
  }
]);

// 3. Verificar ventas en Septiembre 2025
db.chatter_sales.find({
  modeloId: ObjectId("68de29aa8be53744b459d1a7"),
  fechaVenta: {
    $gte: ISODate("2025-09-01T00:00:00.000Z"),
    $lte: ISODate("2025-09-30T23:59:59.999Z")
  }
}).pretty();

// 4. Contar ventas en Septiembre 2025
db.chatter_sales.countDocuments({
  modeloId: ObjectId("68de29aa8be53744b459d1a7"),
  fechaVenta: {
    $gte: ISODate("2025-09-01T00:00:00.000Z"),
    $lte: ISODate("2025-09-30T23:59:59.999Z")
  }
});

// 5. Ver estructura de un documento
db.chatter_sales.findOne({ 
  modeloId: ObjectId("68de29aa8be53744b459d1a7") 
});
