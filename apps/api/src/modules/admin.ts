import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from '../lib/db.js';
import { bindBody, bindRawJson } from '../middleware/body.js';
import { requireAdmin, requireEditor } from '../middleware/auth.js';
import { sendJson, sendNoContent, sendStatusPage, traceOf } from '../lib/http.js';
import { netTimestamp, netTimestampZ, netOSeven } from '../lib/netjson.js';

/**
 * /api users + settings + debates — the port of AdminEndpoints.cs. Three
 * different gate levels live side by side here and all three matter:
 *   - /api/users            → SiteAdmin policy;
 *   - /api/settings (PUT)   → ContentEditor policy (GET is deliberately
 *     ANONYMOUS — the public site renders from it);
 *   - /api/debates          → ContentEditor policy.
 * No editorial rate limit applies to any of these (only the six
 * content/category write endpoints carry that policy).
 */

const router = Router();

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUID_COMPACT_PATTERN = /^[0-9a-f]{32}$/i;

/**
 * The {id:guid} route constraint: a non-guid id never matches the route at
 * all, so the caller gets the bare 404 status page — identical bytes to a
 * completely unknown path.
 */
function isGuid(raw: string): boolean {
  return GUID_PATTERN.test(raw) || GUID_COMPACT_PATTERN.test(raw);
}

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

router.get('/api/users', requireAdmin, (_req, res, next) => {
  db.user
    .findMany({ orderBy: { createdAt: 'asc' } })
    .then((users) => {
      // Key order mirrors the anonymous projection in AdminEndpoints: the
      // display name is derived (email local part) because the column is
      // sparsely populated and the dashboard shows it unconditionally.
      sendJson(
        res,
        200,
        users.map((user) => ({
          id: user.id,
          email: user.email,
          display_name: user.email.split('@')[0],
          created_at: netTimestamp(user.createdAt),
          roles: user.roles,
        })),
      );
    })
    .catch(next);
});

router.post('/api/users/:id/roles', requireAdmin, (req, res, next) => {
  const routeId = String(req.params['id'] ?? '');
  if (!isGuid(routeId)) {
    // Route-constraint miss: bare 404, rendered by the status-page pass.
    sendStatusPage(res, 404, traceOf(req));
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = bindBody(req, [
      { key: 'role', kind: 'string' },
      { key: 'has', kind: 'boolean' },
    ]);
  } catch (error) {
    next(error);
    return;
  }

  const role = (body['role'] as string | null | undefined) ?? null;
  const has = body['has'] === true;

  db.user
    .findUnique({ where: { id: routeId } })
    .then((found) => {
      // Results.NotFound(): bare 404 → the status-page body.
      if (found === null) {
        sendStatusPage(res, 404, traceOf(req));
        return;
      }
      if (role === null || role === '') {
        // Role.ToLowerInvariant() on the original's null would fault too; the
        // generic 500 keeps both runtimes honest about a nonsense payload.
        throw new Error('Role must not be null.');
      }

      let roles = [...found.roles];
      // The wire semantics are INVERTED relative to intuition: has=true means
      // "remove" and has=false means "add" — the dashboard passes CURRENT state.
      if (has) {
        const lowered = role.toLowerCase();
        roles = roles.filter((existing) => existing.toLowerCase() !== lowered);
      } else {
        const present = roles.some((existing) => existing.toLowerCase() === role.toLowerCase());
        if (!present) roles.push(role.toLowerCase());
      }

      const changed = roles.length !== found.roles.length ||
        roles.some((value, index) => value.toLowerCase() !== (found.roles[index] ?? '').toLowerCase());
      return db.user
        .update({
          where: { id: routeId },
          data: {
            roles,
            updatedAt: new Date(),
            ...(changed ? { tokenVersion: { increment: 1 } } : {}),
          },
        })
        .then((updated) => sendJson(res, 200, { success: true, roles: updated.roles }));
    })
    .catch(next);
});

