// Horários padrão das cargas
export const DEFAULT_BATCH_TIMES = ['08:00', '11:00', '14:00', '18:00', '22:00'] as const;

// Limites seguros por canal (posts por dia)
export const CHANNEL_DAILY_LIMITS = {
  TELEGRAM: 50,
  WHATSAPP: 20,
  FACEBOOK: 25,
  SITE: 200,
} as const;

// Configurações de retry
export const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffDelay: 1000, // ms
  backoffType: 'exponential' as const,
} as const;

// Emojis de urgência
export const URGENCY_EMOJIS = {
  HOJE: '🔥',
  ULTIMAS_UNIDADES: '⚡',
  LIMITADO: '⏰',
  NORMAL: '💰',
} as const;

// Labels de urgência
export const URGENCY_LABELS = {
  HOJE: 'ACABA HOJE',
  ULTIMAS_UNIDADES: 'ÚLTIMAS UNIDADES',
  LIMITADO: 'OFERTA LIMITADA',
  NORMAL: '',
} as const;

// Labels de status
export const STATUS_LABELS = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  DISPATCHED: 'Disparado',
  REJECTED: 'Rejeitado',
  ERROR: 'Erro',
  READY: 'Pronto',
  COMPLETED: 'Concluído',
  QUEUED: 'Na fila',
  SENDING: 'Enviando',
  SENT: 'Enviado',
} as const;

// Cores de status (para Tailwind)
export const STATUS_COLORS = {
  PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  APPROVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  DISPATCHED: 'bg-green-500/20 text-green-400 border-green-500/30',
  REJECTED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
  READY: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
  QUEUED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  SENDING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SENT: 'bg-green-500/20 text-green-400 border-green-500/30',
} as const;

// Ícones de canal
export const CHANNEL_ICONS = {
  TELEGRAM: '📱',
  WHATSAPP: '💬',
  FACEBOOK: '👤',
  SITE: '🌐',
} as const;

// Nomes de canal
export const CHANNEL_NAMES = {
  TELEGRAM: 'Telegram',
  WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook',
  SITE: 'Site',
} as const;
