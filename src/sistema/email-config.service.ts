import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailConfigEntity } from './email-config.schema.js';
import { BrevoSmtpProvider, type BrevoConfig, type EmailMessage } from '../email/brevo-smtp.provider.js';
import { encryptString, decryptString, maskSecret, isEncrypted } from '../utils/crypto.util.js';

const EMAIL_KEY = 'system.email';

export interface EmailConfigDto {
  provider?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  authUser?: string;
  authPass?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  enabled?: boolean;
  headers?: Record<string, string>;
}

export interface EmailConfigResponse {
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  authPass: string; // This will be masked in responses
  from: string;
  fromName?: string;
  replyTo?: string;
  enabled: boolean;
  headers?: Record<string, string>;
}

@Injectable()
export class EmailConfigService {
  private readonly logger = new Logger(EmailConfigService.name);

  constructor(
    @InjectModel(EmailConfigEntity.name) private readonly emailConfigModel: Model<EmailConfigEntity>,
    private readonly brevoProvider: BrevoSmtpProvider,
  ) {}

  private async getRawConfig(): Promise<EmailConfigEntity | null> {
    return this.emailConfigModel.findOne({ key: EMAIL_KEY }).lean();
  }

  private redactConfig(config: EmailConfigEntity): EmailConfigResponse {
    return {
      provider: config.provider,
      host: config.host,
      port: config.port,
      secure: config.secure,
      authUser: config.authUser,
      authPass: maskSecret(config.authPassEncrypted),
      from: config.from,
      fromName: config.fromName,
      replyTo: config.replyTo,
      enabled: config.enabled,
      headers: config.headers,
    };
  }

  private async getDecryptedConfig(): Promise<BrevoConfig | null> {
    const config = await this.getRawConfig();
    if (!config) return null;

    try {
      const decryptedPass = decryptString(config.authPassEncrypted);
      return {
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.authUser,
          pass: decryptedPass,
        },
        from: config.from,
        fromName: config.fromName,
        replyTo: config.replyTo,
        headers: config.headers,
      };
    } catch (error) {
      this.logger.error('Failed to decrypt email config', error);
      throw new Error('Failed to decrypt email configuration');
    }
  }

  async getRedactedConfig(): Promise<EmailConfigResponse | null> {
    const config = await this.getRawConfig();
    if (!config) return null;
    return this.redactConfig(config);
  }

  async saveConfig(patch: EmailConfigDto, updatedBy?: string): Promise<EmailConfigResponse> {
    const current = await this.getRawConfig();
    
    // Validate required fields for new configurations
    const authUser = patch.authUser || current?.authUser;
    const authPass = patch.authPass;
    const from = patch.from || current?.from;

    if (!authUser) {
      throw new Error('Usuario SMTP (login) requerido');
    }

    if (!from) {
      throw new Error('Remitente "from" requerido (debe ser un remitente verificado en Brevo)');
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(from)) {
      throw new Error('El campo "from" debe ser un email válido');
    }

    // Handle password encryption
    let encryptedPass = current?.authPassEncrypted;
    
    if (authPass) {
      // Check if password is masked (user didn't change it)
      const isMasked = typeof authPass === 'string' && /^\*+/.test(authPass.trim());
      
      if (!isMasked) {
        // New password provided, encrypt it
        if (!isEncrypted(authPass)) {
          encryptedPass = encryptString(authPass);
        } else {
          encryptedPass = authPass; // Already encrypted
        }
      }
      // If masked, keep current encrypted password
    } else if (!current?.authPassEncrypted) {
      throw new Error('Password/SMTP key requerido');
    }

    const configData: Partial<EmailConfigEntity> = {
      key: EMAIL_KEY,
      provider: patch.provider || current?.provider || 'brevo-smtp',
      host: patch.host || current?.host || 'smtp-relay.brevo.com',
      port: patch.port || current?.port || 587,
      secure: patch.secure !== undefined ? patch.secure : (current?.secure || false),
      authUser,
      authPassEncrypted: encryptedPass!,
      from,
      fromName: patch.fromName !== undefined ? patch.fromName : current?.fromName,
      replyTo: patch.replyTo !== undefined ? patch.replyTo : current?.replyTo,
      enabled: patch.enabled !== undefined ? patch.enabled : (current?.enabled || false),
      headers: patch.headers || current?.headers || {},
      updatedBy,
    };

    const updated = await this.emailConfigModel.findOneAndUpdate(
      { key: EMAIL_KEY },
      configData,
      { new: true, upsert: true }
    );

    return this.redactConfig(updated);
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.getRawConfig();
    return Boolean(config?.enabled);
  }

  async setEnabled(enabled: boolean, updatedBy?: string): Promise<boolean> {
    const updated = await this.emailConfigModel.findOneAndUpdate(
      { key: EMAIL_KEY },
      { enabled: Boolean(enabled), updatedBy },
      { new: true, upsert: false }
    );

    if (!updated) {
      throw new Error('Email configuration not found. Please configure email settings first.');
    }

    return Boolean(updated.enabled);
  }

  async verifyConfig(): Promise<{ ok: boolean; error?: string }> {
    const config = await this.getDecryptedConfig();
    if (!config) {
      return { ok: false, error: 'Config no encontrada' };
    }

    return this.brevoProvider.verify(config);
  }

  async sendEmail(message: EmailMessage): Promise<{ id: string; response: string }> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new Error('Email está deshabilitado');
    }

    const config = await this.getDecryptedConfig();
    if (!config) {
      throw new Error('Config no encontrada');
    }

    return this.brevoProvider.sendEmail(config, message);
  }

  async testEmail(testTo: string): Promise<{ id: string; response: string }> {
    const message: EmailMessage = {
      to: testTo,
      subject: 'Test Email - OnlyTop System',
      text: 'Este es un email de prueba del sistema OnlyTop.',
      html: `
        <h2>Test Email</h2>
        <p>Este es un email de prueba del sistema OnlyTop.</p>
        <p>Si recibes este mensaje, la configuración de email está funcionando correctamente.</p>
        <hr>
        <small>Enviado desde OnlyTop System</small>
      `,
    };

    return this.sendEmail(message);
  }
}
