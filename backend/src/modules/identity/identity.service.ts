import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthTokens, AuthenticatedUser, OrgRole } from '../../common/auth/types';
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
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
}): SafeUser {
  return {
    id: u.id,
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
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private signAccess(user: AuthenticatedUser): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.userId, orgId: user.orgId, orgRole: user.orgRole, email: user.email },
      { secret: process.env['JWT_ACCESS_SECRET'], expiresIn: accessTtlSeconds() },
    );
  }

  private newSession(userId: string, familyId: string) {
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
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('این ایمیل قبلاً ثبت شده است');

    const passwordHash = await hashPassword(dto.password);
    const slug = await this.uniqueOrgSlug();

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          lastLoginAt: new Date(),
        },
      });
      const organization = await tx.organization.create({
        data: { name: dto.organizationName, slug },
      });
      await tx.membership.create({
        data: { organizationId: organization.id, userId: user.id, role: 'org-admin' },
      });
      const familyId = randomBytes(16).toString('hex');
      const session = this.newSession(user.id, familyId);
      await tx.session.create({ data: session.row });
      return { user, organization, refreshToken: session.refreshToken, familyId };
    });

    const identity: AuthenticatedUser = {
      userId: created.user.id,
      email: created.user.email,
      orgId: created.organization.id,
      orgRole: 'org-admin',
    };
    return {
      accessToken: await this.signAccess(identity),
      refreshToken: created.refreshToken,
      user: toSafeUser(created.user),
      organization: {
        id: created.organization.id,
        name: created.organization.name,
        slug: created.organization.slug,
      },
      orgRole: 'org-admin',
    };
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) throw new UnauthorizedException(INVALID_CREDENTIALS);
    const ok = await comparePassword(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: { organization: true },
    });
    if (!membership) throw new ForbiddenException('برای این کاربر سازمانی ثبت نشده است');

    const familyId = randomBytes(16).toString('hex');
    const session = this.newSession(user.id, familyId);
    await this.prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: { ...session.row, ip: meta.ip, userAgent: meta.userAgent },
      });
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    });

    const identity: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      orgId: membership.organizationId,
      orgRole: membership.role as OrgRole,
    };
    return {
      accessToken: await this.signAccess(identity),
      refreshToken: session.refreshToken,
      user: toSafeUser(user),
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
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
    const session = await this.prisma.session.findUnique({
      where: { refreshHash: hash },
      include: { user: { include: { memberships: { orderBy: { createdAt: 'asc' } } } } },
    });
    if (!session) throw new UnauthorizedException('نشست نامعتبر است');
    if (session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      if (session.revokedAt) await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('نشست نامعتبر است');
    }
    const user = session.user;
    if (!user.isActive) throw new UnauthorizedException('نشست نامعتبر است');
    const membership = user.memberships[0];
    if (!membership) throw new ForbiddenException('برای این کاربر سازمانی ثبت نشده است');

    const next = this.newSession(user.id, session.familyId);
    await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await tx.session.create({ data: next.row });
    });

    const identity: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      orgId: membership.organizationId,
      orgRole: membership.role as OrgRole,
    };
    return { accessToken: await this.signAccess(identity), refreshToken: next.refreshToken };
  }

  async logout(dto: RefreshDto): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshHash: sha256(dto.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { organization: true, department: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) throw new UnauthorizedException('نشست نامعتبر است');
    return {
      user: toSafeUser(user),
      memberships: user.memberships.map((m) => ({
        organization: { id: m.organization.id, name: m.organization.name, slug: m.organization.slug },
        role: m.role as OrgRole,
        department: m.department ? { id: m.department.id, name: m.department.name } : null,
      })),
    };
  }

  /** Verifies the current password, then revokes every session (re-login required). */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('نشست نامعتبر است');
    const ok = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('گذرواژه فعلی نادرست است');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(dto.newPassword) },
      });
      await tx.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    });
  }

  private async uniqueOrgSlug(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = `org-${randomBytes(3).toString('hex')}`;
      const existing = await this.prisma.organization.findUnique({ where: { slug } });
      if (!existing) return slug;
    }
    throw new ConflictException('امکان ساخت سازمان وجود ندارد؛ دوباره تلاش کنید');
  }

  private async revokeFamily(familyId: string): Promise<void> {
    try {
      await this.prisma.session.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Revocation is best-effort hardening; the request itself still fails closed.
    }
  }

  /** Maps unique-constraint races to 409 instead of leaking Prisma errors. */
  static toConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('رکورد تکراری است');
    }
    throw error;
  }
}
