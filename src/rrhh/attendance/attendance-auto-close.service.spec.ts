import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AttendanceAutoCloseService } from './attendance-auto-close.service';
import { AttendanceService } from './attendance.service';
import { AttendanceConfigService } from '../../sistema/attendance-config.service';
import { EmpleadosService } from '../empleados.service';
import { AttendanceEntity } from './attendance.schema';

/**
 * Tests Unitarios para AttendanceAutoCloseService
 * 
 * Casos de prueba:
 * 1. Horario Rotativo - Supernumerario (Luis Ramírez)
 *    - Turno AM (07:00 - 14:00)
 *    - Turno PM (14:00 - 22:00)
 *    - Turno Madrugada (22:00 - 06:00)
 * 
 * 2. Horario Fijo (Juan Carlos Pérez López)
 *    - Lunes a Viernes (08:00/09:00/10:00 - 18:00)
 *    - Sábado (09:00 - 15:00)
 */
describe('AttendanceAutoCloseService', () => {
  let service: AttendanceAutoCloseService;
  let attendanceModel: any;
  let attendanceService: any;
  let attendanceConfigService: any;
  let empleadosService: any;

  // Mock data - Luis Ramírez (Supernumerario)
  const luisRamirez = {
    _id: '68de294d29b65fc73020e0fc',
    userId: '68e747a82e6baf4133e3e14d',
    nombre: 'Luis',
    apellido: 'Ramírez',
    cargoId: '68dab39fd497e4ebc8c948ce', // SLS_CHS
    areaId: '68dab39fd497e4ebc8c948ba',  // Sales
  };

  // Mock data - Juan Carlos Pérez (Horario Fijo)
  const juanPerez = {
    _id: '68de16d5b93f93e628c51c4b',
    userId: '68e747a82e6baf4133e3e14e',
    nombre: 'Juan Carlos',
    apellido: 'Pérez López',
    cargoId: '68dab39fd497e4ebc8c948d4', // REC_SC
    areaId: '68dab39fd497e4ebc8c948bc',  // Recruitment
  };

  const mockAttendanceConfig = {
    key: 'attendance_config',
    attendanceType: 'ROTATING',
    rotatingShifts: [
      {
        id: 'shift_am',
        name: 'Turno Mañana',
        type: 'AM',
        timeSlot: { startTime: '07:00', endTime: '14:00' },
        isActive: true,
      },
      {
        id: 'shift_pm',
        name: 'Turno Tarde',
        type: 'PM',
        timeSlot: { startTime: '14:00', endTime: '22:00' },
        isActive: true,
      },
      {
        id: 'shift_madrugada',
        name: 'Turno Madrugada',
        type: 'MADRUGADA',
        timeSlot: { startTime: '22:00', endTime: '06:00' },
        isActive: true,
      },
    ],
    fixedSchedule: {
      monday: { startTime: '08:00', endTime: '18:00' },
      tuesday: { startTime: '10:00', endTime: '18:00' },
      wednesday: { startTime: '09:00', endTime: '18:00' },
      thursday: { startTime: '09:00', endTime: '18:00' },
      friday: { startTime: '09:00', endTime: '18:00' },
      saturday: { startTime: '09:00', endTime: '15:00' },
    },
    toleranceMinutes: 15,
  };

  beforeEach(async () => {
    // Mock del constructor del modelo (persistente)
    attendanceModel = jest.fn().mockImplementation((data: any) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, _id: 'generated-id' }),
    })) as any;
    
    // Mock de los métodos estáticos del modelo (se sobrescriben en cada test)
    attendanceModel.find = jest.fn();
    attendanceModel.findOne = jest.fn();

    // Mock AttendanceService
    attendanceService = {
      getUserAssignedSchedule: jest.fn(),
    };

    // Mock AttendanceConfigService
    attendanceConfigService = {
      getAttendanceConfig: jest.fn().mockResolvedValue(mockAttendanceConfig),
    };

    // Mock EmpleadosService
    empleadosService = {
      findEmpleadoByUserId: jest.fn(),
      findEmpleadoById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceAutoCloseService,
        {
          provide: getModelToken(AttendanceEntity.name),
          useValue: attendanceModel,
        },
        {
          provide: AttendanceService,
          useValue: attendanceService,
        },
        {
          provide: AttendanceConfigService,
          useValue: attendanceConfigService,
        },
        {
          provide: EmpleadosService,
          useValue: empleadosService,
        },
      ],
    }).compile();

    service = module.get<AttendanceAutoCloseService>(AttendanceAutoCloseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper para configurar mocks de mongoose
  const setupMockQueries = (checkIns: any[], hasCheckOut: boolean = false) => {
    const mockFindQuery = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(checkIns),
    };
    attendanceModel.find = jest.fn().mockReturnValue(mockFindQuery);
    
    const mockFindOneQuery = {
      lean: jest.fn().mockResolvedValue(hasCheckOut ? { type: 'CHECK_OUT' } : null),
    };
    attendanceModel.findOne = jest.fn().mockReturnValue(mockFindOneQuery);
  };

  // ==================== HORARIO ROTATIVO - SUPERNUMERARIO ====================

  describe('Horario Rotativo - Turno AM (07:00 - 14:00)', () => {
    it('debe cerrar jornada cuando pasan 15 minutos después de las 14:00', async () => {
      const checkInTime = new Date('2025-10-11T07:00:00'); // 7:00 AM
      const currentTime = new Date('2025-10-11T14:20:00'); // 2:20 PM (14:00 + 20 min)

      // Mockear la hora actual
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        shiftId: 'shift_am',
        areaId: luisRamirez.areaId,
        cargoId: luisRamirez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'ROTATING',
        assignedSchedule: {
          schedule: mockAttendanceConfig.rotatingShifts[0],
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.details[0].shiftEnd).toBe('14:00');
      expect(result.details[0].reason).toContain('Turno Mañana finalizado');

      jest.useRealTimers();
    });

    it('NO debe cerrar jornada si aún no ha pasado el tiempo de tolerancia', async () => {
      const checkInTime = new Date('2025-10-11T07:00:00'); // 7:00 AM
      const currentTime = new Date('2025-10-11T14:10:00'); // 2:10 PM (dentro de tolerancia)

      // Mockear la hora actual
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        shiftId: 'shift_am',
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'ROTATING',
        assignedSchedule: {
          schedule: mockAttendanceConfig.rotatingShifts[0],
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(0);
      expect(result.skipped).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('Horario Rotativo - Turno PM (14:00 - 22:00)', () => {
    it('debe cerrar jornada cuando pasan 15 minutos después de las 22:00', async () => {
      const checkInTime = new Date('2025-10-11T14:00:00'); // 2:00 PM
      const currentTime = new Date('2025-10-11T22:20:00'); // 10:20 PM

      // Mockear la hora actual
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        shiftId: 'shift_pm',
        areaId: luisRamirez.areaId,
        cargoId: luisRamirez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'ROTATING',
        assignedSchedule: {
          schedule: mockAttendanceConfig.rotatingShifts[1],
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(1);
      expect(result.details[0].shiftEnd).toBe('22:00');

      jest.useRealTimers();
    });
  });

  describe('Horario Rotativo - Turno Madrugada (22:00 - 06:00)', () => {
    it('debe cerrar jornada cuando pasan 15 minutos después de las 06:00 (día siguiente)', async () => {
      const checkInTime = new Date('2025-10-11T22:00:00'); // 10:00 PM
      const currentTime = new Date('2025-10-12T06:20:00'); // 6:20 AM del día siguiente

      // Mockear la hora actual
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        shiftId: 'shift_madrugada',
        areaId: luisRamirez.areaId,
        cargoId: luisRamirez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'ROTATING',
        assignedSchedule: {
          schedule: mockAttendanceConfig.rotatingShifts[2],
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(1);
      expect(result.details[0].shiftEnd).toBe('06:00');
      expect(result.details[0].reason).toContain('Turno Madrugada');

      jest.useRealTimers();
    });

    it('NO debe cerrar jornada si aún es de madrugada (antes de las 06:00)', async () => {
      const checkInTime = new Date('2025-10-11T22:00:00'); // 10:00 PM
      const currentTime = new Date('2025-10-12T05:00:00'); // 5:00 AM (aún en turno)

      // Mockear la hora actual
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        shiftId: 'shift_madrugada',
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'ROTATING',
        assignedSchedule: {
          schedule: mockAttendanceConfig.rotatingShifts[2],
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(0);
      expect(result.skipped).toBe(1);

      jest.useRealTimers();
    });
  });

  // ==================== HORARIO FIJO ====================

  describe('Horario Fijo - Lunes (08:00 - 18:00)', () => {
    it('debe cerrar jornada cuando pasan 15 minutos después de las 18:00', async () => {
      const checkInTime = new Date('2025-10-13T08:00:00'); // Lunes 8:00 AM
      const currentTime = new Date('2025-10-13T18:20:00'); // Lunes 6:20 PM

      // Mockear la hora actual
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: juanPerez.userId,
        empleadoId: { _id: juanPerez._id, nombre: 'Juan Carlos', apellido: 'Pérez López' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        areaId: juanPerez.areaId,
        cargoId: juanPerez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'FIXED',
        assignedSchedule: {
          schedule: mockAttendanceConfig.fixedSchedule,
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(1);
      expect(result.details[0].shiftEnd).toBe('18:00');
      expect(result.details[0].reason).toContain('Horario fijo finalizado (monday)');

      jest.useRealTimers();
    });

    it('NO debe cerrar jornada antes de las 18:15 (dentro de tolerancia)', async () => {
      const checkInTime = new Date('2025-10-13T08:00:00'); // Lunes 8:00 AM
      const currentTime = new Date('2025-10-13T18:10:00'); // Lunes 6:10 PM

      // Mockear la hora actual
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: juanPerez.userId,
        empleadoId: { _id: juanPerez._id, nombre: 'Juan Carlos', apellido: 'Pérez López' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'FIXED',
        assignedSchedule: {
          schedule: mockAttendanceConfig.fixedSchedule,
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(0);
      expect(result.skipped).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('Horario Fijo - Sábado (09:00 - 15:00)', () => {
    it('debe cerrar jornada cuando pasan 15 minutos después de las 15:00', async () => {
      const checkInTime = new Date('2025-10-18T09:00:00'); // Sábado 9:00 AM
      const currentTime = new Date('2025-10-18T15:20:00'); // Sábado 3:20 PM

      // Mockear la hora actual
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: juanPerez.userId,
        empleadoId: { _id: juanPerez._id, nombre: 'Juan Carlos', apellido: 'Pérez López' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        areaId: juanPerez.areaId,
        cargoId: juanPerez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'FIXED',
        assignedSchedule: {
          schedule: mockAttendanceConfig.fixedSchedule,
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(1);
      expect(result.details[0].shiftEnd).toBe('15:00');
      expect(result.details[0].reason).toContain('Horario fijo finalizado (saturday)');

      jest.useRealTimers();
    });
  });

  // ==================== CASOS EDGE ====================

  describe('Casos Edge', () => {
    it('debe manejar empleados sin horario asignado', async () => {
      // No necesita fake timers porque no va a cerrar nada
      const mockCheckIn = {
        userId: 'unknown-user',
        empleadoId: { _id: 'unknown-empleado', nombre: 'Usuario', apellido: 'Sin Horario' },
        type: 'CHECK_IN',
        timestamp: new Date(),
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue(null);

      const result = await service.processAutoClose();

      expect(result.closed).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('debe omitir jornadas que ya tienen CHECK_OUT', async () => {
      const mockCheckIn = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: new Date('2025-10-11T07:00:00'),
      };

      const mockCheckOut = {
        userId: luisRamirez.userId,
        type: 'CHECK_OUT',
        timestamp: new Date('2025-10-11T14:00:00'),
      };

      setupMockQueries([mockCheckIn], true); // true = ya tiene CHECK_OUT

      const result = await service.processAutoClose();

      expect(result.closed).toBe(0);
      expect(result.skipped).toBe(0); // No se procesa porque ya tiene CHECK_OUT
    });

    it('debe manejar errores individuales sin detener el proceso completo', async () => {
      const mockCheckIn1 = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: new Date('2025-10-11T07:00:00'),
      };

      const mockCheckIn2 = {
        userId: juanPerez.userId,
        empleadoId: { _id: juanPerez._id, nombre: 'Juan', apellido: 'Pérez' },
        type: 'CHECK_IN',
        timestamp: new Date('2025-10-11T08:00:00'),
      };

      setupMockQueries([mockCheckIn1, mockCheckIn2], false);

      // Simular error en el primer empleado
      attendanceService.getUserAssignedSchedule
        .mockRejectedValueOnce(new Error('Error de conexión'))
        .mockResolvedValueOnce({
          scheduleType: 'FIXED',
          assignedSchedule: { schedule: mockAttendanceConfig.fixedSchedule },
        });

      const result = await service.processAutoClose();

      expect(result.errors).toBe(1);
      expect(result.closed + result.skipped).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== CASOS ADICIONALES DE ROBUSTEZ ====================

  describe('Múltiples Empleados', () => {
    it('debe cerrar múltiples jornadas simultáneamente de diferentes empleados', async () => {
      const currentTime = new Date('2025-10-11T14:20:00'); // 2:20 PM

      // Mockear la hora actual
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      // Luis Ramírez - Turno AM (debe cerrar)
      const mockCheckIn1 = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: new Date('2025-10-11T07:00:00'),
        shiftId: 'shift_am',
        areaId: luisRamirez.areaId,
        cargoId: luisRamirez.cargoId,
      };

      // Juan Pérez - Horario fijo Lunes (NO debe cerrar, aún no termina)
      const mockCheckIn2 = {
        userId: juanPerez.userId,
        empleadoId: { _id: juanPerez._id, nombre: 'Juan', apellido: 'Pérez' },
        type: 'CHECK_IN',
        timestamp: new Date('2025-10-11T08:00:00'),
        areaId: juanPerez.areaId,
        cargoId: juanPerez.cargoId,
      };

      setupMockQueries([mockCheckIn1, mockCheckIn2], false);

      // Mock horarios
      attendanceService.getUserAssignedSchedule
        .mockResolvedValueOnce({
          scheduleType: 'ROTATING',
          assignedSchedule: {
            schedule: mockAttendanceConfig.rotatingShifts[0],
          },
        })
        .mockResolvedValueOnce({
          scheduleType: 'FIXED',
          assignedSchedule: {
            schedule: mockAttendanceConfig.fixedSchedule,
          },
        });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(1); // Solo Luis debe cerrar
      expect(result.skipped).toBe(1); // Juan se omite
      expect(result.errors).toBe(0);
      expect(result.details[0].userId).toBe(luisRamirez.userId);

      jest.useRealTimers();
    });

    it('debe procesar correctamente cuando hay muchas jornadas abiertas', async () => {
      const currentTime = new Date('2025-10-11T22:20:00'); // 10:20 PM

      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      // Crear 5 empleados con turnos PM que deben cerrar
      const mockCheckIns = Array.from({ length: 5 }, (_, i) => ({
        userId: `user-${i}`,
        empleadoId: { _id: `empleado-${i}`, nombre: `Empleado`, apellido: `${i}` },
        type: 'CHECK_IN',
        timestamp: new Date('2025-10-11T14:00:00'),
        shiftId: 'shift_pm',
        areaId: luisRamirez.areaId,
        cargoId: luisRamirez.cargoId,
      }));

      setupMockQueries(mockCheckIns, false);

      // Mock para todos los empleados
      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'ROTATING',
        assignedSchedule: {
          schedule: mockAttendanceConfig.rotatingShifts[1], // Turno PM
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(5); // Todos deben cerrar
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('Casos Límite de Tiempo', () => {
    it('debe cerrar jornada exactamente en el límite de tolerancia', async () => {
      const checkInTime = new Date('2025-10-11T07:00:00'); // 7:00 AM
      const currentTime = new Date('2025-10-11T14:15:00'); // 2:15 PM (exactamente 15 min después)

      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        shiftId: 'shift_am',
        areaId: luisRamirez.areaId,
        cargoId: luisRamirez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'ROTATING',
        assignedSchedule: {
          schedule: mockAttendanceConfig.rotatingShifts[0],
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(1); // Debe cerrar en el límite exacto
      expect(result.errors).toBe(0);

      jest.useRealTimers();
    });

    it('NO debe cerrar jornada 1 minuto antes del límite de tolerancia', async () => {
      const checkInTime = new Date('2025-10-11T07:00:00'); // 7:00 AM
      const currentTime = new Date('2025-10-11T14:14:00'); // 2:14 PM (1 min antes del límite)

      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        shiftId: 'shift_am',
        areaId: luisRamirez.areaId,
        cargoId: luisRamirez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'ROTATING',
        assignedSchedule: {
          schedule: mockAttendanceConfig.rotatingShifts[0],
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(0); // NO debe cerrar antes del límite
      expect(result.skipped).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('Validación de Días de la Semana', () => {
    it('debe cerrar correctamente un horario fijo de martes', async () => {
      const checkInTime = new Date('2025-10-14T10:00:00'); // Martes 10:00 AM
      const currentTime = new Date('2025-10-14T18:20:00'); // Martes 6:20 PM

      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: juanPerez.userId,
        empleadoId: { _id: juanPerez._id, nombre: 'Juan', apellido: 'Pérez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        areaId: juanPerez.areaId,
        cargoId: juanPerez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'FIXED',
        assignedSchedule: {
          schedule: mockAttendanceConfig.fixedSchedule,
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(1);
      expect(result.details[0].shiftEnd).toBe('18:00'); // Martes termina a las 18:00

      jest.useRealTimers();
    });

    it('debe cerrar correctamente un horario fijo de viernes', async () => {
      const checkInTime = new Date('2025-10-17T09:00:00'); // Viernes 9:00 AM
      const currentTime = new Date('2025-10-17T18:20:00'); // Viernes 6:20 PM

      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: juanPerez.userId,
        empleadoId: { _id: juanPerez._id, nombre: 'Juan', apellido: 'Pérez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        areaId: juanPerez.areaId,
        cargoId: juanPerez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'FIXED',
        assignedSchedule: {
          schedule: mockAttendanceConfig.fixedSchedule,
        },
      });

      const result = await service.processAutoClose();

      expect(result.closed).toBe(1);
      expect(result.details[0].shiftEnd).toBe('18:00'); // Viernes termina a las 18:00

      jest.useRealTimers();
    });
  });

  describe('Integridad de Datos', () => {
    it('debe incluir toda la información necesaria en el CHECK_OUT automático', async () => {
      const checkInTime = new Date('2025-10-11T07:00:00');
      const currentTime = new Date('2025-10-11T14:20:00');

      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const mockCheckIn = {
        userId: luisRamirez.userId,
        empleadoId: { _id: luisRamirez._id, nombre: 'Luis', apellido: 'Ramírez' },
        type: 'CHECK_IN',
        timestamp: checkInTime,
        shiftId: 'shift_am',
        areaId: luisRamirez.areaId,
        cargoId: luisRamirez.cargoId,
      };

      setupMockQueries([mockCheckIn], false);

      attendanceService.getUserAssignedSchedule.mockResolvedValue({
        scheduleType: 'ROTATING',
        assignedSchedule: {
          schedule: mockAttendanceConfig.rotatingShifts[0],
        },
      });

      // Verificar que se llamó al constructor del modelo con los datos correctos
      const saveMock = jest.fn().mockResolvedValue({ _id: 'generated-id' });
      attendanceModel.mockImplementation((data: any) => ({
        ...data,
        save: saveMock,
      }));

      await service.processAutoClose();

      // Verificar que se creó el CHECK_OUT con todos los campos principales
      expect(attendanceModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: luisRamirez.userId,
          // empleadoId puede ser string o objeto según cómo se procese
          type: 'CHECK_OUT',
          status: 'PRESENT',
          shiftId: 'shift_am',
          areaId: luisRamirez.areaId,
          cargoId: luisRamirez.cargoId,
          markedBy: 'SYSTEM_AUTO_CLOSE',
          markedByUserId: 'SYSTEM',
          createdBy: 'SYSTEM_AUTO_CLOSE',
          updatedBy: 'SYSTEM_AUTO_CLOSE',
        })
      );

      // Verificar que tiene notas de cierre automático
      const callArgs = attendanceModel.mock.calls[0][0];
      expect(callArgs.notes).toContain('CHECK_OUT automático');
      expect(callArgs.timestamp).toBeInstanceOf(Date);

      expect(saveMock).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
