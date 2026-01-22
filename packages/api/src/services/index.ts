/**
 * Services Index
 * 
 * Exporta todos os serviços da API
 */

// Copy Engine - Gerador de copy humano
export {
  buildCopy,
  buildCopyForChannels,
  validateForChannel,
  formatBRL,
  discountStr,
  getDateSeed,
  getWeekSeed,
} from './copyEngine';

export type {
  Channel,
  OfferInput,
  CopyResult,
  BuildCopyOptions,
} from './copyEngine';

// Draft Dispatcher - Prepara e dispara drafts
export {
  prepareDraftForDispatch,
  dispatchDraft,
  markDeliveryAsSent,
  markDeliveryAsError,
  getCopyPreview,
  canSendToTwitter,
} from './draftDispatcher';

// Cloudinary - Upload de imagens
export {
  configureCloudinary,
  uploadFromUrl,
  uploadFromBase64,
  uploadFromBuffer,
  deleteImage,
  getOptimizedUrl,
  getThumbnailUrl,
  healthCheck as cloudinaryHealthCheck,
} from './cloudinary';

export type {
  UploadResult,
  UploadOptions,
} from './cloudinary';

// ==================== NEW: SCORING & VALIDATION ====================

// Offer Scoring - Sistema de pontuação e classificação
export {
  validateOffer,
  calculateDiscount,
  calculateScore,
  shouldAutoApprove,
  processOffer,
  processBatch,
  getBatchStats,
} from './offerScoring';

export type {
  OfferInput as ScoringOfferInput,
  ValidationResult,
  ScoreResult,
  ScoreBreakdown,
  ProcessedOffer,
} from './offerScoring';

// AI Copy Generator - Geração de copy com IA
export {
  generateCopies,
  validateCopy,
  prepareDataForAI,
  generateAIPrompt,
} from './aiCopyGenerator';

export type {
  CopyInputData,
  GeneratedCopies,
  CopyGeneratorOptions,
} from './aiCopyGenerator';

// Offer Processor - Pipeline completo de processamento
export {
  processOfferBatch,
  reprocessExistingOffers,
} from './offerProcessor';

export type {
  RawOfferData,
  ProcessingResult,
  ProcessingOptions,
} from './offerProcessor';
