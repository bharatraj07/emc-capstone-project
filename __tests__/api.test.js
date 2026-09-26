// __tests__/api.test.js
// -----------------------------------------------------------------------------
// WHY these tests exist: Jenkins' "Test" stage needs to gate the pipeline —
// if tests fail, the build must stop before we ever build a Docker image or
// deploy anything broken. supertest lets us hit the Express `app` object
// in-memory, no real server/port needed, so this runs fast inside Jenkins.
// -----------------------------------------------------------------------------

const request = require('supertest');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

beforeEach(() => {
  // Start each test with a clean slate so tests don't depend on order.
  if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
});

const app = require('../server');

describe('GET /health', () => {
  it('returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /metrics', () => {
  it('exposes Prometheus metrics text', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });
});

describe('/api/tasks', () => {
  it('starts empty', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('creates a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Patch EC2 AMI', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Patch EC2 AMI');
    expect(res.body.done).toBe(false);
  });

  it('rejects a task with no title', async () => {
    const res = await request(app).post('/api/tasks').send({});
    expect(res.status).toBe(400);
  });

  it('toggles a task done and deletes it', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Rotate DB creds' });
    const id = created.body.id;

    const patched = await request(app)
      .patch(`/api/tasks/${id}`)
      .send({ done: true });
    expect(patched.body.done).toBe(true);

    const deleted = await request(app).delete(`/api/tasks/${id}`);
    expect(deleted.status).toBe(204);

    const list = await request(app).get('/api/tasks');
    expect(list.body.find((t) => t.id === id)).toBeUndefined();
  });
});
