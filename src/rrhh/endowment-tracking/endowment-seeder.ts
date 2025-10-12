import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  EndowmentCategoryEntity, 
  EndowmentCategoryDocument,
  EndowmentItemEntity,
  EndowmentItemDocument,
  EndowmentTrackingEntity,
  EndowmentTrackingDocument
} from './endowment.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../empleado.schema.js';

@Injectable()
export class EndowmentSeederService {
  constructor(
    @InjectModel(EndowmentCategoryEntity.name) private categoryModel: Model<EndowmentCategoryDocument>,
    @InjectModel(EndowmentItemEntity.name) private itemModel: Model<EndowmentItemDocument>,
    @InjectModel(EndowmentTrackingEntity.name) private trackingModel: Model<EndowmentTrackingDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
  ) {}

  async seedEndowmentData(): Promise<void> {
    console.log('🌱 Seeding endowment data...');

    // Limpiar datos existentes
    await this.trackingModel.deleteMany({}).exec();
    await this.itemModel.deleteMany({}).exec();
    await this.categoryModel.deleteMany({}).exec();

    // Crear categorías
    const categories = await this.createCategories();
    console.log(`✅ Created ${categories.length} categories`);

    // Crear elementos
    const items = await this.createItems(categories);
    console.log(`✅ Created ${items.length} items`);

    // Crear seguimientos de ejemplo
    const tracking = await this.createTrackingExamples(items);
    console.log(`✅ Created ${tracking.length} tracking records`);

    console.log('🎉 Endowment data seeded successfully!');
  }

  private async createCategories(): Promise<EndowmentCategoryDocument[]> {
    const categoriesData = [
      {
        name: 'Equipo de cómputo',
        description: 'Laptops, computadoras, tablets y accesorios',
        icon: 'laptop',
        color: '#3B82F6'
      },
      {
        name: 'Equipos de comunicación',
        description: 'Celulares, teléfonos, radios y dispositivos de comunicación',
        icon: 'phone',
        color: '#10B981'
      },
      {
        name: 'Uniforme y vestimenta',
        description: 'Camisas, pantalones, zapatos y accesorios de vestir',
        icon: 'shirt',
        color: '#F59E0B'
      },
      {
        name: 'Herramientas de trabajo',
        description: 'Herramientas especializadas para el trabajo',
        icon: 'wrench',
        color: '#EF4444'
      },
      {
        name: 'Equipos de oficina',
        description: 'Escritorios, sillas, archivadores y mobiliario',
        icon: 'desk',
        color: '#8B5CF6'
      }
    ];

    const categories: EndowmentCategoryDocument[] = [];
    for (const categoryData of categoriesData) {
      const category = new this.categoryModel(categoryData);
      await category.save();
      categories.push(category);
    }

    return categories;
  }

  private async createItems(categories: EndowmentCategoryDocument[]): Promise<EndowmentItemDocument[]> {
    const itemsData = [
      // Equipo de cómputo
      {
        name: 'Laptop HP Pavilion 15',
        description: 'Laptop HP Pavilion 15 pulgadas, Intel i5, 8GB RAM, 256GB SSD',
        categoryId: categories[0]._id,
        brand: 'HP',
        model: 'Pavilion 15',
        serialNumber: 'HP123456789',
        estimatedValue: { monto: 2500000, moneda: 'COP' },
        condition: 'NUEVO'
      },
      {
        name: 'Laptop Dell Inspiron 14',
        description: 'Laptop Dell Inspiron 14 pulgadas, AMD Ryzen 5, 16GB RAM, 512GB SSD',
        categoryId: categories[0]._id,
        brand: 'Dell',
        model: 'Inspiron 14',
        serialNumber: 'DELL987654321',
        estimatedValue: { monto: 2800000, moneda: 'COP' },
        condition: 'NUEVO'
      },
      {
        name: 'Monitor Samsung 24"',
        description: 'Monitor Samsung 24 pulgadas Full HD, LED',
        categoryId: categories[0]._id,
        brand: 'Samsung',
        model: 'S24F350',
        serialNumber: 'SAM456789123',
        estimatedValue: { monto: 800000, moneda: 'COP' },
        condition: 'NUEVO'
      },

      // Equipos de comunicación
      {
        name: 'iPhone 13',
        description: 'iPhone 13 128GB, color azul',
        categoryId: categories[1]._id,
        brand: 'Apple',
        model: 'iPhone 13',
        serialNumber: 'IPH789123456',
        estimatedValue: { monto: 3500000, moneda: 'COP' },
        condition: 'NUEVO'
      },
      {
        name: 'Samsung Galaxy A54',
        description: 'Samsung Galaxy A54 128GB, color negro',
        categoryId: categories[1]._id,
        brand: 'Samsung',
        model: 'Galaxy A54',
        serialNumber: 'SGA321654987',
        estimatedValue: { monto: 1800000, moneda: 'COP' },
        condition: 'NUEVO'
      },

      // Uniforme y vestimenta
      {
        name: 'Camisa corporativa azul',
        description: 'Camisa corporativa color azul, talla M',
        categoryId: categories[2]._id,
        brand: 'Corporativo',
        model: 'Camisa Azul',
        estimatedValue: { monto: 120000, moneda: 'COP' },
        condition: 'NUEVO'
      },
      {
        name: 'Pantalón de vestir negro',
        description: 'Pantalón de vestir color negro, talla 32',
        categoryId: categories[2]._id,
        brand: 'Corporativo',
        model: 'Pantalón Negro',
        estimatedValue: { monto: 150000, moneda: 'COP' },
        condition: 'NUEVO'
      },

      // Herramientas de trabajo
      {
        name: 'Destornillador set completo',
        description: 'Set completo de destornilladores Phillips y planos',
        categoryId: categories[3]._id,
        brand: 'Stanley',
        model: 'Set Destornilladores',
        estimatedValue: { monto: 80000, moneda: 'COP' },
        condition: 'NUEVO'
      },

      // Equipos de oficina
      {
        name: 'Silla ergonómica',
        description: 'Silla ergonómica con respaldo ajustable',
        categoryId: categories[4]._id,
        brand: 'Ergonomix',
        model: 'Silla Pro',
        estimatedValue: { monto: 600000, moneda: 'COP' },
        condition: 'NUEVO'
      }
    ];

    const items: EndowmentItemDocument[] = [];
    for (const itemData of itemsData) {
      const item = new this.itemModel(itemData);
      await item.save();
      items.push(item);
    }

    return items;
  }

