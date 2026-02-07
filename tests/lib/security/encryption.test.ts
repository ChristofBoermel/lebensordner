import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'crypto'
import {
  encrypt,
  decrypt,
  validateEncryptionKey,
  getEncryptionKey,
  resetKeyValidationCache,
} from '@/lib/security/encryption'

const TEST_KEY = crypto.randomBytes(32).toString('hex')

describe('encryption', () => {
  beforeEach(() => {
    resetKeyValidationCache()
  })

  describe('encrypt and decrypt round-trip', () => {
    it('should encrypt and decrypt ASCII text', () => {
      const plaintext = 'Hello, World!'
      const encrypted = encrypt(plaintext, TEST_KEY)
      const decrypted = decrypt(encrypted, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })

    it('should encrypt and decrypt UTF-8 text', () => {
      const plaintext = 'Ärzte, Über, Straße, 日本語, 中文'
      const encrypted = encrypt(plaintext, TEST_KEY)
      const decrypted = decrypt(encrypted, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })

    it('should encrypt and decrypt special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\\n\t'
      const encrypted = encrypt(plaintext, TEST_KEY)
      const decrypted = decrypt(encrypted, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })

    it('should encrypt and decrypt empty string', () => {
      const plaintext = ''
      const encrypted = encrypt(plaintext, TEST_KEY)
      const decrypted = decrypt(encrypted, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })

    it('should encrypt and decrypt long text', () => {
      const plaintext = 'A'.repeat(10000)
      const encrypted = encrypt(plaintext, TEST_KEY)
      const decrypted = decrypt(encrypted, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })
  })

  describe('encrypt', () => {
    it('should generate different IVs for same plaintext', () => {
      const plaintext = 'Same text'
      const encrypted1 = encrypt(plaintext, TEST_KEY)
      const encrypted2 = encrypt(plaintext, TEST_KEY)
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
    })

    it('should return iv, authTag, and ciphertext as base64', () => {
      const encrypted = encrypt('test', TEST_KEY)
      expect(encrypted).toHaveProperty('iv')
      expect(encrypted).toHaveProperty('authTag')
      expect(encrypted).toHaveProperty('ciphertext')
      // Check base64 format
      expect(() => Buffer.from(encrypted.iv, 'base64')).not.toThrow()
      expect(() => Buffer.from(encrypted.authTag, 'base64')).not.toThrow()
      expect(() => Buffer.from(encrypted.ciphertext, 'base64')).not.toThrow()
    })
  })

  describe('decrypt', () => {
    it('should throw error when auth tag is tampered', () => {
      const encrypted = encrypt('test data', TEST_KEY)
      const tamperedAuthTag = Buffer.from(encrypted.authTag, 'base64')
      tamperedAuthTag[0] ^= 0xff
      encrypted.authTag = tamperedAuthTag.toString('base64')

      expect(() => decrypt(encrypted, TEST_KEY)).toThrow()
    })

    it('should throw error when ciphertext is modified', () => {
      const encrypted = encrypt('test data', TEST_KEY)
      const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64')
      tamperedCiphertext[0] ^= 0xff
      encrypted.ciphertext = tamperedCiphertext.toString('base64')

      expect(() => decrypt(encrypted, TEST_KEY)).toThrow()
    })

    it('should throw error with wrong key', () => {
      const encrypted = encrypt('test data', TEST_KEY)
      const wrongKey = crypto.randomBytes(32).toString('hex')

      expect(() => decrypt(encrypted, wrongKey)).toThrow()
    })
  })

  describe('validateEncryptionKey', () => {
    it('should throw when key is missing', () => {
      const original = process.env.ENCRYPTION_KEY
      delete process.env.ENCRYPTION_KEY
      expect(() => validateEncryptionKey()).toThrow('ENCRYPTION_KEY environment variable is not set')
      process.env.ENCRYPTION_KEY = original
    })

    it('should throw when key is wrong length', () => {
      const original = process.env.ENCRYPTION_KEY
      process.env.ENCRYPTION_KEY = 'tooshort'
      expect(() => validateEncryptionKey()).toThrow('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
      process.env.ENCRYPTION_KEY = original
    })

    it('should throw when key contains non-hex characters', () => {
      const original = process.env.ENCRYPTION_KEY
      process.env.ENCRYPTION_KEY = 'g'.repeat(64)
      expect(() => validateEncryptionKey()).toThrow('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
      process.env.ENCRYPTION_KEY = original
    })

    it('should succeed with valid 64-char hex key', () => {
      const original = process.env.ENCRYPTION_KEY
      process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
      expect(() => validateEncryptionKey()).not.toThrow()
      process.env.ENCRYPTION_KEY = original
    })
  })

  describe('getEncryptionKey', () => {
    it('should return the encryption key', () => {
      const key = getEncryptionKey()
      expect(key).toBe(process.env.ENCRYPTION_KEY)
    })

    it('should cache validation result', () => {
      const key1 = getEncryptionKey()
      const key2 = getEncryptionKey()
      expect(key1).toBe(key2)
    })
  })
})
