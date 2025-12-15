# Siri Shortcuts (Voice Commands)

This project supports a voice request flow via the API Worker endpoint `/v1/voice-chat`.

## Create a Shortcut (basic)

1. Open the **Shortcuts** app.
2. Create a new Shortcut.
3. Add **Record Audio**.
   - Keep the recording short and clear.
4. Add **Get Contents of URL**.
   - **URL**: `https://<YOUR_API_HOST>/v1/voice-chat`
   - **Method**: `POST`
   - **Request Body**: `Form`
   - Add a field named `audio` with the recorded audio as the value.
   - Add header `Authorization: Bearer <YOUR_API_TOKEN>`.
5. Add **Get Dictionary from Input**.
   - Input: the output of “Get Contents of URL”.
6. Add **Get Dictionary Value**.
   - Key: `audio`
7. Add **Base64 Decode**.
8. Add **Play Sound**.
   - Input: the decoded audio data.

## Trigger the Shortcut via URL (optional)

Shortcuts can be run via deep links using the `shortcuts://` scheme.

The helper `createShortcutUrl()` is available from the shared package (`@aperion/shared`) and follows:

`shortcuts://run-shortcut?name=[name]&input=[input]&text=[text]`

Example:

- name: `Aperion Voice`
- input: `text`
- text: `Hello`

This is useful for wiring together automations that kick off a Shortcut with pre-filled text.
