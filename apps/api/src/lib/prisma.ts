import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 5_000,
  },
});
