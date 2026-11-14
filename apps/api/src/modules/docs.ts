import { Router, type Request, type Response } from 'express';

/**
 * /openapi/v1.json + /swagger — the docs surface of MapOpenApi + UseSwaggerUI.
 *
 * The original document is a Microsoft.AspNetCore.OpenApi artifact generated
 * at runtime; no full capture of it exists (the golden body itself was
 * truncated), so this document is REGENERATED for the Express runtime and
 * pinned where the battery pins it: the first 100 bytes (the info block) and
 * the last 100 bytes (the tags array, the last top-level key, ending
 * [Auth…, Admin, Content, Categories]).
 *
 * One deliberate difference, recorded in docs/migration/BASELINE.md: the chat
 * endpoints are additive (migration decision D3, no .NET counterpart) and are
 * NOT described here — they follow in the follow-up PR together with their
 * first frontend consumer. Operation ids restate the .NET WithName values so
 * external consumers keep their references.
 */

const router = Router();

type Tag = 'Auth' | 'Admin' | 'Content' | 'Categories';

interface Operation {
  tags: Tag[];
  summary: string;
  operationId: string;
  security?: { bearerAuth: [] }[];
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
}

const JSON_RESPONSE = (description: string): Record<string, unknown> => ({
  description,
  content: { 'application/json': { schema: { type: 'object' } } },
});

const PROBLEM_RESPONSE = (description: string): Record<string, unknown> => ({
  description,
  content: { 'application/problem+json': { schema: { type: 'object' } } },
});

// Common failure sets, spelled out once and shared.
const AUTH_FAILURES = {
  '400': PROBLEM_RESPONSE('A request value failed validation.'),
  '401': { description: 'Missing or invalid bearer token.' },
  '403': { description: 'Authenticated but not permitted.' },
};
const BEARER: { bearerAuth: [] }[] = [{ bearerAuth: [] }];

function op(
  tag: Tag,
  operationId: string,
  summary: string,
  responses: Record<string, unknown>,
  extra: Partial<Operation> = {},
): Operation {
  return {
    tags: [tag],
    summary,
    operationId,
    responses,
    ...extra,
  };
}

const ID_PARAMETER = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
} as const;

