import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '📶',
    title: 'Chat without internet',
    subtitle: 'OffChat sends messages directly between nearby phones using Bluetooth — no Wi-Fi or data required.',
  },
  {
    icon: '📡',
    title: 'Become discoverable',
    subtitle: 'Turn on the toggle to let nearby OffChat users find and connect with you.',
  },
  {
    icon: '🔒',
    title: 'End-to-end encrypted',
    subtitle: 'Every message is encrypted on your device before it ever leaves over Bluetooth.',
  },
];

interface OnboardingScreenProps {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  };

  const isLast = index === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      onDone();
    } else {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.button} onPress={goNext}>
          <Text style={styles.buttonText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
        {!isLast && (
          <TouchableOpacity onPress={onDone} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 40 },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  icon: { fontSize: 52 },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: { paddingHorizontal: 32, paddingBottom: 24, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.hairline },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: fonts.semiBold },
  skipButton: { marginTop: 16 },
  skipText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular },
});