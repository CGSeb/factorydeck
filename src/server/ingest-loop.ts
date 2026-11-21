export interface IngestLoopOptions {
  run: () => Promise<boolean>;
  intervalMs: number;
  onError: (error: unknown) => void;
}

export interface IngestLoop {
  lastFinishedAt: () => Date | undefined;
  stop: () => Promise<void>;
}

export function startIngestLoop({
  run,
  intervalMs,
  onError,
}: IngestLoopOptions): IngestLoop {
  let lastFinishedAt: Date | undefined;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let current: Promise<void> = Promise.resolve();

  async function once(): Promise<void> {
    try {
      if (await run()) lastFinishedAt = new Date();
    } catch (error) {
      onError(error);
    }
  }

  function tick(): void {
    current = once().then(() => {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    });
  }

  tick();
  return {
    lastFinishedAt: () => lastFinishedAt,
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await current;
    },
  };
}
