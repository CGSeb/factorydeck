export interface SessionGate {
  onSignedOut: (listener: () => void) => () => void;
  reopen: () => void;
}

export interface AuthGate extends SessionGate {
  fetch: typeof fetch;
}

function requestOf(
  input: Parameters<typeof fetch>[0],
  init: RequestInit | undefined,
): { method: string; path: string } {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const method =
    init?.method ??
    (typeof input === 'object' && 'method' in input ? input.method : 'GET');
  return {
    method: method.toUpperCase(),
    path: new URL(url, 'http://factorydeck.invalid').pathname,
  };
}

function isSignIn(request: { method: string; path: string }): boolean {
  return request.method === 'POST' && request.path === '/api/auth/sign-in';
}

function never(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

export function authGate(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): AuthGate {
  let generation = 0;
  let closed = false;
  const listeners = new Set<() => void>();

  function close(): void {
    closed = true;
    generation += 1;
    for (const listener of listeners) listener();
  }

  return {
    fetch: async (input, init) => {
      if (closed) return never();
      const sent = generation;
      let response: Response;
      try {
        response = await fetchImpl(input, init);
      } catch (error) {
        if (sent !== generation) return never();
        throw error;
      }
      if (sent !== generation) return never();
      if (response.status === 401 && !isSignIn(requestOf(input, init))) {
        close();
        return never();
      }
      return response;
    },
    onSignedOut: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reopen: () => {
      closed = false;
    },
  };
}
