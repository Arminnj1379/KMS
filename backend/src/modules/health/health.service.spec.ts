import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns liveness without dependencies', () => {
    const svc = new HealthService({ ping: async () => undefined } as never);
    const res = svc.liveness();
    expect(res.status).toBe('ok');
    expect(typeof res.timestamp).toBe('string');
  });

  it('reports readiness when database pings', async () => {
    const svc = new HealthService({ ping: async () => undefined } as never);
    const res = await svc.readiness();
    expect(res.status).toBe('ok');
    expect(res.checks['database']).toBe('up');
  });

  it('throws 503 when database is down', async () => {
    const svc = new HealthService({
      ping: async () => {
        throw new Error('down');
      },
    } as never);
    await expect(svc.readiness()).rejects.toThrow('سرویس آماده نیست');
  });
});
