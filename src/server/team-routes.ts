import { type Context, Hono } from 'hono';
import {
  type AccountChange,
  accountChangeOf,
  accountIdOf,
} from '../team/account-change.ts';
import {
  type StatusChangeOutcome,
  type StatusChangeRequest,
  activeChangeOf,
} from '../team/account-status.ts';
import type {
  RoleChangeOutcome,
  RoleChangeRequest,
} from '../team/change-role.ts';
import {
  MANAGERS_ONLY,
  type TeamAccount,
  type TeamResponse,
} from '../team/types.ts';
import type { InvitationSource } from '../team/invitations.ts';
import type { ApiContext } from './api-context.ts';
import type { AuthEnv } from './auth-routes.ts';
import { teamInvitationRoutes } from './invitation-routes.ts';
import { type CreateResetLink, addResetLinkRoute } from './reset-link-route.ts';

export interface TeamSource {
  accounts: () => Promise<TeamAccount[]>;
  changeRole?: (request: RoleChangeRequest) => Promise<RoleChangeOutcome>;
  invitations?: InvitationSource | undefined;
  changeStatus?: (request: StatusChangeRequest) => Promise<StatusChangeOutcome>;
  resetLink?: CreateResetLink;
}

type ChangeOutcome = RoleChangeOutcome | StatusChangeOutcome;

function sendChange(
  team: TeamSource,
  requesterId: number,
  accountId: number,
  change: AccountChange,
): (() => Promise<ChangeOutcome>) | undefined {
  if (change.kind === 'active') {
    const { changeStatus } = team;
    if (changeStatus === undefined) return undefined;
    return () =>
      changeStatus({
        requesterId,
        accountId,
        change: activeChangeOf(change.active),
        now: new Date(),
      });
  }
  const { changeRole } = team;
  if (changeRole === undefined) return undefined;
  return () =>
    changeRole({
      requesterId,
      accountId,
      change:
        change.kind === 'role'
          ? { role: change.role }
          : { refusal: change.refusal },
    });
}

function notFound(c: Context): Response {
  return c.json({ error: 'Not found' }, 404);
}

function roleChangeAnswer(
  c: Context,
  outcome: ChangeOutcome,
  requesterId: number,
): Response {
  switch (outcome.status) {
    case 'changed':
      return c.json(
        { ...outcome.account, you: outcome.account.id === requesterId },
        200,
      );
    case 'signed-out':
      return c.json({ error: 'Not signed in' }, 401);
    case 'managers-only':
      return c.json({ error: MANAGERS_ONLY }, 403);
    case 'not-found':
      return notFound(c);
    case 'invalid':
      return c.json(outcome.refusal, 400);
    case 'conflict':
      return c.json({ error: outcome.error }, 409);
  }
}

export function teamRoutes(
  team: TeamSource | undefined,
  { refreshSeconds, fromDatabase }: ApiContext,
): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
  routes.use('*', async (c, next) => {
    if (c.get('account').role !== 'manager') {
      return c.json({ error: MANAGERS_ONLY }, 403);
    }
    return next();
  });
  if (team !== undefined) {
    routes.get('/accounts', async (c) => {
      const you = c.get('account').id;
      const body: TeamResponse = await fromDatabase(async () => ({
        status: 'ok',
        refreshSeconds,
        accounts: (await team.accounts()).map((row) => ({
          ...row,
          you: row.id === you,
        })),
      }));
      return c.json(body, body.status === 'ok' ? 200 : 503);
    });
  }
  if (team !== undefined) {
    routes.patch('/accounts/:id', async (c) => {
      const accountId = accountIdOf(c.req.param('id'));
      if (accountId === undefined) return notFound(c);
      const change = accountChangeOf(
        await c.req.json().catch((): unknown => undefined),
      );
      const requesterId = c.get('account').id;
      const send = sendChange(team, requesterId, accountId, change);
      if (send === undefined) return notFound(c);
      const outcome = await fromDatabase(send).catch((error: unknown) => {
        if (change.kind === 'active') {
          return { status: 'unreachable' as const, refreshSeconds };
        }
        throw error;
      });
      if (outcome.status === 'unreachable') return c.json(outcome, 503);
      return roleChangeAnswer(c, outcome, requesterId);
    });
  }
  if (team?.invitations !== undefined) {
    routes.route(
      '/invitations',
      teamInvitationRoutes(team.invitations, { refreshSeconds, fromDatabase }),
    );
  }
  addResetLinkRoute(routes, team?.resetLink, fromDatabase);
  routes.all('*', notFound);
  return routes;
}
