import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { getLocalAudioPath } from '../utils/audioStorage';

async function playAlarmAudio() {
  const localPath = await getLocalAudioPath();

  if (localPath) {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: localPath },
        { shouldPlay: true }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Error playing alarm audio:', error);
    }
  }
}

function handleDeepLink(url: string) {
  const parsedUrl = Linking.parse(url);

  if (parsedUrl.path === 'play-morning-audio' || parsedUrl.hostname === 'play-morning-audio') {
    playAlarmAudio();
  }
}

export default function RootLayout() {
  useFrameworkReady();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const notificationReceivedListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    notificationReceivedListener.current = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const data = notification.request.content.data;

        if (data?.type === 'morning-alarm') {
          await playAlarmAudio();
        }
      }
    );

    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;

        if (data?.type === 'morning-alarm') {
          await playAlarmAudio();
        }
      }
    );

    return () => {
      linkingSubscription.remove();
      if (notificationReceivedListener.current) {
        notificationReceivedListener.current.remove();
      }
      if (notificationResponseListener.current) {
        notificationResponseListener.current.remove();
      }
    };
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="generating" />
        <Stack.Screen name="playback" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
