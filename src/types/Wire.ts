export interface HandshakePayload {
  type: 'handshake';
  publicKey: string; // base64
}

export interface EncryptedChatPayload {
  type: 'chat';
  nonce: string;
  ciphertext: string;
}

export type WirePayload = HandshakePayload | EncryptedChatPayload;