import React, { useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { ChatProvider, useChat } from './src/context/ChatContext';
import DeviceListScreen from './src/screens/DeviceListScreen';
import ChatScreen from './src/screens/ChatScreen';

type Screen = 'DeviceList' | 'Chat';

function Navigator() {
  const [screen, setScreen] = useState<Screen>('DeviceList');
  const { connectedPeerId } = useChat();

  const navigation = { navigate: (name: Screen) => setScreen(name) };

  if (screen === 'Chat' || connectedPeerId) {
    return <ChatScreen />;
  }
  return <DeviceListScreen navigation={navigation} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0f14' }}>
        <StatusBar barStyle="light-content" />
        <ChatProvider>
          <Navigator />
        </ChatProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}