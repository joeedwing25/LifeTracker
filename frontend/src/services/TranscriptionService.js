import { aiEnv } from '@/lib/env';

export class TranscriptionService {
  async transcribe(audioBlob) {
    const apiKey = aiEnv.groqApiKey();
    if (!apiKey) {
      throw new Error('Missing Groq API Key for transcription.');
    }

    if (!audioBlob.size) {
      throw new Error('No audio was provided');
    }

    const form = new FormData();
    // Improved extension detection
    const extension = audioBlob.type.split('/')[1]?.split(';')[0] || 'webm';
    form.append('file', audioBlob, `file.${extension}`);
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error?.message ?? `Transcription failed with ${response.status}`);
    }

    return {
      text: json.text?.trim(),
      duration: json.duration,
      language: json.language,
    };
  }
}

export const transcriptionService = new TranscriptionService();
