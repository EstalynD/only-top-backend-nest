import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Servicio para generar y validar tokens de acceso temporal a estados de cuenta
 * 
 * Funcionalidades:
 * - Genera tokens únicos con expiración para acceso público a PDFs
 * - Valida tokens y extrae información del payload
 * - No requiere autenticación del usuario (acceso vía email)
 * 
 * Arquitectura:
 * - Usa HMAC-SHA256 para firmar tokens (sin dependencia de JWT)
 * - Token formato: base64(payload + timestamp + signature)
 * - Expira después de 7 días por defecto
 * 
 * @author OnlyTop Development Team
 * @version 1.0.0
 * @since 2025
 */

export interface TokenPayload {
  modeloId: string;
  facturaId?: string;
  tipo: 'ESTADO_CUENTA' | 'FACTURA_INDIVIDUAL';
  email: string;
  generadoEn: number; // timestamp
  expiraEn: number; // timestamp
}

export interface GenerateTokenOptions {
  modeloId: string;
  facturaId?: string;
  tipo?: 'ESTADO_CUENTA' | 'FACTURA_INDIVIDUAL';
  email: string;
  expiresInDays?: number;
}

@Injectable()
export class CarteraTokenService {
  private readonly logger = new Logger(CarteraTokenService.name);
  private readonly SECRET_KEY: string;
  private readonly DEFAULT_EXPIRATION_DAYS = 7;

  constructor(private readonly configService: ConfigService) {
    // Obtener secret key del .env o generar una temporal (no recomendado para producción)
    this.SECRET_KEY = 
      this.configService.get('CARTERA_TOKEN_SECRET') || 
      this.configService.get('JWT_SECRET') || 
      'onlytop-cartera-default-secret-change-in-production';

    if (this.SECRET_KEY.includes('default')) {
      this.logger.warn(
        '⚠️  Usando SECRET_KEY por defecto. Configura CARTERA_TOKEN_SECRET en .env para producción.'
      );
    }
  }

  /**
   * Genera un token de acceso temporal
   * 
   * @param options Opciones del token
   * @returns Token firmado en formato base64url
   */
  generateToken(options: GenerateTokenOptions): string {
    const now = Date.now();
    const expiresIn = (options.expiresInDays || this.DEFAULT_EXPIRATION_DAYS) * 24 * 60 * 60 * 1000;

    const payload: TokenPayload = {
      modeloId: options.modeloId,
      facturaId: options.facturaId,
      tipo: options.tipo || 'ESTADO_CUENTA',
      email: options.email.toLowerCase().trim(),
      generadoEn: now,
      expiraEn: now + expiresIn,
    };

    // Serializar payload
    const payloadString = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadString).toString('base64url');

    // Generar firma HMAC
    const signature = this.generateSignature(payloadBase64);

    // Combinar payload + signature
    const token = `${payloadBase64}.${signature}`;

    this.logger.debug(`Token generado para ${options.email} - Expira: ${new Date(payload.expiraEn).toISOString()}`);

    return token;
  }

  /**
   * Valida un token y retorna su payload
   * 
   * @param token Token a validar
   * @returns Payload del token si es válido
   * @throws UnauthorizedException si el token es inválido o expiró
   */
  validateToken(token: string): TokenPayload {
    try {
      // Separar payload y signature
      const parts = token.split('.');
      if (parts.length !== 2) {
        throw new Error('Formato de token inválido');
      }

      const [payloadBase64, signature] = parts;

      // Verificar firma
      const expectedSignature = this.generateSignature(payloadBase64);
      if (signature !== expectedSignature) {
        throw new Error('Firma de token inválida');
      }

      // Decodificar payload
      const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
      const payload: TokenPayload = JSON.parse(payloadString);

      // Verificar expiración
      const now = Date.now();
      if (now > payload.expiraEn) {
        throw new Error('Token expirado');
      }

      this.logger.debug(`Token válido para modelo ${payload.modeloId} - Email: ${payload.email}`);

      return payload;
    } catch (error: any) {
      this.logger.warn(`Token inválido: ${error.message}`);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  /**
   * Verifica si un token ha expirado (sin lanzar excepción)
   * 
   * @param token Token a verificar
   * @returns true si expiró, false si aún es válido
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = this.validateToken(token);
      return false; // Si validateToken no lanza error, no está expirado
    } catch (error) {
      return true;
    }
  }

  /**
   * Extrae el payload sin validar (útil para logging/debugging)
   * NO usar para autenticación, solo para información
   * 
   * @param token Token del que extraer payload
   * @returns Payload o null si el formato es inválido
   */
  decodeTokenUnsafe(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return null;

      const payloadString = Buffer.from(parts[0], 'base64url').toString('utf-8');
      return JSON.parse(payloadString);
    } catch (error) {
      return null;
    }
  }

  /**
   * Genera firma HMAC-SHA256 para un payload
   */
  private generateSignature(payload: string): string {
    const hmac = crypto.createHmac('sha256', this.SECRET_KEY);
    hmac.update(payload);
    return hmac.digest('base64url');
  }

  /**
   * Genera una URL completa para acceder al estado de cuenta
   * 
   * @param token Token generado
   * @returns URL completa con token
   */
  generateEstadoCuentaUrl(token: string): string {
    const apiUrl = this.configService.get('API_URL') || this.configService.get('BACKEND_URL') || 'http://localhost:3041';
    return `${apiUrl}/api/cartera/estado-cuenta/token/${token}/pdf`;
  }

  /**
   * Genera una URL completa para ver una factura individual
   * 
   * @param token Token generado
   * @returns URL completa con token
   */
  generateFacturaUrl(token: string): string {
    const apiUrl = this.configService.get('API_URL') || this.configService.get('BACKEND_URL') || 'http://localhost:3041';
    return `${apiUrl}/api/cartera/factura/token/${token}/pdf`;
  }
}
