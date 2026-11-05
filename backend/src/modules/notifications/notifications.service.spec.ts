import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import type { Notification } from '../../common/mongo/schemas/notification.schema';
import { ListNotificationsQuery } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

const ME = '0000000000000000000000a1';
const OTHER = '0000000000000000000000b2';

const oid = (hex: string): Types.ObjectId => new Types.ObjectId(hex);

interface ChainStub<T> {
  lean: jest.Mock<Promise<T>>;
  sort: jest.Mock<ChainStub<T>>;
  skip: jest.Mock<ChainStub<T>>;
  limit: jest.Mock<ChainStub<T>>;
}

function q<T>(value: T): ChainStub<T> {
  const stub = {} as ChainStub<T>;
  stub.lean = jest.fn().mockResolvedValue(value);
  stub.sort = jest.fn().mockReturnValue(stub);
  stub.skip = jest.fn().mockReturnValue(stub);
  stub.limit = jest.fn().mockReturnValue(stub);
  return stub;
}

function makeModelMock() {
  return {
    create: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  };
}

const row = (overrides: Record<string, unknown> = {}) => ({
  _id: oid('0000000000000000000000e1'),
  userId: oid(ME),
  type: 'review.submitted',
  title: 'درخواست بررسی',
  body: null,
  data: null,
  isRead: false,
  createdAt: new Date(),
  ...overrides,
});

function makeDeps() {
  const model = makeModelMock();
  const svc = new NotificationsService(model as unknown as Model<Notification>);
  return { svc, model };
}

describe('NotificationsService', () => {
  it('notify persists an unread inbox row', async () => {
    const { svc, model } = makeDeps();
    model.create.mockResolvedValue({});
    await svc.notify({ userId: ME, type: 'review.submitted', title: 'سلام' });
    expect(model.create).toHaveBeenCalledTimes(1);
    expect(model.create.mock.calls[0][0]).toMatchObject({
      userId: expect.any(Types.ObjectId),
      type: 'review.submitted',
      title: 'سلام',
      isRead: false,
    });
  });

  it('notify drops invalid userIds without throwing', async () => {
    const { svc, model } = makeDeps();
    await svc.notify({ userId: 'not-an-id', type: 'x', title: 'y' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('list is scoped to the caller and returns the unread count', async () => {
    const { svc, model } = makeDeps();
    model.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    model.find.mockReturnValue(q([row(), row(), row()]));
    const res = await svc.list(ME, Object.assign(new ListNotificationsQuery(), {}));
    expect(res.total).toBe(3);
    expect(res.unread).toBe(1);
    expect(res.items).toHaveLength(3);
    expect(model.find.mock.calls[0][0]).toMatchObject({ userId: expect.any(Types.ObjectId) });
  });

  it('unreadCount is scoped to the caller', async () => {
    const { svc, model } = makeDeps();
    model.countDocuments.mockResolvedValue(2);
    await expect(svc.unreadCount(ME)).resolves.toEqual({ unread: 2 });
    expect(model.countDocuments.mock.calls[0][0]).toMatchObject({ userId: expect.any(Types.ObjectId) });
  });

  it('markRead only touches the own row (foreign → 404)', async () => {
    const { svc, model } = makeDeps();
    model.findOneAndUpdate.mockReturnValue(q(null));
    await expect(
      svc.markRead(OTHER, '0000000000000000000000e1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('markAllRead updates only own unread rows', async () => {
    const { svc, model } = makeDeps();
    model.updateMany.mockResolvedValue({ modifiedCount: 4 });
    await expect(svc.markAllRead(ME)).resolves.toEqual({ updated: 4 });
    expect(model.updateMany.mock.calls[0][0]).toMatchObject({ userId: expect.any(Types.ObjectId), isRead: false });
  });
});
