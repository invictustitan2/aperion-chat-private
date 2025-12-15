export function createShortcutUrl(
  name: string,
  input: "text" | "clipboard",
  text: string,
): string {
  const encodedName = encodeURIComponent(name);
  const encodedText = encodeURIComponent(text);
  return `shortcuts://run-shortcut?name=${encodedName}&input=${input}&text=${encodedText}`;
}
