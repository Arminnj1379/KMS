/**
 * MongoDB seed — demo org with people, categories, tags and articles.
 * Idempotent via upserts on natural keys; safe to re-run.
 * Run: npm run db:seed --workspace=backend
 * Credentials: admin@kms.local / ChangeMe123! (org-admin; change after login)
 *              sara@kms.local  / ChangeMe123! (KB reviewer)
 */
import * as path from 'node:path';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';

for (const candidate of ['.env', '../.env']) {
  dotenv.config({ path: path.resolve(process.cwd(), candidate) });
}

import { Article, ArticleSchema } from '../src/common/mongo/schemas/article.schema';
import { ArticleVersion, ArticleVersionSchema } from '../src/common/mongo/schemas/article-version.schema';
import { Category, CategorySchema } from '../src/common/mongo/schemas/category.schema';
import { KbMember, KbMemberSchema } from '../src/common/mongo/schemas/kb-member.schema';
import { KnowledgeBase, KnowledgeBaseSchema } from '../src/common/mongo/schemas/knowledge-base.schema';
import { Membership, MembershipSchema } from '../src/common/mongo/schemas/membership.schema';
import { Organization, OrganizationSchema } from '../src/common/mongo/schemas/organization.schema';
import { Tag, TagSchema } from '../src/common/mongo/schemas/tag.schema';
import { User, UserSchema } from '../src/common/mongo/schemas/user.schema';
import { ensureIndexes } from './ensure-indexes';

/** Overload-union-safe model accessor (scripts run outside strict service typing). */
function getModel<T>(name: string, schema: mongoose.Schema<T>): mongoose.Model<T> {
  const existing = mongoose.models[name] as mongoose.Model<T> | undefined;
  return existing ?? mongoose.model<T>(name, schema);
}

function doc(paragraphs: string[]): Record<string, unknown> {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  };
}

const textOf = (paragraphs: string[]): string => paragraphs.join('\n\n');

