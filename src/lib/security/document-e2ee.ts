export const toBase64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const fromBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const generateDEK = async (): Promise<CryptoKey> =>
  globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);

export const encryptFile = async (
  buffer: ArrayBuffer | ArrayBufferView,
  dek: CryptoKey,
  iv?: Uint8Array,
  aad?: Uint8Array,
): Promise<{ ciphertext: ArrayBuffer; iv: string }> => {
  const actualIv = iv ?? globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const params: AesGcmParams = {
    name: "AES-GCM",
    iv: actualIv as Uint8Array<ArrayBuffer>,
  };
  if (aad) {
    params.additionalData = aad as Uint8Array<ArrayBuffer>;
  }
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    params,
    dek,
    data,
  );
  return {
    ciphertext,
    iv: toBase64(actualIv),
  };
};

export const decryptFile = async (
  ciphertext: ArrayBuffer,
  dek: CryptoKey,
  iv: string,
  aad?: Uint8Array,
): Promise<ArrayBuffer> => {
  const ivBytes = fromBase64(iv);
  const params: AesGcmParams = {
    name: "AES-GCM",
    iv: ivBytes as Uint8Array<ArrayBuffer>,
  };
  if (aad) {
    params.additionalData = aad as Uint8Array<ArrayBuffer>;
  }
  return globalThis.crypto.subtle.decrypt(params, dek, ciphertext);
};

export const encryptField = async (
  value: string,
  dek: CryptoKey,
  aad?: Uint8Array,
): Promise<string> => {
  const plaintext = new TextEncoder().encode(value);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const params: AesGcmParams = {
    name: "AES-GCM",
    iv: iv as Uint8Array<ArrayBuffer>,
  };
  if (aad) {
    params.additionalData = aad as Uint8Array<ArrayBuffer>;
  }
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    params,
    dek,
    plaintext,
  );
  const payload = JSON.stringify({
    iv: toBase64(iv),
    ct: toBase64(ciphertext),
  });
  return toBase64(new TextEncoder().encode(payload));
};

export const decryptField = async (
  encoded: string,
  dek: CryptoKey,
  aad?: Uint8Array,
): Promise<string> => {
  const payloadBytes = fromBase64(encoded);
  const payloadText = new TextDecoder().decode(payloadBytes);
  const payload = JSON.parse(payloadText) as { iv: string; ct: string };
  const iv = fromBase64(payload.iv);
  const params: AesGcmParams = {
    name: "AES-GCM",
    iv: iv as Uint8Array<ArrayBuffer>,
  };
  if (aad) {
    params.additionalData = aad as Uint8Array<ArrayBuffer>;
  }
  const plaintext = await globalThis.crypto.subtle.decrypt(
    params,
    dek,
    fromBase64(payload.ct),
  );
  return new TextDecoder().decode(plaintext);
};

export const deriveMasterKey = async (
  passphrase: string,
  salt: Uint8Array,
  params: { iterations: number; hash: string },
): Promise<CryptoKey> => {
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: params.iterations,
      hash: params.hash,
    },
    baseKey,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
};

export const wrapKey = async (
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<string> => {
  const wrapped = await globalThis.crypto.subtle.wrapKey(
    "raw",
    keyToWrap,
    wrappingKey,
    { name: "AES-KW" },
  );
  return toBase64(wrapped);
};

export const unwrapKey = async (
  wrapped: string,
  wrappingKey: CryptoKey,
  targetAlg: "AES-GCM" | "AES-KW",
): Promise<CryptoKey> => {
  const wrappedBytes = fromBase64(wrapped);
  const algorithm =
    targetAlg === "AES-GCM"
      ? { name: "AES-GCM", length: 256 }
      : { name: "AES-KW", length: 256 };
  const usages: KeyUsage[] =
    targetAlg === "AES-GCM" ? ["encrypt", "decrypt"] : ["wrapKey", "unwrapKey"];

  return globalThis.crypto.subtle.unwrapKey(
    "raw",
    wrappedBytes,
    wrappingKey,
    { name: "AES-KW" },
    algorithm,
    true,
    usages,
  );
};

export const generateRecoveryKey = async (): Promise<string> => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const generateRelationshipKey = async (): Promise<string> => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const importRawHexKey = async (
  hex: string,
  usage: KeyUsage[],
): Promise<CryptoKey> => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return globalThis.crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-KW", length: 256 },
    true,
    usage,
  );
};
