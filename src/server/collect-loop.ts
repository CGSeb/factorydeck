export interface CollectLoopOptions {
  run: () => Promise<void>;
  intervalMs: number;
  onError: (error: unknown) => void;
}

export interface CollectLoop {
  refresh: () => Promise<void>;
  stop: () => Promise<void>;
}

export function startCollectLoop({
  run,
  intervalMs,
  onError,
}: CollectLoopOptions): CollectLoop {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let current: Promise<void> | undefined;

  function start(): Promise<void> {
    if (current !== undefined) return current;
    clearTimeout(timer);
    const running = run()
      .catch(onError)
      .finally(() => {
        current = undefined;
        if (!stopped) timer = setTimeout(() => void start(), intervalMs);
      });
    current = running;
    return running;
  }

  void start();
  return {
    refresh: () => (stopped ? Promise.resolve() : start()),
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await current;
    },
  };
}
