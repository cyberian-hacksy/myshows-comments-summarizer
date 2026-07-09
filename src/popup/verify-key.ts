// API-key check backed by the cheapest authenticated call available (the
// model list). A success doubles as a fresh model roster for the caller.

export type KeyVerification =
  | { ok: true; modelCount: number }
  | { ok: false; message: string }

export async function verifyKey(
  apiKey: string,
  fetchModels: (apiKey: string) => Promise<string[]>,
): Promise<KeyVerification> {
  if (!apiKey.trim()) {
    return { ok: false, message: 'Enter an API key first.' }
  }
  try {
    const ids = await fetchModels(apiKey)
    return { ok: true, modelCount: ids.length }
  } catch {
    return { ok: false, message: 'Key rejected — check it on the OpenAI dashboard.' }
  }
}
