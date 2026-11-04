import { UnprocessableEntityException } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { Model, Types } from 'mongoose';
import type { Department } from '../../common/mongo/schemas/department.schema';
import type { Membership } from '../../common/mongo/schemas/membership.schema';
import type { Organization } from '../../common/mongo/schemas/organization.schema';
import type { User } from '../../common/mongo/schemas/user.schema';
import { OrganizationsService } from './organizations.service';
import { UsersService } from '../users/users.service';

const O1 = '000000000000000000000010';

// SAFETY: test-only stub of Mongoose's chainable Query API (sort/skip/limit/session/select + lean).
interface ChainStub<T> {
  lean: jest.Mock<Promise<T>>;
  sort: jest.Mock<ChainStub<T>>;
  skip: jest.Mock<ChainStub<T>>;
  limit: jest.Mock<ChainStub<T>>;
  session: jest.Mock<ChainStub<T>>;
}

function q<T>(value: T): ChainStub<T> {
  const stub = {} as ChainStub<T>;
  stub.lean = jest.fn().mockResolvedValue(value);
  stub.sort = jest.fn().mockReturnValue(stub);
  stub.skip = jest.fn().mockReturnValue(stub);
  stub.limit = jest.fn().mockReturnValue(stub);
  stub.session = jest.fn().mockReturnValue(stub);
  return stub;
}

function makeModelMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
  };
}

type ModelMock = ReturnType<typeof makeModelMock>;

function makeOrgDeps() {
  const connection = {
    startSession: jest.fn().mockResolvedValue({
      withTransaction: jest.fn(async (fn: (s: unknown) => Promise<unknown>) => fn({})),
      endSession: jest.fn(),
    }),
  } as unknown as Connection;
  const orgs = makeModelMock();
  const depts = makeModelMock();
  const memberships = makeModelMock();
  const users = makeModelMock();
  const svc = new OrganizationsService(
    connection,
    orgs as unknown as Model<Organization>,
    depts as unknown as Model<Department>,
    memberships as unknown as Model<Membership>,
    users as unknown as Model<User>,
  );
  return { svc, orgs, depts, memberships, users };
}

const oid = (hex: string): Types.ObjectId => new Types.ObjectId(hex);

describe('Organization safety rules', () => {
  it('removeMember refuses self-removal', async () => {
    const { svc } = makeOrgDeps();
    await expect(
      svc.removeMember(O1, '000000000000000000000001', '000000000000000000000001'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('removeMember refuses to drop the last org-admin', async () => {
    const { svc, memberships } = makeOrgDeps();
    memberships.findOne.mockReturnValue(q({ role: 'org-admin' }));
    memberships.countDocuments.mockResolvedValue(0);
    await expect(
      svc.removeMember(O1, '000000000000000000000002', '000000000000000000000001'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('updateDepartment refuses moves into its own subtree', async () => {
    const { svc, depts } = makeOrgDeps();
    depts.findOne
      .mockReturnValueOnce(q({ _id: oid('0000000000000000000000a1'), path: '/x', slug: 'x' }))
      .mockReturnValueOnce(
        q({ _id: oid('0000000000000000000000b2'), path: '/x/y', depth: 1 }),
      );
    await expect(
      svc.updateDepartment(O1, '0000000000000000000000a1', {
        parentId: '0000000000000000000000b2',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('users.update refuses self-deactivation and last-admin demotion', async () => {
    const connection = {
      startSession: jest.fn().mockResolvedValue({
        withTransaction: jest.fn(async (fn: (s: unknown) => Promise<unknown>) => fn({})),
        endSession: jest.fn(),
      }),
    } as unknown as Connection;
    const users = makeModelMock();
    const memberships: ModelMock = makeModelMock();
    const depts = makeModelMock();
    const svc = new UsersService(
      connection,
      users as unknown as Model<User>,
      memberships as unknown as Model<Membership>,
      depts as unknown as Model<Department>,
    );

    memberships.findOne.mockReturnValue(q({ role: 'member', userId: oid('000000000000000000000001') }));
    await expect(
      svc.update(O1, '000000000000000000000001', '000000000000000000000001', { isActive: false }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    memberships.findOne.mockReturnValue(q({ role: 'org-admin', userId: oid('000000000000000000000009') }));
    memberships.countDocuments.mockResolvedValue(0);
    await expect(
      svc.update(O1, '000000000000000000000001', '000000000000000000000009', { role: 'member' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
