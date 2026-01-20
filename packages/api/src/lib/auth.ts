import bcrypt from 'bcryptjs';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './prisma.js';

// Hash de senha
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verificar senha
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Hash para refresh token
export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

// Verificar refresh token
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

// Middleware de autenticação JWT
export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token inválido ou expirado',
      },
    });
  }
}

// Middleware para verificar se é admin
export async function adminGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const user = request.user as { id: string; role: string };
    
    if (user.role !== 'ADMIN') {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso restrito a administradores',
        },
      });
    }
  } catch (err) {
    reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token inválido ou expirado',
      },
    });
  }
}

// Declarar tipos para JWT
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; role: string };
    user: { id: string; email: string; role: string };
  }
}
