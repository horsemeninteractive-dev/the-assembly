// Gemini TTS is now proxied through /api/tts on the server.
// The API key never touches the client bundle.

export interface GeminiSpeechOptions {
  text: string;
  voice: string;
}

export const generateGeminiSpeech = async (options: GeminiSpeechOptions): Promise<HTMLAudioElement | null> => {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: options.text, voice: options.voice }),
    });

    if (!res.ok) return null;

    const data = await res.json() as { audio?: string };
    if (!data.audio) return null;

    const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
    return audio;
  } catch (error) {
    console.error("Gemini TTS error:", error);
    return null;
  }
};

export const getGeminiVoiceForAi = (aiName: string): string => {
  const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  let hash = 0;
  for (let i = 0; i < aiName.length; i++) {
    hash = aiName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return voices[Math.abs(hash) % voices.length];
};
