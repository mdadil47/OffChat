import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BleTransport, DiscoveredPeer } from '../services/BleTransport';
import { GattServerBridge } from '../services/GattServerBridge';
import { requestBlePermissions } from '../services/permissions';
import { OffchatMessage, createMessage } from '../types/Message';
import { WirePayload } from '../types/Wire';
import { haptics } from '../services/haptics';
import {
  generateKeyPair,
  deriveSharedKey,
  publicKeyToBase64,
  base64ToPublicKey,
  encrypt,
  decrypt,
} from '../services/crypto';

const MY_DEVICE_ID = `me-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const NICKNAME_KEY = 'offchat_nickname';
const DEFAULT_NICKNAME = 'Offchat-Device';
const MAX_HOPS = 5;
const SEEN_CACHE_LIMIT = 500;

interface ChatContextValue {
  myDeviceId: string;
  peers: DiscoveredPeer[];
  connectedPeerId: string | null;
  messages: OffchatMessage[];
  isScanning: boolean;
  isAdvertising: boolean;
  isTogglingAdvertising: boolean;
  isSecure: boolean;
  nickname: string;
  setNickname: (name: string) => Promise<void>;
  startScan: () => void;
  stopScan: () => void;
  connectTo: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleAdvertising: () => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  sendReaction: (messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (messageId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const transportRef = useRef<BleTransport>(new BleTransport());
  const keyPairRef = useRef(generateKeyPair());

  // Per-connection state, keyed by deviceId — this is the core of mesh support.
  const sharedKeysRef = useRef<Map<string, Uint8Array>>(new Map());
  const centralDeviceIdsRef = useRef<Set<string>>(new Set()); // we connected out to these
  const peripheralDeviceIdsRef = useRef<Set<string>>(new Set()); // these connected in to us
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const nicknameRef = useRef(DEFAULT_NICKNAME);

  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);
  const [secureDeviceIds, setSecureDeviceIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<OffchatMessage[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [isTogglingAdvertising, setIsTogglingAdvertising] = useState(false);
  const [nicknameState, setNicknameState] = useState(DEFAULT_NICKNAME);

  useEffect(() => {
    AsyncStorage.getItem(NICKNAME_KEY)
      .then((stored) => {
        if (stored) {
          setNicknameState(stored);
          nicknameRef.current = stored;
        }
      })
      .catch((e) => console.warn('Failed to load nickname', e));
  }, []);

  const setNickname = useCallback(async (name: string) => {
    const trimmed = name.trim() || DEFAULT_NICKNAME;
    nicknameRef.current = trimmed;
    setNicknameState(trimmed);
    try {
      await AsyncStorage.setItem(NICKNAME_KEY, trimmed);
    } catch (e) {
      console.warn('Failed to save nickname', e);
    }
  }, []);

  /** Sends a wire payload to one specific device, regardless of which role (central/peripheral) that connection is. */
  const sendTo = useCallback(async (deviceId: string, payload: WirePayload) => {
    if (centralDeviceIdsRef.current.has(deviceId)) {
      await transportRef.current.send(deviceId, payload);
    } else if (peripheralDeviceIdsRef.current.has(deviceId)) {
      await GattServerBridge.notifyMessage(deviceId, JSON.stringify(payload));
    } else {
      throw new Error(`No active connection to ${deviceId}`);
    }
  }, []);

  const markSeen = (messageId: string): boolean => {
    if (seenMessageIdsRef.current.has(messageId)) return true;
    seenMessageIdsRef.current.add(messageId);
    if (seenMessageIdsRef.current.size > SEEN_CACHE_LIMIT) {
      const first = seenMessageIdsRef.current.values().next().value;
      if (first) seenMessageIdsRef.current.delete(first);
    }
    return false;
  };

  /** Re-encrypts a plaintext string for every other connected device and forwards it, for relay/flood. */
  const relayToOthers = useCallback(
    async (plaintext: string, receivedFromDeviceId: string, route: string[], baseType: 'chat' | 'reaction') => {
      const allDeviceIds = new Set([
        ...centralDeviceIdsRef.current,
        ...peripheralDeviceIdsRef.current,
      ]);
      const forwardTargets = Array.from(allDeviceIds).filter(
        (id) => id !== receivedFromDeviceId && !route.includes(id) && sharedKeysRef.current.has(id),
      );

      await Promise.all(
        forwardTargets.map(async (targetId) => {
          const key = sharedKeysRef.current.get(targetId)!;
          const encrypted = encrypt(plaintext, key);
          const payload: WirePayload = { type: baseType, nonce: encrypted.nonce, ciphertext: encrypted.ciphertext };
          try {
            await sendTo(targetId, payload);
          } catch (e) {
            console.warn(`Relay forward to ${targetId} failed`, e);
          }
        }),
      );
    },
    [sendTo],
  );

  const handleIncomingPayload = useCallback(
    (fromDeviceId: string, payload: WirePayload) => {
      if (payload.type === 'handshake') {
        const theirPublicKey = base64ToPublicKey(payload.publicKey);
        const shared = deriveSharedKey(theirPublicKey, keyPairRef.current.secretKey);
        sharedKeysRef.current.set(fromDeviceId, shared);
        setSecureDeviceIds((prev) => new Set(prev).add(fromDeviceId));
        haptics.success();

        // Reply with our own public key so the other side can derive the same shared secret,
        // if they haven't already sent theirs proactively (peripheral side does this).
        sendTo(fromDeviceId, {
          type: 'handshake',
          publicKey: publicKeyToBase64(keyPairRef.current.publicKey),
        }).catch((e) => console.warn('Handshake reply failed (may already be sent)', e));
        return;
      }

      const key = sharedKeysRef.current.get(fromDeviceId);
      if (!key) {
        console.warn(`Received ${payload.type} before handshake with ${fromDeviceId} — dropping.`);
        return;
      }

      if (payload.type === 'chat') {
        const plaintext = decrypt({ nonce: payload.nonce, ciphertext: payload.ciphertext }, key);
        if (plaintext === null) {
          console.warn('Failed to decrypt incoming message.');
          return;
        }
        let msg: OffchatMessage;
        try {
          msg = JSON.parse(plaintext);
        } catch (e) {
          console.warn('Decrypted chat payload was invalid', e);
          return;
        }

        if (markSeen(msg.id)) return; // already processed this message, avoid loops/duplicates

        if (msg.recipientId === MY_DEVICE_ID) {
          setMessages((prev) => [...prev, { ...msg, status: 'delivered' }]);
        } else if (msg.ttl > 1) {
          const newRoute = [...msg.route, MY_DEVICE_ID];
          const forwarded: OffchatMessage = { ...msg, ttl: msg.ttl - 1, hopCount: msg.hopCount + 1, route: newRoute };
          relayToOthers(JSON.stringify(forwarded), fromDeviceId, newRoute, 'chat');
        }
        return;
      }

      if (payload.type === 'reaction') {
        const plaintext = decrypt({ nonce: payload.nonce, ciphertext: payload.ciphertext }, key);
        if (plaintext === null) return;
        try {
          const reactionData = JSON.parse(plaintext) as {
            messageId: string;
            emoji: string;
            targetDeviceId?: string;
            route?: string[];
          };
          const route = reactionData.route ?? [];
          const reactionId = `reaction-${reactionData.messageId}-${reactionData.emoji}`;
          if (markSeen(reactionId)) return;

          if (!reactionData.targetDeviceId || reactionData.targetDeviceId === MY_DEVICE_ID) {
            setMessages((prev) =>
              prev.map((m) => (m.id === reactionData.messageId ? { ...m, reaction: reactionData.emoji } : m)),
            );
          } else {
            const newRoute = [...route, MY_DEVICE_ID];
            relayToOthers(
              JSON.stringify({ ...reactionData, route: newRoute }),
              fromDeviceId,
              newRoute,
              'reaction',
            );
          }
        } catch (e) {
          console.warn('Decrypted reaction payload was invalid', e);
        }
      }
    },
    [relayToOthers, sendTo],
  );

  useEffect(() => {
    const unsubscribe = GattServerBridge.onMessageReceived((raw) => {
      handleIncomingPayload(raw.deviceId, JSON.parse(raw.payload));
    });
    return unsubscribe;
  }, [handleIncomingPayload]);

  useEffect(() => {
    const unsubscribe = GattServerBridge.onPeripheralConnectionChanged((event) => {
      if (event.connected) {
        peripheralDeviceIdsRef.current.add(event.deviceId);
        setConnectedPeerId((prev) => prev ?? event.deviceId);
      } else {
        peripheralDeviceIdsRef.current.delete(event.deviceId);
        sharedKeysRef.current.delete(event.deviceId);
        setSecureDeviceIds((prev) => {
          const next = new Set(prev);
          next.delete(event.deviceId);
          return next;
        });
        setConnectedPeerId((prev) => (prev === event.deviceId ? null : prev));
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

  const toggleAdvertising = useCallback(async () => {
    setIsTogglingAdvertising(true);
    const startedAt = Date.now();
    const MIN_VISIBLE_MS = 500;

    try {
      if (isAdvertising) {
        await GattServerBridge.stopAdvertising();
        setIsAdvertising(false);
        stopScan();
        setPeers([]);
      } else {
        const granted = await requestBlePermissions();
        if (!granted) return;
        await GattServerBridge.startAdvertising(nicknameRef.current);
        setIsAdvertising(true);
        startScan();
      }
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = MIN_VISIBLE_MS - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setIsTogglingAdvertising(false);
    }
  }, [isAdvertising, startScan, stopScan]);

  const connectTo = useCallback(
    async (deviceId: string) => {
      stopScan();
      await transportRef.current.connect(deviceId, handleIncomingPayload);
      centralDeviceIdsRef.current.add(deviceId);
      setConnectedPeerId(deviceId);
      await sendTo(deviceId, {
        type: 'handshake',
        publicKey: publicKeyToBase64(keyPairRef.current.publicKey),
      });
    },
    [stopScan, handleIncomingPayload, sendTo],
  );

  const disconnect = useCallback(async () => {
    if (connectedPeerId) {
      await transportRef.current.disconnect(connectedPeerId);
      centralDeviceIdsRef.current.delete(connectedPeerId);
      sharedKeysRef.current.delete(connectedPeerId);
      setSecureDeviceIds((prev) => {
        const next = new Set(prev);
        next.delete(connectedPeerId);
        return next;
      });
    }
    setConnectedPeerId(null);
  }, [connectedPeerId]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!connectedPeerId || !sharedKeysRef.current.has(connectedPeerId)) {
        throw new Error('Cannot send: no secure connection to the active peer.');
      }
      const msg = createMessage(MY_DEVICE_ID, connectedPeerId, body);
      msg.ttl = MAX_HOPS; // allow relaying, unlike the original direct-only prototype
      setMessages((prev) => [...prev, msg]);
      markSeen(msg.id); // don't relay our own message back to ourselves if it loops around

      try {
        const key = sharedKeysRef.current.get(connectedPeerId)!;
        const encrypted = encrypt(JSON.stringify(msg), key);
        const payload: WirePayload = { type: 'chat', nonce: encrypted.nonce, ciphertext: encrypted.ciphertext };
        await sendTo(connectedPeerId, payload);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'sent' } : m)));
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed' } : m)));
        throw e;
      }
    },
    [connectedPeerId, sendTo],
  );

  const sendReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!connectedPeerId || !sharedKeysRef.current.has(connectedPeerId)) return;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reaction: emoji } : m)));
      try {
        const key = sharedKeysRef.current.get(connectedPeerId)!;
        const reactionData = { messageId, emoji, targetDeviceId: undefined, route: [MY_DEVICE_ID] };
        const encrypted = encrypt(JSON.stringify(reactionData), key);
        const payload: WirePayload = { type: 'reaction', nonce: encrypted.nonce, ciphertext: encrypted.ciphertext };
        await sendTo(connectedPeerId, payload);
      } catch (e) {
        console.warn('Failed to send reaction', e);
      }
    },
    [connectedPeerId, sendTo],
  );

  const deleteMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const isSecure = connectedPeerId ? secureDeviceIds.has(connectedPeerId) : false;

  const value = useMemo(
    () => ({
      myDeviceId: MY_DEVICE_ID,
      peers,
      connectedPeerId,
      messages,
      isScanning,
      isAdvertising,
      isTogglingAdvertising,
      isSecure,
      nickname: nicknameState,
      setNickname,
      startScan,
      stopScan,
      connectTo,
      disconnect,
      toggleAdvertising,
      sendMessage,
      sendReaction,
      deleteMessage,
    }),
    [
      peers,
      connectedPeerId,
      messages,
      isScanning,
      isAdvertising,
      isTogglingAdvertising,
      isSecure,
      nicknameState,
      setNickname,
      startScan,
      stopScan,
      connectTo,
      disconnect,
      toggleAdvertising,
      sendMessage,
      sendReaction,
      deleteMessage,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}