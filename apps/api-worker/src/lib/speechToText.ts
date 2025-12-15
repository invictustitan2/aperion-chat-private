import { getGoogleAccessToken } from "./googleAuth";
import { bytesToBase64 } from "./base64";

export type WordTimeOffset = {
  word: string;
  start: number;
  end: number;
};

type AudioInput =
  | { gcsUri: string }
  | { filePath: string }
  | { bytes: Uint8Array };

type GoogleEnv = {
  GOOGLE_APPLICATION_CREDENTIALS_JSON?: string;
};

function toBase64(bytes: Uint8Array): string {
  return bytesToBase64(bytes);
}

async function readFileAsBytes(filePath: string): Promise<Uint8Array> {
  const fs = await import("node:fs/promises");
  const buf = await fs.readFile(filePath);
  return new Uint8Array(buf);
}

export async function transcribeAudio(
  input: string | AudioInput,
  enableWordTimeOffsets?: false,
  googleEnv?: GoogleEnv,
): Promise<string>;
export async function transcribeAudio(
  input: string | AudioInput,
  enableWordTimeOffsets: true,
  googleEnv?: GoogleEnv,
): Promise<WordTimeOffset[]>;
export async function transcribeAudio(
  input: string | AudioInput,
  enableWordTimeOffsets = false,
  googleEnv?: GoogleEnv,
): Promise<string | WordTimeOffset[]> {
  const token = await getGoogleAccessToken(googleEnv ?? {});

  let audio:
    | { uri: string }
    | {
        content: string;
      };

  if (typeof input === "string") {
    if (input.startsWith("gs://")) {
      audio = { uri: input };
    } else {
      const bytes = await readFileAsBytes(input);
      audio = { content: toBase64(bytes) };
    }
  } else if ("gcsUri" in input) {
    audio = { uri: input.gcsUri };
  } else if ("filePath" in input) {
    const bytes = await readFileAsBytes(input.filePath);
    audio = { content: toBase64(bytes) };
  } else {
    audio = { content: toBase64(input.bytes) };
  }

  const config: Record<string, unknown> = {
    encoding: "LINEAR16",
    sampleRateHertz: 16000,
    languageCode: "en-US",
  };

  if (enableWordTimeOffsets) config.enableWordTimeOffsets = true;

  const resp = await fetch(
    "https://speech.googleapis.com/v1/speech:recognize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio, config }),
    },
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Speech-to-text failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as {
    results?: Array<{
      alternatives?: Array<{
        transcript?: string;
        words?: Array<{
          word?: string;
          startTime?: { seconds?: string | number; nanos?: number };
          endTime?: { seconds?: string | number; nanos?: number };
        }>;
      }>;
    }>;
  };

  if (enableWordTimeOffsets) {
    const words: WordTimeOffset[] = [];
    for (const result of data.results ?? []) {
      const alt = result.alternatives?.[0];
      for (const w of alt?.words ?? []) {
        const start =
          Number(w.startTime?.seconds ?? 0) +
          Number(w.startTime?.nanos ?? 0) / 1e9;
        const end =
          Number(w.endTime?.seconds ?? 0) + Number(w.endTime?.nanos ?? 0) / 1e9;
        words.push({ word: w.word ?? "", start, end });
      }
    }
    return words;
  }

  return (data.results ?? [])
    .map((r) => r.alternatives?.[0]?.transcript ?? "")
    .filter(Boolean)
    .join("\n");
}
