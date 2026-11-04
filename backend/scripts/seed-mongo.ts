/**
 * MongoDB seed — demo org + admin + one KB (idempotent via upserts).
 * Run: npm run db:seed --workspace=backend
 * Credentials: admin@kms.local / ChangeMe123! (change after first login)
 */
import * as path from 'node:path';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

for (const candidate of ['.env', '../.env']) {
  dotenv.config({ path: path.resolve(process.cwd(), candidate) });
}

import { KbMember, KbMemberSchema } from '../src/common/mongo/schemas/kb-member.schema';
import { KnowledgeBase, KnowledgeBaseSchema } from '../src/common/mongo/schemas/knowledge-base.schema';
import { Membership, MembershipSchema } from '../src/common/mongo/schemas/membership.schema';
import { Organization, OrganizationSchema } from '../src/common/mongo/schemas/organization.schema';
import { User, UserSchema } from '../src/common/mongo/schemas/user.schema';

async function main(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);

  const UserModel = mongoose.model(User.name, UserSchema);
  const OrganizationModel = mongoose.model(Organization.name, OrganizationSchema);
  const MembershipModel = mongoose.model(Membership.name, MembershipSchema);
  const KnowledgeBaseModel = mongoose.model(KnowledgeBase.name, KnowledgeBaseSchema);
  const KbMemberModel = mongoose.model(KbMember.name, KbMemberSchema);
  await Promise.all([
    UserModel.createIndexes(),
    OrganizationModel.createIndexes(),
    MembershipModel.createIndexes(),
    KnowledgeBaseModel.createIndexes(),
    KbMemberModel.createIndexes(),
  ]);

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  const admin = await UserModel.findOneAndUpdate(
    { email: 'admin@kms.local' },
    {
      $setOnInsert: {
        email: 'admin@kms.local',
        passwordHash,
        fullName: 'مدیر سامانه',
        locale: 'fa',
        isSuperAdmin: true,
      },
    },
    { upsert: true, new: true },
  ).lean();
  if (!admin) throw new Error('seed: admin upsert failed');

  const org = await OrganizationModel.findOneAndUpdate(
    { slug: 'demo' },
    {
      $setOnInsert: {
        name: 'سازمان نمونه',
        slug: 'demo',
        description: 'سازمان نمایشی سامانه مدیریت دانش',
      },
    },
    { upsert: true, new: true },
  ).lean();
  if (!org) throw new Error('seed: org upsert failed');

  await MembershipModel.updateOne(
    { organizationId: org._id, userId: admin._id },
    { $set: { organizationId: org._id, userId: admin._id, role: 'org-admin' } },
    { upsert: true },
  );

  const kb = await KnowledgeBaseModel.findOneAndUpdate(
    { organizationId: org._id, slug: 'general' },
    {
      $setOnInsert: {
        organizationId: org._id,
        title: 'پایگاه دانش عمومی',
        slug: 'general',
        description: 'راهنماها و رویه‌های عمومی سازمان',
        visibility: 'internal',
        ownerId: admin._id,
      },
    },
    { upsert: true, new: true },
  ).lean();
  if (!kb) throw new Error('seed: kb upsert failed');

  await KbMemberModel.updateOne(
    { knowledgeBaseId: kb._id, userId: admin._id },
    { $set: { knowledgeBaseId: kb._id, userId: admin._id, role: 'manager' } },
    { upsert: true },
  );

  // eslint-disable-next-line no-console
  console.log(`Seeded org=${org.slug} kb=${kb.slug} admin=${admin.email}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void mongoose.disconnect();
  });
