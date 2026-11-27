import { SERVER_UNREACHABLE } from './auth-api.ts';
import {
  type AccountChangeOutcome,
  accountChangeOutcome,
} from './role-change-api.ts';

export type ChangeActive = (
  accountId: number,
  active: boolean,
) => Promise<AccountChangeOutcome>;

export function activeChanger(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): ChangeActive {
  return async (accountId, active) => {
    try {
      const response = await fetchImpl(`/api/team/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      return await accountChangeOutcome(response);
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
  };
}
