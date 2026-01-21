import { z } from 'zod';

// ==================== AUTH ====================

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

// ==================== PAGINATION ====================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==================== NICHES ====================

export const createNicheSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  slug: z.string().min(2, 'Slug deve ter no mínimo 2 caracteres').regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const updateNicheSchema = createNicheSchema.partial();

// ==================== STORES ====================

export const createStoreSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  slug: z.string().min(2, 'Slug deve ter no mínimo 2 caracteres').regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  logoUrl: z.string().url().optional().nullable(),
});

export const updateStoreSchema = createStoreSchema.partial();

// ==================== OFFERS ====================

export const createOfferSchema = z.object({
  title: z.string().min(5, 'Título deve ter no mínimo 5 caracteres'),
  description: z.string().optional().nullable(),
  originalPrice: z.coerce.number().positive('Preço original deve ser positivo'),
  finalPrice: z.coerce.number().positive('Preço final deve ser positivo'),
  discountPct: z.coerce.number().int().min(0).max(100).optional(), // Calculado automaticamente se não fornecido
  affiliateUrl: z.string().url('URL de afiliado inválida').optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  nicheId: z.string().cuid('Nicho inválido').optional().nullable(), // Opcional
  storeId: z.string().cuid('Loja inválida').optional().nullable(), // Opcional
  urgency: z.enum(['HOJE', 'ULTIMAS_UNIDADES', 'LIMITADO', 'NORMAL']).default('NORMAL'),
  expiresAt: z.coerce.date().optional().nullable(),
});

export const updateOfferSchema = createOfferSchema.partial();

export const offersFilterSchema = paginationSchema.extend({
  nicheId: z.string().optional(),
  storeId: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  minDiscount: z.coerce.number().int().min(0).max(100).optional(),
  q: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// ==================== BATCHES ====================

export const batchDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
});

export const batchScheduleSchema = z.array(z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:MM'),
  enabled: z.boolean(),
  order: z.number().int().min(0),
}));

// ==================== DRAFTS ====================

export const createDraftSchema = z.object({
  offerId: z.string().cuid('Oferta inválida'),
  batchId: z.string().cuid('Carga inválida'),
  copyText: z.string().min(10, 'Texto do post deve ter no mínimo 10 caracteres'),
  channels: z.array(z.enum(['TELEGRAM', 'WHATSAPP', 'FACEBOOK', 'SITE'])).min(1, 'Selecione ao menos um canal'),
  priority: z.enum(['HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
  aiScore: z.number().int().min(0).max(100).optional(),
});

export const updateDraftSchema = z.object({
  copyText: z.string().min(10).optional(),
  channels: z.array(z.enum(['TELEGRAM', 'WHATSAPP', 'FACEBOOK', 'SITE'])).min(1).optional(),
  priority: z.enum(['HIGH', 'NORMAL', 'LOW']).optional(),
});

export const draftsFilterSchema = paginationSchema.extend({
  batchId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduledTime: z.string().optional(),
  nicheId: z.string().optional(),
  storeId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'DISPATCHED', 'ERROR', 'REJECTED']).optional(),
  priority: z.enum(['HIGH', 'NORMAL', 'LOW']).optional(),
  channel: z.enum(['TELEGRAM', 'WHATSAPP', 'FACEBOOK', 'SITE']).optional(),
});

// ==================== PUBLICATIONS ====================

export const createPublicationSchema = z.object({
  offerId: z.string().cuid('Oferta inválida'),
  title: z.string().min(5).optional(),
  excerpt: z.string().optional(),
  copyText: z.string().optional(),
});

export const publicationsFilterSchema = paginationSchema.extend({
  nicheSlug: z.string().optional(),
  storeSlug: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(['recent', 'discount']).default('recent'),
  isActive: z.coerce.boolean().optional(),
});

// ==================== CONFIG ====================

export const updateConfigSchema = z.object({
  siteName: z.string().min(2).optional(),
  siteBaseUrl: z.string().url().optional(),
  defaultUtmSource: z.string().optional(),
  defaultUtmMedium: z.string().optional(),
  telegramChannel: z.string().optional().nullable(),
  whatsappNumber: z.string().optional().nullable(),
});

// ==================== STATS ====================

export const statsFilterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const clicksFilterSchema = paginationSchema.extend({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  channel: z.enum(['TELEGRAM', 'WHATSAPP', 'FACEBOOK', 'SITE']).optional(),
  nicheId: z.string().optional(),
  storeId: z.string().optional(),
  goCode: z.string().optional(),
});

// Types
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateNicheInput = z.infer<typeof createNicheSchema>;
export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
export type CreatePublicationInput = z.infer<typeof createPublicationSchema>;
