import React, { useEffect, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar, ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatProvider, useChat } from './src/context/ChatContext';
import DeviceListScreen from './src/screens/DeviceListScreen';
import ChatScreen from './src/screens/ChatScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme/colors';

const ONBOARDING_KEY = 'offchat_has_seen_onboarding';

type Screen = 'DeviceList' | 'Chat' | 'Settings';

function Navigator() {
  const [screen, setScreen] = useState<Screen>('DeviceList');
  const { connectedPeerId } = useChat();

  const navigation = { navigate: (name: Screen) => setScreen(name) };

  if (screen === 'Settings') {
    return <SettingsScreen onBack={() => setScreen('DeviceList')} />;
  }
  if (screen === 'Chat' || connectedPeerId) {
    return <ChatScreen />;
  }
  return <DeviceListScreen navigation={navigation} />;
}

export default function App() {
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => {
        setShowOnboarding(value !== 'true');
      })
      .catch(() => {
        setShowOnboarding(true);
      })
      .finally(() => setCheckingOnboarding(false));
  }, []);

  const completeOnboarding = () => {
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch((e) =>
      console.warn('Failed to persist onboarding flag', e),
    );
    setShowOnboarding(false);
  };

  if (checkingOnboarding) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0f14' }}>
        <StatusBar barStyle="light-content" />
        {showOnboarding ? (
          <OnboardingScreen onDone={completeOnboarding} />
        ) : (
          <ChatProvider>
            <Navigator />
          </ChatProvider>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}