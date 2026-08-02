import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/** Generates a fresh X25519 key pair for this session. */
export function generateKeyPair(): KeyPair {
  return nacl.box.keyPair();
}

/** Derives a shared secret from our private key and their public key (X25519 ECDH). */
export function deriveSharedKey(theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array {
  return nacl.box.before(theirPublicKey, mySecretKey);
}

export function publicKeyToBase64(key: Uint8Array): string {
  return encodeBase64(key);
}

export function base64ToPublicKey(b64: string): Uint8Array {
  return decodeBase64(b64);
}

export interface EncryptedPayload {
  nonce: string;      // base64
  ciphertext: string; // base64
}

/** Encrypts a plaintext string using the shared secret. Generates a fresh random nonce each call. */
export function encrypt(plaintext: string, sharedKey: Uint8Array): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = new TextEncoder().encode(plaintext);
  const box = nacl.secretbox(messageBytes, nonce, sharedKey);
  return {
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(box),
  };
}

/** Decrypts a payload using the shared secret. Returns null if decryption fails (wrong key, tampered data). */
export function decrypt(payload: EncryptedPayload, sharedKey: Uint8Array): string | null {
  const nonce = decodeBase64(payload.nonce);
  const box = decodeBase64(payload.ciphertext);
  const opened = nacl.secretbox.open(box, nonce, sharedKey);
  if (!opened) return null;
  return new TextDecoder().decode(opened);
}