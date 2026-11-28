import type { Handler, Hono } from 'hono';
import { accountIdOf } from '../team/account-change.ts';
import type {
  ResetLinkOutcome,
  ResetLinkRequest,
} from '../team/reset-links.ts';
import type { ApiContext } from './api-context.ts';
import type { AuthEnv } from './auth-routes.ts';

export type CreateResetLink = (
  request: ResetLinkRequest,
) => Promise<ResetLinkOutcome>;

export function resetLinkRoute(
  resetLink: CreateResetLink,
  fromDatabase: ApiContext['fromDatabase'],
): Handler<AuthEnv> {
  return async (c) => {
    const accountId = accountIdOf(c.req.param('id') ?? '');
    if (accountId === undefined) return c.json({ error: 'Not found' }, 404);
    const createdBy = c.get('account').id;
    const outcome = await fromDatabase(() =>
      resetLink({ accountId, createdBy }),
    );
    switch (outcome.status) {
      case 'unreachable':
        return c.json(outcome, 503);
      case 'not-found':
        return c.json({ error: 'Not found' }, 404);
      case 'conflict':
        return c.json({ error: outcome.error }, 409);
      case 'created':
        return c.json(
          { token: outcome.token, expiresAt: outcome.expiresAt.toISOString() },
          201,
        );
    }
  };
}

export function addResetLinkRoute(
  routes: Hono<AuthEnv>,
  resetLink: CreateResetLink | undefined,
  fromDatabase: ApiContext['fromDatabase'],
): void {
  if (resetLink === undefined) return;
  routes.post(
    '/accounts/:id/reset-link',
    resetLinkRoute(resetLink, fromDatabase),
  );
}
