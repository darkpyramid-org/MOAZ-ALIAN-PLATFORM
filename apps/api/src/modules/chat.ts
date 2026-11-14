import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { bindBody } from '../middleware/body.js';
import { sendJson, sendNoContent, sendStatusPage, traceOf } from '../lib/http.js';
import { netTimestamp } from '../lib/netjson.js';

/**
 * Chat persistence — migration decision D3. There is NO .NET contract here
 * (the tables were created after the legacy API froze), so this module is
 * deliberately small and boring:
 *
 *   GET    /api/chat/threads                 → the caller's threads, newest first
 *   POST   /api/chat/threads                 → {title?} → thread
 *   DELETE /api/chat/threads/:id             → own thread → 204; foreign → 404
 *   GET    /api/chat/threads/:id/messages    → own thread's messages
 *   POST   /api/chat/threads/:id/messages    → {role, content} → message
 *
 * Ownership is absolute: every read/write filters on the thread's owner, and
 * a thread that exists but belongs to someone else answers the same bare 404
 * as a missing one — existence is not disclosed across accounts. Timestamps
 * use the platform's standard wire format; keys are snake_case to match the
 * frontend's ChatThread shape ({id, title, updated_at}).
 */

const router = Router();

interface ThreadRow {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function threadJson(thread: ThreadRow): Record<string, unknown> {
  return {
    id: thread.id,
    title: thread.title,
    created_at: netTimestamp(thread.createdAt),
    updated_at: netTimestamp(thread.updatedAt),
  };
}

router.get('/api/chat/threads', requireAuth, (req, res, next) => {
  const userId = req.auth?.userId ?? '';
  db.chatThread
    .findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } })
    .then((threads) => sendJson(res, 200, threads.map(threadJson)))
    .catch(next);
});

router.post('/api/chat/threads', requireAuth, (req, res, next) => {
  const userId = req.auth?.userId ?? '';
  if (userId === '') {
    sendStatusPage(res, 401, traceOf(req));
    return;
  }

  let title: string | null = null;
  try {
    // An empty body is fine here (the endpoint accepts no arguments at all in
    // the common case); a JSON body may carry a title.
    const raw = (req as unknown as Request & { rawBody?: Buffer }).rawBody;
    if (raw !== undefined && raw.length > 0) {
      const bound = bindBody(req, [{ key: 'title', kind: 'string' }]);
      const supplied = (bound['title'] as string | null | undefined) ?? null;
      title = supplied === null || supplied.trim() === '' ? null : supplied.trim();
    }
  } catch (error) {
    next(error);
    return;
  }

  db.chatThread
    .create({ data: { userId, title } })
    .then((thread) => sendJson(res, 200, threadJson(thread)))
    .catch(next);
});

/** Loads the thread only when it belongs to the caller; otherwise 404. */
function loadOwnThread(threadId: string, userId: string): Promise<ThreadRow | null> {
  // findFirst over BOTH predicates instead of findUnique-then-compare: the
  // foreign-owned thread is indistinguishable from a missing one by design.
  return db.chatThread.findFirst({ where: { id: threadId, userId } });
}

router.delete('/api/chat/threads/:id', requireAuth, (req, res, next) => {
  const userId = req.auth?.userId ?? '';
  const threadId = String(req.params['id'] ?? '');

  db.chatThread
    .deleteMany({ where: { id: threadId, userId } })
    .then((result) => {
      if (result.count === 0) {
        // Missing OR foreign — the same bare 404 the debates routes use.
        sendStatusPage(res, 404, traceOf(req));
        return;
      }
      // Messages cascade via the FK.
      sendNoContent(res);
    })
    .catch(next);
});

router.get('/api/chat/threads/:id/messages', requireAuth, (req, res, next) => {
  const userId = req.auth?.userId ?? '';
  const threadId = String(req.params['id'] ?? '');

  loadOwnThread(threadId, userId)
    .then((thread) => {
      if (thread === null) {
        sendStatusPage(res, 404, traceOf(req));
        return;
      }
      return db.chatMessage
        .findMany({ where: { threadId: thread.id }, orderBy: { createdAt: 'asc' } })
        .then((messages) =>
          sendJson(
            res,
            200,
            messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              created_at: netTimestamp(message.createdAt),
            })),
          ),
        );
    })
    .catch(next);
});

router.post('/api/chat/threads/:id/messages', requireAuth, (req, res, next) => {
  const userId = req.auth?.userId ?? '';
  const threadId = String(req.params['id'] ?? '');

  let bound: Record<string, unknown>;
  try {
    bound = bindBody(req, [
      { key: 'role', kind: 'string' },
      { key: 'content', kind: 'string' },
    ]);
  } catch (error) {
    next(error);
    return;
  }

  const role = (bound['role'] as string | null | undefined) ?? '';
  const content = (bound['content'] as string | null | undefined) ?? '';
  if (role !== 'user' && role !== 'assistant') {
    // A junk role would poison the transcript the UI replays; reject it
    // before it lands in the database.
    sendJson(res, 400, { title: 'role must be "user" or "assistant".', status: 400 });
    return;
  }

  loadOwnThread(threadId, userId)
    .then((thread) => {
      if (thread === null) {
        sendStatusPage(res, 404, traceOf(req));
        return;
      }
      const now = new Date();
      return db.$transaction([
        db.chatMessage.create({
          data: { threadId: thread.id, role, content, createdAt: now },
        }),
        db.chatThread.update({ where: { id: thread.id }, data: { updatedAt: now } }),
      ]).then(([message]) =>
        sendJson(res, 200, {
          id: message.id,
          role: message.role,
          content: message.content,
          created_at: netTimestamp(message.createdAt),
        }),
      );
    })
    .catch(next);
});

export const chatRoutes = router;
