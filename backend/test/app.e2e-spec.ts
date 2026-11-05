/**
 * Phase 11 — HTTP end-to-end coverage (the layer unit specs + manual smoke
 * scripts don't cover): boots the real Nest application against a real
 * MongoDB replica set (`kms_e2e` database, dropped after the run) and drives
 * full user journeys over HTTP with supertest. No mocks below the HTTP line.
 *
 * Run: npm run test:e2e --workspace=backend  (needs MongoDB rs0 on localhost)
 */
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

process.env['NODE_ENV'] = 'test';
process.env['MONGODB_URI'] =
  process.env['E2E_MONGODB_URI'] ??
  'mongodb://localhost:27017/kms_e2e?replicaSet=rs0&directConnection=true';
process.env['JWT_ACCESS_SECRET'] = 'e2e-access-secret-at-least-32-chars!!';
process.env['STORAGE_DRIVER'] = 'local';
process.env['UPLOADS_DIR'] = './uploads-e2e';
process.env['JWT_ACCESS_TTL'] = '900';
process.env['JWT_REFRESH_TTL_DAYS'] = '7';
process.env['S3_ENDPOINT'] = 'http://localhost:9000';
process.env['S3_ACCESS_KEY'] = 'e2e';
process.env['S3_SECRET_KEY'] = 'e2e';

const ts = Date.now().toString(36);
const adminEmail = `e2e-admin-${ts}@example.com`;
const reviewerEmail = `e2e-reviewer-${ts}@example.com`;
const org2Email = `e2e-org2-${ts}@example.com`;
const PASSWORD = 'Secret123!';

const doc = (text: string): Record<string, unknown> => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

interface AuthBody {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string };
  organization: { id: string; name: string; slug: string };
  orgRole: string;
}

