import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ALARM_NOTIFICATION_ID = 'morning-alarm';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface ScheduleAlarmParams {
  wakeUpTime: string;
  name: string;
  soundFileName?: string;
}

export interface ScheduleResult {
  success: boolean;
  error?: string;
  scheduledTime?: Date;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function calculateNextAlarmTime(wakeUpTime: string): Date {
  const [hours, minutes] = wakeUpTime.split(':').map(Number);
  const now = new Date();
  const alarmTime = new Date();

  alarmTime.setHours(hours, minutes, 0, 0);

  if (alarmTime <= now) {
    alarmTime.setDate(alarmTime.getDate() + 1);
  }

  return alarmTime;
}

export async function scheduleAlarm(params: ScheduleAlarmParams): Promise<ScheduleResult> {
  const { wakeUpTime, name, soundFileName } = params;

  try {
    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
      return {
        success: false,
        error: 'Notification permissions are required to schedule your morning alarm.',
      };
    }

    await cancelExistingAlarm();

    const alarmTime = calculateNextAlarmTime(wakeUpTime);
    const secondsUntilAlarm = Math.max(1, Math.floor((alarmTime.getTime() - Date.now()) / 1000));

    if (Platform.OS === 'web') {
      return {
        success: true,
        scheduledTime: alarmTime,
        error: 'Web notifications have limited background support. Keep the browser tab open for best results.',
      };
    }

    const notificationSound = soundFileName || true;

    await Notifications.scheduleNotificationAsync({
      identifier: ALARM_NOTIFICATION_ID,
      content: {
        title: 'Good Morning!',
        body: `${name}, your personalized morning audio is ready.`,
        sound: notificationSound,
        priority: Notifications.AndroidNotificationPriority.MAX,
        interruptionLevel: 'timeSensitive',
        data: { type: 'morning-alarm' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilAlarm,
      },
    });

    return {
      success: true,
      scheduledTime: alarmTime,
    };
  } catch (error) {
    console.error('Error scheduling alarm:', error);
    return {
      success: false,
      error: 'Failed to schedule alarm. Please try again.',
    };
  }
}

export async function cancelExistingAlarm(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    await Notifications.cancelScheduledNotificationAsync(ALARM_NOTIFICATION_ID);
  } catch (error) {
    console.error('Error cancelling alarm:', error);
  }
}

export async function getScheduledAlarm(): Promise<Date | null> {
  try {
    if (Platform.OS === 'web') return null;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const alarm = scheduled.find((n) => n.identifier === ALARM_NOTIFICATION_ID);

    if (alarm?.trigger && 'seconds' in alarm.trigger && typeof alarm.trigger.seconds === 'number') {
      const scheduledTime = new Date(Date.now() + alarm.trigger.seconds * 1000);
      return scheduledTime;
    }

    return null;
  } catch (error) {
    console.error('Error getting scheduled alarm:', error);
    return null;
  }
}

export function formatAlarmTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatAlarmDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
