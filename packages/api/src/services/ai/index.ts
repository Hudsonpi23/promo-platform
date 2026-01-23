/**
 * 🤖 AI Services - Índice de exportações
 * 
 * Sistema de CURADORIA HUMANA + DISTRIBUIÇÃO AUTOMATIZADA POR IA
 */

// Base
export { isOpenAIConfigured, createCompletion, parseAIJson, OPENAI_MODELS, OPENAI_CONFIG } from './openai.js';
export * from './types.js';

// Agentes
export { runCuradora } from './agents/curadora.js';
export { runOrquestrador } from './agents/orquestrador.js';
export { runCopywriter, runCopywriterBatch } from './agents/copywriters.js';

// Workflow
export { 
  processApprovedOffer, 
  processApprovedOffersBatch,
  processPendingOffers,
} from './workflow.js';
