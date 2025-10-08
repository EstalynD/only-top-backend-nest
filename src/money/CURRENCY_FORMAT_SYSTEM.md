# Sistema de Formato de Monedas Dinámico

## 📚 Descripción General

El sistema ahora usa **configuración dinámica desde la base de datos** para formatear monedas. Esto permite a los administradores personalizar cómo se muestran los valores monetarios sin cambiar código.

## 🏗️ Arquitectura

```
┌─────────────────────┐
│  CurrencyEntity     │  ← BD: Configuración por moneda
│  (MongoDB)          │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ CurrencyConfigService│  ← Caché en memoria
│  - Carga al inicio  │
│  - Refresca manual  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   MoneyService      │  ← Usa config dinámica
│  - formatForUser()  │
│  - toDatabase()     │
│  - fromDatabase()   │
└─────────────────────┘
```

## 🔧 Configuración en Base de Datos

### Ejemplo: USD con CODE_SYMBOL
```json
{
  "code": "USD",
  "symbol": "$",
  "minimumFractionDigits": 2,
  "maximumFractionDigits": 2,
  "displayFormat": "CODE_SYMBOL",
  "isActive": true
}
```

**Resultado**: `USD $ 3,000,000.25`

### Ejemplo: COP sin decimales
```json
{
  "code": "COP",
  "symbol": "$",
  "minimumFractionDigits": 0,
  "maximumFractionDigits": 0,
  "displayFormat": "CODE_SYMBOL",
  "isActive": true
}
```

**Resultado**: `COP $ 3.000.000`

## 📊 Display Formats

| Format | Descripción | Ejemplo |
|--------|-------------|---------|
| `SYMBOL_ONLY` | Solo símbolo | `$ 3,000,000.25` |
| `CODE_SYMBOL` | Código + símbolo | `USD $ 3,000,000.25` |
| `CODE_ONLY` | Solo código | `USD 3,000,000.25` |

## 💻 Uso en Código

### Backend (NestJS)

```typescript
import { MoneyService } from './money/money.service.js';

@Injectable()
export class MiServicio {
  constructor(private readonly moneyService: MoneyService) {}

  async ejemplo() {
    // Formatear (usa config de BD automáticamente)
    const formatted = this.moneyService.formatForUser(3000000.25, 'USD');
    // Resultado: "USD $ 3,000,000.25" (según config en BD)

    // Guardar en BD
    const dbValue = this.moneyService.toDatabase(3000000.25, 'USD');
    // dbValue = 300000025000n (BigInt)

    // Leer de BD
    const value = this.moneyService.fromDatabase(300000025000n);
    // value = 3000000.25
  }
}
```

### Frontend (React/Next.js)

El frontend recibe los valores ya formateados del backend:

```typescript
interface BankOnlyTop {
  dineroConsolidadoUSD: number;           // 3000000.25
  dineroConsolidadoFormateado: string;    // "USD $ 3,000,000.25"
  dineroMovimientoUSD: number;
  dineroMovimientoFormateado: string;
  totalUSD: number;
  totalFormateado: string;
}

// Usar valores formateados
<p>{bank.dineroConsolidadoFormateado}</p>
```

## 🔄 Refrescar Caché

Si actualizas la configuración de monedas en la BD, refresca el caché:

```typescript
import { CurrencyConfigService } from './money/currency-config.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly currencyConfig: CurrencyConfigService) {}

  async actualizarConfigMoneda() {
    // Actualizar en BD...
    
    // Refrescar caché
    await this.currencyConfig.refreshCache();
  }
}
```

O reinicia el servidor (el caché se carga automáticamente al iniciar).

## 🎯 Ventajas del Sistema

1. **✅ Configuración sin código**: Administradores pueden cambiar formato desde BD
2. **✅ Performance**: Caché en memoria evita consultas repetitivas
3. **✅ Consistencia**: Todos los servicios usan la misma config
4. **✅ Flexibilidad**: Soporta múltiples monedas con diferentes formatos
5. **✅ Fallback**: Si falla BD, usa configuración por defecto

## 📝 Ejemplos de Formato

### USD (2 decimales, CODE_SYMBOL)
```
Entrada: 3000000.25
Salida: USD $ 3,000,000.25
```

### COP (0 decimales, CODE_SYMBOL)
```
Entrada: 3000000.25
Salida: COP $ 3.000.000
```

### USD (2 decimales, SYMBOL_ONLY)
```
Entrada: 1500
Salida: $ 1,500.00
```

## ⚠️ Notas Importantes

1. **Almacenamiento**: Valores se guardan como `BigInt` escalados (5 decimales de precisión)
2. **Display**: Formato de presentación se controla desde BD
3. **Decimales**: `minimumFractionDigits` y `maximumFractionDigits` controlan precisión visual
4. **Separadores**: Sistema detecta automáticamente según código de moneda

## 🔍 Troubleshooting

### Problema: Formato no cambia después de actualizar BD
**Solución**: Reinicia el servidor o llama a `currencyConfig.refreshCache()`

### Problema: Muestra formato por defecto
**Solución**: Verifica que `isActive: true` en la BD y que el código de moneda coincida

### Problema: Decimales incorrectos
**Solución**: Revisa `minimumFractionDigits` y `maximumFractionDigits` en BD
