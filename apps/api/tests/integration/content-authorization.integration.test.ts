import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { db } from '../../src/lib/db.js';
import { issueToken } from '../../src/lib/jwt.js';

const app = createApp();
const editorId = randomUUID();
const readerId = randomUUID();
const categoryId = 'integration-' + randomUUID();
const slug = 'integration-article-' + randomUUID();
const now = new Date();

describe.skipIf(!process.env.TEST_DATABASE_URL)('PostgreSQL integration: content and category authorization', () => {
  let editorToken: string;
  let readerToken: string;

  beforeAll(async () => {
    const [editor, reader] = await Promise.all([
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
    ]);
    editorToken = issueToken(editor);
    readerToken = issueToken(reader);
  });

  afterAll(async () => {
    await db.contentItem.deleteMany({ where: { slug } });
    await db.category.deleteMany({ where: { id: { in: [categoryId, categoryId + '-crud'] } } });
    await db.user.deleteMany({ where: { id: { in: [editorId, readerId] } } });
  });

  it('enforces anonymous, reader, and editor boundaries for content writes', async () => {
    const payload = {
      type: 'article',
      title: 'Integration Article',
      slug,
      description: 'PostgreSQL integration fixture',
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

    const read = await request(app).get('/api/content/article/' + slug).expect(200);
    expect(read.body.title).toBe('Integration Article');

    await request(app)
      .put('/api/content/' + created.body.id)
      .set('Authorization', 'Bearer ' + editorToken)
      .send({ ...payload, title: 'Updated Integration Article', slug })
      .expect(200);

    const updated = await request(app).get('/api/content/article/' + slug).expect(200);
    expect(updated.body.title).toBe('Updated Integration Article');

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
});
