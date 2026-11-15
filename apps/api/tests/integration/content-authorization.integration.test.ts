import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { db } from '../../src/lib/db.js';
import { issueToken } from '../../src/lib/jwt.js';

const app = createApp();
const editorId = randomUUID();
const readerId = randomUUID();
const adminId = randomUUID();
const settingsId = 'integration-settings-' + randomUUID();
const categoryId = 'integration-' + randomUUID();
const slug = 'integration-article-' + randomUUID();
const now = new Date();
let createdDebateId: string | null = null;

describe.skipIf(!process.env.TEST_DATABASE_URL)('PostgreSQL integration: content and category authorization', () => {
  let editorToken: string;
  let readerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const [editor, reader, admin] = await Promise.all([
      db.user.create({
        data: {
          id: editorId,
          email: editorId + '@example.test',
          passwordHash: 'integration-only-not-used',
          roles: ['editor'],
          createdAt: now,
          updatedAt: null,
        },
      }),
      db.user.create({
        data: {
          id: readerId,
          email: readerId + '@example.test',
          passwordHash: 'integration-only-not-used',
          roles: [],
          createdAt: now,
          updatedAt: null,
        },
      }),
      db.user.create({
        data: {
          id: adminId,
          email: adminId + '@example.test',
          passwordHash: 'integration-only-not-used',
          roles: ['admin', 'editor'],
          createdAt: now,
          updatedAt: null,
        },
      }),
    ]);
    editorToken = issueToken(editor);
    readerToken = issueToken(reader);
    adminToken = issueToken(admin);
  });

  afterAll(async () => {
    await db.contentItem.deleteMany({ where: { slug } });
    await db.category.deleteMany({ where: { id: { in: [categoryId, categoryId + '-crud'] } } });
    if (createdDebateId !== null) {
      await db.debate.deleteMany({ where: { id: createdDebateId } });
    }
    await db.siteSetting.deleteMany({ where: { id: settingsId } });
    await db.user.deleteMany({ where: { id: { in: [editorId, readerId, adminId] } } });
  });

  it('enforces anonymous, reader, and editor boundaries for content writes', async () => {
    const payload = {
      type: 'article',
      title: 'Integration Article',
      slug,
      description: 'PostgreSQL integration fixture',
      sourceUrl: 'https://example.test/integration-article',
      categoryIds: [categoryId],
      rightsStatus: 'unknown',
    };

    await request(app).post('/api/content').send(payload).expect(401);
    await request(app)
      .post('/api/content')
      .set('Authorization', 'Bearer ' + readerToken)
      .send(payload)
      .expect(403);

    await db.category.create({
      data: {
        id: categoryId,
        name: 'Integration Category',
        description: 'Temporary test category',
        sortOrder: 999,
        createdAt: now,
        updatedAt: now,
      },
    });

    const created = await request(app)
      .post('/api/content')
      .set('Authorization', 'Bearer ' + editorToken)
      .send(payload)
      .then((response) => {
        expect(response.status, JSON.stringify(response.body)).toBe(201);
        return response;
      });

    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.slug).toBe(slug);

    await request(app)
      .post('/api/content')
      .set('Authorization', 'Bearer ' + editorToken)
      .send(payload)
      .expect(409);

    const read = await request(app).get('/api/content/article/' + slug).expect(200);
    expect(read.body.title).toBe('Integration Article');

    await request(app)
      .put('/api/content/' + created.body.id)
      .set('Authorization', 'Bearer ' + editorToken)
      .send({ ...payload, title: 'Updated Integration Article', slug })
      .expect(200);

    const updated = await request(app).get('/api/content/article/' + slug).expect(200);
    expect(updated.body.title).toBe('Updated Integration Article');

    const filteredPage = await request(app)
      .get('/api/content')
      .query({ type: 'article', search: 'Integration Article', page: 1, pageSize: 1 })
      .expect(200);
    expect(filteredPage.body.totalCount).toBe(1);
    expect(filteredPage.body.items[0].slug).toBe(slug);
    expect(filteredPage.body.page).toBe(1);
    expect(filteredPage.body.pageSize).toBe(1);

    await request(app)
      .delete('/api/content/' + created.body.id)
      .set('Authorization', 'Bearer ' + editorToken)
      .expect(204);
  });

  it('covers category CRUD and prevents non-editor mutations', async () => {
    const id = categoryId + '-crud';
    const payload = { id, name: 'CRUD Category', description: 'Created in integration test', sortOrder: 1000 };

    await request(app).post('/api/categories').send(payload).expect(401);
    await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer ' + readerToken)
      .send(payload)
      .expect(403);

    await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer ' + editorToken)
      .send(payload)
      .expect(201);

    const read = await request(app).get('/api/categories/' + id).expect(200);
    expect(read.body.name).toBe('CRUD Category');

    await request(app)
      .put('/api/categories/' + id)
      .set('Authorization', 'Bearer ' + editorToken)
      .send({ ...payload, name: 'Updated CRUD Category' })
      .expect(200);

    const updated = await request(app).get('/api/categories/' + id).expect(200);
    expect(updated.body.name).toBe('Updated CRUD Category');

    await request(app)
      .delete('/api/categories/' + id)
      .set('Authorization', 'Bearer ' + editorToken)
      .expect(204);
  });
  it('enforces SiteAdmin, editor settings, and debate route policies', async () => {
    await request(app).get('/api/users').expect(401);
    await request(app).get('/api/users').set('Authorization', 'Bearer ' + editorToken).expect(403);
    await request(app).get('/api/users').set('Authorization', 'Bearer ' + adminToken).expect(200);

    await request(app)
      .post('/api/users/' + readerId + '/roles')
      .set('Authorization', 'Bearer ' + editorToken)
      .send({ role: 'editor', has: false })
      .expect(403);

    const roleUpdate = await request(app)
      .post('/api/users/' + readerId + '/roles')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ role: 'editor', has: false })
      .expect(200);
    expect(roleUpdate.body.roles).toContain('editor');

    const roleRemoval = await request(app)
      .post('/api/users/' + readerId + '/roles')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ role: 'editor', has: true })
      .expect(200);
    expect(roleRemoval.body.roles).not.toContain('editor');

    // The role-management endpoint revokes existing sessions. Refresh the
    // reader token so the following assertion exercises authorization (403),
    // rather than the stale-token authentication path (401).
    const refreshedReader = await db.user.findUniqueOrThrow({ where: { id: readerId } });
    readerToken = issueToken(refreshedReader);

    await request(app).get('/api/settings/' + settingsId).expect(200);
    await request(app)
      .put('/api/settings/' + settingsId)
      .set('Authorization', 'Bearer ' + readerToken)
      .send({ title: 'forbidden' })
      .expect(403);
    await request(app)
      .put('/api/settings/' + settingsId)
      .set('Authorization', 'Bearer ' + editorToken)
      .send({ title: 'integration settings' })
      .expect(200);
    const settings = await request(app).get('/api/settings/' + settingsId).expect(200);
    expect(settings.body.data.title).toBe('integration settings');

    await request(app).get('/api/debates').expect(401);
    await request(app).get('/api/debates').set('Authorization', 'Bearer ' + readerToken).expect(403);
    await request(app).get('/api/debates').set('Authorization', 'Bearer ' + editorToken).expect(200);

    const debate = await request(app)
      .post('/api/debates')
      .set('Authorization', 'Bearer ' + editorToken)
      .send({ guestName: 'Integration Guest', topic: 'Authorization boundary' })
      .expect(200);
    const debateId = debate.body.id as string;
    createdDebateId = debateId;

    await request(app)
      .put('/api/debates/' + debateId)
      .set('Authorization', 'Bearer ' + editorToken)
      .send({ guestName: 'Updated Guest', topic: 'Updated authorization boundary' })
      .expect(200);
    await request(app)
      .delete('/api/debates/' + debateId)
      .set('Authorization', 'Bearer ' + editorToken)
      .expect(204);
  });

});
