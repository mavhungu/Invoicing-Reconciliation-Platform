import { JwtService } from '@nestjs/jwt';
import { AccountRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import * as argon2 from 'argon2';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    signAsync: jest.fn().mockResolvedValue('signed-access-token'),
    verifyAsync: jest.fn().mockResolvedValue({
      sub: 'c0a80101-0000-4000-8000-000000000002',
      email: 'owner@example.test',
      tenantId: 'c0a80101-0000-4000-8000-000000000001',
      role: 'owner',
    }),
  })),
}));

jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthService', () => {
  const tenantId = 'c0a80101-0000-4000-8000-000000000001';
  const userId = 'c0a80101-0000-4000-8000-000000000002';
  const memberships = [
    {
      tenantId,
      role: AccountRole.owner,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      tenant: { id: tenantId, name: 'Acme' },
    },
  ];
  let prisma: {
    $transaction: jest.Mock;
    user: { findUnique: jest.Mock };
    withUser: jest.Mock;
    withTenant: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    process.env.AUTH_ACCESS_TOKEN_SECRET =
      'test-secret-that-is-long-enough-for-hmac-signing';
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = '600';
    process.env.AUTH_REFRESH_TOKEN_TTL_DAYS = '30';
    jest.mocked(argon2.hash).mockResolvedValue('argon2id$test-hash');
    jest.mocked(argon2.verify).mockResolvedValue(true);

    prisma = {
      $transaction: jest.fn(),
      user: { findUnique: jest.fn() },
      withUser: jest.fn(),
      withTenant: jest.fn(),
    };
    service = new AuthService(
      new JwtService(),
      prisma as unknown as PrismaService,
    );
  });

  it('creates a tenant, owner membership, hashed password, and session at registration', async () => {
    const tx = {
      tenant: {
        create: jest.fn().mockResolvedValue({ id: tenantId, name: 'Acme' }),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: userId,
          email: 'owner@example.test',
          displayName: 'Owner',
        }),
      },
      $queryRaw: jest.fn(),
      membership: {
        create: jest.fn().mockResolvedValue(memberships[0]),
      },
      auditLog: { create: jest.fn() },
      refreshToken: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    const result = await service.register({
      email: 'Owner@Example.Test',
      password: 'a-long-test-password',
      displayName: 'Owner',
      organizationName: 'Acme',
    });

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'owner@example.test',
          passwordHash: 'argon2id$test-hash',
        }),
        select: { id: true, email: true, displayName: true },
      }),
    );
    expect(tx.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { tenantId, userId, role: AccountRole.owner },
      }),
    );
    expect(tx.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          activeTenantId: tenantId,
          tokenHash: expect.not.stringContaining(result.refreshToken),
        }),
      }),
    );
    expect(result.response.user).toEqual({
      id: userId,
      email: 'owner@example.test',
      displayName: 'Owner',
    });
    expect(result.response.activeTenant.role).toBe(AccountRole.owner);
    expect(result.response.accessToken).toBeTruthy();
  });

  it('rejects invalid credentials without creating a session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'owner@example.test',
      displayName: 'Owner',
      passwordHash: 'argon2id$test-hash',
    });
    jest.mocked(argon2.verify).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'owner@example.test',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(prisma.withUser).not.toHaveBeenCalled();
    expect(prisma.withTenant).not.toHaveBeenCalled();
  });

  it('creates a hashed refresh session after successful login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'owner@example.test',
      displayName: 'Owner',
      passwordHash: 'argon2id$test-hash',
    });
    prisma.withUser.mockResolvedValue(memberships);

    const tx = {
      refreshToken: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma.withTenant.mockImplementation((_tenantId, callback) => callback(tx));

    const result = await service.login({
      email: 'owner@example.test',
      password: 'a-long-test-password',
    });

    expect(argon2.verify).toHaveBeenCalledWith(
      'argon2id$test-hash',
      'a-long-test-password',
    );
    expect(prisma.withTenant).toHaveBeenCalledWith(tenantId, expect.any(Function));
    expect(tx.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          activeTenantId: tenantId,
          tokenHash: expect.not.stringContaining(result.refreshToken),
        }),
      }),
    );
    expect(result.response.user).not.toHaveProperty('passwordHash');
  });

  it('rotates a refresh token and rejects reuse of a revoked token', async () => {
    const currentToken = 'current-refresh-token';
    const current = {
      id: 'c0a80101-0000-4000-8000-000000000003',
      tokenHash: 'stored-hash',
      familyId: 'c0a80101-0000-4000-8000-000000000004',
      userId,
      activeTenantId: tenantId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const tx = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      $queryRaw: jest.fn(),
      membership: { findMany: jest.fn().mockResolvedValue(memberships) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          email: 'owner@example.test',
          displayName: 'Owner',
        }),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    const rotated = await service.refresh(currentToken);
    expect(rotated.refreshToken).not.toBe(currentToken);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: current.id }),
      }),
    );
    expect(tx.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyId: current.familyId,
          userId,
          activeTenantId: tenantId,
        }),
      }),
    );

    tx.refreshToken.findUnique.mockResolvedValue({
      ...current,
      revokedAt: new Date(),
    });
    await expect(service.refresh(currentToken)).rejects.toMatchObject({
      status: 401,
    });
    expect(tx.refreshToken.updateMany).toHaveBeenLastCalledWith({
      where: { familyId: current.familyId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('uses the current membership role when authenticating an access token', async () => {
    prisma.withTenant.mockResolvedValue({ role: AccountRole.viewer });

    await expect(service.authenticateAccessToken('signed-token')).resolves.toEqual({
      sub: userId,
      email: 'owner@example.test',
      tenantId,
      role: AccountRole.viewer,
    });
    expect(prisma.withTenant).toHaveBeenCalledWith(
      tenantId,
      expect.any(Function),
    );
  });
});
