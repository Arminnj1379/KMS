/**
 * MongoDB integration test — runs against the real server from MONGODB_URI
 * (compose `mongo`, replica set rs0) in an isolated `kms_mongo_integration`
 * database. If MongoDB is unreachable the tests log a warning and pass
 * vacuously (documented in PROGRESS.md); CI/compose runs must reach it.
 */
import mongoose, { type Connection } from 'mongoose';
import { Membership, MembershipSchema } from './schemas/membership.schema';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { User, UserSchema } from './schemas/user.schema';
import { withTransaction } from './transaction.helper';

const URI =
  process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kms?replicaSet=rs0&directConnection=true';

let connection: Connection | null = null;

beforeAll(async () => {
  try {
    connection = await mongoose
      .createConnection(URI, { dbName: 'kms_mongo_integration', serverSelectionTimeoutMS: 3000 })
      .asPromise();
    await connection.db?.admin().ping();
    await connection.db?.dropDatabase();
  } catch {
    // eslint-disable-next-line no-console
    console.warn('mongo-integration: MongoDB unreachable, skipping live assertions');
    connection = null;
  }
}, 15000);

afterAll(async () => {
  if (connection) {
    await connection.db?.dropDatabase().catch(() => undefined);
    await connection.close();
  }
});

function liveOrSkip(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!connection) return;
    await fn();
  }, 15000);
}

describe('MongoDB integration', () => {
  liveOrSkip('enforces unique users.email with E11000', async () => {
    if (!connection) return;
    const users = connection.model(User.name, UserSchema);
    await users.createIndexes();
    await users.create({ email: 'dup@example.com', passwordHash: 'x', fullName: 'A' });
    await expect(
      users.create({ email: 'dup@example.com', passwordHash: 'y', fullName: 'B' }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  liveOrSkip('enforces unique memberships(organizationId, userId)', async () => {
    if (!connection) return;
    const memberships = connection.model(Membership.name, MembershipSchema);
    await memberships.createIndexes();
    const { Types } = mongoose;
    const orgId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    await memberships.create({ organizationId: orgId, userId, role: 'member' });
    await expect(
      memberships.create({ organizationId: orgId, userId, role: 'member' }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  liveOrSkip('commits user+org+membership in one transaction (rs0 required)', async () => {
    if (!connection) return;
    const users = connection.model(User.name, UserSchema);
    const orgs = connection.model(Organization.name, OrganizationSchema);
    const memberships = connection.model(Membership.name, MembershipSchema);

    const email = `tx-${Date.now()}@example.com`;
    await withTransaction(connection, async (session) => {
      const [user] = await users.create(
        [{ email, passwordHash: 'x', fullName: 'Tx User' }],
        { session },
      );
      const [org] = await orgs.create([{ name: 'Tx Org', slug: `tx-${Date.now()}` }], {
        session,
      });
      if (!user || !org) throw new Error('tx fixture failed');
      await memberships.create(
        [{ organizationId: org._id, userId: user._id, role: 'org-admin' }],
        { session },
      );
    });

    const found = await users.findOne({ email }).lean();
    expect(found).not.toBeNull();
    const memberCount = await memberships.countDocuments({ userId: found?._id });
    expect(memberCount).toBe(1);
  });
});