const paths: Record<string, Record<string, Operation>> = {
  '/api/auth/login': {
    post: op('Auth', 'Login', 'Exchange email + password for a bearer token.', {
      '200': JSON_RESPONSE('The authenticated user and token.'),
      ...AUTH_FAILURES,
    }),
  },
  '/api/auth/register': {
    post: op('Auth', 'Register', 'Create an account (admin rights granted only via allowlist).', {
      '200': JSON_RESPONSE('The authenticated user and token.'),
      '409': PROBLEM_RESPONSE('The email is already registered.'),
      ...AUTH_FAILURES,
    }),
  },
  '/api/auth/me': {
    get: op('Auth', 'GetCurrentUser', 'The caller\u2019s profile, derived from the token claims.', {
      '200': JSON_RESPONSE('Profile fields.'),
      '401': { description: 'No valid bearer token.' },
    }),
    put: op('Auth', 'UpdateProfile', 'Update the caller\u2019s display name and avatar.', {
      ...AUTH_FAILURES,
      '200': JSON_RESPONSE('Updated profile fields.'),
    }),
  },
  '/api/auth/change-password': {
    post: op('Auth', 'ChangePassword', 'Rotate the caller\u2019s password.', {
      '200': JSON_RESPONSE('Success flag.'),
      '400': PROBLEM_RESPONSE('A request value failed validation.'),
      '401': { description: 'No valid bearer token or wrong current password.' },
      '403': { description: 'Authenticated but not permitted.' },
    }),
  },
  '/api/auth/forgot-password': {
    post: op(
      'Auth',
      'ForgotPassword',
      'Issue a reset token (the answer is identical whether or not the email exists).',
      { '200': JSON_RESPONSE('Neutral confirmation message.') },
    ),
  },
  '/api/auth/reset-password': {
    post: op('Auth', 'ResetPassword', 'Complete a password reset with the emailed token.', {
      '200': JSON_RESPONSE('Success flag.'),
      '400': PROBLEM_RESPONSE('The reset token is invalid or expired.'),
    }),
  },
  '/api/auth/oauth/{provider}': {
    get: op(
      'Auth',
      'OAuthChallenge',
      'Redirect to the provider\u2019s consent screen; 501 while unconfigured.',
      {
        '302': { description: 'Redirect to the provider.' },
        '501': PROBLEM_RESPONSE('Provider not configured.'),
      },
    ),
  },
  '/api/auth/oauth/{provider}/callback': {
    get: op(
      'Auth',
      'OAuthCallback',
      'Complete the code exchange and land on the frontend with a token (or error flag).',
      {
        '302': { description: 'Redirect to the frontend.' },
        '501': PROBLEM_RESPONSE('Provider not configured.'),
      },
    ),
  },
  '/api/users': {
    get: op('Admin', 'AdminListUsers', 'All users, oldest first. Requires the admin role.', {
      '200': JSON_RESPONSE('User rows in display order.'),
      ...AUTH_FAILURES,
    }, { security: BEARER }),
  },
  '/api/users/{id}/roles': {
    post: op(
      'Admin',
      'ToggleUserRole',
      'Toggle a role flag for one user (observed contract: has=true removes).',
      {
        '200': JSON_RESPONSE('Success flag with the user\u2019s roles.'),
        '404': { description: 'Unknown user id.' },
        ...AUTH_FAILURES,
      },
      {
        security: BEARER,
        parameters: [{ ...ID_PARAMETER, schema: { type: 'string', format: 'uuid' } }],
      },
    ),
  },
  '/api/settings': {
    get: op('Admin', 'GetSiteSettings', 'The public site settings document and its version stamp.', {
      '200': JSON_RESPONSE('{ data, version } — data is null when nothing is stored yet.'),
    }),
    put: op('Admin', 'UpdateSiteSettings', 'Replace the settings document verbatim. Requires an editor.', {
      '200': JSON_RESPONSE('Success flag.'),
      ...AUTH_FAILURES,
    }, {
      security: BEARER,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
    }),
  },
  '/api/settings/{id}': {
    get: op('Admin', 'GetSiteSettingsById', 'The settings document for one named settings id.', {
      '200': JSON_RESPONSE('{ data, version }.'),
    }, { parameters: [ID_PARAMETER] }),
    put: op('Admin', 'UpdateSiteSettingsById', 'Replace one named settings document verbatim.', {
      '200': JSON_RESPONSE('Success flag.'),
      ...AUTH_FAILURES,
    }, { security: BEARER, parameters: [ID_PARAMETER] }),
  },
  '/api/debates': {
    get: op('Admin', 'ListDebates', 'Debate episodes, newest first. Requires an editor.', {
      '200': JSON_RESPONSE('Debate rows in display order.'),
      ...AUTH_FAILURES,
    }, { security: BEARER }),
    post: op('Admin', 'CreateDebate', 'Record a debate episode.', {
      '200': JSON_RESPONSE('{ id, success }.'),
      ...AUTH_FAILURES,
    }, {
      security: BEARER,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
    }),
  },
  '/api/debates/{id}': {
    put: op('Admin', 'UpdateDebate', 'Replace one debate episode.', {
      '200': JSON_RESPONSE('{ id, success }.'),
      '404': { description: 'Unknown debate id.' },
      ...AUTH_FAILURES,
    }, {
      security: BEARER,
      parameters: [{ ...ID_PARAMETER, schema: { type: 'string', format: 'uuid' } }],
    }),
    delete: op('Admin', 'DeleteDebate', 'Remove one debate episode.', {
      '204': { description: 'Deleted.' },
      '404': { description: 'Unknown debate id.' },
      ...AUTH_FAILURES,
    }, {
      security: BEARER,
      parameters: [{ ...ID_PARAMETER, schema: { type: 'string', format: 'uuid' } }],
    }),
  },
  '/api/content': {
    get: op('Content', 'ListContent', 'The public library: filtered, paged, and optionally searched.', {
      '200': JSON_RESPONSE('A paged result envelope.'),
      '400': PROBLEM_RESPONSE('A query parameter failed validation.'),
    }),
    post: op('Content', 'CreateContent', 'Create a content record. Requires an editor or admin token.', {
      '201': JSON_RESPONSE('The created record.'),
      ...AUTH_FAILURES,
    }, {
      security: BEARER,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
    }),
  },
  '/api/content/counts': {
    get: op('Content', 'GetContentCounts', 'Live record counts grouped by content type.', {
      '200': JSON_RESPONSE('One row per type.'),
    }),
  },
  '/api/content/snapshot': {
    get: op('Content', 'GetContentSnapshot', 'A flat snapshot of every record\u2019s list shape.', {
      '200': JSON_RESPONSE('Every record, unpaged.'),
    }),
  },
  '/api/content/{type}/{slug}': {
    get: op('Content', 'GetContentBySlug', 'One public record, addressed by its type segment and slug.', {
      '200': JSON_RESPONSE('The full record.'),
      '404': { description: 'Unknown type segment or slug.' },
    }, {
      parameters: [
        {
          name: 'type',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: ['video', 'videos', 'book', 'books', 'article', 'articles', 'research'] },
        },
        { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
      ],
    }),
  },
  '/api/content/{id}': {
    put: op('Content', 'UpdateContent', 'Replace a content record. Requires an editor or admin token.', {
      '200': JSON_RESPONSE('The updated record.'),
      '404': { description: 'Unknown record id.' },
      ...AUTH_FAILURES,
    }, { security: BEARER, parameters: [ID_PARAMETER] }),
    delete: op('Content', 'DeleteContent', 'Delete a content record. Requires an editor or admin token.', {
      '204': { description: 'Deleted.' },
      '404': { description: 'Unknown record id.' },
      ...AUTH_FAILURES,
    }, { security: BEARER, parameters: [ID_PARAMETER] }),
  },
  '/api/categories': {
    get: op('Categories', 'ListCategories', 'All categories in display order, each with its live content count.', {
      '200': JSON_RESPONSE('Category rows in display order.'),
    }),
    post: op('Categories', 'CreateCategory', 'Create a category. Requires an editor or admin token.', {
      '201': JSON_RESPONSE('The created category.'),
      ...AUTH_FAILURES,
    }, {
      security: BEARER,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
    }),
  },
  '/api/categories/{id}': {
    get: op('Categories', 'GetCategory', 'One category with its live content count.', {
      '200': JSON_RESPONSE('The category.'),
      '404': { description: 'Unknown category id.' },
    }, { parameters: [ID_PARAMETER] }),
    put: op('Categories', 'UpdateCategory', 'Replace a category\u2019s text and sort order. Requires an editor.', {
      '200': JSON_RESPONSE('The updated category.'),
      '404': { description: 'Unknown category id.' },
      '409': PROBLEM_RESPONSE('The id cannot be changed, or the category still has content.'),
      ...AUTH_FAILURES,
    }, { security: BEARER, parameters: [ID_PARAMETER] }),
    delete: op('Categories', 'DeleteCategory', 'Delete an empty category. Requires an editor.', {
      '204': { description: 'Deleted.' },
      '404': { description: 'Unknown category id.' },
      '409': PROBLEM_RESPONSE('The category still has content records.'),
      ...AUTH_FAILURES,
    }, { security: BEARER, parameters: [ID_PARAMETER] }),
  },
};

