import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, Clock } from 'lucide-react-native';

const LANGUAGES = ['English', 'French', 'German', 'Spanish', 'Portuguese'];

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const ITEM_HEIGHT = 44;

function getNextFullHour(): { hour: string; minute: string } {
  const now = new Date();
  let nextHour = now.getHours() + 1;
  if (nextHour >= 24) nextHour = 0;
  return {
    hour: nextHour.toString().padStart(2, '0'),
    minute: '00',
  };
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

interface WeatherData {
  description: string;
  temperature: number;
  city: string;
  country: string;
}

function parseLocation(location: string): { city: string; country: string } {
  const parts = location.split(',').map(part => part.trim());
  return {
    city: parts[0] || '',
    country: parts[1] || '',
  };
}

async function fetchWeather(city: string, country?: string): Promise<WeatherData | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weather`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ city, country }),
    });

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

export default function InputScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState('English');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [errors, setErrors] = useState({ name: '', location: '', language: '' });
  const [isLoading, setIsLoading] = useState(false);

  const defaultTime = getNextFullHour();
  const [selectedHour, setSelectedHour] = useState(defaultTime.hour);
  const [selectedMinute, setSelectedMinute] = useState(defaultTime.minute);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const hourListRef = useRef<FlatList>(null);
  const minuteListRef = useRef<FlatList>(null);

  const validateFields = () => {
    const newErrors = { name: '', location: '', language: '' };
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Please enter your name';
      isValid = false;
    }

    if (!location.trim()) {
      newErrors.location = 'Please enter your location';
      isValid = false;
    }

    if (!language) {
      newErrors.language = 'Please select a language';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleGenerate = async () => {
    if (!validateFields()) return;

    setIsLoading(true);

    const { city, country } = parseLocation(location);
    const weather = await fetchWeather(city, country);

    setIsLoading(false);

    router.push({
      pathname: '/generating',
      params: {
        name,
        location,
        language,
        city,
        country,
        weatherDescription: weather?.description || '',
        weatherTemperature: weather?.temperature?.toString() || '',
        wakeUpTime: `${selectedHour}:${selectedMinute}`,
      }
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Your Morning Audio</Text>
            <Text style={styles.subtitle}>
              Tell us about yourself to create a personalized morning experience
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="First name (e.g. Alex)"
                placeholderTextColor="#999"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                autoCapitalize="words"
                editable={!isLoading}
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={[styles.input, errors.location && styles.inputError]}
                placeholder="City, Country (e.g. Paris, France)"
                placeholderTextColor="#999"
                value={location}
                onChangeText={(text) => {
                  setLocation(text);
                  if (errors.location) setErrors({ ...errors, location: '' });
                }}
                autoCapitalize="words"
                editable={!isLoading}
              />
              {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Language</Text>
              <TouchableOpacity
                style={[styles.picker, errors.language && styles.inputError]}
                onPress={() => !isLoading && setShowLanguagePicker(!showLanguagePicker)}
                disabled={isLoading}
              >
                <Text style={styles.pickerText}>{language}</Text>
                <ChevronDown size={20} color="#666" />
              </TouchableOpacity>
              {errors.language ? <Text style={styles.errorText}>{errors.language}</Text> : null}

              {showLanguagePicker && (
                <View style={styles.languageList}>
                  {LANGUAGES.map((lang) => (
                    <TouchableOpacity
                      key={lang}
                      style={styles.languageOption}
                      onPress={() => {
                        setLanguage(lang);
                        setShowLanguagePicker(false);
                        if (errors.language) setErrors({ ...errors, language: '' });
                      }}
                    >
                      <Text style={[
                        styles.languageOptionText,
                        language === lang && styles.languageOptionSelected
                      ]}>
                        {lang}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Wake-up Time</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => !isLoading && setShowTimePicker(!showTimePicker)}
                disabled={isLoading}
              >
                <View style={styles.timeDisplay}>
                  <Clock size={20} color="#666" />
                  <Text style={styles.pickerText}>{selectedHour}:{selectedMinute}</Text>
                </View>
                <ChevronDown size={20} color="#666" />
              </TouchableOpacity>

              {showTimePicker && (
                <View style={styles.timePickerContainer}>
                  <View style={styles.timePickerColumns}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeColumnLabel}>Hour</Text>
                      <View style={styles.timeScrollContainer}>
                        <FlatList
                          ref={hourListRef}
                          data={HOURS}
                          keyExtractor={(item) => `hour-${item}`}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={ITEM_HEIGHT}
                          decelerationRate="fast"
                          initialScrollIndex={HOURS.indexOf(selectedHour)}
                          getItemLayout={(_, index) => ({
                            length: ITEM_HEIGHT,
                            offset: ITEM_HEIGHT * index,
                            index,
                          })}
                          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                            const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                            if (index >= 0 && index < HOURS.length) {
                              setSelectedHour(HOURS[index]);
                            }
                          }}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={styles.timeItem}
                              onPress={() => {
                                setSelectedHour(item);
                                const index = HOURS.indexOf(item);
                                hourListRef.current?.scrollToIndex({ index, animated: true });
                              }}
                            >
                              <Text style={[
                                styles.timeItemText,
                                selectedHour === item && styles.timeItemSelected
                              ]}>
                                {item}
                              </Text>
                            </TouchableOpacity>
                          )}
                        />
                      </View>
                    </View>

                    <Text style={styles.timeSeparator}>:</Text>

                    <View style={styles.timeColumn}>
                      <Text style={styles.timeColumnLabel}>Minute</Text>
                      <View style={styles.timeScrollContainer}>
                        <FlatList
                          ref={minuteListRef}
                          data={MINUTES}
                          keyExtractor={(item) => `minute-${item}`}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={ITEM_HEIGHT}
                          decelerationRate="fast"
                          initialScrollIndex={MINUTES.indexOf(selectedMinute)}
                          getItemLayout={(_, index) => ({
                            length: ITEM_HEIGHT,
                            offset: ITEM_HEIGHT * index,
                            index,
                          })}
                          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                            const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                            if (index >= 0 && index < MINUTES.length) {
                              setSelectedMinute(MINUTES[index]);
                            }
                          }}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={styles.timeItem}
                              onPress={() => {
                                setSelectedMinute(item);
                                const index = MINUTES.indexOf(item);
                                minuteListRef.current?.scrollToIndex({ index, animated: true });
                              }}
                            >
                              <Text style={[
                                styles.timeItemText,
                                selectedMinute === item && styles.timeItemSelected
                              ]}>
                                {item}
                              </Text>
                            </TouchableOpacity>
                          )}
                        />
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.timePickerDone}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.timePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Generate My Morning</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 6,
  },
  picker: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  languageList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  languageOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#666',
  },
  languageOptionSelected: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    marginTop: 8,
    padding: 16,
  },
  timePickerColumns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeColumn: {
    alignItems: 'center',
  },
  timeColumnLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontWeight: '500',
  },
  timeScrollContainer: {
    height: ITEM_HEIGHT * 3,
    width: 60,
    overflow: 'hidden',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginHorizontal: 16,
    marginTop: 20,
  },
  timeItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeItemText: {
    fontSize: 20,
    color: '#999',
  },
  timeItemSelected: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  timePickerDone: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  timePickerDoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 'auto',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
