const ENCRYPTION_VERSION = 'e2ee-v1'
const DEFAULT_PBKDF2_ITERATIONS = 250000

export interface DocumentEncryptionMetadata {
  version: typeof ENCRYPTION_VERSION
  algorithm: 'AES-GCM'
  kdf: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  salt: string
  iv: string
  originalMimeType: string
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}


async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const blobWithArrayBuffer = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }
  if (typeof blobWithArrayBuffer.arrayBuffer === 'function') {
    return blobWithArrayBuffer.arrayBuffer()
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'))
      reader.readAsArrayBuffer(blob)
    })
  }

  return new Response(blob).arrayBuffer()
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptDocumentFile(file: File, passphrase: string): Promise<{
  encryptedFile: File
  metadata: DocumentEncryptionMetadata
}> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const iterations = DEFAULT_PBKDF2_ITERATIONS
  const key = await deriveAesKey(passphrase, salt, iterations)

  const plainBuffer = await blobToArrayBuffer(file)
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plainBuffer,
  )

  const encryptedFile = new File([new Uint8Array(cipherBuffer)], 'encrypted.bin', {
    type: 'application/octet-stream',
    lastModified: Date.now(),
  })

  return {
    encryptedFile,
    metadata: {
      version: ENCRYPTION_VERSION,
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: toBase64(salt),
      iv: toBase64(iv),
      originalMimeType: file.type || 'application/octet-stream',
    },
  }
}

export async function decryptDocumentBlob(
  encryptedBlob: Blob,
  passphrase: string,
  metadata: DocumentEncryptionMetadata,
): Promise<Blob> {
  if (metadata.version !== ENCRYPTION_VERSION) {
    throw new Error('Unsupported encryption version')
  }

  const salt = fromBase64(metadata.salt)
  const iv = fromBase64(metadata.iv)
  const key = await deriveAesKey(passphrase, salt, metadata.iterations)

  const encryptedBuffer = await blobToArrayBuffer(encryptedBlob)
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encryptedBuffer,
  )

  return new Blob([new Uint8Array(plainBuffer)], { type: metadata.originalMimeType || 'application/octet-stream' })
}

export function isDocumentEncryptionMetadata(value: unknown): value is DocumentEncryptionMetadata {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DocumentEncryptionMetadata>
  return (
    candidate.version === ENCRYPTION_VERSION &&
    candidate.algorithm === 'AES-GCM' &&
    candidate.kdf === 'PBKDF2' &&
    candidate.hash === 'SHA-256' &&
    typeof candidate.iterations === 'number' &&
    typeof candidate.salt === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.originalMimeType === 'string'
  )
}
