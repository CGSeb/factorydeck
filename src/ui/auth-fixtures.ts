import { loaders } from './app-fixtures.ts';
import type {
  AuthState,
  LoadAuthState,
  LoadMe,
  MeResult,
  SignIn,
} from './auth-api.ts';
import { authGate, type AuthGate } from './auth-gate.ts';

export const ACCOUNT = {
  id: 1,
  email: 'ada@example.test',
  name: 'Ada',
  role: 'dev',
} as const;

type Loaders = typeof loaders;

export interface World {
  signedIn: boolean;
  calls: string[];
  state: () => Promise<AuthState>;
  me: () => Promise<MeResult>;
  reset: () => void;
}

export function world(signedIn: boolean, setUp?: (here: World) => void): World {
  const here: World = {
    signedIn,
    calls: [],
    state: () => Promise.resolve({ setup: false }),
    me: () =>
      Promise.resolve(
        here.signedIn
          ? { status: 'account', account: ACCOUNT }
          : { status: 'signed-out' },
      ),
    reset: () => {
      here.signedIn = signedIn;
      here.calls.length = 0;
      here.state = () => Promise.resolve({ setup: false });
      here.me = () =>
        Promise.resolve(
          here.signedIn
            ? { status: 'account', account: ACCOUNT }
            : { status: 'signed-out' },
        );
      setUp?.(here);
    },
  };
  here.reset();
  return here;
}

function gated<A extends unknown[], R>(
  gate: AuthGate,
  path: string,
  load: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args) => {
    await gate.fetch(path);
    return load(...args);
  };
}

function gatedLoaders(gate: AuthGate): Loaders {
  return {
    loadOverview: gated(gate, '/api/loadOverview', loaders.loadOverview),
    loadSessions: gated(gate, '/api/loadSessions', loaders.loadSessions),
    loadSession: gated(gate, '/api/loadSession', loaders.loadSession),
    loadSkills: gated(gate, '/api/loadSkills', loaders.loadSkills),
    loadSkill: gated(gate, '/api/loadSkill', loaders.loadSkill),
    loadRoles: gated(gate, '/api/loadRoles', loaders.loadRoles),
    loadFeatures: gated(gate, '/api/loadFeatures', loaders.loadFeatures),
    loadFeature: gated(gate, '/api/loadFeature', loaders.loadFeature),
    loadBugs: gated(gate, '/api/loadBugs', loaders.loadBugs),
    loadFactory: gated(gate, '/api/loadFactory', loaders.loadFactory),
    loadCollection: gated(gate, '/api/loadCollection', loaders.loadCollection),
    refreshCollection: gated(
      gate,
      '/api/refreshCollection',
      loaders.refreshCollection,
    ),
    loadAutonomy: gated(gate, '/api/loadAutonomy', loaders.loadAutonomy),
    loadQuality: gated(gate, '/api/loadQuality', loaders.loadQuality),
    loadFrictions: gated(gate, '/api/loadFrictions', loaders.loadFrictions),
    loadOccurrences: gated(
      gate,
      '/api/loadOccurrences',
      loaders.loadOccurrences,
    ),
    loadOutput: gated(gate, '/api/loadOutput', loaders.loadOutput),
    loadFlow: gated(gate, '/api/loadFlow', loaders.loadFlow),
    loadBugStats: gated(gate, '/api/loadBugStats', loaders.loadBugStats),
    loadWaiting: gated(gate, '/api/loadWaiting', loaders.loadWaiting),
  };
}

export function appArgs(here: World): Loaders & {
  loadAuthState: LoadAuthState;
  loadMe: LoadMe;
  signIn: SignIn;
  sessionGate: AuthGate;
} {
  const gate = authGate((input) => {
    here.calls.push(typeof input === 'string' ? input : '');
    return Promise.resolve(
      here.signedIn
        ? Response.json({})
        : Response.json({ error: 'Not signed in' }, { status: 401 }),
    );
  });
  return {
    ...gatedLoaders(gate),
    sessionGate: gate,
    loadAuthState: () => {
      here.calls.push('state');
      return here.state();
    },
    loadMe: () => {
      here.calls.push('me');
      return here.me();
    },
    signIn: () => {
      here.calls.push('sign-in');
      here.signedIn = true;
      return Promise.resolve({ status: 'signed-in', account: ACCOUNT });
    },
  };
}

export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export function dataCalls(here: World): string[] {
  return here.calls.filter((call) => call.startsWith('/api/'));
}
