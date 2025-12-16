/**
 * Workers AI Text-to-Speech
 * Note: Workers AI doesn't have a native TTS model as of now.
 * This module provides a fallback approach using the browser speech synthesis
 * or a placeholder for future Workers AI TTS support.
 *
 * For now, we'll use the existing Google TTS or return a simple audio placeholder.
 */

type Ai = {
  run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Generate speech audio from text using Workers AI
 * Note: Workers AI currently doesn't have a production TTS model.
 * This is a placeholder that returns empty audio or uses alternative methods.
 *
 * @param ai - Workers AI binding
 * @param text - Text to synthesize
 * @returns Audio as Uint8Array (MP3)
 */
export async function synthesizeWithWorkersAi(
  ai: Ai,
  text: string,
): Promise<Uint8Array> {
  // Workers AI doesn't have TTS yet, but we can explore alternatives:
  // Option 1: Use a streaming text response that frontend can use with Web Speech API
  // Option 2: Use an external TTS service
  // Option 3: Return the text for client-side synthesis

  // For now, we'll return a placeholder that indicates text-only response
  // The frontend can use the Web Speech API for synthesis
  console.log(
    `[TTS] Text to synthesize (${text.length} chars): ${text.substring(0, 50)}...`,
  );

  // Return empty audio - frontend should fallback to Web Speech API
  return new Uint8Array(0);
}

/**
 * Check if Workers AI TTS is available
 * Currently returns false as Workers AI doesn't have TTS
 */
export function isWorkersAiTtsAvailable(): boolean {
  return false;
}
