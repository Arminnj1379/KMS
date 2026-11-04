import { HealthService } from './health.service';

function makeConnection(ping: () => Promise<unknown>) {
  return { db: { admin: () => ({ ping }) } };
}

function makeStorage(healthy: boolean) {
  return { isHealthy: jest.fn().mockResolvedValue(healthy) };
}

describe('HealthService', () => {
  it('returns liveness without dependencies', () => {
    const svc = new HealthService(makeConnection(async () => undefined) as never, makeStorage(true) as never);
    const res = svc.liveness();
    expect(res.status).toBe('ok');
    expect(typeof res.timestamp).toBe('string');
  });

  it('reports readiness when MongoDB and storage are up', async () => {
    const svc = new HealthService(makeConnection(async () => ({})) as never, makeStorage(true) as never);
    const res = await svc.readiness();
    expect(res.status).toBe('ok');
    expect(res.checks['database']).toBe('up');
    expect(res.checks['storage']).toBe('up');
  });

  it('throws 503 when MongoDB is down', async () => {
    const svc = new HealthService(
      makeConnection(async () => {
        throw new Error('down');
      }) as never,
      makeStorage(true) as never,
    );
    await expect(svc.readiness()).rejects.toThrow('سرویس آماده نیست');
  });

  it('throws 503 when storage is down', async () => {
    const svc = new HealthService(makeConnection(async () => ({})) as never, makeStorage(false) as never);
    await expect(svc.readiness()).rejects.toThrow('سرویس آماده نیست');
  });
});
