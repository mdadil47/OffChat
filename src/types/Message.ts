export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface OffchatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: number;
  status: MessageStatus;
  reaction?: string;

  // Mesh-ready fields — not used yet in direct 1-to-1 mode, but having
  // them here now means we won't need to reformat messages later when
  // we add relay support.
  ttl: number;        // hops remaining before a relaying device should drop it
  hopCount: number;   // how many devices have relayed this so far
  route: string[];    // device ids already passed through, to prevent loops
}

export function createMessage(
  senderId: string,
  recipientId: string,
  body: string,
): OffchatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    senderId,
    recipientId,
    body,
    createdAt: Date.now(),
    status: 'sending',
    ttl: 1,
    hopCount: 0,
    route: [senderId],
  };
}