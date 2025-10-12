# Integración Frontend - Sistema de Asistencia para Empleados

## 📋 Guía de Integración

Esta guía proporciona ejemplos de cómo integrar los nuevos endpoints de asistencia en el frontend de la aplicación.

---

## 🎨 Componentes React Sugeridos

### 1. Servicio de API (`service-attendance-empleado.ts`)

```typescript
// lib/service-attendance/empleado.ts

export interface MarcacionRequest {
  type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  deviceInfo?: {
    userAgent: string;
    ipAddress?: string;
    platform: string;
  };
}

export interface MarcacionResponse {
  id: string;
  type: string;
  timestamp: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  message: string;
  empleadoNombre: string;
  areaId?: string;
  cargoId?: string;
}

export interface EstadoActual {
  lastRecord: {
    id: string;
    type: string;
    timestamp: string;
    status: string;
    notes?: string;
  } | null;
  nextExpectedType: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END' | null;
  todayRecords: Array<{
    id: string;
    type: string;
    timestamp: string;
    status: string;
  }>;
  summary: any;
  scheduleInfo: any;
  canMarkAttendance: boolean;
  allowedTypes: string[];
}

export class AttendanceEmpleadoService {
  private baseUrl = '/rrhh/attendance/empleado';

  /**
   * Marcar asistencia del empleado autenticado
   */
  async marcarAsistencia(data: MarcacionRequest): Promise<MarcacionResponse> {
    // Agregar información del dispositivo automáticamente
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      ...data.deviceInfo
    };

    // Intentar obtener ubicación si está disponible
    let location = data.location;
    if (!location && navigator.geolocation) {
      try {
        location = await this.getCurrentLocation();
      } catch (error) {
        console.warn('No se pudo obtener la ubicación:', error);
      }
    }

    const response = await fetch(`${this.baseUrl}/marcar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        deviceInfo,
        location
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al marcar asistencia');
    }

    return response.json();
  }

  /**
   * Obtener estado actual de asistencia
   */
  async obtenerEstadoActual(): Promise<EstadoActual> {
    const response = await fetch(`${this.baseUrl}/estado-actual`);
    
    if (!response.ok) {
      throw new Error('Error al obtener estado actual');
    }

    return response.json();
  }

  /**
   * Obtener resumen del día actual
   */
  async obtenerResumenHoy() {
    const response = await fetch(`${this.baseUrl}/mi-resumen`);
    
    if (!response.ok) {
      throw new Error('Error al obtener resumen');
    }

    return response.json();
  }

  /**
   * Obtener resumen de fecha específica
   */
  async obtenerResumen(fecha: string) {
    const response = await fetch(`${this.baseUrl}/mi-resumen/${fecha}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener resumen');
    }

    return response.json();
  }

  /**
   * Obtener registros con filtros
   */
  async obtenerMisRegistros(params?: {
    startDate?: string;
    endDate?: string;
    populate?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.populate) queryParams.append('populate', 'true');

    const response = await fetch(`${this.baseUrl}/mis-registros?${queryParams}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener registros');
    }

    return response.json();
  }

  /**
   * Obtener horario asignado
   */
  async obtenerMiHorario() {
    const response = await fetch(`${this.baseUrl}/mi-horario`);
    
    if (!response.ok) {
      throw new Error('Error al obtener horario');
    }

    return response.json();
  }

  /**
   * Obtener tiempo restante para check-in
   */
  async obtenerTiempoRestante() {
    const response = await fetch(`${this.baseUrl}/tiempo-restante`);
    
    if (!response.ok) {
      throw new Error('Error al obtener tiempo restante');
    }

    return response.json();
  }

  /**
   * Obtener reporte de rango de fechas
   */
  async obtenerMiReporte(startDate: string, endDate: string) {
    const queryParams = new URLSearchParams({ startDate, endDate });
    const response = await fetch(`${this.baseUrl}/mi-reporte?${queryParams}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener reporte');
    }

    return response.json();
  }

  /**
   * Obtener ubicación actual del dispositivo
   */
  private async getCurrentLocation(): Promise<{ latitude: number; longitude: number; address?: string }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no disponible'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  }
}

// Exportar instancia singleton
export const attendanceEmpleadoService = new AttendanceEmpleadoService();
```

---

### 2. Componente de Marcación (`MarcadorAsistencia.tsx`)

```typescript
// components/rrhh/MarcadorAsistencia.tsx
'use client';

import { useState, useEffect } from 'react';
import { attendanceEmpleadoService, EstadoActual } from '@/lib/service-attendance/empleado';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut, Coffee, Play } from 'lucide-react';

export default function MarcadorAsistencia() {
  const [estado, setEstado] = useState<EstadoActual | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horaActual, setHoraActual] = useState(new Date());

  // Actualizar hora cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Cargar estado al montar
  useEffect(() => {
    cargarEstado();
  }, []);

  const cargarEstado = async () => {
    try {
      setLoading(true);
      const data = await attendanceEmpleadoService.obtenerEstadoActual();
      setEstado(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const marcar = async (type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END') => {
    try {
      setLoading(true);
      setError(null);

      const resultado = await attendanceEmpleadoService.marcarAsistencia({ type });
      
      // Mostrar mensaje de éxito
      alert(resultado.message);
      
      // Recargar estado
      await cargarEstado();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTipoLabel = (type: string) => {
    const labels = {
      'CHECK_IN': 'Entrada',
      'CHECK_OUT': 'Salida',
      'BREAK_START': 'Inicio Descanso',
      'BREAK_END': 'Fin Descanso'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTipoIcon = (type: string) => {
    const icons = {
      'CHECK_IN': <LogIn className="w-5 h-5" />,
      'CHECK_OUT': <LogOut className="w-5 h-5" />,
      'BREAK_START': <Coffee className="w-5 h-5" />,
      'BREAK_END': <Play className="w-5 h-5" />
    };
    return icons[type as keyof typeof icons] || null;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
      'PRESENT': 'default',
      'LATE': 'destructive',
      'ABSENT': 'outline',
      'EXCUSED': 'secondary'
    };

    const labels = {
      'PRESENT': 'A Tiempo',
      'LATE': 'Tarde',
      'ABSENT': 'Ausente',
      'EXCUSED': 'Justificado'
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  if (loading && !estado) {
    return <div className="flex justify-center p-8">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Reloj y Fecha */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">
              {horaActual.toLocaleTimeString('es-CO', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
            <div className="text-muted-foreground">
              {horaActual.toLocaleDateString('es-CO', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado Actual */}
      {estado?.lastRecord && (
        <Card>
          <CardHeader>
            <CardTitle>Última Marcación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getTipoIcon(estado.lastRecord.type)}
                <div>
                  <div className="font-medium">{getTipoLabel(estado.lastRecord.type)}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(estado.lastRecord.timestamp).toLocaleTimeString('es-CO')}
                  </div>
                </div>
              </div>
              {getStatusBadge(estado.lastRecord.status)}
            </div>
            {estado.lastRecord.notes && (
              <div className="mt-2 text-sm text-muted-foreground">
                Nota: {estado.lastRecord.notes}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resumen del Día */}
      {estado?.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{estado.summary.totalHours.toFixed(1)}h</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{estado.summary.workedHours.toFixed(1)}h</div>
                <div className="text-sm text-muted-foreground">Trabajadas</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{estado.summary.breakHours.toFixed(1)}h</div>
                <div className="text-sm text-muted-foreground">Descanso</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botones de Acción */}
      <Card>
        <CardHeader>
          <CardTitle>Marcar Asistencia</CardTitle>
          <CardDescription>
            {estado?.nextExpectedType 
              ? `Próxima acción: ${getTipoLabel(estado.nextExpectedType)}`
              : 'No hay acciones disponibles'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {estado?.allowedTypes.includes('CHECK_IN') && (
              <Button
                onClick={() => marcar('CHECK_IN')}
                disabled={loading}
                className="h-20 flex flex-col items-center justify-center"
              >
                <LogIn className="w-6 h-6 mb-1" />
                Entrada
              </Button>
            )}

            {estado?.allowedTypes.includes('BREAK_START') && (
              <Button
                onClick={() => marcar('BREAK_START')}
                disabled={loading}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
              >
                <Coffee className="w-6 h-6 mb-1" />
                Descanso
              </Button>
            )}

            {estado?.allowedTypes.includes('BREAK_END') && (
              <Button
                onClick={() => marcar('BREAK_END')}
                disabled={loading}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
              >
                <Play className="w-6 h-6 mb-1" />
                Continuar
              </Button>
            )}

            {estado?.allowedTypes.includes('CHECK_OUT') && (
              <Button
                onClick={() => marcar('CHECK_OUT')}
                disabled={loading}
                variant="secondary"
                className="h-20 flex flex-col items-center justify-center"
              >
                <LogOut className="w-6 h-6 mb-1" />
                Salida
              </Button>
            )}
          </div>

          {!estado?.canMarkAttendance && (
            <div className="mt-4 p-3 bg-muted rounded-md text-sm text-center text-muted-foreground">
              No puedes marcar asistencia en este momento
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registros del Día */}
      {estado?.todayRecords && estado.todayRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registros de Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {estado.todayRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-2 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    {getTipoIcon(record.type)}
                    <div>
                      <div className="font-medium text-sm">{getTipoLabel(record.type)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(record.timestamp).toLocaleTimeString('es-CO')}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(record.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

### 3. Página de Asistencia (`page.tsx`)

```typescript
// app/(protected)/mi-asistencia/page.tsx
import { Metadata } from 'next';
import MarcadorAsistencia from '@/components/rrhh/MarcadorAsistencia';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MiHorario from '@/components/rrhh/MiHorario';
import MisRegistros from '@/components/rrhh/MisRegistros';
import MiReporte from '@/components/rrhh/MiReporte';

export const metadata: Metadata = {
  title: 'Mi Asistencia | OnlyTop',
  description: 'Marca tu asistencia y consulta tu historial'
};

export default function MiAsistenciaPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mi Asistencia</h1>
        <p className="text-muted-foreground">
          Gestiona tu asistencia diaria y consulta tu historial
        </p>
      </div>

      <Tabs defaultValue="marcar" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="marcar">Marcar</TabsTrigger>
          <TabsTrigger value="horario">Mi Horario</TabsTrigger>
          <TabsTrigger value="registros">Registros</TabsTrigger>
          <TabsTrigger value="reporte">Reporte</TabsTrigger>
        </TabsList>

        <TabsContent value="marcar">
          <MarcadorAsistencia />
        </TabsContent>

        <TabsContent value="horario">
          <MiHorario />
        </TabsContent>

        <TabsContent value="registros">
          <MisRegistros />
        </TabsContent>

        <TabsContent value="reporte">
          <MiReporte />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 📱 Vista Móvil Optimizada

### Componente Simplificado para Móvil

```typescript
// components/rrhh/MarcadorAsistenciaMovil.tsx
'use client';

import { useState, useEffect } from 'react';
import { attendanceEmpleadoService } from '@/lib/service-attendance/empleado';

export default function MarcadorAsistenciaMovil() {
  const [estado, setEstado] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarEstado();
  }, []);

  const cargarEstado = async () => {
    const data = await attendanceEmpleadoService.obtenerEstadoActual();
    setEstado(data);
  };

  const marcarRapido = async (type: string) => {
    setLoading(true);
    try {
      await attendanceEmpleadoService.marcarAsistencia({ type: type as any });
      await cargarEstado();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 safe-area-pb">
      {estado?.allowedTypes.map((type: string) => (
        <button
          key={type}
          onClick={() => marcarRapido(type)}
          disabled={loading}
          className="w-full py-4 bg-primary text-primary-foreground rounded-lg font-semibold mb-2"
        >
          {type === 'CHECK_IN' && '🏢 Entrada'}
          {type === 'CHECK_OUT' && '👋 Salida'}
          {type === 'BREAK_START' && '☕ Descanso'}
          {type === 'BREAK_END' && '▶️ Continuar'}
        </button>
      ))}
    </div>
  );
}
```

---

## 🔔 Notificaciones y Alertas

```typescript
// hooks/useAttendanceReminders.ts
import { useEffect } from 'react';
import { attendanceEmpleadoService } from '@/lib/service-attendance/empleado';

export function useAttendanceReminders() {
  useEffect(() => {
    const checkReminders = async () => {
      try {
        const tiempoRestante = await attendanceEmpleadoService.obtenerTiempoRestante();
        
        if (tiempoRestante && tiempoRestante.isUrgent) {
          // Mostrar notificación
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⏰ Recordatorio de Asistencia', {
              body: `Te quedan ${tiempoRestante.minutesRemaining} minutos para marcar entrada`,
              icon: '/icon-192.png'
            });
          }
        }
      } catch (error) {
        console.error('Error checking reminders:', error);
      }
    };

    // Verificar cada 5 minutos
    const interval = setInterval(checkReminders, 5 * 60 * 1000);
    checkReminders(); // Primera verificación inmediata

    return () => clearInterval(interval);
  }, []);
}
```

---

## 🎯 Best Practices

### 1. Manejo de Errores

```typescript
try {
  await attendanceEmpleadoService.marcarAsistencia({ type: 'CHECK_IN' });
} catch (error: any) {
  if (error.message.includes('CHECK_IN already marked')) {
    // Ya marcó entrada
    toast.info('Ya has marcado tu entrada hoy');
  } else if (error.message.includes('outside allowed working hours')) {
    // Fuera de horario
    toast.error('No puedes marcar asistencia fuera de tu horario laboral');
  } else {
    // Error genérico
    toast.error(error.message);
  }
}
```

### 2. Optimistic Updates

```typescript
const marcarConOptimismo = async (type: string) => {
  // Actualizar UI inmediatamente
  setEstado(prev => ({
    ...prev,
    lastRecord: {
      type,
      timestamp: new Date().toISOString(),
      status: 'PRESENT'
    }
  }));

  try {
    // Hacer la petición
    await attendanceEmpleadoService.marcarAsistencia({ type: type as any });
  } catch (error) {
    // Revertir en caso de error
    await cargarEstado();
    throw error;
  }
};
```

### 3. Caché y Revalidación

```typescript
import { useQuery } from '@tanstack/react-query';

export function useEstadoAsistencia() {
  return useQuery({
    queryKey: ['asistencia', 'estado'],
    queryFn: () => attendanceEmpleadoService.obtenerEstadoActual(),
    refetchInterval: 30000, // Actualizar cada 30 segundos
    staleTime: 10000 // Considerar datos frescos por 10 segundos
  });
}
```

---

## 🧪 Testing

```typescript
// __tests__/MarcadorAsistencia.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MarcadorAsistencia from '@/components/rrhh/MarcadorAsistencia';
import { attendanceEmpleadoService } from '@/lib/service-attendance/empleado';

jest.mock('@/lib/service-attendance/empleado');

describe('MarcadorAsistencia', () => {
  it('debe cargar el estado al montar', async () => {
    (attendanceEmpleadoService.obtenerEstadoActual as jest.Mock).mockResolvedValue({
      canMarkAttendance: true,
      allowedTypes: ['CHECK_IN']
    });

    render(<MarcadorAsistencia />);

    await waitFor(() => {
      expect(screen.getByText('Entrada')).toBeInTheDocument();
    });
  });

  it('debe marcar entrada correctamente', async () => {
    (attendanceEmpleadoService.marcarAsistencia as jest.Mock).mockResolvedValue({
      message: 'Entrada registrada correctamente'
    });

    render(<MarcadorAsistencia />);
    
    const botonEntrada = screen.getByText('Entrada');
    fireEvent.click(botonEntrada);

    await waitFor(() => {
      expect(attendanceEmpleadoService.marcarAsistencia).toHaveBeenCalledWith({
        type: 'CHECK_IN'
      });
    });
  });
});
```

---

## 📚 Recursos Adicionales

- [Documentación API](./ATTENDANCE_EMPLEADO_README.md)
- [Arquitectura del Sistema](./ATTENDANCE_ARCHITECTURE.md)
- [Log de Actualizaciones](./ATTENDANCE_UPDATE_LOG.md)

---

**Última actualización**: 9 de Octubre de 2025  
**Versión**: 2.0.0
