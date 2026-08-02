import React, { useEffect, useRef } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface ConnectionStatusProps {
  connected: boolean;
  secure: boolean;
}

export default function ConnectionStatus({ connected, secure }: ConnectionStatusProps) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [connected, secure, fade]);

  let label = 'Connecting…';
  let color = colors.textSecondary;
  if (connected && !secure) {
    label = 'Securing connection…';
  } else if (connected && secure) {
    label = 'Encrypted';
    color = colors.online;
  }

  return (
    <Animated.Text style={[styles.label, { color, opacity: fade }]}>{label}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, marginTop: 1 },
});