import { PrismaClient } from "@prisma/client";

// 在开发环境下复用同一个 PrismaClient 实例，避免热更新时创建过多连接
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
