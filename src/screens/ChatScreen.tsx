import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Switch,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useChat } from '../context/ChatContext';
import Avatar from '../components/Avatar';
import PulseRing from '../components/PulseRing';
import { SkeletonDeviceRow } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { haptics } from '../services/haptics';
import { colors } from '../theme/colors';

export default function DeviceListScreen({ navigation }: any) {
  const {
    peers,
    isScanning,
    isAdvertising,
    isTogglingAdvertising,
    startScan,
    stopScan,
    toggleAdvertising,
    connectTo,
  } = useChat();

  const [refreshing, setRefreshing] = useState(false);

  const handleConnect = async (deviceId: string) => {
    try {
      await connectTo(deviceId);
      navigation.navigate('Chat');
    } catch (e) {
      console.warn('Connection failed', e);
    }
  };

  const onRefresh = async () => {
    if (!isAdvertising) return;
    setRefreshing(true);
    stopScan();
    await startScan();
    setRefreshing(false);
  };

  const showSkeletons = (isTogglingAdvertising || isScanning) && isAdvertising && peers.length === 0 && !refreshing;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Nearby</Text>
        <Text style={styles.title}>OffChat</Text>
      </View>

      <View style={styles.discoverableRow}>
        <PulseRing active={isAdvertising} size={40}>
          <Avatar id="self" name="Me" size={40} />
        </PulseRing>
        <View style={styles.discoverableText}>
          <Text style={styles.discoverableTitle}>
            {isAdvertising ? 'Broadcasting' : 'Make me discoverable'}
          </Text>
          <Text style={styles.discoverableSub}>
            {isAdvertising ? 'Other devices can find you now' : 'Let nearby devices see you'}
          </Text>
        </View>
        <Switch
          value={isAdvertising}
          onValueChange={() => {
            haptics.light();
            toggleAdvertising();
          }}
          disabled={isTogglingAdvertising}
          trackColor={{ false: colors.hairline, true: colors.primaryMuted }}
          thumbColor={isAdvertising ? colors.primary : '#FFFFFF'}
        />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Devices</Text>
      </View>

      {!isAdvertising ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="📡"
            title="Turn on discoverable"
            subtitle="Switch on to find nearby devices and let them find you."
          />
        </View>
      ) : showSkeletons ? (
        <View>
          <SkeletonDeviceRow />
          <View style={styles.divider} />
          <SkeletonDeviceRow />
          <View style={styles.divider} />
          <SkeletonDeviceRow />
        </View>
      ) : (
        <FlatList
          data={peers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={peers.length === 0 && styles.emptyContainer}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState icon="🔍" title="No devices found yet" subtitle="Pull down to scan again." />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => handleConnect(item.id)}>
              <Avatar id={item.id} name={item.name} size={44} />
              <View style={styles.rowText}>
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceSub}>
                  {item.rssi != null ? `${item.rssi} dBm` : 'Nearby'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700', marginTop: 2 },
  discoverableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 24,
    marginBottom: 28,
  },
  discoverableText: { flex: 1 },
  discoverableTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  discoverableSub: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  sectionRow: { marginHorizontal: 24, marginBottom: 8 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 14 },
  rowText: { flex: 1 },
  deviceName: { color: colors.textPrimary, fontSize: 16, fontWeight: '500' },
  deviceSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: 24 + 44 + 14 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
});