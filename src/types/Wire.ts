export interface HandshakePayload {
  type: 'handshake';
  publicKey: string;
}

export interface EncryptedChatPayload {
  type: 'chat';
  nonce: string;
  ciphertext: string;
}

export interface EncryptedReactionPayload {
  type: 'reaction';
  nonce: string;
  ciphertext: string;
}

export type WirePayload = HandshakePayload | EncryptedChatPayload | EncryptedReactionPayload;