import crypto from 'crypto'

// --- Interfaces ---

export interface EncryptedData {
  iv: string
  authTag: string
  ciphertext: string
}

// --- Validation cache ---

let keyValidated = false

// --- Functions ---

export function encrypt(plaintext: string, key: string): EncryptedData {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)

  const encrypted = cipher.update(plaintext, 'utf8', 'base64') + cipher.final('base64')
  const authTag = cipher.getAuthTag()

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted,
  }
}

export function decrypt(encrypted: EncryptedData, key: string): string {
  const iv = Buffer.from(encrypted.iv, 'base64')
  const authTag = Buffer.from(encrypted.authTag, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)

  decipher.setAuthTag(authTag)

  const decrypted = decipher.update(encrypted.ciphertext, 'base64', 'utf8') + decipher.final('utf8')
  return decrypted
}

export function validateEncryptionKey(): void {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
}

export function getEncryptionKey(): string {
  if (!keyValidated) {
    validateEncryptionKey()
    keyValidated = true
  }
  return process.env.ENCRYPTION_KEY!
}

/**
 * Reset the validation cache. Useful for testing.
 */
export function resetKeyValidationCache(): void {
  keyValidated = false
}
