package com.offchatapp

import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID

class GattServerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val SERVICE_UUID = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e")
    private val WRITE_CHAR_UUID = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e")
    private val NOTIFY_CHAR_UUID = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e")

    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var notifyChar: BluetoothGattCharacteristic? = null
    private var connectedDevice: BluetoothDevice? = null

    override fun getName() = "OffchatGattServer"

    @ReactMethod
    fun startAdvertising(deviceName: String, promise: Promise) {
        try {
            val btManager = reactApplicationContext
                .getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
            val adapter = btManager.adapter
            adapter.name = deviceName

            val service = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)

            val writeChar = BluetoothGattCharacteristic(
                WRITE_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE
            )

            notifyChar = BluetoothGattCharacteristic(
                NOTIFY_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ
            )
            val cccd = BluetoothGattDescriptor(
                UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"),
                BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE
            )
            notifyChar?.addDescriptor(cccd)

            service.addCharacteristic(writeChar)
            service.addCharacteristic(notifyChar)

            gattServer = btManager.openGattServer(reactApplicationContext, object : BluetoothGattServerCallback() {

                override fun onConnectionStateChange(device: BluetoothDevice?, status: Int, newState: Int) {
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        connectedDevice = device
                        val params = Arguments.createMap().apply {
                            putString("deviceId", device?.address ?: "unknown")
                            putBoolean("connected", true)
                        }
                        reactApplicationContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("OffchatPeripheralConnectionChanged", params)
                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        connectedDevice = null
                        val params = Arguments.createMap().apply {
                            putString("deviceId", device?.address ?: "unknown")
                            putBoolean("connected", false)
                        }
                        reactApplicationContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("OffchatPeripheralConnectionChanged", params)
                    }
                }

                override fun onCharacteristicWriteRequest(
                    device: BluetoothDevice?, requestId: Int,
                    characteristic: BluetoothGattCharacteristic?,
                    preparedWrite: Boolean, responseNeeded: Boolean,
                    offset: Int, value: ByteArray?
                ) {
                    if (characteristic?.uuid == WRITE_CHAR_UUID && value != null) {
                        val json = String(value, Charsets.UTF_8)
                        val params = Arguments.createMap().apply { putString("payload", json) }
                        reactApplicationContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("OffchatMessageReceived", params)
                    }
                    if (responseNeeded) {
                        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
                    }
                }

                override fun onDescriptorWriteRequest(
                    device: BluetoothDevice?, requestId: Int,
                    descriptor: BluetoothGattDescriptor?,
                    preparedWrite: Boolean, responseNeeded: Boolean,
                    offset: Int, value: ByteArray?
                ) {
                    if (responseNeeded) {
                        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
                    }
                }
            })
            gattServer?.addService(service)

            advertiser = adapter.bluetoothLeAdvertiser
            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setConnectable(true)
                .build()
            val data = AdvertiseData.Builder()
                .addServiceUuid(android.os.ParcelUuid(SERVICE_UUID))
                .setIncludeDeviceName(true)
                .build()
            advertiser?.startAdvertising(settings, data, object : AdvertiseCallback() {
                override fun onStartFailure(errorCode: Int) {
                    promise.reject("ADVERTISE_FAILED", "Advertising failed with code $errorCode")
                }
            })

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ADVERTISING_ERROR", e)
        }
    }

    @ReactMethod
    fun stopAdvertising(promise: Promise) {
        try {
            advertiser?.stopAdvertising(object : AdvertiseCallback() {})
            gattServer?.close()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ADVERTISING_ERROR", e)
        }
    }

    @ReactMethod
    fun notifyMessage(payload: String, promise: Promise) {
        val device = connectedDevice
        val char = notifyChar
        if (device == null || char == null) {
            promise.reject("NO_CONNECTION", "No connected central to notify.")
            return
        }
        char.value = payload.toByteArray(Charsets.UTF_8)
        val sent = gattServer?.notifyCharacteristicChanged(device, char, false) ?: false
        promise.resolve(sent)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN's NativeEventEmitter, no-op here.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN's NativeEventEmitter, no-op here.
    }
}