"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient();
exports.prisma.$connect()
    .then(() => console.log('Connected to PostgreSQL via Prisma.'))
    .catch((err) => console.error('Failed to connect to PostgreSQL:', err));
//# sourceMappingURL=prisma.js.map