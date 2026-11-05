import { Model } from 'mongoose';
import type { AuditLog } from '../../common/mongo/schemas/audit-log.schema';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQuery } from './dto/audit-logs.dto';

const ORG = '000000000000000000000010';

function q<T>(value: T) {
  const stub = {
    lean: jest.fn().mockResolvedValue(value),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
  return stub;
}

function makeModelMock() {
  return { create: jest.fn(), countDocuments: jest.fn(), find: jest.fn() };
}

function makeDeps() {
  const model = makeModelMock();
  const svc = new AuditLogsService(model as unknown as Model<AuditLog>);
  return { svc, model };
}

describe('AuditLogsService', () => {
  it('write persists the row post-commit', async () => {
    const { svc, model } = makeDeps();
    model.create.mockResolvedValue({});
    await svc.write({
      organizationId: ORG,
      actorId: '0000000000000000000000a1',
      action: 'article.publish',
      resourceType: 'article',
      resourceId: '0000000000000000000000d1',
      metadata: { fromStatus: 'draft' },
    });
    expect(model.create).toHaveBeenCalledTimes(1);
    expect(model.create.mock.calls[0][0]).toMatchObject({
      organizationId: ORG,
      action: 'article.publish',
      resourceType: 'article',
    });
  });

  it('write never throws (DB outage cannot fail the request)', async () => {
    const { svc, model } = makeDeps();
    model.create.mockRejectedValue(new Error('mongo down'));
    await expect(
      svc.write({
        organizationId: ORG,
        actorId: null,
        action: 'auth.login',
        resourceType: 'user',
        resourceId: 'x',
      }),
    ).resolves.toBeUndefined();
  });

  it('list is always org-scoped and newest-first', async () => {
    const { svc, model } = makeDeps();
    model.countDocuments.mockResolvedValue(1);
    const rows = [
      {
        _id: { toHexString: () => 'a1' },
        organizationId: ORG,
        actorId: 'u1',
        action: 'article.create',
        resourceType: 'article',
        resourceId: 'd1',
        metadata: null,
        ip: null,
        createdAt: new Date(),
      },
    ];
    model.find.mockReturnValue(q(rows));
    const res = await svc.list(ORG, Object.assign(new ListAuditLogsQuery(), {}));
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(model.find).toHaveBeenCalled();
    const filter = model.find.mock.calls[0][0] as Record<string, unknown>;
    expect(filter['organizationId']).toBe(ORG);
    // sort newest-first
    const firstResult = model.find.mock.results[0];
    const chain = (firstResult ? firstResult.value : undefined) as { sort: jest.Mock };
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });
});
