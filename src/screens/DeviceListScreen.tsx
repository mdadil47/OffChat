import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useChat } from '../context/ChatContext';
import Avatar from '../components/Avatar';
import { colors } from '../theme/colors';

export default function DeviceListScreen({ navigation }: any) {
  const { peers, isScanning, isAdvertising, startScan, stopScan, startAdvertising, connectTo } = useChat();

  useEffect(() => {
    startScan();
    return () => stopScan();
  }, [startScan, stopScan]);

  const handleConnect = async (deviceId: string) => {
    try {
      await connectTo(deviceId);
      navigation.navigate('Chat');
    } catch (e) {
      console.warn('Connection failed', e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello,</Text>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Offchat</Text>
          {isScanning && <ActivityIndicator color={colors.primary} />}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.discoverableButton, isAdvertising && styles.discoverableButtonActive]}
        onPress={startAdvertising}
        disabled={isAdvertising}
      >
        <View style={[styles.dot, { backgroundColor: isAdvertising ? colors.online : '#fff' }]} />
        <Text style={styles.discoverableText}>
          {isAdvertising ? 'You are discoverable' : 'Make me discoverable'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Nearby devices</Text>

      <FlatList
        data={peers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, peers.length === 0 && styles.emptyContainer]}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isScanning ? 'Scanning for nearby devices…' : 'No devices found yet.'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleConnect(item.id)}>
            <Avatar id={item.id} name={item.name} />
            <View style={styles.cardText}>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.deviceSub}>
                {item.rssi != null ? `Signal ${item.rssi} dBm` : 'Nearby'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  greeting: { color: colors.textSecondary, fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '700' },
  discoverableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  discoverableButtonActive: { backgroundColor: colors.primaryDark },
  dot: { width: 8, height: 8, borderRadius: 4 },
  discoverableText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardText: { flex: 1 },
  deviceName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  deviceSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});