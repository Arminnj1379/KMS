/**
 * Prisma seed — demo org + admin + one KB (idempotent via upserts).
 * Run: npm run prisma:seed --workspace=backend
 * Credentials: admin@kms.local / ChangeMe123! (change after first login)
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@kms.local' },
    update: {},
    create: {
      email: 'admin@kms.local',
      passwordHash,
      fullName: 'مدیر سامانه',
      locale: 'fa',
      isSuperAdmin: true,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'سازمان نمونه', slug: 'demo', description: 'سازمان نمایشی سامانه مدیریت دانش' },
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
    update: { role: 'org-admin' },
    create: { organizationId: org.id, userId: admin.id, role: 'org-admin' },
  });

  const kb = await prisma.knowledgeBase.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'general' } },
    update: {},
    create: {
      organizationId: org.id,
      title: 'پایگاه دانش عمومی',
      slug: 'general',
      description: 'راهنماها و رویه‌های عمومی سازمان',
      visibility: 'internal',
      ownerId: admin.id,
    },
  });

  await prisma.kbMember.upsert({
    where: { knowledgeBaseId_userId: { knowledgeBaseId: kb.id, userId: admin.id } },
    update: { role: 'manager' },
    create: { knowledgeBaseId: kb.id, userId: admin.id, role: 'manager' },
  });

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
    void prisma.$disconnect();
  });
