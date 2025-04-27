import { PrismaClient } from "@prisma/client";

declare global {
  let prisma: PrismaClient | undefined;
}

const prismaGlobal = globalThis as { prisma?: PrismaClient };
const db = prismaGlobal.prisma ?? new PrismaClient();
export { db };

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = db;
}