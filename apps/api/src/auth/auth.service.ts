import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../generated/prisma/client';
import { AccountRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type {
  AccessTokenClaims,
  AuthenticatedRequestUser,
  AuthResponse,
  MembershipSummary,
} from './auth.types';

type UserSummary = {
  id: string;
  email: string;
  displayName: string | null;
};

type MembershipRecord = {
  tenantId: string;
  role: AccountRole;
  createdAt: Date;
  tenant: { id: string; name: string };
};

type SessionResult = {
  refreshToken: string;
  response: AuthResponse;
};

type TokenConfig = {
  secret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
};

@Injectable()
export class AuthService {
  private readonly config: TokenConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    const secret = process.env.AUTH_ACCESS_TOKEN_SECRET;
    if (!secret || secret.length < 32 || secret.includes('replace-with')) {
      throw new Error(
        'AUTH_ACCESS_TOKEN_SECRET must be set to a random secret of at least 32 characters.',
      );
    }

    const accessTtlSeconds = this.readPositiveInteger(
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
      600,
    );
    const refreshTtlDays = this.readPositiveInteger(
      'AUTH_REFRESH_TOKEN_TTL_DAYS',
      30,
    );
    if (accessTtlSeconds > 3600) {
      throw new Error('AUTH_ACCESS_TOKEN_TTL_SECONDS must not exceed 3600.');
    }
    if (refreshTtlDays > 365) {
      throw new Error('AUTH_REFRESH_TOKEN_TTL_DAYS must not exceed 365.');
    }

    this.config = {
      secret,
      accessTtlSeconds,
      refreshTtlDays,
    };
  }

  get refreshTokenMaxAgeMs(): number {
    return this.config.refreshTtlDays * 24 * 60 * 60 * 1000;
  }

  async register(dto: RegisterDto): Promise<SessionResult> {
    const email = dto.email.toLowerCase();
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    const refreshToken = this.newRefreshToken();
    const now = new Date();
    const expiresAt = this.refreshExpiry(now);

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const tenant = await transaction.tenant.create({
          data: { name: dto.organizationName },
        });
        const user = await transaction.user.create({
          data: {
            email,
            passwordHash,
            displayName: dto.displayName,
          },
          select: { id: true, email: true, displayName: true },
        });

        await transaction.$queryRaw`
          SELECT set_config('app.tenant_id', ${tenant.id}, true)
        `;
        const membership = await transaction.membership.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: AccountRole.owner,
          },
          include: { tenant: { select: { id: true, name: true } } },
        });

        await transaction.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorId: user.id,
            action: 'auth.register',
            entityType: 'User',
            entityId: user.id,
            after: { email },
          },
        });

        await transaction.refreshToken.create({
          data: {
            tokenHash: this.hashRefreshToken(refreshToken),
            familyId: randomUUID(),
            userId: user.id,
            activeTenantId: tenant.id,
            expiresAt,
          },
        });

        return { user, membership };
      });

      return this.createSessionResult(
        created.user,
        [created.membership],
        created.membership,
        refreshToken,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account with this email already exists.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        displayName: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const memberships = await this.findMemberships(user.id);
    const selected = dto.tenantId
      ? memberships.find((membership) => membership.tenantId === dto.tenantId)
      : memberships[0];

    if (!selected) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const refreshToken = this.newRefreshToken();
    const now = new Date();

    await this.prisma.withTenant(selected.tenantId, async (transaction) => {
      await transaction.refreshToken.create({
        data: {
          tokenHash: this.hashRefreshToken(refreshToken),
          familyId: randomUUID(),
          userId: user.id,
          activeTenantId: selected.tenantId,
          expiresAt: this.refreshExpiry(now),
        },
      });
      await transaction.auditLog.create({
        data: {
          tenantId: selected.tenantId,
          actorId: user.id,
          action: 'auth.login',
          entityType: 'User',
          entityId: user.id,
        },
      });
    });

    const { passwordHash: _passwordHash, ...userSummary } = user;
    return this.createSessionResult(
      userSummary,
      memberships,
      selected,
      refreshToken,
    );
  }

  async refresh(rawToken: string): Promise<SessionResult> {
    if (!rawToken) {
      throw new UnauthorizedException('A refresh session is required.');
    }

    const nextRefreshToken = this.newRefreshToken();
    const now = new Date();
    const outcome = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.refreshToken.findUnique({
        where: { tokenHash: this.hashRefreshToken(rawToken) },
      });

      if (!current) {
        return { kind: 'invalid' as const };
      }

      if (current.revokedAt) {
        await transaction.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { kind: 'invalid' as const };
      }

      const consumed = await transaction.refreshToken.updateMany({
        where: {
          id: current.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (consumed.count !== 1) {
        await transaction.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { kind: 'invalid' as const };
      }

      await transaction.$queryRaw`
        SELECT set_config('app.user_id', ${current.userId}, true)
      `;
      const memberships = await transaction.membership.findMany({
        where: { userId: current.userId },
        include: { tenant: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      const activeMembership =
        memberships.find(
          (membership) => membership.tenantId === current.activeTenantId,
        ) ?? memberships[0];

      if (!activeMembership) {
        await transaction.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { kind: 'invalid' as const };
      }

      const user = await transaction.user.findUnique({
        where: { id: current.userId },
        select: { id: true, email: true, displayName: true },
      });
      if (!user) {
        return { kind: 'invalid' as const };
      }

      await transaction.refreshToken.create({
        data: {
          tokenHash: this.hashRefreshToken(nextRefreshToken),
          familyId: current.familyId,
          userId: current.userId,
          activeTenantId: activeMembership.tenantId,
          expiresAt: this.refreshExpiry(now),
        },
      });

      return {
        kind: 'ok' as const,
        user,
        memberships,
        activeMembership,
      };
    });

    if (outcome.kind !== 'ok') {
      throw new UnauthorizedException('The refresh session is invalid or expired.');
    }

    return this.createSessionResult(
      outcome.user,
      outcome.memberships,
      outcome.activeMembership,
      nextRefreshToken,
    );
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) {
      return;
    }

    const tokenHash = this.hashRefreshToken(rawToken);
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const session = await transaction.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!session || session.revokedAt) {
        return;
      }

      await transaction.refreshToken.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.$queryRaw`
        SELECT set_config('app.tenant_id', ${session.activeTenantId}, true)
      `;
      await transaction.auditLog.create({
        data: {
          tenantId: session.activeTenantId,
          actorId: session.userId,
          action: 'auth.logout',
          entityType: 'User',
          entityId: session.userId,
        },
      });
    });
  }

  async selectTenant(
    user: AuthenticatedRequestUser,
    tenantId: string,
    rawRefreshToken: string,
  ): Promise<SessionResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('A refresh session is required.');
    }

    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const now = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT set_config('app.user_id', ${user.sub}, true)
      `;
      const membership = await transaction.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.sub } },
        include: { tenant: { select: { id: true, name: true } } },
      });

      if (!membership) {
        throw new ForbiddenException('You are not a member of this tenant.');
      }

      const updated = await transaction.refreshToken.updateMany({
        where: {
          tokenHash,
          userId: user.sub,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { activeTenantId: tenantId },
      });
      if (updated.count !== 1) {
        throw new UnauthorizedException('The refresh session is invalid or expired.');
      }

      await transaction.$queryRaw`
        SELECT set_config('app.tenant_id', ${tenantId}, true)
      `;
      await transaction.auditLog.create({
        data: {
          tenantId,
          actorId: user.sub,
          action: 'tenant.select',
          entityType: 'Tenant',
          entityId: tenantId,
        },
      });

      return membership;
    });

    const memberships = await this.findMemberships(user.sub);
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, displayName: true },
    });
    if (!currentUser) {
      throw new UnauthorizedException('The authenticated user no longer exists.');
    }

    return this.createSessionResult(currentUser, memberships, result, rawRefreshToken);
  }

  async getCurrentSession(
    user: AuthenticatedRequestUser,
  ): Promise<{
    user: AuthResponse['user'];
    memberships: MembershipSummary[];
    activeTenant: MembershipSummary;
  }> {
    const memberships = await this.findMemberships(user.sub);
    const activeTenant = memberships.find(
      (membership) => membership.tenantId === user.tenantId,
    );
    if (!activeTenant) {
      throw new UnauthorizedException('The active tenant membership no longer exists.');
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, displayName: true },
    });
    if (!userRecord) {
      throw new UnauthorizedException('The authenticated user no longer exists.');
    }

    return {
      user: userRecord,
      memberships: memberships.map((membership) =>
        this.summarizeMembership(membership),
      ),
      activeTenant: this.summarizeMembership(activeTenant),
    };
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedRequestUser> {
    let claims: AccessTokenClaims & { role?: AccountRole };
    try {
      claims = await this.jwtService.verifyAsync<
        AccessTokenClaims & { role?: AccountRole }
      >(token, {
        secret: this.config.secret,
        algorithms: ['HS256'],
        issuer: 'invoice-reconciliation-api',
        audience: 'invoice-reconciliation-web',
      });
    } catch {
      throw new UnauthorizedException('The access token is invalid or expired.');
    }

    if (
      typeof claims.sub !== 'string' ||
      typeof claims.email !== 'string' ||
      typeof claims.tenantId !== 'string'
    ) {
      throw new UnauthorizedException('The access token is invalid.');
    }

    const membership = await this.prisma.withTenant(
      claims.tenantId,
      (transaction) =>
        transaction.membership.findUnique({
          where: {
            tenantId_userId: { tenantId: claims.tenantId, userId: claims.sub },
          },
          select: { role: true },
        }),
    );

    if (!membership) {
      throw new UnauthorizedException('The active tenant membership no longer exists.');
    }

    return {
      sub: claims.sub,
      email: claims.email,
      tenantId: claims.tenantId,
      role: membership.role,
    };
  }

  private async findMemberships(userId: string): Promise<MembershipRecord[]> {
    return this.prisma.withUser(userId, (transaction) =>
      transaction.membership.findMany({
        where: { userId },
        include: { tenant: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  private async createSessionResult(
    user: UserSummary,
    memberships: MembershipRecord[],
    activeMembership: MembershipRecord,
    refreshToken: string,
  ): Promise<SessionResult> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        tenantId: activeMembership.tenantId,
        role: activeMembership.role,
      },
      {
        secret: this.config.secret,
        algorithm: 'HS256',
        expiresIn: this.config.accessTtlSeconds,
        issuer: 'invoice-reconciliation-api',
        audience: 'invoice-reconciliation-web',
      },
    );

    return {
      refreshToken,
      response: {
        accessToken,
        user,
        memberships: memberships.map((membership) =>
          this.summarizeMembership(membership),
        ),
        activeTenant: this.summarizeMembership(activeMembership),
      },
    };
  }

  private summarizeMembership(membership: MembershipRecord): MembershipSummary {
    return {
      tenantId: membership.tenantId,
      tenantName: membership.tenant.name,
      role: membership.role,
    };
  }

  private newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiry(from: Date): Date {
    return new Date(from.getTime() + this.refreshTokenMaxAgeMs);
  }

  private readPositiveInteger(name: string, defaultValue: number): number {
    const raw = process.env[name];
    if (raw === undefined) {
      return defaultValue;
    }

    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive integer.`);
    }

    return value;
  }
}
