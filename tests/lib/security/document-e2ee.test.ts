import { describe, expect, it } from 'vitest'
import {
  decryptDocumentBlob,
  encryptDocumentFile,
  isDocumentEncryptionMetadata,
} from '@/lib/security/document-e2ee'

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read blob'))
    reader.readAsText(blob)
  })
}

describe('document-e2ee', () => {
  it('encrypts and decrypts file content with same passphrase', async () => {
    const file = new File([new TextEncoder().encode('hello geheim')], 'secret.txt', {
      type: 'text/plain',
    })

    const { encryptedFile, metadata } = await encryptDocumentFile(file, 'test-passphrase')

    expect(encryptedFile.type).toBe('application/octet-stream')
    expect(metadata.originalMimeType).toBe('text/plain')
    expect(isDocumentEncryptionMetadata(metadata)).toBe(true)

    const decrypted = await decryptDocumentBlob(encryptedFile, 'test-passphrase', metadata)
    const text = await readBlobAsText(decrypted)

    expect(text).toBe('hello geheim')
  })

  it('fails decryption with wrong passphrase', async () => {
    const file = new File([new TextEncoder().encode('top secret')], 'secret.txt', {
      type: 'text/plain',
    })

    const { encryptedFile, metadata } = await encryptDocumentFile(file, 'correct')

    await expect(decryptDocumentBlob(encryptedFile, 'wrong', metadata)).rejects.toThrow()
  })
})
