import { URGENCY_EMOJIS, URGENCY_LABELS, STATUS_LABELS, STATUS_COLORS, CHANNEL_ICONS } from './constants.js';

/**
 * Formata valor como moeda brasileira
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata desconto como string
 */
export function formatDiscount(discount: number): string {
  return `-${discount}% OFF`;
}

/**
 * Retorna emoji de urgência
 */
export function getUrgencyEmoji(urgency: string): string {
  return URGENCY_EMOJIS[urgency as keyof typeof URGENCY_EMOJIS] || URGENCY_EMOJIS.NORMAL;
}

/**
 * Retorna label de urgência
 */
export function getUrgencyLabel(urgency: string): string {
  const emoji = getUrgencyEmoji(urgency);
  const label = URGENCY_LABELS[urgency as keyof typeof URGENCY_LABELS];
  return label ? `${emoji} ${label}` : '';
}

/**
 * Retorna label de status
 */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status;
}

/**
 * Retorna cor de status (classes Tailwind)
 */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.PENDING;
}

/**
 * Retorna ícone de canal
 */
export function getChannelIcon(channel: string): string {
  return CHANNEL_ICONS[channel as keyof typeof CHANNEL_ICONS] || '📤';
}

/**
 * Calcula desconto percentual
 */
export function calculateDiscount(originalPrice: number, finalPrice: number): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
}

/**
 * Formata data para exibição
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', options || {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formata data e hora para exibição
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Gera slug a partir de string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Trunca texto com ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Formata mensagem para Telegram (Markdown)
 */
export function formatTelegramMessage(post: {
  title: string;
  copyText: string;
  price: number;
  discount: number;
  urgency: string;
  store: string;
  affiliateUrl: string;
}): string {
  const emoji = getUrgencyEmoji(post.urgency);
  return `${emoji} *${post.title}*

${post.copyText}

💰 *R$ ${post.price.toFixed(2)}* (-${post.discount}% OFF)

🏪 ${post.store}

👉 [VER OFERTA](${post.affiliateUrl})`;
}

/**
 * Formata mensagem para WhatsApp (texto simples)
 */
export function formatWhatsAppMessage(post: {
  title: string;
  copyText: string;
  price: number;
  discount: number;
  urgency: string;
  store: string;
  affiliateUrl: string;
}): string {
  const emoji = getUrgencyEmoji(post.urgency);
  return `${emoji} *${post.title}*

${post.copyText}

💰 *R$ ${post.price.toFixed(2)}* (-${post.discount}% OFF)

🏪 ${post.store}

👉 ${post.affiliateUrl}`;
}

/**
 * Formata post para Facebook
 */
export function formatFacebookPost(post: {
  title: string;
  copyText: string;
  price: number;
  discount: number;
  urgency: string;
  store: string;
  affiliateUrl: string;
}): string {
  const emoji = getUrgencyEmoji(post.urgency);
  const storeTag = post.store.toLowerCase().replace(/\s+/g, '');
  
  return `${emoji} ${post.title}

${post.copyText}

💰 R$ ${post.price.toFixed(2)} (-${post.discount}% OFF)

🏪 ${post.store}

👉 Ver oferta: ${post.affiliateUrl}

#promocao #desconto #oferta #${storeTag}`;
}
