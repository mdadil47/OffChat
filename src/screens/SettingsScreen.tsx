import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useChat } from '../context/ChatContext';
import { haptics } from '../services/haptics';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const APP_VERSION = '1.0.0';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { nickname, setNickname } = useChat();
  const [draft, setDraft] = useState(nickname);
  const [saved, setSaved] = useState(false);

  const onSave = async () => {
    await setNickname(draft);
    haptics.success();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Your Name</Text>
        <Text style={styles.sectionSub}>This is what nearby devices will see when you're discoverable.</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Offchat-Device"
            placeholderTextColor={colors.textSecondary}
            maxLength={24}
          />
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Text style={styles.saveButtonText}>{saved ? 'Saved ✓' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>{APP_VERSION}</Text>
        </View>
        <Text style={styles.aboutDescription}>
          OffChat sends encrypted messages directly between nearby devices over Bluetooth —
          no internet or cell signal required.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backButton: { paddingRight: 2 },
  backArrow: { fontSize: 28, color: colors.textPrimary, marginTop: -2, fontFamily: fonts.regular },
  title: { color: colors.textPrimary, fontSize: 18, fontFamily: fonts.bold },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionSub: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.regular, marginBottom: 14 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    color: colors.textPrimary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 14, fontFamily: fonts.semiBold },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: 28 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  aboutLabel: { color: colors.textPrimary, fontSize: 14, fontFamily: fonts.semiBold },
  aboutValue: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular },
  aboutDescription: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.regular, lineHeight: 19 },
});