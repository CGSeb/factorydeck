export type Answer =
  { reached: true; status: number; body: unknown } | { reached: false };

export interface Http {
  fetch: typeof fetch;
  timeoutMs: number;
}

export interface Call {
  method: 'GET' | 'POST';
  body?: unknown;
  token?: string;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function headersOf(call: Call): Record<string, string> {
  return {
    accept: 'application/json',
    ...(call.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(call.token === undefined
      ? {}
      : { authorization: `Bearer ${call.token}` }),
  };
}

export async function request(
  http: Http,
  url: string,
  call: Call,
): Promise<Answer> {
  try {
    const response = await http.fetch(url, {
      method: call.method,
      headers: headersOf(call),
      body: call.body === undefined ? null : JSON.stringify(call.body),
      redirect: 'manual',
      signal: AbortSignal.timeout(http.timeoutMs),
    });
    const text = await response.text();
    return { reached: true, status: response.status, body: parseJson(text) };
  } catch {
    return { reached: false };
  }
}

export function errorOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined;
  }
  return typeof body.error === 'string' ? body.error : undefined;
}
