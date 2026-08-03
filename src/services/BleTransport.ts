import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { WirePayload } from '../types/Wire';

export const OFFCHAT_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const MESSAGE_WRITE_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const MESSAGE_NOTIFY_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export interface DiscoveredPeer {
  id: string;
  name: string;
  rssi: number | null;
}

interface ActiveConnection {
  device: Device;
  notifySub: Subscription;
}

export class BleTransport {
  private manager: BleManager;
  private connections: Map<string, ActiveConnection> = new Map();

  constructor() {
    this.manager = new BleManager();
  }

  async ensureReady(): Promise<void> {
    const state = await this.manager.state();
    if (state !== 'PoweredOn') {
      console.warn(`Bluetooth not ready (state: ${state}).`);
    }
  }

  startScan(
    onPeerFound: (peer: DiscoveredPeer) => void,
    onError: (error: Error) => void,
  ): void {
    this.manager.startDeviceScan(
      [OFFCHAT_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device: Device | null) => {
        if (error) {
          onError(error);
          return;
        }
        if (device) {
          onPeerFound({
            id: device.id,
            name: device.name ?? device.localName ?? 'Unknown device',
            rssi: device.rssi,
          });
        }
      },
    );
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  /** Connects to a peer (in addition to any existing connections) and subscribes to its notify characteristic. */
  async connect(
    deviceId: string,
    onPayload: (fromDeviceId: string, payload: WirePayload) => void,
  ): Promise<void> {
    if (this.connections.has(deviceId)) return; // already connected

    const device = await this.manager.connectToDevice(deviceId, { autoConnect: false });
    await device.discoverAllServicesAndCharacteristics();

    const notifySub = device.monitorCharacteristicForService(
      OFFCHAT_SERVICE_UUID,
      MESSAGE_NOTIFY_CHAR_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        try {
          const json = Buffer.from(characteristic.value, 'base64').toString('utf8');
          const payload: WirePayload = JSON.parse(json);
          onPayload(deviceId, payload);
        } catch (e) {
          console.warn('Failed to parse incoming wire payload', e);
        }
      },
    );

    this.connections.set(deviceId, { device, notifySub });
  }

  async disconnect(deviceId: string): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (!conn) return;
    conn.notifySub.remove();
    await this.manager.cancelDeviceConnection(deviceId).catch(() => {});
    this.connections.delete(deviceId);
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(Array.from(this.connections.keys()).map((id) => this.disconnect(id)));
  }

  getConnectedDeviceIds(): string[] {
    return Array.from(this.connections.keys());
  }

  async send(deviceId: string, payload: WirePayload): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (!conn) {
      throw new Error(`Not connected to ${deviceId}`);
    }
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    await this.manager.writeCharacteristicWithResponseForDevice(
      deviceId,
      OFFCHAT_SERVICE_UUID,
      MESSAGE_WRITE_CHAR_UUID,
      encoded,
    );
  }

  destroy(): void {
    this.connections.forEach((conn) => conn.notifySub.remove());
    this.manager.destroy();
  }
}