import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { avatarColorFor } from '../theme/colors';

interface AvatarProps {
  id: string;
  name: string;
  size?: number;
}

export default function Avatar({ id, name, size = 48 }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const color = avatarColorFor(id);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  letter: { color: '#fff', fontWeight: '700' },
});