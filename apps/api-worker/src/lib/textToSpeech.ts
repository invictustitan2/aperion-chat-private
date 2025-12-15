import { getGoogleAccessToken } from "./googleAuth";
import { base64ToBytes } from "./base64";

type GoogleEnv = {
  GOOGLE_APPLICATION_CREDENTIALS_JSON?: string;
};

export async function synthesizeSpeech(
  text: string,
  googleEnv?: GoogleEnv,
): Promise<Uint8Array> {
  const token = await getGoogleAccessToken(googleEnv ?? {});

  const resp = await fetch(
    "https://texttospeech.googleapis.com/v1/text:synthesize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    },
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Text-to-speech failed: ${resp.status} ${body}`);
  }

  const data = (await resp.json()) as { audioContent?: string };
  if (!data.audioContent) return new Uint8Array();
  return base64ToBytes(data.audioContent);
}
