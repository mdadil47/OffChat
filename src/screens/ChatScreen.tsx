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
} from 'react-native';
import { useChat } from '../context/ChatContext';
import Avatar from '../components/Avatar';
import { colors } from '../theme/colors';

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export default function ChatScreen() {
  const { messages, myDeviceId, connectedPeerId, isSecure, sendMessage, disconnect } = useChat();
  const [draft, setDraft] = useState('');

  const onSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      await sendMessage(body);
    } catch (e) {
      console.warn('Send failed', e);
    }
  };

  const peerName = connectedPeerId ? `Offchat-${connectedPeerId.slice(-4)}` : 'Waiting…';

  const statusText = !connectedPeerId
    ? 'Connecting…'
    : isSecure
    ? '🔒 Encrypted · Bluetooth'
    : 'Securing connection…';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={disconnect} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          {connectedPeerId && <Avatar id={connectedPeerId} name={peerName} size={38} />}
          <View style={styles.headerText}>
            <Text style={styles.peerName}>{peerName}</Text>
            <Text style={[styles.peerStatus, isSecure && styles.peerStatusSecure]}>{statusText}</Text>
          </View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const mine = item.senderId === myDeviceId;
            return (
              <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                    {item.body}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
                  {mine && <Text style={styles.status}> · {item.status}</Text>}
                </View>
              </View>
            );
          }}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={isSecure ? 'Type a message' : 'Waiting for secure connection…'}
            placeholderTextColor={colors.textSecondary}
            editable={isSecure}
            onSubmitEditing={onSend}
          />
          <TouchableOpacity style={[styles.sendButton, !isSecure && styles.sendButtonDisabled]} onPress={onSend} disabled={!isSecure}>
            <Text style={styles.sendArrow}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.background,
  },
  backButton: { paddingRight: 4 },
  backArrow: { fontSize: 30, color: colors.primary, marginTop: -4 },
  headerText: { flex: 1 },
  peerName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  peerStatus: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  peerStatusSecure: { color: colors.online },
  messageList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexGrow: 1, justifyContent: 'flex-end' },
  bubbleRow: { alignSelf: 'flex-start', maxWidth: '78%', marginVertical: 3 },
  bubbleRowMine: { alignSelf: 'flex-end' },
  bubble: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 20 },
  bubbleMine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.bubbleTheirs,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: colors.bubbleTextMine },
  bubbleTextTheirs: { color: colors.bubbleTextTheirs },
  metaRow: { flexDirection: 'row', marginTop: 3, paddingHorizontal: 4 },
  timestamp: { color: colors.textSecondary, fontSize: 10 },
  status: { color: colors.textSecondary, fontSize: 10 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sendButtonDisabled: { backgroundColor: colors.textSecondary, shadowOpacity: 0 },
  sendArrow: { color: '#fff', fontSize: 18 },
});