  private async createTrackingExamples(items: EndowmentItemDocument[]): Promise<EndowmentTrackingDocument[]> {
    // Obtener algunos empleados para crear ejemplos
    const empleados = await this.empleadoModel.find({ estado: 'ACTIVO' }).limit(3).exec();
    
    if (empleados.length === 0) {
      console.log('⚠️ No hay empleados activos para crear ejemplos de seguimiento');
      return [];
    }

    const trackingData = [
      // Entregas
      {
        empleadoId: empleados[0]._id,
        itemId: items[0]._id, // Laptop HP
        categoryId: items[0].categoryId,
        action: 'ENTREGA',
        actionDate: new Date('2025-01-08T10:00:00.000Z'),
        observations: 'Equipo en buen estado, entregado para trabajo remoto',
        condition: 'NUEVO',
        location: 'Oficina principal',
        referenceNumber: 'END20250001'
      },
      {
        empleadoId: empleados[0]._id,
        itemId: items[3]._id, // iPhone 13
        categoryId: items[3].categoryId,
        action: 'ENTREGA',
        actionDate: new Date('2025-01-08T10:30:00.000Z'),
        observations: 'Celular corporativo para comunicación',
        condition: 'NUEVO',
        location: 'Oficina principal',
        referenceNumber: 'END20250002'
      },
      {
        empleadoId: empleados[1]._id,
        itemId: items[1]._id, // Laptop Dell
        categoryId: items[1].categoryId,
        action: 'ENTREGA',
        actionDate: new Date('2025-01-09T09:00:00.000Z'),
        observations: 'Laptop para desarrollo de software',
        condition: 'NUEVO',
        location: 'Oficina principal',
        referenceNumber: 'END20250003'
      },
      {
        empleadoId: empleados[1]._id,
        itemId: items[4]._id, // Samsung Galaxy
        categoryId: items[4].categoryId,
        action: 'ENTREGA',
        actionDate: new Date('2025-01-09T09:15:00.000Z'),
        observations: 'Celular para comunicación con clientes',
        condition: 'NUEVO',
        location: 'Oficina principal',
        referenceNumber: 'END20250004'
      },
      {
        empleadoId: empleados[2]._id,
        itemId: items[5]._id, // Camisa corporativa
        categoryId: items[5].categoryId,
        action: 'ENTREGA',
        actionDate: new Date('2025-01-10T08:00:00.000Z'),
        observations: 'Uniforme corporativo',
        condition: 'NUEVO',
        location: 'Oficina principal',
        referenceNumber: 'END20250005'
      },
      {
        empleadoId: empleados[2]._id,
        itemId: items[6]._id, // Pantalón
        categoryId: items[6].categoryId,
        action: 'ENTREGA',
        actionDate: new Date('2025-01-10T08:05:00.000Z'),
        observations: 'Pantalón de vestir corporativo',
        condition: 'NUEVO',
        location: 'Oficina principal',
        referenceNumber: 'END20250006'
      },

      // Una devolución de ejemplo
      {
        empleadoId: empleados[0]._id,
        itemId: items[0]._id, // Laptop HP
        categoryId: items[0].categoryId,
        action: 'DEVOLUCION',
        actionDate: new Date('2025-01-15T16:00:00.000Z'),
        observations: 'Devolución por cambio de equipo',
        condition: 'BUENO',
        location: 'Oficina principal',
        referenceNumber: 'END20250007'
      },

      // Un mantenimiento de ejemplo
      {
        empleadoId: empleados[1]._id,
        itemId: items[1]._id, // Laptop Dell
        categoryId: items[1].categoryId,
        action: 'MANTENIMIENTO',
        actionDate: new Date('2025-01-12T14:00:00.000Z'),
        observations: 'Mantenimiento preventivo del equipo',
        condition: 'BUENO',
        location: 'Taller técnico',
        referenceNumber: 'END20250008'
      }
    ];

    const tracking: EndowmentTrackingDocument[] = [];
    for (const trackingDataItem of trackingData) {
      const trackingRecord = new this.trackingModel(trackingDataItem);
      await trackingRecord.save();
      tracking.push(trackingRecord);
    }

    return tracking;
  }

  async clearEndowmentData(): Promise<void> {
    console.log('🧹 Clearing endowment data...');
    
    await this.trackingModel.deleteMany({}).exec();
    await this.itemModel.deleteMany({}).exec();
    await this.categoryModel.deleteMany({}).exec();
    
    console.log('✅ Endowment data cleared');
  }
}
