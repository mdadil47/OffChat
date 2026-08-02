import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface PulseRingProps {
  active: boolean;
  size?: number;
  children: React.ReactNode;
}

/**
 * Renders children (typically an Avatar) with a soft expanding ring behind
 * it when `active` is true — a quiet visual metaphor for "broadcasting."
 * Only animates while active; otherwise renders children plain.
 */
export default function PulseRing({ active, size = 56, children }: PulseRingProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      opacity.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.6, duration: 1800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale, opacity]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {active && (
        <Animated.View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              transform: [{ scale }],
              opacity,
            },
          ]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', alignItems: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: colors.primary },
});