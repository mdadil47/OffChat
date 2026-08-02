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

export class BleTransport {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private notifySub: Subscription | null = null;

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

  /** Connects to a peer and subscribes to incoming wire payloads (handshake or encrypted chat). */
  async connect(
    deviceId: string,
    onPayload: (payload: WirePayload) => void,
  ): Promise<void> {
    const device = await this.manager.connectToDevice(deviceId, { autoConnect: false });
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;

    this.notifySub = device.monitorCharacteristicForService(
      OFFCHAT_SERVICE_UUID,
      MESSAGE_NOTIFY_CHAR_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        try {
          const json = Buffer.from(characteristic.value, 'base64').toString('utf8');
          const payload: WirePayload = JSON.parse(json);
          onPayload(payload);
        } catch (e) {
          console.warn('Failed to parse incoming wire payload', e);
        }
      },
    );
  }

  async disconnect(): Promise<void> {
    this.notifySub?.remove();
    this.notifySub = null;
    if (this.connectedDevice) {
      await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      this.connectedDevice = null;
    }
  }

  /** Sends any wire payload (handshake or encrypted chat) to the connected peer. */
  async send(payload: WirePayload): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No connected peer to send to.');
    }
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    await this.manager.writeCharacteristicWithResponseForDevice(
      this.connectedDevice.id,
      OFFCHAT_SERVICE_UUID,
      MESSAGE_WRITE_CHAR_UUID,
      encoded,
    );
  }

  destroy(): void {
    this.notifySub?.remove();
    this.manager.destroy();
  }
}