import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Clipboard,
} from 'react-native';
import { useChat } from '../context/ChatContext';
import Avatar from '../components/Avatar';
import AnimatedBubble from '../components/AnimatedBubble';
import ConnectionStatus from '../components/ConnectionStatus';
import MessageActionSheet from '../components/MessageActionSheet';
import { haptics } from '../services/haptics';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { OffchatMessage } from '../types/Message';

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export default function ChatScreen() {
  const {
    messages,
    myDeviceId,
    connectedPeerId,
    isSecure,
    sendMessage,
    sendReaction,
    deleteMessage,
    disconnect,
  } = useChat();
  const [draft, setDraft] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<OffchatMessage | null>(null);

  const onSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    haptics.light();
    try {
      await sendMessage(body);
    } catch (e) {
      haptics.error();
      console.warn('Send failed', e);
    }
  };

  const onLongPressMessage = (msg: OffchatMessage) => {
    haptics.medium();
    setSelectedMessage(msg);
  };

  const peerName = connectedPeerId ? `Offchat-${connectedPeerId.slice(-4)}` : 'Waiting…';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={disconnect} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          {connectedPeerId && <Avatar id={connectedPeerId} name={peerName} size={36} />}
          <View style={styles.headerText}>
            <Text style={styles.peerName}>{peerName}</Text>
            <ConnectionStatus connected={!!connectedPeerId} secure={isSecure} />
          </View>
        </View>

        <View style={styles.headerDivider} />

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const mine = item.senderId === myDeviceId;
            return (
              <AnimatedBubble style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onLongPress={() => onLongPressMessage(item)}
                  style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                >
                  <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                    {item.body}
                  </Text>
                  {item.reaction && (
                    <View style={styles.reactionBadge}>
                      <Text style={styles.reactionBadgeText}>{item.reaction}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.metaRow}>
                  <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
                  {mine && <Text style={styles.status}> · {item.status}</Text>}
                </View>
              </AnimatedBubble>
            );
          }}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={isSecure ? 'Message' : 'Waiting for secure connection…'}
            placeholderTextColor={colors.textSecondary}
            editable={isSecure}
            onSubmitEditing={onSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, !isSecure && styles.sendButtonDisabled]}
            onPress={onSend}
            disabled={!isSecure}
          >
            <Text style={styles.sendArrow}>↑</Text>
          </TouchableOpacity>
        </View>bottom sheet lives outside the KeyboardAvoidingView flow
      </KeyboardAvoidingView>

      <MessageActionSheet
        visible={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        onReact={(emoji) => {
          if (selectedMessage) {
            haptics.light();
            sendReaction(selectedMessage.id, emoji);
          }
        }}
        onCopy={() => {
          if (selectedMessage) {
            Clipboard.setString(selectedMessage.body);
            haptics.success();
          }
        }}
        onDelete={() => {
          if (selectedMessage) {
            deleteMessage(selectedMessage.id);
            haptics.medium();
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  backButton: { paddingRight: 2 },
  backArrow: { fontSize: 28, color: colors.textPrimary, marginTop: -2, fontFamily: fonts.regular },
  headerText: { flex: 1 },
  peerName: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.semiBold },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  messageList: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexGrow: 1, justifyContent: 'flex-end' },
  bubbleRow: { alignSelf: 'flex-start', maxWidth: '78%', marginVertical: 4 },
  bubbleRowMine: { alignSelf: 'flex-end' },
  bubble: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 18, position: 'relative' },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 20, fontFamily: fonts.regular },
  bubbleTextMine: { color: '#FFFFFF' },
  bubbleTextTheirs: { color: colors.textPrimary },
  reactionBadge: {
    position: 'absolute',
    bottom: -10,
    right: -6,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  reactionBadgeText: { fontSize: 12 },
  metaRow: { flexDirection: 'row', marginTop: 3, paddingHorizontal: 4 },
  timestamp: { color: colors.textSecondary, fontSize: 10, fontFamily: fonts.regular },
  status: { color: colors.textSecondary, fontSize: 10, fontFamily: fonts.regular },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    color: colors.textPrimary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.hairline },
  sendArrow: { color: '#fff', fontSize: 18, fontFamily: fonts.semiBold },
});