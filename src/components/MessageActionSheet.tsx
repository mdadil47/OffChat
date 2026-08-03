import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

interface MessageActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onCopy: () => void;
  onDelete: () => void;
}

export default function MessageActionSheet({
  visible,
  onClose,
  onReact,
  onCopy,
  onDelete,
}: MessageActionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.reactionRow}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionButton}
                onPress={() => {
                  onReact(emoji);
                  onClose();
                }}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              onCopy();
              onClose();
            }}
          >
            <Text style={styles.actionText}>Copy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              onDelete();
              onClose();
            }}
          >
            <Text style={[styles.actionText, styles.deleteText]}>Delete for me</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  reactionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  reactionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 24 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: 12 },
  actionRow: { paddingVertical: 14 },
  actionText: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.regular },
  deleteText: { color: colors.danger },
});