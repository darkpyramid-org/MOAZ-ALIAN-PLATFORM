import { Router } from 'express';
import { bindBody } from '../middleware/body.js';
import { requireEditor } from '../middleware/auth.js';
import { editorialRateLimit } from '../middleware/rateLimit.js';
import { sendJson, sendCreated, sendNoContent } from '../lib/http.js';
import { validateUpsertCategory } from '../domain/validators.js';
import * as categoryService from '../services/categoryService.js';

/**
 * /api/categories — the port of CategoryEndpoints.cs. Validation happens at
 * the route (the original validates in BOTH the endpoint and the service —
 * the second pass is unobservable, so one call keeps the same wire behaviour).
 * Writes are editor-gated and share the content cache token: a category
 * rename changes what every cached list shows.
 */

const router = Router();

router.get('/api/categories', (_req, res, next) => {
  categoryService
    .listCategories()
    .then((list) => sendJson(res, 200, list))
    .catch(next);
});

router.get('/api/categories/:id', (req, res, next) => {
  categoryService
    .getCategory(String(req.params['id'] ?? ''))
    .then((category) => sendJson(res, 200, category))
    .catch(next);
});

/** Bound body → service input, with the record's CLR default for absent SortOrder. */
function categoryInput(bound: Record<string, unknown>): {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
} {
  return {
    id: (bound['id'] as string | null | undefined) ?? '',
    name: (bound['name'] as string | null | undefined) ?? '',
    description: (bound['description'] as string | null | undefined) ?? null,
    sortOrder: (bound['sortOrder'] as number | null | undefined) ?? 0,
  };
}

router.post('/api/categories', requireEditor, editorialRateLimit, (req, res, next) => {
  try {
    const bound = bindBody(req, [
      { key: 'id', kind: 'string', required: true },
      { key: 'name', kind: 'string', required: true },
      { key: 'description', kind: 'string' },
      { key: 'sortOrder', kind: 'number' },
    ]);
    validateUpsertCategory({
      id: (bound['id'] as string | null | undefined) ?? null,
      name: (bound['name'] as string | null | undefined) ?? null,
      description: (bound['description'] as string | null | undefined) ?? null,
    });

    categoryService
      .createCategory(categoryInput(bound), req.auth ?? undefined)
      .then((created) => {
        // The Location header mirrors Results.Created: the raw id, unencoded.
        sendCreated(res, `/api/categories/${created['id']}`, created);
      })
      .catch(next);
  } catch (error) {
    next(error);
  }
});

router.put('/api/categories/:id', requireEditor, editorialRateLimit, (req, res, next) => {
  try {
    const bound = bindBody(req, [
      { key: 'id', kind: 'string', required: true },
      { key: 'name', kind: 'string', required: true },
      { key: 'description', kind: 'string' },
      { key: 'sortOrder', kind: 'number' },
    ]);
    validateUpsertCategory({
      id: (bound['id'] as string | null | undefined) ?? null,
      name: (bound['name'] as string | null | undefined) ?? null,
      description: (bound['description'] as string | null | undefined) ?? null,
    });

    categoryService
      .updateCategory(String(req.params['id'] ?? ''), categoryInput(bound), req.auth ?? undefined)
      .then((updated) => sendJson(res, 200, updated))
      .catch(next);
  } catch (error) {
    next(error);
  }
});

router.delete('/api/categories/:id', requireEditor, editorialRateLimit, (req, res, next) => {
  categoryService
    .deleteCategory(String(req.params['id'] ?? ''), req.auth ?? undefined)
    .then(() => sendNoContent(res))
    .catch(next);
});

export const categoryRoutes = router;
