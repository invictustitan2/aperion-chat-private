type GeminiEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export async function generateAssistantReply(
  userText: string,
  env: GeminiEnv,
): Promise<string> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const model = env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: userText }],
        },
      ],
      generationConfig: {
        temperature: 0.6,
      },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gemini request failed: ${resp.status} ${body}`);
  }

  const data = (await resp.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  return text;
}
