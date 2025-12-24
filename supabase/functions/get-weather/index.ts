import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WeatherRequest {
  city: string;
  country?: string;
}

interface WeatherResponse {
  success: boolean;
  data?: {
    description: string;
    temperature: number;
    city: string;
    country: string;
  };
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { city, country }: WeatherRequest = await req.json();

    if (!city) {
      return new Response(
        JSON.stringify({ success: false, error: "City is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Weather service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const query = country ? `${city},${country}` : city;
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&units=metric&appid=${apiKey}`;

    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Weather data unavailable" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const weatherData = await weatherResponse.json();

    const response: WeatherResponse = {
      success: true,
      data: {
        description: weatherData.weather?.[0]?.description || "unknown",
        temperature: Math.round(weatherData.main?.temp || 0),
        city: weatherData.name || city,
        country: weatherData.sys?.country || country || "",
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch weather" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});