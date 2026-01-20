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
