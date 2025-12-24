import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

interface GenerateParams {
  name: string;
  city: string;
  country: string;
  language: string;
  weatherDescription?: string;
  temperature?: number;
}

async function generateMorningText(params: GenerateParams): Promise<string | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-morning-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (data.success && data.text) {
      return data.text;
    }
    return null;
  } catch {
    return null;
  }
}

async function generateAudio(text: string, language: string): Promise<string | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ text, language }),
    });

    const data = await response.json();

    if (data.success && data.audioUrl) {
      return data.audioUrl;
    }
    return null;
  } catch {
    return null;
  }
}

function getFallbackScript(
  name: string,
  city: string,
  country: string,
  language: string,
  weatherDescription?: string,
  temperature?: number
): string {
  const location = country ? `${city}, ${country}` : city;
  const hasWeather = weatherDescription && temperature !== undefined;

  const weatherLine = hasWeather
    ? `The weather is ${weatherDescription} at ${temperature} degrees.`
    : '';

  const fallbacks: { [key: string]: string } = {
    English: `Good morning, ${name}. You are waking up in ${location}. ${weatherLine} Take a moment to appreciate the stillness before the day unfolds.`,
    French: `Bonjour, ${name}. Vous vous réveillez à ${location}. ${hasWeather ? `Le temps est ${weatherDescription} à ${temperature} degrés.` : ''} Prenez un moment pour apprécier le calme avant que la journée ne se déploie.`,
    German: `Guten Morgen, ${name}. Sie erwachen in ${location}. ${hasWeather ? `Das Wetter ist ${weatherDescription} bei ${temperature} Grad.` : ''} Nehmen Sie sich einen Moment, um die Stille zu genießen, bevor der Tag beginnt.`,
    Spanish: `Buenos días, ${name}. Despiertas en ${location}. ${hasWeather ? `El clima es ${weatherDescription} a ${temperature} grados.` : ''} Tómate un momento para apreciar la quietud antes de que el día se despliegue.`,
    Portuguese: `Bom dia, ${name}. Você acorda em ${location}. ${hasWeather ? `O tempo está ${weatherDescription} a ${temperature} graus.` : ''} Reserve um momento para apreciar a quietude antes que o dia se desenrole.`,
  };

  return fallbacks[language] || fallbacks.English;
}

export default function GeneratingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [statusText, setStatusText] = useState('Creating your personalized morning...');

  useEffect(() => {
    let isMounted = true;

    async function generate() {
      const name = params.name as string;
      const city = params.city as string;
      const country = params.country as string;
      const language = params.language as string;
      const weatherDescription = params.weatherDescription as string || undefined;
      const weatherTemperature = params.weatherTemperature as string;
      const temperature = weatherTemperature ? parseInt(weatherTemperature) : undefined;

      const aiText = await generateMorningText({
        name,
        city,
        country,
        language,
        weatherDescription,
        temperature,
      });

      if (!isMounted) return;

      let script: string;
      if (aiText) {
        script = aiText;
      } else {
        setStatusText('Finishing up...');
        script = getFallbackScript(name, city, country, language, weatherDescription, temperature);
      }

      setStatusText('Generating audio...');

      const audioUrl = await generateAudio(script, language);

      if (!isMounted) return;

      router.replace({
        pathname: '/playback',
        params: {
          name: params.name,
          location: params.location,
          language: params.language,
          city: params.city,
          country: params.country,
          weatherDescription: params.weatherDescription,
          weatherTemperature: params.weatherTemperature,
          wakeUpTime: params.wakeUpTime,
          script,
          audioUrl: audioUrl || '',
        },
      });
    }

    generate();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={styles.text}>{statusText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  text: {
    fontSize: 18,
    color: '#666',
    marginTop: 24,
    textAlign: 'center',
  },
});
