/**
 * 🤖 Types para os Agentes de IA
 */

import { Channel, RiskLevel } from '@prisma/client';

// ==================== OFFER INPUT (dados que a IA recebe) ====================

export interface OfferForAI {
  id: string;
  title: string;
  description?: string | null;
  originalPrice: number;
  finalPrice: number;
  discountPct: number;
  mainImage: string;
  images: string[];
  storeName: string;
  nicheName: string;
  urgency: string;
  promoType: string;
  couponCode?: string | null;
  affiliateUrl: string;
}

// ==================== AGENTE 0: CURADORA ====================

export interface CuradoraInput {
  offer: OfferForAI;
}

export interface CuradoraOutput {
  priorityScore: number;        // 0-100 (score de prioridade)
  riskLevel: RiskLevel;         // LOW, MEDIUM, HIGH, BLOCKED
  recommendedNetworks: Channel[];
  reasoning: string;            // Explicação da avaliação
  blockReason?: string;         // Se BLOCKED, motivo
  suggestions?: string[];       // Sugestões de melhoria
}

// ==================== AGENTE 1: ORQUESTRADOR ====================

export interface OrquestradorInput {
  offer: OfferForAI;
  curadoraResult: CuradoraOutput;
}

export interface PostJobRequest {
  network: Channel;
  style: string;                // "vitrine", "urgente", "conversacional", etc
  priority: number;             // 1-10
}

export interface OrquestradorOutput {
  jobs: PostJobRequest[];
  reasoning: string;
}

// ==================== AGENTES 2-5: COPYWRITERS ====================

export interface CopywriterInput {
  offer: OfferForAI;
  style: string;
  network: Channel;
}

export interface CopywriterOutput {
  textFinal: string;
  reasoning: string;
  hashtags?: string[];
  emoji?: string;
}

// ==================== AGENTE CONFIG ====================

export interface AgentConfig {
  name: string;
  description: string;
  network?: Channel;
  systemPrompt: string;
}

// ==================== WORKFLOW RESULT ====================

export interface AIWorkflowResult {
  success: boolean;
  offer: OfferForAI;
  curadora?: CuradoraOutput;
  orquestrador?: OrquestradorOutput;
  jobs?: Array<{
    network: Channel;
    textFinal: string;
    imageUsed: string;
    agentName: string;
    style: string;
  }>;
  error?: string;
}
