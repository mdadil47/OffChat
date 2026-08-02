import { NativeEventEmitter, NativeModules } from 'react-native';

const { OffchatGattServer } = NativeModules;
const emitter = new NativeEventEmitter(OffchatGattServer);

export interface IncomingRawMessage {
  payload: string; // JSON string — same shape as OffchatMessage, parse it at the call site
}

export interface PeripheralConnectionEvent {
  deviceId: string;
  connected: boolean;
}

export const GattServerBridge = {
  startAdvertising(deviceName: string): Promise<boolean> {
    return OffchatGattServer.startAdvertising(deviceName);
  },

  stopAdvertising(): Promise<boolean> {
    return OffchatGattServer.stopAdvertising();
  },

  /** Sends a message out to whichever central is currently connected to us. */
  notifyMessage(payloadJson: string): Promise<boolean> {
    return OffchatGattServer.notifyMessage(payloadJson);
  },

  /** Subscribe to incoming writes from a connected central. Returns an unsubscribe function. */
  onMessageReceived(callback: (raw: IncomingRawMessage) => void): () => void {
    const sub = emitter.addListener('OffchatMessageReceived', callback);
    return () => sub.remove();
  },

  /** Fires when a central device connects to or disconnects from us (we're the peripheral). */
  onPeripheralConnectionChanged(callback: (event: PeripheralConnectionEvent) => void): () => void {
    const sub = emitter.addListener('OffchatPeripheralConnectionChanged', callback);
    return () => sub.remove();
  },
};