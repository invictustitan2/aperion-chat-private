/**
 * Workers AI Speech-to-Text using Whisper
 * Replaces Google Cloud Speech-to-Text with @cf/openai/whisper
 */

export type WhisperResult = {
  text: string;
  vtt?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
};

/**
 * Transcribe audio using Workers AI Whisper model
 * @param ai - Workers AI binding
 * @param audioBytes - Audio file as Uint8Array (supports various formats)
 * @returns Transcribed text
 */
export async function transcribeWithWhisper(
  ai: Ai,
  audioBytes: Uint8Array,
): Promise<string> {
  const result = (await ai.run("@cf/openai/whisper", {
    audio: Array.from(audioBytes),
  })) as WhisperResult;

  return result.text?.trim() || "";
}

/**
 * Transcribe audio with word-level timestamps
 * @param ai - Workers AI binding
 * @param audioBytes - Audio file as Uint8Array
 * @returns Transcription with word timestamps
 */
export async function transcribeWithTimestamps(
  ai: Ai,
  audioBytes: Uint8Array,
): Promise<WhisperResult> {
  const result = (await ai.run("@cf/openai/whisper", {
    audio: Array.from(audioBytes),
  })) as WhisperResult;

  return result;
}