describe('KMS HTTP e2e (Phase 11)', () => {
  let app: INestApplication;
  let connection: Connection;
  let admin: AuthBody;
  let reviewerToken: string;
  let reviewerId: string;
  let kbSlug: string;
  let articleId: string;
  let articleSlug: string;
  let reviewId: string;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
    await connection.db?.dropDatabase();
  });

  afterAll(async () => {
    await connection.db?.dropDatabase();
    await app.close();
  });

  it('health + ready report a live API, database and storage', async () => {
    await api().get('/api/health').expect(200);
    const ready = await api().get('/api/ready').expect(200);
    expect(ready.body.status).toBe('ok');
    expect(ready.body.checks.database).toBe('up');
    expect(ready.body.checks.storage).toBe('up');
  });

  it('self-service registration bootstraps an isolated org with an org-admin', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ fullName: 'E2E Admin', email: adminEmail, password: PASSWORD, organizationName: `E2E Org ${ts}` })
      .expect(201);
    admin = res.body as AuthBody;
    expect(admin.accessToken.length).toBeGreaterThan(10);
    expect(admin.orgRole).toBe('org-admin');
    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${admin.accessToken}`).expect(200);
    expect(me.body.user.email).toBe(adminEmail);
  });

  it('org-admin creates a KB and invites a reviewer', async () => {
    const auth = `Bearer ${admin.accessToken}`;
    const kb = await api()
      .post('/api/knowledge-bases')
      .set('Authorization', auth)
      .send({ title: `E2E KB ${ts}`, slug: `e2e-kb-${ts}`, visibility: 'internal' })
      .expect(201);
    kbSlug = kb.body.slug as string;

    const invited = await api()
      .post('/api/users')
      .set('Authorization', auth)
      .send({ fullName: 'E2E Reviewer', email: reviewerEmail, password: PASSWORD })
      .expect(201);
    reviewerId = invited.body.user.id as string;

    const login = await api()
      .post('/api/auth/login')
      .send({ email: reviewerEmail, password: PASSWORD })
      .expect(200);
    reviewerToken = (login.body as AuthBody).accessToken;

    await api()
      .post(`/api/knowledge-bases/${kbSlug}/members`)
      .set('Authorization', auth)
      .send({ email: reviewerEmail, role: 'reviewer' })
      .expect(201);
  });

  it('draft → autosave (no snapshot) → changelog save (snapshot)', async () => {
    const auth = `Bearer ${admin.accessToken}`;
    const created = await api()
      .post(`/api/knowledge-bases/${kbSlug}/articles`)
      .set('Authorization', auth)
      .send({ title: 'E2E Article', slug: `e2e-art-${ts}`, contentJson: doc('نسخه یک') })
      .expect(201);
    articleId = created.body.id as string;
    articleSlug = created.body.slug as string;
    expect(created.body.status).toBe('draft');
    expect(created.body.version).toBe(1);

    const autosaved = await api()
      .patch(`/api/knowledge-bases/${kbSlug}/articles/${articleId}`)
      .set('Authorization', auth)
      .send({ version: 1, contentJson: doc('نسخه دو') })
      .expect(200);
    expect(autosaved.body.version).toBe(2);
    const noSnap = await api()
      .get(`/api/knowledge-bases/${kbSlug}/articles/${articleId}/versions`)
      .set('Authorization', auth)
      .expect(200);
    expect(noSnap.body).toHaveLength(0);

    const saved = await api()
      .patch(`/api/knowledge-bases/${kbSlug}/articles/${articleId}`)
      .set('Authorization', auth)
      .send({ version: 2, contentJson: doc('نسخه سه'), changelog: 'e2e snapshot' })
      .expect(200);
    expect(saved.body.version).toBe(3);
    const snapped = await api()
      .get(`/api/knowledge-bases/${kbSlug}/articles/${articleId}/versions`)
      .set('Authorization', auth)
      .expect(200);
    expect(snapped.body).toHaveLength(1);
  });

  it('stale versions conflict with 409 carrying the current document', async () => {
    const res = await api()
      .patch(`/api/knowledge-bases/${kbSlug}/articles/${articleId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ version: 1, title: 'stale write' })
      .expect(409);
    // The envelope must carry `current` (Phase 11: the filter used to drop it).
    expect((res.body.current as { version: number }).version).toBe(3);
  });

  it('submit → approve publishes, writes history, and notifies both parties', async () => {
    const adminAuth = `Bearer ${admin.accessToken}`;
    const submitted = await api()
      .post(`/api/knowledge-bases/${kbSlug}/articles/${articleSlug}/submit`)
      .set('Authorization', adminAuth)
      .send({ reviewerId })
      .expect(201);
    expect(submitted.body.reviewRequest.status).toBe('pending');
    reviewId = submitted.body.reviewRequest.id as string;

    const decided = await api()
      .post(`/api/review-requests/${reviewId}/approve`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ comment: 'e2e approved' })
      .expect(200);
    expect(decided.body.article.status).toBe('published');

    const history = await api()
      .get(`/api/knowledge-bases/${kbSlug}/articles/${articleSlug}/history`)
      .set('Authorization', adminAuth)
      .expect(200);
    expect(history.body.length).toBeGreaterThanOrEqual(2);

    const revInbox = await api()
      .get('/api/notifications')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);
    expect(revInbox.body.total).toBe(1);
    expect(revInbox.body.items[0].type).toBe('review.submitted');

    const adminInbox = await api().get('/api/notifications').set('Authorization', adminAuth).expect(200);
    expect(adminInbox.body.items.some((n: { type: string }) => n.type === 'review.approved')).toBe(true);

    const notifId = revInbox.body.items[0].id as string;
    await api().patch(`/api/notifications/${notifId}/read`).set('Authorization', `Bearer ${reviewerToken}`).expect(200);
    const unread = await api()
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);
    expect(unread.body.unread).toBe(0);
  });

  it('audit log records the journey; members get 403', async () => {
    const adminAuth = `Bearer ${admin.accessToken}`;
    const audit = await api().get('/api/audit-logs?pageSize=100').set('Authorization', adminAuth).expect(200);
    const actions = (audit.body.items as { action: string }[]).map((i) => i.action);
    for (const expected of ['auth.register', 'kb.create', 'article.create', 'review.submitted', 'review.approved']) {
      expect(actions).toContain(expected);
    }
    await api().get('/api/audit-logs').set('Authorization', `Bearer ${reviewerToken}`).expect(403);
  });

  it('global search finds by exact token and by Persian affix variant', async () => {
    const adminAuth = `Bearer ${admin.accessToken}`;
    await api()
      .post(`/api/knowledge-bases/${kbSlug}/articles`)
      .set('Authorization', adminAuth)
      .send({ title: 'راهنما', slug: `e2e-rahbar-${ts}`, contentJson: doc('متن راهنما') })
      .expect(201);

    const exact = await api().get('/api/search?q=راهنما').set('Authorization', adminAuth).expect(200);
    expect(exact.body.total).toBeGreaterThanOrEqual(1);

    const affixed = await api().get(`/api/search?q=${encodeURIComponent('راهنمای')}`).set('Authorization', adminAuth).expect(200);
    expect(affixed.body.mode).toBe('regex');
    expect(affixed.body.total).toBeGreaterThanOrEqual(1);
    expect(affixed.body.items.some((i: { slug: string }) => i.slug === `e2e-rahbar-${ts}`)).toBe(true);
  });

  it('second org is fully isolated (empty inbox + own audit only)', async () => {
    const org2 = await api()
      .post('/api/auth/register')
      .send({ fullName: 'E2E Org2', email: org2Email, password: PASSWORD, organizationName: `E2E Org2 ${ts}` })
      .expect(201);
    const org2Auth = `Bearer ${(org2.body as AuthBody).accessToken}`;
    const org2Id = (org2.body as AuthBody).organization.id;

    const inbox = await api().get('/api/notifications').set('Authorization', org2Auth).expect(200);
    expect(inbox.body.total).toBe(0);

    const audit = await api().get('/api/audit-logs').set('Authorization', org2Auth).expect(200);
    expect(audit.body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of audit.body.items as { organizationId: string }[]) {
      expect(item.organizationId).toBe(org2Id);
    }
  });

  it('logout revokes the session; reuse of the refresh token fails closed', async () => {
    const refreshToken = admin.refreshToken;
    await api().post('/api/auth/logout').send({ refreshToken }).expect(204);
    await api().post('/api/auth/refresh').send({ refreshToken }).expect(401);
  });
});