// ---------------------------------------------------------------------------
// Site settings — GET anonymous, PUT editor-gated. The stored value is the
// caller's raw JSON text; GET re-parses it, so the round-trip preserves
// property order exactly while normalising whitespace.
// ---------------------------------------------------------------------------

router.get('/api/settings', (_req, res, next) => {
  readSettings('main', res, next);
});

router.get('/api/settings/:id', (req, res, next) => {
  readSettings(String(req.params['id'] ?? ''), res, next);
});

function readSettings(targetId: string, res: Response, next: NextFunction): void {
  db.siteSetting
    .findUnique({ where: { id: targetId } })
    .then((row) => {
      if (row === null) {
        sendJson(res, 200, { data: null, version: 'default' });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.data);
      } catch {
        // JsonDocument.Parse would fault on corrupt stored text too; the
        // generic 500 keeps the failure honest instead of serving junk.
        throw new Error('Stored site settings are not valid JSON.');
      }
      sendJson(res, 200, { data: parsed, version: netOSeven(row.updatedAt) });
    })
    .catch(next);
}

router.put('/api/settings', requireEditor, (req, res, next) => {
  writeSettings('main', req, res, next);
});

router.put('/api/settings/:id', requireEditor, (req, res, next) => {
  writeSettings(String(req.params['id'] ?? ''), req, res, next);
});

function writeSettings(targetId: string, req: Request, res: Response, next: NextFunction): void {
  let raw: string;
  try {
    // [FromBody] JsonElement + GetRawText: the value is stored byte-for-byte
    // as the caller sent it — whitespace, property order and all.
    raw = bindRawJson(req).raw;
  } catch (error) {
    next(error);
    return;
  }

  const now = new Date();
  db.siteSetting
    .upsert({
      where: { id: targetId },
      create: { id: targetId, data: raw, updatedAt: now },
      update: { data: raw, updatedAt: now },
    })
    .then(() => sendJson(res, 200, { success: true }))
    .catch(next);
}

// ---------------------------------------------------------------------------
// Debates — raw ADO.NET in the original, Prisma here; the ordering rule
// (DebateDate DESC NULLS LAST, then CreatedAt DESC) is expressed explicitly
// because Prisma's default DESC null ordering is the opposite of the SQL.
// ---------------------------------------------------------------------------

const DEBATE_SELECT = {
  id: true,
  guestName: true,
  guestBackground: true,
  topic: true,
  replySummary: true,
  outcome: true,
  debateDate: true,
  videoUrl: true,
  tags: true,
  notes: true,
  createdAt: true,
} as const;

function debateJson(row: {
  id: string;
  guestName: string;
  guestBackground: string | null;
  topic: string;
  replySummary: string | null;
  outcome: string;
  debateDate: string | null;
  videoUrl: string | null;
  tags: string[];
  notes: string | null;
  createdAt: Date;
}): Record<string, unknown> {
  // Snake_case keys are the contract the dashboard consumes; created_at is a
  // raw timestamp column, so it prints with the "Z" instant form.
  return {
    id: row.id,
    guest_name: row.guestName,
    guest_background: row.guestBackground,
    topic: row.topic,
    reply_summary: row.replySummary,
    outcome: row.outcome,
    debate_date: row.debateDate,
    video_url: row.videoUrl,
    tags: row.tags ?? [],
    notes: row.notes,
    created_at: netTimestampZ(row.createdAt),
  };
}

interface DebateBound {
  guestName: string | null;
  guestBackground: string | null;
  topic: string | null;
  replySummary: string | null;
  outcome: string | null;
  debateDate: string | null;
  videoUrl: string | null;
  tags: string[] | null;
  notes: string | null;
}

