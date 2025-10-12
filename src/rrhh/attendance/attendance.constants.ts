/**
 * attendance.constants.ts
 * 
 * Constantes y configuraciones centralizadas para el sistema de asistencia.
 * Define estados de turno, tipos de anomalías, plazos y configuraciones globales.
 */

// === ESTADOS DE TURNO ===
export enum ShiftStatus {
  EN_CURSO = 'EN_CURSO',           // Turno activo, dentro del rango horario
  FUTURO = 'FUTURO',               // Turno no ha iniciado, hora actual < hora inicio
  FINALIZADO = 'FINALIZADO',       // Turno concluido, hora actual > hora fin
  NO_AUTORIZADO = 'NO_AUTORIZADO'  // Usuario sin permisos o no asignado
}

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  [ShiftStatus.EN_CURSO]: '🟢 En Curso',
  [ShiftStatus.FUTURO]: '🕒 Próximo',
  [ShiftStatus.FINALIZADO]: '🔴 Finalizado',
  [ShiftStatus.NO_AUTORIZADO]: '⛔ No Autorizado'
};

export const SHIFT_STATUS_DESCRIPTIONS: Record<ShiftStatus, string> = {
  [ShiftStatus.EN_CURSO]: 'El turno está activo. Puedes marcar asistencia.',
  [ShiftStatus.FUTURO]: 'El turno aún no ha iniciado. Espera la hora de inicio.',
  [ShiftStatus.FINALIZADO]: 'El turno ha concluido. No puedes marcar asistencia.',
  [ShiftStatus.NO_AUTORIZADO]: 'No tienes autorización para este turno.'
};

// === TIPOS DE ANOMALÍAS ===
export enum AnomalyType {
  AUSENCIA = 'AUSENCIA',                     // No se registró asistencia
  LLEGADA_TARDE = 'LLEGADA_TARDE',           // Check-in después del horario
  SALIDA_ANTICIPADA = 'SALIDA_ANTICIPADA',   // Check-out antes del horario
  SALIDA_SIN_REGISTRO = 'SALIDA_SIN_REGISTRO' // No registró check-out
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  [AnomalyType.AUSENCIA]: 'Inasistencia',
  [AnomalyType.LLEGADA_TARDE]: 'Llegada Tardía',
  [AnomalyType.SALIDA_ANTICIPADA]: 'Salida Anticipada',
  [AnomalyType.SALIDA_SIN_REGISTRO]: 'Salida sin Registro'
};

export const ANOMALY_TYPE_COLORS: Record<AnomalyType, string> = {
  [AnomalyType.AUSENCIA]: '#EF4444',           // Rojo
  [AnomalyType.LLEGADA_TARDE]: '#F59E0B',      // Amarillo
  [AnomalyType.SALIDA_ANTICIPADA]: '#F97316',  // Naranja
  [AnomalyType.SALIDA_SIN_REGISTRO]: '#8B5CF6' // Púrpura
};

// === PLAZOS Y CONFIGURACIONES ===

/**
 * Plazo en días hábiles para que el empleado subsane un memorando
 * Después de este plazo, el memorando pasa a estado EXPIRADO
 */
export const SUBSANATION_DEADLINE_DAYS = 5;

/**
 * Minutos de tolerancia antes de considerar una llegada como tardía
 * Ejemplo: Si el turno inicia a las 7:00 AM y la tolerancia es 15 minutos,
 * se puede marcar hasta las 7:15 AM sin generar memorando
 */
export const DEFAULT_TOLERANCE_MINUTES = 15;

/**
 * Minutos de tolerancia para la salida anticipada
 * Similar a la llegada, se permite una ventana de tolerancia antes del horario oficial
 */
export const EARLY_DEPARTURE_TOLERANCE_MINUTES = 10;

/**
 * Minutos antes del inicio del turno en que se permite marcar asistencia
 * Ejemplo: Si el turno inicia a las 7:00 AM y el margen es 30 minutos,
 * se puede marcar desde las 6:30 AM
 */
export const CHECK_IN_EARLY_MARGIN_MINUTES = 30;

/**
 * Minutos después del fin del turno en que se permite marcar salida
 * Permite registrar salida aunque el turno haya finalizado oficialmente
 */
export const CHECK_OUT_LATE_MARGIN_MINUTES = 120;

/**
 * Hora del día (en formato 24h) en que se ejecuta el job de verificación de inasistencias
 * Por defecto: 23:00 (11:00 PM)
 */
export const ABSENCE_CHECK_HOUR = 23;
export const ABSENCE_CHECK_MINUTE = 0;

/**
 * Hora del día en que se ejecuta el job de expiración de memorandos
 * Por defecto: 00:30 (12:30 AM)
 */
export const MEMORANDUM_EXPIRY_CHECK_HOUR = 0;
export const MEMORANDUM_EXPIRY_CHECK_MINUTE = 30;

// === CÓDIGOS DE CARGO ESPECIALES ===

/**
 * Códigos de cargo para supernumerarios
 * Estos cargos tienen lógica especial de asignación de horarios
 */
export const SUPERNUMERARY_CARGO_CODES = ['SLS_CHS']; // Chatter Supernumerario

/**
 * Códigos de turnos permitidos para reemplazo por supernumerarios
 */
export const REPLACEMENT_ALLOWED_SHIFT_TYPES = ['AM', 'PM', 'MADRUGADA'];

// === MENSAJES PARA EL USUARIO ===

