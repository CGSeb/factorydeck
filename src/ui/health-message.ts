/** The sentence the page shows for the database health. */
export function healthMessage(databaseAnswers: boolean): string {
  return databaseAnswers
    ? 'Database connected.'
    : 'Database unreachable. Start it with pnpm db:up.';
}

/** Reads `/api/health` once; any failure counts as an unreachable database. */
export async function fetchHealthMessage(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  try {
    const response = await fetchImpl('/api/health');
    return healthMessage(response.ok);
  } catch {
    return healthMessage(false);
  }
}
