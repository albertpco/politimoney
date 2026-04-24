import { PrismaClient } from "@prisma/client";

declare global {
  var __politiredPrisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  if (process.env.INGEST_DB_WRITE === "false") return null;

  if (!global.__politiredPrisma) {
    global.__politiredPrisma = new PrismaClient();
  }
  return global.__politiredPrisma;
}
