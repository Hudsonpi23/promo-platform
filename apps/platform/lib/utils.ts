import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDiscount(discount: number): string {
  return `-${discount}% OFF`;
}

export function getUrgencyLabel(urgency: string): string {
  const labels: Record<string, string> = {
    HOJE: '🔥 ACABA HOJE',
    ULTIMAS_UNIDADES: '⚡ ÚLTIMAS UNIDADES',
    LIMITADO: '⏰ OFERTA LIMITADA',
    NORMAL: '',
  };
  return labels[urgency] || '';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    APPROVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    DISPATCHED: 'bg-green-500/20 text-green-400 border-green-500/30',
    REJECTED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return colors[status] || colors.PENDING;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    APPROVED: 'Aprovado',
    DISPATCHED: 'Disparado',
    REJECTED: 'Rejeitado',
    ERROR: 'Erro',
  };
  return labels[status] || status;
}

export function getChannelIcon(channel: string): string {
  const icons: Record<string, string> = {
    TELEGRAM: '📱',
    WHATSAPP: '💬',
    FACEBOOK: '👤',
    TWITTER: '🐦',
    SITE: '🌐',
  };
  return icons[channel] || '📤';
}

export function getChannelName(channel: string): string {
  const names: Record<string, string> = {
    TELEGRAM: 'Telegram',
    WHATSAPP: 'WhatsApp',
    FACEBOOK: 'Facebook',
    TWITTER: 'Twitter/X',
    SITE: 'Site',
  };
  return names[channel] || channel;
}
