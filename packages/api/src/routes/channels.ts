import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function channelsRoutes(app: FastifyInstance) {
  // Listar configurações de canais
  app.get('/', async () => {
    return prisma.channelConfig.findMany({
      orderBy: { channel: 'asc' },
    });
  });

  // Criar/atualizar configuração de canal
  app.put('/:channel', async (request) => {
    const { channel } = request.params as { channel: string };
    const body = request.body as {
      name: string;
      config: Record<string, any>;
      isActive?: boolean;
    };

    const config = await prisma.channelConfig.upsert({
      where: { channel: channel as any },
      update: {
        name: body.name,
        config: body.config,
        isActive: body.isActive ?? true,
      },
      create: {
        channel: channel as any,
        name: body.name,
        config: body.config,
        isActive: body.isActive ?? true,
      },
    });

    return config;
  });

  // Buscar erros (Setor de Erros)
  app.get('/errors', async (request) => {
    const query = request.query as {
      resolved?: string;
      limit?: string;
    };

    const errors = await prisma.errorLog.findMany({
      where: {
        ...(query.resolved !== undefined && {
          isResolved: query.resolved === 'true',
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ? parseInt(query.limit) : 50,
    });

    return errors;
  });

  // Marcar erro como resolvido
  app.post('/errors/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };

    const error = await prisma.errorLog.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    return error;
  });

  // Reenviar draft que deu erro
  app.post('/errors/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string };

    const errorLog = await prisma.errorLog.findUnique({
      where: { id },
    });

    if (!errorLog || !errorLog.draftId) {
      return reply.status(404).send({ error: 'Erro não encontrado ou sem draft associado' });
    }

    // Voltar o draft para PENDING
    await prisma.postDraft.update({
      where: { id: errorLog.draftId },
      data: { status: 'PENDING' },
    });

    // Marcar erro como resolvido
    await prisma.errorLog.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    return { success: true, draftId: errorLog.draftId };
  });
}
