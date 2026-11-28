const HTTP_SCHEME = /^https?:\/\//i;

export function serverOrigin(input: string): string | undefined {
  const trimmed = input.trim();
  if (!HTTP_SCHEME.test(trimmed) || !URL.canParse(trimmed)) return undefined;
  const url = new URL(trimmed);
  if (url.username !== '' || url.password !== '') return undefined;
  return url.origin;
}

export function invalidServerUrl(input: string): string {
  return `Invalid server URL: ${input}. It needs http:// or https://.`;
}
