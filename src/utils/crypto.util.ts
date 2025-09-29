import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.CRYPTO_SECRET_KEY || 'default-secret-key-change-in-production-32-chars';

// Derivar clave de 32 bytes (AES-256)
const KEY = crypto.scryptSync(SECRET_KEY, 'salt', 32);
// Para GCM, un IV de 12 bytes es recomendado por NIST
const IV_LENGTH = 12;
const AAD = Buffer.from('onlytop-email-config');

export function encryptString(text: string): string {
  if (!text) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  cipher.setAAD(AAD);

  const encryptedBuf = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Formato: iv.encrypted.authTag (hex)
  return `${iv.toString('hex')}.${encryptedBuf.toString('hex')}.${authTag.toString('hex')}`;
}

export function decryptString(encryptedText: string): string {
  if (!encryptedText) return '';

  try {
    const parts = encryptedText.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const [ivHex, encryptedHex, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedBuf = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(authTag);

    const decryptedBuf = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
    return decryptedBuf.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function maskSecret(text: string, visibleChars: number = 4): string {
  if (!text || text.length <= visibleChars) {
    return '********';
  }
  
  const visible = text.slice(-visibleChars);
  const masked = '*'.repeat(Math.max(8, text.length - visibleChars));
  return `${masked}${visible}`;
}

export function isEncrypted(text: string): boolean {
  return typeof text === 'string' && text.split('.').length === 3;
}
