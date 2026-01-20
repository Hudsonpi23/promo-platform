import { FastifyReply } from 'fastify';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  // Auth
  INVALID_CREDENTIALS: new AppError('INVALID_CREDENTIALS', 'Email ou senha incorretos', 401),
  UNAUTHORIZED: new AppError('UNAUTHORIZED', 'Não autorizado', 401),
  FORBIDDEN: new AppError('FORBIDDEN', 'Acesso negado', 403),
  TOKEN_EXPIRED: new AppError('TOKEN_EXPIRED', 'Token expirado', 401),
  TOKEN_INVALID: new AppError('TOKEN_INVALID', 'Token inválido', 401),
  
  // Resources
  NOT_FOUND: (resource: string) => new AppError('NOT_FOUND', `${resource} não encontrado`, 404),
  ALREADY_EXISTS: (resource: string) => new AppError('ALREADY_EXISTS', `${resource} já existe`, 409),
  
  // Validation
  VALIDATION_ERROR: (details: any) => new AppError('VALIDATION_ERROR', 'Erro de validação', 400, details),
  
  // Business
  BATCH_LOCKED: new AppError('BATCH_LOCKED', 'Carga já está bloqueada', 400),
  BATCH_CLOSED: new AppError('BATCH_CLOSED', 'Carga já está fechada', 400),
  DRAFT_NOT_PENDING: new AppError('DRAFT_NOT_PENDING', 'Draft não está pendente', 400),
  DRAFT_NOT_APPROVED: new AppError('DRAFT_NOT_APPROVED', 'Draft não está aprovado', 400),
};

export function sendError(reply: FastifyReply, error: AppError | Error) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    });
  }

  console.error('Unexpected error:', error);
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor',
    },
  });
}
