import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BleTransport, DiscoveredPeer } from '../services/BleTransport';
import { GattServerBridge } from '../services/GattServerBridge';
import { requestBlePermissions } from '../services/permissions';
import { OffchatMessage, createMessage } from '../types/Message';
import { WirePayload } from '../types/Wire';
import {
  generateKeyPair,
  deriveSharedKey,
  publicKeyToBase64,
  base64ToPublicKey,
  encrypt,
  decrypt,
} from '../services/crypto';

const MY_DEVICE_ID = `me-${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface ChatContextValue {
  myDeviceId: string;
  peers: DiscoveredPeer[];
  connectedPeerId: string | null;
  messages: OffchatMessage[];
  isScanning: boolean;
  isAdvertising: boolean;
  isSecure: boolean; // true once the encryption handshake has completed
  startScan: () => void;
  stopScan: () => void;
  connectTo: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  startAdvertising: () => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const transportRef = useRef<BleTransport>(new BleTransport());
  const keyPairRef = useRef(generateKeyPair()); // fresh per app session
  const sharedKeyRef = useRef<Uint8Array | null>(null);

  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OffchatMessage[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [isSecure, setIsSecure] = useState(false);

  // Central-role send path (we connected out to someone)
  const sendWireCentral = useCallback((payload: WirePayload) => transportRef.current.send(payload), []);
  // Peripheral-role send path (someone connected to us)
  const sendWirePeripheral = useCallback(
    (payload: WirePayload) => GattServerBridge.notifyMessage(JSON.stringify(payload)),
    [],
  );

  /** Shared handler for any incoming wire payload, regardless of which BLE role received it. */
  const handleIncomingPayload = useCallback(
    (payload: WirePayload, replyVia: (p: WirePayload) => Promise<any>) => {
      if (payload.type === 'handshake') {
        const theirPublicKey = base64ToPublicKey(payload.publicKey);
        sharedKeyRef.current = deriveSharedKey(theirPublicKey, keyPairRef.current.secretKey);
        setIsSecure(true);

        // If we haven't already sent our own handshake on this connection
        // (e.g. we're the peripheral, who doesn't proactively initiate),
        // reply with ours so both sides derive the same shared key.
        replyVia({ type: 'handshake', publicKey: publicKeyToBase64(keyPairRef.current.publicKey) }).catch(
          (e) => console.warn('Handshake reply failed (may already be sent)', e),
        );
        return;
      }

      if (payload.type === 'chat') {
        if (!sharedKeyRef.current) {
          console.warn('Received chat payload before handshake completed — dropping.');
          return;
        }
        const plaintext = decrypt(
          { nonce: payload.nonce, ciphertext: payload.ciphertext },
          sharedKeyRef.current,
        );
        if (plaintext === null) {
          console.warn('Failed to decrypt incoming message (wrong key or tampered data).');
          return;
        }
        try {
          const msg: OffchatMessage = JSON.parse(plaintext);
          setMessages((prev) => [...prev, { ...msg, status: 'delivered' }]);
        } catch (e) {
          console.warn('Decrypted payload was not a valid message', e);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = GattServerBridge.onMessageReceived((raw) => {
      try {
        const payload: WirePayload = JSON.parse(raw.payload);
        handleIncomingPayload(payload, sendWirePeripheral);
      } catch (e) {
        console.warn('Failed to parse peripheral-received payload', e);
      }
    });
    return unsubscribe;
  }, [handleIncomingPayload, sendWirePeripheral]);

  useEffect(() => {
    const unsubscribe = GattServerBridge.onPeripheralConnectionChanged((event) => {
      if (event.connected) {
        setConnectedPeerId(event.deviceId);
        sharedKeyRef.current = null; // fresh handshake required per new connection
        setIsSecure(false);
      } else {
        setConnectedPeerId((prev) => (prev === event.deviceId ? null : prev));
        sharedKeyRef.current = null;
        setIsSecure(false);
      }
    });
    return unsubscribe;
  }, []);

  const startScan = useCallback(async () => {
    const granted = await requestBlePermissions();
    if (!granted) return;
    await transportRef.current.ensureReady();
    setPeers([]);
    setIsScanning(true);
    transportRef.current.startScan(
      (peer) => {
        setPeers((prev) => (prev.find((p) => p.id === peer.id) ? prev : [...prev, peer]));
      },
      (_err) => setIsScanning(false),
    );
  }, []);

  const stopScan = useCallback(() => {
    transportRef.current.stopScan();
    setIsScanning(false);
  }, []);

  const startAdvertising = useCallback(async () => {
    const granted = await requestBlePermissions();
    if (!granted) return;
    await GattServerBridge.startAdvertising('Offchat-Device');
    setIsAdvertising(true);
  }, []);

  const connectTo = useCallback(
    async (deviceId: string) => {
      stopScan();
      sharedKeyRef.current = null;
      setIsSecure(false);
      await transportRef.current.connect(deviceId, (payload) => {
        handleIncomingPayload(payload, sendWireCentral);
      });
      setConnectedPeerId(deviceId);

      // As the central (the one who connected out), we initiate the handshake.
      await sendWireCentral({
        type: 'handshake',
        publicKey: publicKeyToBase64(keyPairRef.current.publicKey),
      });
    },
    [stopScan, handleIncomingPayload, sendWireCentral],
  );

  const disconnect = useCallback(async () => {
    await transportRef.current.disconnect();
    setConnectedPeerId(null);
    sharedKeyRef.current = null;
    setIsSecure(false);
  }, []);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!sharedKeyRef.current) {
        throw new Error('Cannot send: secure handshake not yet complete.');
      }
      const recipientId = connectedPeerId ?? 'unknown-peer';
      const msg = createMessage(MY_DEVICE_ID, recipientId, body);
      setMessages((prev) => [...prev, msg]);

      try {
        const encrypted = encrypt(JSON.stringify(msg), sharedKeyRef.current);
        const payload: WirePayload = { type: 'chat', nonce: encrypted.nonce, ciphertext: encrypted.ciphertext };

        // Try whichever role applies — same central/peripheral ambiguity as before.
        if (connectedPeerId) {
          await sendWireCentral(payload);
        } else {
          await sendWirePeripheral(payload);
        }
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'sent' } : m)));
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed' } : m)));
        throw e;
      }
    },
    [connectedPeerId, sendWireCentral, sendWirePeripheral],
  );

  const value = useMemo(
    () => ({
      myDeviceId: MY_DEVICE_ID,
      peers,
      connectedPeerId,
      messages,
      isScanning,
      isAdvertising,
      isSecure,
      startScan,
      stopScan,
      connectTo,
      disconnect,
      startAdvertising,
      sendMessage,
    }),
    [peers, connectedPeerId, messages, isScanning, isAdvertising, isSecure, startScan, stopScan, connectTo, disconnect, startAdvertising, sendMessage],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}