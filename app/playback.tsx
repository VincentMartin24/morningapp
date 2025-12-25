import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import { Play, Pause, RotateCcw, CloudSun, Clock, Bell, CheckCircle, AlertCircle, X, MapPin, User } from 'lucide-react-native';
import { saveAudioLocally, deleteLocalAudio } from '../utils/audioStorage';
import { scheduleAlarm, cancelExistingAlarm, formatAlarmTime, formatAlarmDate, ScheduleResult } from '../utils/alarmScheduler';
import { saveNotificationSound, deleteNotificationSound } from '../utils/notificationSound';

type SchedulingStatus = 'idle' | 'saving' | 'scheduling' | 'scheduled' | 'cancelling' | 'error';

export default function PlaybackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const isMounted = useRef(true);

  const [localAudioPath, setLocalAudioPath] = useState<string | null>(null);
  const [schedulingStatus, setSchedulingStatus] = useState<SchedulingStatus>('idle');
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasWeather = params.weatherDescription && params.weatherTemperature;
  const wakeUpTime = params.wakeUpTime as string;
  const userName = params.name as string;
  const userLocation = params.location as string;

  useEffect(() => {
    isMounted.current = true;
    setupAudio();

    return () => {
      isMounted.current = false;
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
    } catch (error) {
      console.error('Error setting audio mode:', error);
    }
  };

  const handlePlayPause = async () => {
    const audioUrl = params.audioUrl as string;

    if (!audioUrl) {
      console.log('No audio URL available');
      return;
    }

    try {
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        if (isMounted.current) {
          setSound(newSound);
          setIsPlaying(true);
        }
      } else {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Error with audio playback:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (!isMounted.current) return;

    if (status.isLoaded) {
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
    }
  };

  const handleGenerateAgain = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
    }
    setSound(null);
    setIsPlaying(false);
    router.replace('/');
  };

  const handleScheduleAlarm = async () => {
    const audioUrl = params.audioUrl as string;
    const name = params.name as string;

    if (!audioUrl) {
      setErrorMessage('No audio available to schedule.');
      setSchedulingStatus('error');
      return;
    }

    if (!wakeUpTime) {
      setErrorMessage('No wake-up time specified.');
      setSchedulingStatus('error');
      return;
    }

    setSchedulingStatus('saving');
    setErrorMessage(null);

    const [savedPath, soundFileName] = await Promise.all([
      saveAudioLocally(audioUrl),
      saveNotificationSound(audioUrl),
    ]);

    if (!isMounted.current) return;

    if (!savedPath) {
      setErrorMessage('Failed to save audio. Please try again.');
      setSchedulingStatus('error');
      return;
    }

    setLocalAudioPath(savedPath);
    setSchedulingStatus('scheduling');

    const result = await scheduleAlarm({
      wakeUpTime,
      name,
      soundFileName: soundFileName || undefined,
    });

    if (!isMounted.current) return;

    setScheduleResult(result);

    if (result.success) {
      setSchedulingStatus('scheduled');
      if (result.error) {
        setErrorMessage(result.error);
      }
    } else {
      setErrorMessage(result.error || 'Failed to schedule alarm.');
      setSchedulingStatus('error');
    }
  };

  const handleCancelAlarm = async () => {
    setSchedulingStatus('cancelling');
    setErrorMessage(null);

    try {
      await cancelExistingAlarm();
      await Promise.all([deleteLocalAudio(), deleteNotificationSound()]);

      if (!isMounted.current) return;

      setSchedulingStatus('idle');
      setScheduleResult(null);
      setLocalAudioPath(null);
    } catch (error) {
      console.error('Error cancelling alarm:', error);
      if (!isMounted.current) return;
      setErrorMessage('Failed to cancel alarm. Please try again.');
      setSchedulingStatus('scheduled');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Good Morning</Text>
            <Text style={styles.subtitle}>
              {params.name} · {params.location}
            </Text>

            {hasWeather && (
              <View style={styles.weatherBadge}>
                <CloudSun size={16} color="#666" />
                <Text style={styles.weatherText}>
                  {params.weatherDescription} · {params.weatherTemperature}°C
                </Text>
              </View>
            )}
          </View>

          <View style={styles.scriptContainer}>
            <Text style={styles.scriptText}>{params.script}</Text>
          </View>

          <View style={styles.playerContainer}>
            <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
              {isPlaying ? (
                <Pause size={32} color="#FFFFFF" />
              ) : (
                <Play size={32} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            <Text style={styles.playerLabel}>
              {isPlaying ? 'Playing...' : 'Tap to play audio'}
            </Text>
          </View>

          <View style={styles.scheduleSection}>
            <View style={styles.wakeUpTimeDisplay}>
              <Clock size={18} color="#666" />
              <Text style={styles.wakeUpTimeLabel}>Wake-up time:</Text>
              <Text style={styles.wakeUpTimeValue}>{wakeUpTime}</Text>
            </View>

            {schedulingStatus === 'idle' && (
              <TouchableOpacity style={styles.scheduleButton} onPress={handleScheduleAlarm}>
                <Bell size={20} color="#FFFFFF" />
                <Text style={styles.scheduleButtonText}>Schedule Alarm</Text>
              </TouchableOpacity>
            )}

            {(schedulingStatus === 'saving' || schedulingStatus === 'scheduling') && (
              <View style={styles.schedulingProgress}>
                <ActivityIndicator size="small" color="#1A1A1A" />
                <Text style={styles.schedulingText}>
                  {schedulingStatus === 'saving' ? 'Saving audio...' : 'Scheduling alarm...'}
                </Text>
              </View>
            )}

            {schedulingStatus === 'scheduled' && scheduleResult?.scheduledTime && (
              <View style={styles.scheduledContainer}>
                <View style={styles.scheduledHeader}>
                  <CheckCircle size={22} color="#16A34A" />
                  <Text style={styles.scheduledTitle}>
                    Your morning audio is scheduled for {formatAlarmTime(scheduleResult.scheduledTime)}
                  </Text>
                </View>

                <View style={styles.scheduledTimeCard}>
                  <Text style={styles.scheduledTimeValue}>
                    {formatAlarmTime(scheduleResult.scheduledTime)}
                  </Text>
                  <Text style={styles.scheduledDateLabel}>
                    {formatAlarmDate(scheduleResult.scheduledTime)}
                  </Text>
                </View>

                <View style={styles.scheduledDetails}>
                  <View style={styles.scheduledDetailRow}>
                    <User size={16} color="#666" />
                    <Text style={styles.scheduledDetailText}>{userName}</Text>
                  </View>
                  <View style={styles.scheduledDetailRow}>
                    <MapPin size={16} color="#666" />
                    <Text style={styles.scheduledDetailText}>{userLocation}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelAlarm}>
                  <X size={18} color="#DC2626" />
                  <Text style={styles.cancelButtonText}>Cancel Scheduled Audio</Text>
                </TouchableOpacity>
              </View>
            )}

            {schedulingStatus === 'cancelling' && (
              <View style={styles.schedulingProgress}>
                <ActivityIndicator size="small" color="#1A1A1A" />
                <Text style={styles.schedulingText}>Cancelling alarm...</Text>
              </View>
            )}

            {errorMessage && (
              <View style={styles.errorContainer}>
                <AlertCircle size={18} color="#DC2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {schedulingStatus === 'error' && (
              <TouchableOpacity style={styles.retryButton} onPress={handleScheduleAlarm}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.generateButton} onPress={handleGenerateAgain}>
            <RotateCcw size={20} color="#1A1A1A" />
            <Text style={styles.generateButtonText}>Generate Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  weatherText: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  scriptContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  scriptText: {
    fontSize: 16,
    lineHeight: 28,
    color: '#333',
  },
  playerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerLabel: {
    fontSize: 14,
    color: '#666',
  },
  scheduleSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  wakeUpTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  wakeUpTimeLabel: {
    fontSize: 14,
    color: '#666',
  },
  wakeUpTimeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  scheduleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  schedulingProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  schedulingText: {
    fontSize: 14,
    color: '#666',
  },
  scheduledContainer: {
    alignItems: 'center',
  },
  scheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  scheduledTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#16A34A',
    flex: 1,
  },
  scheduledTimeCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  scheduledTimeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#166534',
    letterSpacing: -0.5,
  },
  scheduledDateLabel: {
    fontSize: 14,
    color: '#15803D',
    marginTop: 4,
  },
  scheduledDetails: {
    alignSelf: 'stretch',
    gap: 8,
    marginBottom: 20,
  },
  scheduledDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduledDetailText: {
    fontSize: 14,
    color: '#666',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },
  retryButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: 0.3,
  },
});