export const USER_MESSAGES = {
  // Mensajes de error
  SHIFT_NOT_STARTED: 'No puedes marcar asistencia. Tu turno aún no ha iniciado.',
  SHIFT_ENDED: 'No puedes marcar asistencia. Tu turno ya ha finalizado.',
  NOT_AUTHORIZED: 'No estás autorizado para marcar asistencia en este turno.',
  ALREADY_CHECKED_IN: 'Ya has registrado tu entrada para este turno.',
  ALREADY_CHECKED_OUT: 'Ya has registrado tu salida para este turno.',
  NO_CHECK_IN_FOUND: 'Debes registrar tu entrada antes de marcar la salida.',
  
  // Mensajes de advertencia (con anomalía)
  LATE_ARRIVAL_WARNING: (delayMinutes: number, employeeName?: string) => 
    employeeName 
      ? `Estás a punto de reemplazar el cargo de ${employeeName}. Tu turno debió iniciar hace ${delayMinutes} minutos. Esta marcación generará un memorando por tardanza. Si cuentas con una justificación válida, por favor detállala para revisión de tu administrador.`
      : `Estás llegando ${delayMinutes} minutos tarde. Esta marcación generará un memorando por tardanza. Si cuentas con una justificación válida, por favor detállala para revisión de tu administrador.`,
  
  EARLY_DEPARTURE_WARNING: (earlyMinutes: number) =>
    `Estás saliendo ${earlyMinutes} minutos antes del horario programado. Esta marcación generará un memorando por salida anticipada que requiere aprobación de Recursos Humanos.`,
  
  // Mensajes de éxito
  CHECK_IN_SUCCESS: 'Entrada registrada correctamente.',
  CHECK_OUT_SUCCESS: 'Salida registrada correctamente.',
  
  // Mensajes de memorando
  MEMORANDUM_GENERATED: (type: string) => 
    `Se ha generado un memorando por ${type}. Tienes ${SUBSANATION_DEADLINE_DAYS} días hábiles para subsanarlo.`,
  
  MEMORANDUM_SUBSANED: 'Tu justificación ha sido enviada a Recursos Humanos para revisión.',
  MEMORANDUM_APPROVED: 'Tu justificación ha sido aprobada. El memorando no afectará tu registro.',
  MEMORANDUM_REJECTED: 'Tu justificación ha sido rechazada. El memorando quedará registrado como falta.',
  MEMORANDUM_EXPIRED: 'El plazo para subsanar este memorando ha vencido.',
};

// === CONFIGURACIONES DE VALIDACIÓN ===

/**
 * Configuración de validación por tipo de marcación
 */
export const VALIDATION_CONFIG = {
  CHECK_IN: {
    earlyMarginMinutes: CHECK_IN_EARLY_MARGIN_MINUTES,
    toleranceMinutes: DEFAULT_TOLERANCE_MINUTES,
    requireShiftActive: false, // Permite marcar antes del inicio (con margen)
  },
  CHECK_OUT: {
    lateMarginMinutes: CHECK_OUT_LATE_MARGIN_MINUTES,
    toleranceMinutes: EARLY_DEPARTURE_TOLERANCE_MINUTES,
    requireCheckIn: true, // Requiere que exista un check-in previo
  },
  BREAK_START: {
    requireCheckIn: true,
    requireShiftActive: true,
  },
  BREAK_END: {
    requireBreakStart: true,
    requireShiftActive: true,
  },
};

// === FORMATO DE CÓDIGO DE MEMORANDO ===

/**
 * Prefijo para el código de memorando
 * Formato: MEM-YYYY-#### (ej: MEM-2025-0001)
 */
export const MEMORANDUM_CODE_PREFIX = 'MEM';

/**
 * Genera el código de memorando basado en el año y secuencia
 */
export function generateMemorandumCode(year: number, sequence: number): string {
  const paddedSequence = sequence.toString().padStart(4, '0');
  return `${MEMORANDUM_CODE_PREFIX}-${year}-${paddedSequence}`;
}

// === CONFIGURACIÓN DE NOTIFICACIONES ===

export const NOTIFICATION_CONFIG = {
  // Enviar notificación al empleado cuando se genera memorando
  NOTIFY_EMPLOYEE_ON_CREATION: true,
  
  // Enviar notificación a RRHH cuando memorando pasa a revisión
  NOTIFY_RRHH_ON_REVIEW: true,
  
  // Enviar recordatorio al empleado X días antes del vencimiento
  REMINDER_DAYS_BEFORE_EXPIRY: 2,
  
  // Enviar notificación al empleado cuando memorando expira
  NOTIFY_EMPLOYEE_ON_EXPIRY: true,
};

// === TIPOS DE DATOS AUXILIARES ===

export interface ShiftStatusInfo {
  status: ShiftStatus;
  label: string;
  description: string;
  canCheckIn: boolean;
  canCheckOut: boolean;
  currentShift?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  };
  nextShift?: {
    id: string;
    name: string;
    startTime: string;
    startsInMinutes: number;
  };
}

export interface AnomalyDetectionResult {
  hasAnomaly: boolean;
  anomalyType?: AnomalyType;
  details?: {
    expectedTime?: Date;
    actualTime?: Date;
    delayMinutes?: number;
    earlyMinutes?: number;
    message?: string;
  };
}

export interface MemorandumGenerationData {
  type: AnomalyType;
  userId: string;
  empleadoId: string;
  incidentDate: Date;
  expectedTime?: Date;
  actualTime?: Date;
  delayMinutes?: number;
  earlyMinutes?: number;
  shiftId?: string;
  shiftName?: string;
  attendanceRecordId?: string;
  employeeJustification?: string;
}
