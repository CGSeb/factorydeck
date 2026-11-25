import { countedRequest } from '../git-host/outcome.ts';
import {
  type RequestRow,
  outcomeRequest,
} from '../git-host/outcome-request.ts';
import type { BugFix } from './types.ts';

export function bugFix(requests: readonly RequestRow[]): BugFix | null {
  const counted = countedRequest(
    requests.map((row) => ({
      ...outcomeRequest(row),
      number: row.number,
      url: row.url,
    })),
  );
  const report = counted?.report;
  if (counted === undefined || report == null) return null;
  return {
    rootCause: report.rootCause ?? null,
    reproduced: report.reproduced ?? null,
    request: { number: counted.number, url: counted.url },
  };
}
