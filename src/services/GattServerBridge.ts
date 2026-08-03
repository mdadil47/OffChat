import { NativeEventEmitter, NativeModules } from 'react-native';

const { OffchatGattServer } = NativeModules;
const emitter = new NativeEventEmitter(OffchatGattServer);

export interface IncomingRawMessage {
  deviceId: string;
  payload: string;
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

  notifyMessage(deviceId: string, payloadJson: string): Promise<boolean> {
    return OffchatGattServer.notifyMessage(deviceId, payloadJson);
  },

  onMessageReceived(callback: (raw: IncomingRawMessage) => void): () => void {
    const sub = emitter.addListener('OffchatMessageReceived', callback);
    return () => sub.remove();
  },

  onPeripheralConnectionChanged(callback: (event: PeripheralConnectionEvent) => void): () => void {
    const sub = emitter.addListener('OffchatPeripheralConnectionChanged', callback);
    return () => sub.remove();
  },
};