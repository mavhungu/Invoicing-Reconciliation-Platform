import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be set before starting the API.');
    }

    super({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  withTenant<T>(
    tenantId: string,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return operation(transaction);
    });
  }

  withUser<T>(
    userId: string,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      return operation(transaction);
    });
  }
}
