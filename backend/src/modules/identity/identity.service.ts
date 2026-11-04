import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types, type Connection } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthTokens, AuthenticatedUser, OrgRole } from '../../common/auth/types';
import { throwConflictIfDuplicate } from '../../common/mongo/mongo-errors';
import { normalizeEmail, toObjectIdOrNull } from '../../common/mongo/object-id';
import { withTransaction } from '../../common/mongo/transaction.helper';
import { Department } from '../../common/mongo/schemas/department.schema';
import { Membership } from '../../common/mongo/schemas/membership.schema';
import { Organization } from '../../common/mongo/schemas/organization.schema';
import { RefreshSession } from '../../common/mongo/schemas/session.schema';
import { User } from '../../common/mongo/schemas/user.schema';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { comparePassword, hashPassword } from './password.util';

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
}

export interface AuthResult extends AuthTokens {
  user: SafeUser;
  organization: { id: string; name: string; slug: string };
  orgRole: OrgRole;
}

function toSafeUser(u: {
  _id: Types.ObjectId;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
}): SafeUser {
  return {
    id: u._id.toHexString(),
    email: u.email,
    fullName: u.fullName,
    avatarUrl: u.avatarUrl,
    locale: u.locale,
    isActive: u.isActive,
  };
}

function sha256(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function accessTtlSeconds(): number {
  const raw = process.env['JWT_ACCESS_TTL'];
  const n = raw ? Number.parseInt(raw, 10) : 900;
  return Number.isFinite(n) && n > 0 ? n : 900;
}

function refreshTtlDays(): number {
  const raw = process.env['JWT_REFRESH_TTL_DAYS'];
  const n = raw ? Number.parseInt(raw, 10) : 7;
  return Number.isFinite(n) && n > 0 ? n : 7;
}

const INVALID_CREDENTIALS = 'ایمیل یا گذرواژه نادرست است';

/**
 * Authentication flows. Owns users/sessions rows touched during
 * bootstrap (register) — later user/org management lives in their modules.
 */
@Injectable()
export class IdentityService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Organization.name) private readonly organizationModel: Model<Organization>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
    @InjectModel(RefreshSession.name) private readonly sessionModel: Model<RefreshSession>,
    @InjectModel(Department.name) private readonly departmentModel: Model<Department>,
    private readonly jwt: JwtService,
  ) {}

  private signAccess(user: AuthenticatedUser): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.userId, orgId: user.orgId, orgRole: user.orgRole, email: user.email },
      { secret: process.env['JWT_ACCESS_SECRET'], expiresIn: accessTtlSeconds() },
    );
  }

  private newSession(userId: Types.ObjectId, familyId: string) {
    const refreshToken = randomBytes(32).toString('base64url');
    return {
      refreshToken,
      row: {
        userId,
        refreshHash: sha256(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + refreshTtlDays() * 24 * 3600 * 1000),
      },
    };
  }

  /**
   * Public self-service bootstrap: creates an isolated org with the caller
   * as its org-admin. (Decision D-013.)
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    const existing = await this.userModel.findOne({ email }).lean();
    if (existing) throw new ConflictException('این ایمیل قبلاً ثبت شده است');

    const passwordHash = await hashPassword(dto.password);
    const slug = await this.uniqueOrgSlug();

    try {
      const created = await withTransaction(this.connection, async (session) => {
        const [user] = await this.userModel.create(
          [
            {
              email,
              passwordHash,
              fullName: dto.fullName,
              lastLoginAt: new Date(),
            },
          ],
          { session },
        );
        if (!user) throw new ConflictException('امکان ساخت حساب وجود ندارد');
        const [organization] = await this.organizationModel.create(
          [{ name: dto.organizationName, slug }],
          { session },
        );
        if (!organization) throw new ConflictException('امکان ساخت سازمان وجود ندارد');
        await this.membershipModel.create(
          [{ organizationId: organization._id, userId: user._id, role: 'org-admin' }],
          { session },
        );
        const familyId = randomBytes(16).toString('hex');
        const newSession = this.newSession(user._id, familyId);
        await this.sessionModel.create([newSession.row], { session });
        return { userId: user._id, refreshToken: newSession.refreshToken };
      });

      const user = await this.userModel.findById(created.userId).lean();
      const organization = await this.organizationModel.findOne({ slug }).lean();
      if (!user || !organization) throw new ConflictException('امکان ساخت حساب وجود ندارد');

      const identity: AuthenticatedUser = {
        userId: user._id.toHexString(),
        email: user.email,
        orgId: organization._id.toHexString(),
        orgRole: 'org-admin',
      };
      return {
        accessToken: await this.signAccess(identity),
        refreshToken: created.refreshToken,
        user: toSafeUser(user),
        organization: {
          id: organization._id.toHexString(),
          name: organization.name,
          slug: organization.slug,
        },
        orgRole: 'org-admin',
      };
    } catch (error) {
      throwConflictIfDuplicate(error, 'این ایمیل قبلاً ثبت شده است');
      throw error;
    }
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }): Promise<AuthResult> {
    const user = await this.userModel.findOne({ email: normalizeEmail(dto.email) }).lean();
    if (!user || !user.isActive) throw new UnauthorizedException(INVALID_CREDENTIALS);
    const ok = await comparePassword(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const membership = await this.membershipModel
      .findOne({ userId: user._id })
      .sort({ createdAt: 1 })
      .lean();
    if (!membership) throw new ForbiddenException('برای این کاربر سازمانی ثبت نشده است');
    const organization = await this.organizationModel.findById(membership.organizationId).lean();
    if (!organization) throw new ForbiddenException('برای این کاربر سازمانی ثبت نشده است');

    const familyId = randomBytes(16).toString('hex');
    const session = this.newSession(user._id, familyId);
    await withTransaction(this.connection, async (tx) => {
      await this.sessionModel.create(
        [{ ...session.row, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null }],
        { session: tx },
      );
      await this.userModel.updateOne(
        { _id: user._id },
        { lastLoginAt: new Date() },
        { session: tx },
      );
    });

    const identity: AuthenticatedUser = {
      userId: user._id.toHexString(),
      email: user.email,
      orgId: organization._id.toHexString(),
      orgRole: membership.role as OrgRole,
    };
    return {
      accessToken: await this.signAccess(identity),
      refreshToken: session.refreshToken,
      user: toSafeUser(user),
      organization: {
        id: organization._id.toHexString(),
        name: organization.name,
        slug: organization.slug,
      },
      orgRole: membership.role as OrgRole,
    };
  }

  /**
   * Opaque refresh rotation. Presenting an already-rotated token is treated
   * as theft: the whole family is revoked.
   */
  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    const hash = sha256(dto.refreshToken);
    const session = await this.sessionModel.findOne({ refreshHash: hash }).lean();
    if (!session) throw new UnauthorizedException('نشست نامعتبر است');
    if (session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      if (session.revokedAt) await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('نشست نامعتبر است');
    }
    const user = await this.userModel.findById(session.userId).lean();
    if (!user || !user.isActive) throw new UnauthorizedException('نشست نامعتبر است');
    const membership = await this.membershipModel
      .findOne({ userId: user._id })
      .sort({ createdAt: 1 })
      .lean();
    if (!membership) throw new ForbiddenException('برای این کاربر سازمانی ثبت نشده است');

    const next = this.newSession(user._id, session.familyId);
    await withTransaction(this.connection, async (tx) => {
      await this.sessionModel.updateOne(
        { _id: session._id },
        { revokedAt: new Date() },
        { session: tx },
      );
      await this.sessionModel.create([next.row], { session: tx });
    });

    const identity: AuthenticatedUser = {
      userId: user._id.toHexString(),
      email: user.email,
      orgId: membership.organizationId.toHexString(),
      orgRole: membership.role as OrgRole,
    };
    return { accessToken: await this.signAccess(identity), refreshToken: next.refreshToken };
  }

  async logout(dto: RefreshDto): Promise<void> {
    await this.sessionModel.updateMany(
      { refreshHash: sha256(dto.refreshToken), revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  async me(userId: string) {
    const id = toObjectIdOrNull(userId);
    const user = id ? await this.userModel.findById(id).lean() : null;
    if (!user) throw new UnauthorizedException('نشست نامعتبر است');
    const memberships = await this.membershipModel
      .find({ userId: user._id })
      .sort({ createdAt: 1 })
      .lean();
    const rows = await Promise.all(
      memberships.map(async (m) => {
        const organization = await this.organizationModel.findById(m.organizationId).lean();
        if (!organization) return null;
        const department = m.departmentId
          ? await this.departmentModel.findById(m.departmentId).lean()
          : null;
        return {
          organization: {
            id: organization._id.toHexString(),
            name: organization.name,
            slug: organization.slug,
          },
          role: m.role as OrgRole,
          department: department
            ? { id: department._id.toHexString(), name: department.name }
            : null,
        };
      }),
    );
    return { user: toSafeUser(user), memberships: rows.filter((r) => r !== null) };
  }

  /** Verifies the current password, then revokes every session (re-login required). */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const id = toObjectIdOrNull(userId);
    const user = id ? await this.userModel.findById(id).lean() : null;
    if (!user) throw new UnauthorizedException('نشست نامعتبر است');
    const ok = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('گذرواژه فعلی نادرست است');
    await withTransaction(this.connection, async (tx) => {
      await this.userModel.updateOne(
        { _id: user._id },
        { passwordHash: await hashPassword(dto.newPassword) },
        { session: tx },
      );
      await this.sessionModel.updateMany(
        { userId: user._id },
        { revokedAt: new Date() },
        { session: tx },
      );
    });
  }

  private async uniqueOrgSlug(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = `org-${randomBytes(3).toString('hex')}`;
      const existing = await this.organizationModel.findOne({ slug }).lean();
      if (!existing) return slug;
    }
    throw new ConflictException('امکان ساخت سازمان وجود ندارد؛ دوباره تلاش کنید');
  }

  private async revokeFamily(familyId: string): Promise<void> {
    try {
      await this.sessionModel.updateMany(
        { familyId, revokedAt: null },
        { revokedAt: new Date() },
      );
    } catch {
      // Revocation is best-effort hardening; the request itself still fails closed.
    }
  }
}
