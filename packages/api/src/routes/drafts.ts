import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { createDraftSchema, updateDraftSchema, draftsFilterSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';
import { sendTelegramMessage, formatTelegramPost, isTelegramConfigured } from '../services/telegram.js';

// Gerar slug a partir do título
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

export async function draftsRoutes(app: FastifyInstance) {
  // GET /drafts - Listar drafts com filtros
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = draftsFilterSchema.parse(request.query);
      const { page, limit, batchId, date, scheduledTime, nicheId, storeId, status, priority, channel } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      
      if (batchId) where.batchId = batchId;
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (channel) where.channels = { has: channel };
      
      // Filtros por data/horário
      if (date || scheduledTime) {
        where.batch = {};
        if (date) {
          where.batch.date = new Date(date + 'T00:00:00.000Z');
        }
        if (scheduledTime) {
          where.batch.scheduledTime = scheduledTime;
        }
      }

      // Filtros de offer (nicho/loja)
      if (nicheId || storeId) {
        where.offer = {};
        if (nicheId) where.offer.nicheId = nicheId;
        if (storeId) where.offer.storeId = storeId;
      }

      const [drafts, total] = await Promise.all([
        prisma.postDraft.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { priority: 'asc' },
            { createdAt: 'desc' },
          ],
          include: {
            offer: {
              include: {
                niche: { select: { id: true, name: true, slug: true, icon: true } },
                store: { select: { id: true, name: true, slug: true } },
              },
            },
            batch: { select: { id: true, scheduledTime: true, date: true, status: true } },
            deliveries: {
              select: { channel: true, status: true, sentAt: true, errorMessage: true },
            },
            approvedBy: { select: { id: true, name: true } },
          },
        }),
        prisma.postDraft.count({ where }),
      ]);

      return {
        data: drafts,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // POST /drafts - Criar draft
  app.post('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const body = createDraftSchema.parse(request.body);

      // Verificar se offer existe
      const offer = await prisma.offer.findUnique({ where: { id: body.offerId } });
      if (!offer) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      // Verificar se batch existe
      const batch = await prisma.batch.findUnique({ where: { id: body.batchId } });
      if (!batch) {
        return sendError(reply, Errors.NOT_FOUND('Carga'));
      }

      const draft = await prisma.postDraft.create({
        data: body as any,
        include: {
          offer: {
            include: {
              niche: { select: { id: true, name: true, slug: true, icon: true } },
              store: { select: { id: true, name: true, slug: true } },
            },
          },
          batch: { select: { id: true, scheduledTime: true, date: true } },
        },
      });

      // Atualizar contador do batch
      await prisma.batch.update({
        where: { id: body.batchId },
        data: { pendingCount: { increment: 1 } },
      });

      return reply.status(201).send({ data: draft });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /drafts/:id
  app.get('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const draft = await prisma.postDraft.findUnique({
        where: { id },
        include: {
          offer: {
            include: {
              niche: true,
              store: true,
            },
          },
          batch: true,
          deliveries: true,
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      return { data: draft };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // PUT /drafts/:id
  app.put('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateDraftSchema.parse(request.body);

      const existing = await prisma.postDraft.findUnique({ where: { id } });
      if (!existing) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      const draft = await prisma.postDraft.update({
        where: { id },
        data: body,
        include: {
          offer: {
            include: {
              niche: { select: { id: true, name: true, slug: true, icon: true } },
              store: { select: { id: true, name: true, slug: true } },
            },
          },
          batch: { select: { id: true, scheduledTime: true, date: true } },
          deliveries: true,
        },
      });

      return { data: draft };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // POST /drafts/:id/approve
  app.post('/:id/approve', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const draft = await prisma.postDraft.findUnique({
        where: { id },
        include: { 
          batch: true,
          offer: {
            include: {
              niche: true,
              store: true,
            },
          },
        },
      });

      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      if (draft.status !== 'PENDING') {
        return sendError(reply, Errors.DRAFT_NOT_PENDING);
      }

      // Atualizar draft para DISPATCHED (já vai publicar automaticamente)
      const updated = await prisma.postDraft.update({
        where: { id },
        data: {
          status: 'DISPATCHED',
          approvedAt: new Date(),
          approvedById: user.id,
        },
        include: {
          offer: {
            include: {
              niche: { select: { id: true, name: true, slug: true, icon: true } },
              store: { select: { id: true, name: true, slug: true } },
            },
          },
          batch: { select: { id: true, scheduledTime: true, date: true } },
          deliveries: true,
        },
      });

      const channels = draft.channels as string[];
      const offer = draft.offer;

      // ========== PUBLICAR NO SITE AUTOMATICAMENTE ==========
      if (channels.includes('SITE') && offer) {
        try {
          // Gerar slug único
          let slug = generateSlug(offer.title);
          let slugSuffix = 0;
          while (await prisma.publishedPost.findUnique({ where: { slug } })) {
            slugSuffix++;
            slug = `${generateSlug(offer.title)}-${slugSuffix}`;
          }

          const goCode = nanoid(8);

          // Criar publicação no site
          const publication = await prisma.publishedPost.create({
            data: {
              offerId: offer.id,
              slug,
              goCode,
              title: offer.title,
              excerpt: offer.description,
              copyText: (draft as any).copyTextSite || draft.copyText || `🔥 ${offer.title}`,
              price: offer.finalPrice,
              originalPrice: offer.originalPrice,
              discountPct: offer.discountPct || 0,
              affiliateUrl: offer.affiliateUrl,
              imageUrl: (draft as any).imageUrl || offer.imageUrl,
              urgency: offer.urgency,
              nicheId: offer.nicheId,
              storeId: offer.storeId,
              isActive: true,
            },
          });

          // Registrar delivery para SITE
          await prisma.postDelivery.create({
            data: {
              draftId: draft.id,
              channel: 'SITE',
              status: 'SENT',
              sentAt: new Date(),
              externalId: `/oferta/${publication.slug}`,
            },
          });

          console.log(`[Approve] Publicado no site: ${publication.slug}`);
        } catch (siteError: any) {
          console.error('[Approve] Erro ao publicar no site:', siteError.message);
          // Registrar erro de delivery
          await prisma.postDelivery.create({
            data: {
              draftId: draft.id,
              channel: 'SITE',
              status: 'ERROR',
              errorMessage: siteError.message,
            },
          });
        }
      }

      // ========== ENVIAR PARA O TELEGRAM ==========
      if (channels.includes('TELEGRAM') && offer) {
        try {
          if (!isTelegramConfigured()) {
            console.log('[Approve] Telegram não configurado, pulando...');
            await prisma.postDelivery.create({
              data: {
                draftId: draft.id,
                channel: 'TELEGRAM',
                status: 'ERROR',
                errorMessage: 'Telegram não configurado',
              },
            });
          } else {
            // Formatar texto para o Telegram
            const telegramText = formatTelegramPost({
              title: offer.title,
              originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
              finalPrice: Number(offer.finalPrice),
              discountPct: offer.discountPct,
              affiliateUrl: offer.affiliateUrl,
              storeName: offer.store?.name,
              copyText: (draft as any).copyTextTelegram || draft.copyText,
            });

            // Enviar para o Telegram (com imagem se tiver)
            const imageUrl = (draft as any).imageUrl || offer.imageUrl;
            const telegramResult = await sendTelegramMessage({
              text: telegramText,
              imageUrl: imageUrl || undefined,
            });

            if (telegramResult.success) {
              await prisma.postDelivery.create({
                data: {
                  draftId: draft.id,
                  channel: 'TELEGRAM',
                  status: 'SENT',
                  sentAt: new Date(),
                  externalId: telegramResult.messageId?.toString(),
                },
              });
              console.log(`[Approve] Telegram enviado com sucesso! ID: ${telegramResult.messageId}`);
            } else {
              await prisma.postDelivery.create({
                data: {
                  draftId: draft.id,
                  channel: 'TELEGRAM',
                  status: 'ERROR',
                  errorMessage: telegramResult.error,
                },
              });
              console.error(`[Approve] Erro ao enviar Telegram: ${telegramResult.error}`);
            }
          }
        } catch (telegramError: any) {
          console.error('[Approve] Erro ao enviar Telegram:', telegramError.message);
          await prisma.postDelivery.create({
            data: {
              draftId: draft.id,
              channel: 'TELEGRAM',
              status: 'ERROR',
              errorMessage: telegramError.message,
            },
          });
        }
      }

      // Atualizar contadores do batch
      await prisma.batch.update({
        where: { id: draft.batchId },
        data: {
          pendingCount: { decrement: 1 },
          dispatchedCount: { increment: 1 },
        },
      });

      // Buscar draft atualizado com deliveries
      const finalDraft = await prisma.postDraft.findUnique({
        where: { id },
        include: {
          offer: {
            include: {
              niche: { select: { id: true, name: true, slug: true, icon: true } },
              store: { select: { id: true, name: true, slug: true } },
            },
          },
          batch: { select: { id: true, scheduledTime: true, date: true } },
          deliveries: true,
        },
      });

      return { data: finalDraft };
    } catch (error: any) {
      console.error('[Approve] Erro:', error);
      return sendError(reply, error);
    }
  });

  // POST /drafts/:id/mark-approved (apenas marca como aprovado, não dispara)
  app.post('/:id/mark-approved', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const draft = await prisma.postDraft.findUnique({ where: { id } });

      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      if (draft.status !== 'PENDING') {
        return sendError(reply, Errors.DRAFT_NOT_PENDING);
      }

      const updated = await prisma.postDraft.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: user.id,
        },
        include: {
          offer: {
            include: {
              niche: { select: { id: true, name: true, slug: true, icon: true } },
              store: { select: { id: true, name: true, slug: true } },
            },
          },
          batch: { select: { id: true, scheduledTime: true, date: true } },
        },
      });

      // Atualizar contadores
      await prisma.batch.update({
        where: { id: draft.batchId },
        data: {
          pendingCount: { decrement: 1 },
          approvedCount: { increment: 1 },
        },
      });

      return { data: updated };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /drafts/:id/reject
  app.post('/:id/reject', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const draft = await prisma.postDraft.findUnique({ where: { id } });

      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      if (draft.status !== 'PENDING') {
        return sendError(reply, Errors.DRAFT_NOT_PENDING);
      }

      const updated = await prisma.postDraft.update({
        where: { id },
        data: { status: 'REJECTED' },
        include: {
          offer: {
            include: {
              niche: { select: { id: true, name: true, slug: true, icon: true } },
              store: { select: { id: true, name: true, slug: true } },
            },
          },
          batch: { select: { id: true, scheduledTime: true, date: true } },
        },
      });

      // Atualizar contador
      await prisma.batch.update({
        where: { id: draft.batchId },
        data: { pendingCount: { decrement: 1 } },
      });

      return { data: updated };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /drafts/:id/move-to-error (ou /error)
  app.post('/:id/error', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { message?: string };

      const draft = await prisma.postDraft.findUnique({ where: { id } });

      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      const previousStatus = draft.status;

      const updated = await prisma.postDraft.update({
        where: { id },
        data: {
          status: 'ERROR',
          errorMsg: body.message || 'Movido para erros manualmente',
        },
        include: {
          offer: {
            include: {
              niche: { select: { id: true, name: true, slug: true, icon: true } },
              store: { select: { id: true, name: true, slug: true } },
            },
          },
          batch: { select: { id: true, scheduledTime: true, date: true } },
        },
      });

      // Atualizar contadores
      const decrementField = previousStatus === 'PENDING' ? 'pendingCount' :
                            previousStatus === 'APPROVED' ? 'approvedCount' :
                            previousStatus === 'DISPATCHED' ? 'dispatchedCount' : null;

      if (decrementField) {
        await prisma.batch.update({
          where: { id: draft.batchId },
          data: {
            [decrementField]: { decrement: 1 },
            errorCount: { increment: 1 },
          },
        });
      }

      return { data: updated };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /drafts/:id/dispatch
  app.post('/:id/dispatch', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const draft = await prisma.postDraft.findUnique({ where: { id } });

      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      if (draft.status !== 'APPROVED') {
        return sendError(reply, Errors.DRAFT_NOT_APPROVED);
      }

      // Criar deliveries para cada canal
      const deliveries = [];
      for (const channel of draft.channels) {
        const delivery = await prisma.postDelivery.upsert({
          where: {
            draftId_channel: {
              draftId: draft.id,
              channel,
            },
          },
          create: {
            draftId: draft.id,
            channel,
            status: 'PENDING',
          },
          update: {
            status: 'PENDING',
            errorMessage: null,
            retries: 0,
          },
        });
        deliveries.push(delivery);
      }

      // Marcar draft como DISPATCHED
      const updated = await prisma.postDraft.update({
        where: { id },
        data: { status: 'DISPATCHED' },
        include: {
          offer: {
            include: {
              niche: { select: { id: true, name: true, slug: true, icon: true } },
              store: { select: { id: true, name: true, slug: true } },
            },
          },
          batch: { select: { id: true, scheduledTime: true, date: true } },
          deliveries: true,
        },
      });

      // Atualizar contadores
      await prisma.batch.update({
        where: { id: draft.batchId },
        data: {
          approvedCount: { decrement: 1 },
          dispatchedCount: { increment: 1 },
        },
      });

      return {
        data: updated,
        meta: {
          deliveriesCreated: deliveries.length,
        },
      };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });
}