async function main(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);
  await ensureIndexes();

  const UserModel = getModel(User.name, UserSchema);
  const OrganizationModel = getModel(Organization.name, OrganizationSchema);
  const MembershipModel = getModel(Membership.name, MembershipSchema);
  const KnowledgeBaseModel = getModel(KnowledgeBase.name, KnowledgeBaseSchema);
  const KbMemberModel = getModel(KbMember.name, KbMemberSchema);
  const CategoryModel = getModel(Category.name, CategorySchema);
  const ArticleModel = getModel(Article.name, ArticleSchema);
  const ArticleVersionModel = getModel(ArticleVersion.name, ArticleVersionSchema);
  const TagModel = getModel(Tag.name, TagSchema);

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  const admin = await UserModel.findOneAndUpdate(
    { email: 'admin@kms.local' },
    {
      $setOnInsert: {
        email: 'admin@kms.local',
        passwordHash,
        fullName: 'مدیر سامانه',
        locale: 'fa',
        isActive: true,
      },
    },
    { upsert: true, new: true },
  ).lean();
  if (!admin) throw new Error('seed: admin upsert failed');

  const sara = await UserModel.findOneAndUpdate(
    { email: 'sara@kms.local' },
    {
      $setOnInsert: {
        email: 'sara@kms.local',
        passwordHash,
        fullName: 'سارا رضایی',
        locale: 'fa',
        isActive: true,
      },
    },
    { upsert: true, new: true },
  ).lean();
  if (!sara) throw new Error('seed: reviewer upsert failed');

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

  for (const [userId, role] of [
    [admin._id, 'org-admin'],
    [sara._id, 'member'],
  ] as const) {
    await MembershipModel.updateOne(
      { organizationId: org._id, userId },
      { $set: { organizationId: org._id, userId, role } },
      { upsert: true },
    );
  }

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

  for (const [userId, kbRole] of [
    [admin._id, 'manager'],
    [sara._id, 'reviewer'],
  ] as const) {
    await KbMemberModel.updateOne(
      { knowledgeBaseId: kb._id, userId },
      { $set: { knowledgeBaseId: kb._id, userId, role: kbRole } },
      { upsert: true },
    );
  }

  const guides = await CategoryModel.findOneAndUpdate(
    { knowledgeBaseId: kb._id, slug: 'guides' },
    {
      $setOnInsert: {
        knowledgeBaseId: kb._id,
        parentId: null,
        title: 'راهنماها',
        slug: 'guides',
        description: 'راهنمای شروع و استفاده از سامانه',
        position: 0,
        path: '/guides',
        depth: 0,
      },
    },
    { upsert: true, new: true },
  ).lean();
  const procedures = await CategoryModel.findOneAndUpdate(
    { knowledgeBaseId: kb._id, slug: 'procedures' },
    {
      $setOnInsert: {
        knowledgeBaseId: kb._id,
        parentId: null,
        title: 'رویه‌ها',
        slug: 'procedures',
        description: 'رویه‌های بررسی و انتشار',
        position: 1,
        path: '/procedures',
        depth: 0,
      },
    },
    { upsert: true, new: true },
  ).lean();
  if (!guides || !procedures) throw new Error('seed: categories upsert failed');

  const tagIds: Types.ObjectId[] = [];
  for (const [name, slug] of [
    ['شروع', 'start'],
    ['بررسی', 'review'],
  ] as const) {
    const tag = await TagModel.findOneAndUpdate(
      { organizationId: org._id, slug },
      { $setOnInsert: { organizationId: org._id, name, slug } },
      { upsert: true, new: true },
    ).lean();
    if (tag) tagIds.push(tag._id);
  }

  const articles: {
    title: string;
    slug: string;
    summary: string;
    body: string[];
    status: 'published' | 'draft';
    categoryId: Types.ObjectId | null;
  }[] = [
    {
      title: 'شروع کار با سامانه',
      slug: 'getting-started',
      summary: 'اولین گام‌ها برای استفاده از پایگاه دانش سازمان.',
      body: [
        'این سامانه برای سازمان‌دهی دانش سازمان طراحی شده است: مقاله بنویسید، برای بررسی بفرستید و پس از تأیید منتشر کنید.',
        'از نوار جست‌وجو می‌توانید در عنوان و متن همه مقالاتی که به آن‌ها دسترسی دارید جست‌وجو کنید.',
      ],
      status: 'published',
      categoryId: guides._id,
    },
    {
      title: 'چرخه بررسی مقالات',
      slug: 'review-cycle',
      summary: 'مقاله چگونه از پیش‌نویس به انتشار می‌رسد؟',
      body: [
        'نویسنده مقاله را در وضعیت پیش‌نویس می‌سازد و با انتخاب یک داور، آن را برای بررسی ارسال می‌کند.',
        'داور می‌تواند مقاله را تأیید و منتشر کند یا با یادداشت آن را به پیش‌نویس بازگرداند.',
      ],
      status: 'published',
      categoryId: procedures._id,
    },
    {
      title: 'پیش‌نویس نمونه',
      slug: 'sample-draft',
      summary: 'یک پیش‌نویس برای تمرین ویرایش و ارسال برای بررسی.',
      body: ['این یک پیش‌نویس نمونه است. آن را ویرایش کنید و برای بررسی بفرستید.'],
      status: 'draft',
      categoryId: null,
    },
  ];

  for (const a of articles) {
    const contentJson = doc(a.body);
    const row = await ArticleModel.findOneAndUpdate(
      { knowledgeBaseId: kb._id, slug: a.slug },
      {
        $setOnInsert: {
          organizationId: org._id,
          knowledgeBaseId: kb._id,
          categoryId: a.categoryId,
          authorId: admin._id,
          title: a.title,
          slug: a.slug,
          summary: a.summary,
          contentJson,
          contentText: textOf(a.body),
          status: a.status,
          version: 1,
          viewCount: 0,
          tagIds,
          attachments: [],
          publishedAt: a.status === 'published' ? new Date() : null,
          deletedAt: null,
        },
      },
      { upsert: true, new: true },
    ).lean();
    if (!row) throw new Error(`seed: article ${a.slug} upsert failed`);
    const snapshots = await ArticleVersionModel.countDocuments({ articleId: row._id });
    if (snapshots === 0) {
      await ArticleVersionModel.create({
        articleId: row._id,
        version: 1,
        title: a.title,
        summary: a.summary,
        contentJson,
        contentText: textOf(a.body),
        changelog: 'نسخه اولیه (seed)',
        createdBy: admin._id,
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded org=${org.slug} kb=${kb.slug} admin=${admin.email} reviewer=${sara.email}`);
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
