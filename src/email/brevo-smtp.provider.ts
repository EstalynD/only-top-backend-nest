import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface BrevoConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  fromName?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  // Permitir certificados autofirmados (solo para entornos de desarrollo)
  allowSelfSigned?: boolean;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: any[];
}

@Injectable()
export class BrevoSmtpProvider {
  private readonly logger = new Logger(BrevoSmtpProvider.name);

  createTransporter(config: BrevoConfig): Transporter {
    const host = config.host || 'smtp-relay.brevo.com';
    const port = Number(config.port || 587);
    const secure = Boolean(config.secure || false);
    const { user, pass } = config.auth;

    if (!user || !pass) {
      throw new Error('Brevo SMTP auth incompleto: user/pass requerido');
    }

    const transporterConfig: any = {
      host,
      port,
      secure,
      auth: { user, pass },
    };

    // TLS: permitir certificados autofirmados bajo bandera explícita/env (desarrollo)
    const envReject =
      process.env.SMTP_TLS_REJECT_UNAUTHORIZED ?? process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '';
    const envAllowSelfSigned =
      process.env.SMTP_ALLOW_SELF_SIGNED ?? process.env.ALLOW_SELF_SIGNED ?? '';

    const shouldAllowSelfSigned =
      Boolean(config.allowSelfSigned) ||
      ['0', 'false', 'no'].includes(envReject.toLowerCase()) ||
      ['1', 'true', 'yes'].includes(envAllowSelfSigned.toLowerCase());

    if (shouldAllowSelfSigned) {
      transporterConfig.tls = { ...(transporterConfig.tls || {}), rejectUnauthorized: false };
      this.logger.warn(
        'TLS verification disabled (self-signed allowed). Use ONLY in development environments.'
      );
    }

    return nodemailer.createTransport(transporterConfig);
  }

  async verify(config: BrevoConfig): Promise<{ ok: boolean; error?: string }> {
    try {
      const transporter = this.createTransporter(config);
      await transporter.verify();
      return { ok: true };
    } catch (error) {
      this.logger.error('Brevo verify error', error);
      const message = (error as any)?.message || '';
      const code = (error as any)?.code || '';

      // Reintento controlado si es error por certificado autofirmado y aún no se permitía
      const isSelfSigned =
        code === 'ESOCKET' ||
        message.toLowerCase().includes('self-signed certificate') ||
        message.toLowerCase().includes('certificate chain');

      if (isSelfSigned && !config.allowSelfSigned) {
        this.logger.warn('Retrying verify with allowSelfSigned=true');
        try {
          const retryTransporter = this.createTransporter({ ...config, allowSelfSigned: true });
          await retryTransporter.verify();
          return { ok: true };
        } catch (retryErr: any) {
          this.logger.error('Brevo verify retry failed', retryErr);
          return { ok: false, error: retryErr?.message || String(retryErr) };
        }
      }

      return { ok: false, error: message };
    }
  }

  async sendEmail(config: BrevoConfig, message: EmailMessage): Promise<{ id: string; response: string }> {
    const transporter = this.createTransporter(config);
    
    const fromEmail = message.from || config.from;
    const fromName = message.fromName || config.fromName;
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    const replyTo = message.replyTo || config.replyTo;
    
    const headers = {
      ...config.headers,
      ...message.headers,
    };

    const mailOptions = {
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
      ...(replyTo ? { replyTo } : {}),
      ...(Object.keys(headers || {}).length ? { headers } : {}),
      envelope: {
        from: fromEmail,
        to: Array.isArray(message.to) ? message.to : [message.to],
      },
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      return { 
        id: info.messageId, 
        response: info.response 
      };
    } catch (error) {
      this.logger.error('Email send error', error);

      // Reintento si es certificado autofirmado
      const messageErr = (error as any)?.message || '';
      const code = (error as any)?.code || '';
      const isSelfSigned =
        code === 'ESOCKET' ||
        messageErr.toLowerCase().includes('self-signed certificate') ||
        messageErr.toLowerCase().includes('certificate chain');

      if (isSelfSigned && !config.allowSelfSigned) {
        this.logger.warn('Retrying sendMail with allowSelfSigned=true');
        const retryTransporter = this.createTransporter({ ...config, allowSelfSigned: true });
        const info = await retryTransporter.sendMail(mailOptions);
        return { id: info.messageId, response: info.response };
      }

      throw new Error(`Failed to send email: ${messageErr}`);
    }
  }
}
