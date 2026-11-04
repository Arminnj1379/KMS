import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { Model, Types } from 'mongoose';
import type { Category } from '../../common/mongo/schemas/category.schema';
import type { KbMember } from '../../common/mongo/schemas/kb-member.schema';
import type { KnowledgeBase } from '../../common/mongo/schemas/knowledge-base.schema';
import type { Membership } from '../../common/mongo/schemas/membership.schema';
import type { User } from '../../common/mongo/schemas/user.schema';
import { CategoriesService } from './categories.service';
import { KnowledgeBasesService } from './knowledge-bases.service';

const ORG = '000000000000000000000010';
const ALI = '0000000000000000000000a1';
const SARA = '0000000000000000000000b2';

const oid = (hex: string): Types.ObjectId => new Types.ObjectId(hex);

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
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
  };
}

type ModelMock = ReturnType<typeof makeModelMock>;

function makeTx() {
  return {
    startSession: jest.fn().mockResolvedValue({
      withTransaction: jest.fn(async (fn: (s: unknown) => Promise<unknown>) => fn({})),
      endSession: jest.fn(),
    }),
  } as unknown as Connection;
}

interface Deps {
  kbs: KnowledgeBasesService;
  cats: CategoriesService;
  kbs_: ModelMock;
  members: ModelMock;
  cats_: ModelMock;
  users: ModelMock;
  memberships: ModelMock;
}

function makeDeps(): Deps {
  const kbs_ = makeModelMock();
  const members = makeModelMock();
  const cats_ = makeModelMock();
  const users = makeModelMock();
  const memberships = makeModelMock();
  const kbs = new KnowledgeBasesService(
    makeTx(),
    kbs_ as unknown as Model<KnowledgeBase>,
    members as unknown as Model<KbMember>,
    cats_ as unknown as Model<Category>,
    users as unknown as Model<User>,
    memberships as unknown as Model<Membership>,
  );
  const cats = new CategoriesService(
    makeTx(),
    cats_ as unknown as Model<Category>,
    kbs,
  );
  return { kbs, cats, kbs_, members, cats_, users, memberships };
}

const kbDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: oid('0000000000000000000000k1'.replace(/k/g, 'c')),
  organizationId: oid(ORG),
  title: 'KB',
  slug: 'kb',
  description: null,
  icon: null,
  visibility: 'internal',
  ownerId: oid(ALI),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Knowledge base access rules', () => {
  it('private KB is invisible (404) to non-members', async () => {
    const d = makeDeps();
    d.kbs_.findOne.mockReturnValue(q(kbDoc({ visibility: 'private' })));
    d.members.findOne.mockReturnValue(q(null));
    await expect(d.kbs.findOne(ORG, SARA, 'member', 'kb')).rejects.toBeInstanceOf(NotFoundException);
    expect(d.kbs_.findOne).toHaveBeenCalled();
  });

  it('internal KB is visible read-only to org members without membership', async () => {
    const d = makeDeps();
    d.kbs_.findOne.mockReturnValue(q(kbDoc({ visibility: 'internal' })));
    d.kbs_.findById.mockReturnValue(q(kbDoc({ visibility: 'internal' })));
    d.members.findOne.mockReturnValue(q(null));
    d.members.countDocuments.mockResolvedValue(0);
    d.cats_.countDocuments.mockResolvedValue(0);
    const res = await d.kbs.findOne(ORG, SARA, 'member', 'kb');
    expect(res.role).toBeNull();
  });

  it('contributor cannot update KB settings (403), manager can', async () => {
    const d = makeDeps();
    d.kbs_.findOne.mockReturnValue(q(kbDoc()));
    d.members.findOne.mockReturnValue(q({ role: 'contributor' }));
    await expect(
      d.kbs.update(ORG, SARA, 'member', 'kb', { title: 'New' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    d.members.findOne.mockReturnValue(q({ role: 'manager' }));
    d.kbs_.findByIdAndUpdate.mockReturnValue(q(kbDoc({ title: 'New' })));
    d.members.countDocuments.mockResolvedValue(1);
    d.cats_.countDocuments.mockResolvedValue(0);
    const res = await d.kbs.update(ORG, SARA, 'member', 'kb', { title: 'New' });
    expect(res.title).toBe('New');
  });

  it('delete requires confirm=true and cascades members + categories', async () => {
    const d = makeDeps();
    await expect(d.kbs.remove(ORG, ALI, 'org-admin', 'kb')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    d.kbs_.findOne.mockReturnValue(q(kbDoc()));
    d.kbs_.deleteOne.mockResolvedValue({});
    d.members.deleteMany.mockResolvedValue({});
    d.cats_.deleteMany.mockResolvedValue({});
    await expect(d.kbs.remove(ORG, ALI, 'org-admin', 'kb', 'true')).resolves.toBeUndefined();
    expect(d.members.deleteMany).toHaveBeenCalled();
    expect(d.cats_.deleteMany).toHaveBeenCalled();
    expect(d.kbs_.deleteOne).toHaveBeenCalled();
  });

  it('addMember requires existing org membership', async () => {
    const d = makeDeps();
    d.kbs_.findOne.mockReturnValue(q(kbDoc()));
    d.users.findOne.mockReturnValue(q({ _id: oid(SARA), email: 's@s.co', fullName: 'S', isActive: true }));
    d.memberships.findOne.mockReturnValue(q(null));
    await expect(
      d.kbs.addMember(ORG, ALI, 'org-admin', 'kb', { email: 's@s.co', role: 'reader' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Category rules', () => {
  it('reader cannot create categories (403)', async () => {
    const d = makeDeps();
    d.kbs_.findOne.mockReturnValue(q(kbDoc()));
    d.members.findOne.mockReturnValue(q({ role: 'reader' }));
    await expect(
      d.cats.create(ORG, SARA, 'member', 'kb', { title: 'T', slug: 't' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('move into own subtree is rejected (422)', async () => {
    const d = makeDeps();
    d.kbs_.findOne.mockReturnValue(q(kbDoc()));
    d.members.findOne.mockReturnValue(q({ role: 'manager' }));
    d.cats_.findOne
      .mockReturnValueOnce(q({ _id: oid('0000000000000000000000c1'), path: '/x', slug: 'x' }))
      .mockReturnValueOnce(
        q({ _id: oid('0000000000000000000000c2'), path: '/x/y', depth: 1 }),
      );
    await expect(
      d.cats.update(ORG, ALI, 'member', 'kb', '0000000000000000000000c1', {
        parentId: '0000000000000000000000c2',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('delete with children is rejected (422)', async () => {
    const d = makeDeps();
    d.kbs_.findOne.mockReturnValue(q(kbDoc()));
    d.members.findOne.mockReturnValue(q({ role: 'manager' }));
    d.cats_.findOne.mockReturnValue(q({ _id: oid('0000000000000000000000c1'), path: '/x' }));
    d.cats_.countDocuments.mockResolvedValue(2);
    await expect(
      d.cats.remove(ORG, ALI, 'member', 'kb', '0000000000000000000000c1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
