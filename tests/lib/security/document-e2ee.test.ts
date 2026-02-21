import { describe, expect, it } from 'vitest'
import {
  generateDEK,
  encryptFile,
  decryptFile,
  encryptField,
  decryptField,
  deriveMasterKey,
  wrapKey,
  unwrapKey,
  generateRecoveryKey,
  toBase64,
  fromBase64,
} from '@/lib/security/document-e2ee'

describe('document-e2ee Phase 1', () => {
  it('generateDEK returns a CryptoKey', async () => {
    const dek = await generateDEK()
    expect(dek instanceof CryptoKey).toBe(true)
    expect(dek.algorithm.name).toBe('AES-GCM')
    expect(dek.extractable).toBe(true)
  })

  it('encryptFile + decryptFile roundtrip', async () => {
    const dek = await generateDEK()
    const bytes = new Uint8Array(256)
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = i % 256
    }
    const { ciphertext, iv } = await encryptFile(bytes.buffer, dek)
    const plaintext = await decryptFile(ciphertext, dek, iv)
    const result = new Uint8Array(plaintext)
    expect(result.length).toBe(bytes.length)
    for (let i = 0; i < bytes.length; i += 1) {
      expect(result[i]).toBe(bytes[i])
    }
  })

  it('encryptField + decryptField roundtrip', async () => {
    const dek = await generateDEK()
    const encoded = await encryptField('Hallo Welt', dek)
    const plain = await decryptField(encoded, dek)
    expect(plain).toBe('Hallo Welt')
  })

  it('wrapKey + unwrapKey DEK roundtrip', async () => {
    const dek = await generateDEK()
    const salt = new Uint8Array(32)
    const params = { iterations: 1000, hash: 'SHA-256' }
    const masterKey = await deriveMasterKey('passphrase', salt, params)
    const wrapped = await wrapKey(dek, masterKey)
    const unwrapped = await unwrapKey(wrapped, masterKey, 'AES-GCM')

    const bytes = new Uint8Array(128)
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = (i * 7) % 256
    }
    const encrypted = await encryptFile(bytes.buffer, dek)
    const decrypted = await decryptFile(encrypted.ciphertext, unwrapped, encrypted.iv)
    const result = new Uint8Array(decrypted)
    for (let i = 0; i < bytes.length; i += 1) {
      expect(result[i]).toBe(bytes[i])
    }
  })

  it('tampered ciphertext throws on decryptFile', async () => {
    const dek = await generateDEK()
    const data = new Uint8Array(64)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = i
    }
    const { ciphertext, iv } = await encryptFile(data.buffer, dek)
    const tampered = new Uint8Array(ciphertext.slice(0))
    tampered[0] ^= 0xff
    await expect(decryptFile(tampered.buffer, dek, iv)).rejects.toThrow()
  })

  it('different calls produce different IVs', async () => {
    const dek = await generateDEK()
    const data = new Uint8Array([1, 2, 3, 4]).buffer
    const first = await encryptFile(data, dek)
    const second = await encryptFile(data, dek)
    expect(first.iv).not.toBe(second.iv)
  })

  it('AAD binding: decryptFile fails with different AAD', async () => {
    const dek = await generateDEK()
    const data = new Uint8Array([5, 6, 7, 8]).buffer
    const aad1 = new TextEncoder().encode('doc-id-1')
    const aad2 = new TextEncoder().encode('doc-id-2')
    const encrypted = await encryptFile(data, dek, undefined, aad1)
    await expect(decryptFile(encrypted.ciphertext, dek, encrypted.iv, aad2)).rejects.toThrow()
  })

  it('generateRecoveryKey returns 64-char hex', async () => {
    const key = await generateRecoveryKey()
    expect(key).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true)
  })

  it('deriveMasterKey same inputs → wrap/unwrap works', async () => {
    const dek = await generateDEK()
    const salt = new Uint8Array(32)
    const params = { iterations: 1000, hash: 'SHA-256' }
    const masterKey1 = await deriveMasterKey('passphrase', salt, params)
    const masterKey2 = await deriveMasterKey('passphrase', salt, params)
    const wrapped = await wrapKey(dek, masterKey1)
    const unwrapped = await unwrapKey(wrapped, masterKey2, 'AES-GCM')

    const payload = new Uint8Array(96)
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] = (i * 13) % 256
    }
    const encrypted = await encryptFile(payload.buffer, dek)
    const decrypted = await decryptFile(encrypted.ciphertext, unwrapped, encrypted.iv)
    const result = new Uint8Array(decrypted)
    for (let i = 0; i < payload.length; i += 1) {
      expect(result[i]).toBe(payload[i])
    }
  })
})