const document = {
  // Key order matters at the pins: openapi → info (head 100 bytes) and the
  // tags array LAST (tail 100 bytes).
  openapi: '3.0.1',
  info: {
    title: 'ApiServer.WebApi | v1',
    version: '1.0.0',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'The token issued by POST /api/auth/login (HS256).',
      },
    },
  },
  paths,
  // Registration order of the .NET route groups, de-duplicated (OAuth shares
  // the Auth tag): the array ends [Admin, Content, Categories] exactly as the
  // captured tail requires.
  tags: [{ name: 'Auth' }, { name: 'Admin' }, { name: 'Content' }, { name: 'Categories' }],
};

// Pretty-printed with 2-space indent — the byte budget of the golden head/tail
// assumes it. Serialized once at boot, not per request.
const documentJson = JSON.stringify(document, null, 2);

router.get('/openapi/v1.json', (_req: Request, res: Response) => {
  // The .NET OpenAPI endpoint answers "application/json;charset=utf-8" — no
  // space after the semicolon, unlike every other JSON surface on this API.
  res.status(200).set('content-type', 'application/json;charset=utf-8').send(documentJson);
});

router.get('/swagger', (_req: Request, res: Response) => {
  // UseSwaggerUI's landing page, reduced to a static bootstrap: the UI loads
  // from a CDN against this API's own document. Nothing here is contract —
  // only /openapi/v1.json is consumed programmatically.
  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>MOAZ ALIAN Library API v1</title>',
    '<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />',
    '</head>',
    '<body>',
    '<div id="swagger-ui"></div>',
    '<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>',
    '<script>',
    'window.onload = function () {',
    '  window.ui = SwaggerUIBundle({ url: "/openapi/v1.json", dom_id: "#swagger-ui" });',
    '};',
    '</script>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
  res.status(200).set('content-type', 'text/html; charset=utf-8').send(html);
});

export const docsRoutes = router;
