import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

prisma.$connect()
  .then(() => console.log('Connected to PostgreSQL via Prisma.'))
  .catch((err) => console.error('Failed to connect to PostgreSQL:', err));
