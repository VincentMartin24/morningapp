import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateRequest {
  name: string;
  city: string;
  country: string;
  language: string;
  weatherDescription?: string;
  temperature?: number;
}

interface GenerateResponse {
  success: boolean;
  text?: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an elegant, calm morning narrator inspired by The New Yorker.
Your tone is editorial, intelligent, and soothing.
You are not motivational.`;

function buildUserPrompt(data: GenerateRequest): string {
  const weatherInfo = data.weatherDescription && data.temperature !== undefined
    ? `Weather: ${data.weatherDescription}\nTemperature: ${data.temperature}°C`
    : 'Weather: Not available';

  return `Write a short spoken morning message using the inputs below.

Rules:
- Language: ${data.language}
- Use the person's first name naturally
- Mention the city and country once
- If weather data exists, reference it subtly and poetically
- One short paragraph
- Calm, editorial tone
- About 15–20 seconds when spoken
- No emojis
- Output ONLY the spoken text

Inputs:
Name: ${data.name}
Location: ${data.city}, ${data.country}
${weatherInfo}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const data: GenerateRequest = await req.json();

    if (!data.name || !data.city || !data.language) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(data) },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate text" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await openaiResponse.json();
    const generatedText = result.choices?.[0]?.message?.content?.trim();

    if (!generatedText) {
      return new Response(
        JSON.stringify({ success: false, error: "No text generated" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const response: GenerateResponse = {
      success: true,
      text: generatedText,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Generation failed" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});