function bindDebate(req: Request): DebateBound {
  const body = bindBody(req, [
    { key: 'guestName', kind: 'string' },
    { key: 'guestBackground', kind: 'string' },
    { key: 'topic', kind: 'string' },
    { key: 'replySummary', kind: 'string' },
    { key: 'outcome', kind: 'string' },
    { key: 'debateDate', kind: 'string' },
    { key: 'videoUrl', kind: 'string' },
    { key: 'tags', kind: 'stringArray' },
    { key: 'notes', kind: 'string' },
    // Present in the DTO but ignored by the write path (the DB stamps NOW());
    // the binding must still validate its shape, so a wrong-typed value fails
    // the same way the original's binder would.
    { key: 'createdAt', kind: 'date' },
  ]);
  return {
    guestName: (body['guestName'] as string | null) ?? null,
    guestBackground: (body['guestBackground'] as string | null) ?? null,
    topic: (body['topic'] as string | null) ?? null,
    replySummary: (body['replySummary'] as string | null) ?? null,
    outcome: (body['outcome'] as string | null) ?? null,
    debateDate: (body['debateDate'] as string | null) ?? null,
    videoUrl: (body['videoUrl'] as string | null) ?? null,
    tags: (body['tags'] as string[] | null) ?? null,
    notes: (body['notes'] as string | null) ?? null,
  };
}

router.get('/api/debates', requireEditor, (_req, res, next) => {
  db.debate
    .findMany({
      orderBy: [{ debateDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      select: DEBATE_SELECT,
    })
    .then((rows) => sendJson(res, 200, rows.map(debateJson)))
    .catch(next);
});

router.post('/api/debates', requireEditor, (req, res, next) => {
  let bound: DebateBound;
  try {
    bound = bindDebate(req);
  } catch (error) {
    next(error);
    return;
  }

  // A null guest name reaches the database and the NOT NULL constraint
  // rejects it — surfacing as the generic 500, exactly like the original.
  db.debate
    .create({
      data: {
        id: crypto.randomUUID(),
        guestName: bound.guestName as string,
        guestBackground: bound.guestBackground,
        topic: bound.topic as string,
        replySummary: bound.replySummary,
        outcome: bound.outcome ?? 'open',
        debateDate: bound.debateDate,
        videoUrl: bound.videoUrl,
        tags: bound.tags ?? [],
        notes: bound.notes,
        createdAt: new Date(),
      },
    })
    .then((created) => sendJson(res, 200, { id: created.id, success: true }))
    .catch(next);
});

router.put('/api/debates/:id', requireEditor, (req, res, next) => {
  const routeId = String(req.params['id'] ?? '');
  if (!isGuid(routeId)) {
    sendStatusPage(res, 404, traceOf(req));
    return;
  }

  let bound: DebateBound;
  try {
    bound = bindDebate(req);
  } catch (error) {
    next(error);
    return;
  }

  db.debate
    .updateMany({
      where: { id: routeId },
      data: {
        guestName: bound.guestName as string,
        guestBackground: bound.guestBackground,
        topic: bound.topic as string,
        replySummary: bound.replySummary,
        outcome: bound.outcome ?? 'open',
        debateDate: bound.debateDate,
        videoUrl: bound.videoUrl,
        tags: bound.tags ?? [],
        notes: bound.notes,
      },
    })
    .then((result) => {
      // affected == 0 → Results.NotFound(): bare 404 → status-page body.
      if (result.count === 0) {
        sendStatusPage(res, 404, traceOf(req));
        return;
      }
      sendJson(res, 200, { id: routeId, success: true });
    })
    .catch(next);
});

router.delete('/api/debates/:id', requireEditor, (req, res, next) => {
  const routeId = String(req.params['id'] ?? '');
  if (!isGuid(routeId)) {
    sendStatusPage(res, 404, traceOf(req));
    return;
  }

  db.debate
    .deleteMany({ where: { id: routeId } })
    .then((result) => {
      if (result.count === 0) {
        sendStatusPage(res, 404, traceOf(req));
        return;
      }
      sendNoContent(res);
    })
    .catch(next);
});

export const adminRoutes = router;
