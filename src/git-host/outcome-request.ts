import type { gitHostRequest } from '../db/schema.ts';
import type { OutcomeRequest } from './outcome.ts';
import type { RequestState } from './types.ts';

export type RequestRow = typeof gitHostRequest.$inferSelect;

export function requestState(value: string): RequestState {
  return value === 'merged' || value === 'closed' ? value : 'open';
}

export function outcomeRequest(request: RequestRow): OutcomeRequest {
  return {
    state: requestState(request.state),
    mergedAt: request.mergedAt?.toISOString() ?? null,
    updatedAt: request.updatedAt.toISOString(),
    report: request.report,
    reports: request.reports,
  };
}
