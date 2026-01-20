/**
 * Cloudinary Service
 * 
 * Upload e gerenciamento de imagens na nuvem.
 * Configuração via variáveis de ambiente (nunca hardcode secrets!)
 */

import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

// ==================== TYPES ====================

export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  error?: string;
}

export interface UploadOptions {
  folder?: string;           // Pasta no Cloudinary (ex: "promo-platform/offers")
  transformation?: {         // Transformações automáticas
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'limit';
    quality?: 'auto' | number;
    format?: 'auto' | 'webp' | 'jpg' | 'png';
  };
  tags?: string[];           // Tags para organização
  publicId?: string;         // ID público customizado
}

// ==================== CONFIGURATION ====================

/**
 * Configurar Cloudinary com variáveis de ambiente
 * 
 * Variáveis necessárias (do motor):
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */
export function configureCloudinary(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[Cloudinary] Variáveis de ambiente não configuradas');
    return false;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  console.log('[Cloudinary] Configurado com sucesso');
  return true;
}

// ==================== UPLOAD FUNCTIONS ====================

/**
 * Upload de imagem via URL
 * 
 * @param imageUrl - URL da imagem original
 * @param options - Opções de upload
 */
export async function uploadFromUrl(
  imageUrl: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const uploadOptions: any = {
      folder: options.folder || 'promo-platform/offers',
      resource_type: 'image',
      overwrite: true,
      invalidate: true,
    };

    // Transformações
    if (options.transformation) {
      uploadOptions.transformation = {
        width: options.transformation.width || 800,
        height: options.transformation.height,
        crop: options.transformation.crop || 'limit',
        quality: options.transformation.quality || 'auto',
        fetch_format: options.transformation.format || 'auto',
      };
    } else {
      // Transformações padrão para otimização
      uploadOptions.transformation = {
        width: 800,
        crop: 'limit',
        quality: 'auto',
        fetch_format: 'auto',
      };
    }

    // Tags
    if (options.tags && options.tags.length > 0) {
      uploadOptions.tags = options.tags;
    }

    // Public ID customizado
    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const result: UploadApiResponse = await cloudinary.uploader.upload(imageUrl, uploadOptions);

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  } catch (error: any) {
    console.error('[Cloudinary] Erro no upload:', error.message);
    return {
      success: false,
      error: error.message || 'Erro desconhecido no upload',
    };
  }
}

/**
 * Upload de imagem via Buffer (para uploads diretos)
 * 
 * @param buffer - Buffer da imagem
 * @param options - Opções de upload
 */
export async function uploadFromBuffer(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const uploadOptions: any = {
      folder: options.folder || 'promo-platform/offers',
      resource_type: 'image',
      overwrite: true,
      invalidate: true,
    };

    // Transformações padrão
    uploadOptions.transformation = {
      width: options.transformation?.width || 800,
      crop: options.transformation?.crop || 'limit',
      quality: options.transformation?.quality || 'auto',
      fetch_format: options.transformation?.format || 'auto',
    };

    if (options.tags) {
      uploadOptions.tags = options.tags;
    }

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    // Upload via stream
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          resolve({
            success: false,
            error: error?.message || 'Erro no upload',
          });
          return;
        }

        resolve({
          success: true,
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Upload de imagem via Base64
 * 
 * @param base64 - String base64 da imagem (com ou sem prefixo data:)
 * @param options - Opções de upload
 */
export async function uploadFromBase64(
  base64: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    // Garantir prefixo data:
    const dataUri = base64.startsWith('data:')
      ? base64
      : `data:image/jpeg;base64,${base64}`;

    const uploadOptions: any = {
      folder: options.folder || 'promo-platform/offers',
      resource_type: 'image',
      overwrite: true,
      invalidate: true,
      transformation: {
        width: options.transformation?.width || 800,
        crop: options.transformation?.crop || 'limit',
        quality: options.transformation?.quality || 'auto',
        fetch_format: options.transformation?.format || 'auto',
      },
    };

    if (options.tags) {
      uploadOptions.tags = options.tags;
    }

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const result = await cloudinary.uploader.upload(dataUri, uploadOptions);

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  } catch (error: any) {
    console.error('[Cloudinary] Erro no upload base64:', error.message);
    return {
      success: false,
      error: error.message || 'Erro desconhecido',
    };
  }
}

// ==================== DELETE FUNCTIONS ====================

/**
 * Deletar imagem do Cloudinary
 * 
 * @param publicId - ID público da imagem
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error: any) {
    console.error('[Cloudinary] Erro ao deletar:', error.message);
    return false;
  }
}

// ==================== URL HELPERS ====================

/**
 * Gerar URL otimizada para uma imagem
 * 
 * @param publicId - ID público da imagem
 * @param options - Opções de transformação
 */
export function getOptimizedUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'limit';
    quality?: 'auto' | number;
    format?: 'auto' | 'webp' | 'jpg' | 'png';
  } = {}
): string {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: {
      width: options.width || 800,
      height: options.height,
      crop: options.crop || 'limit',
      quality: options.quality || 'auto',
      fetch_format: options.format || 'auto',
    },
  });
}

/**
 * Gerar URL de thumbnail
 * 
 * @param publicId - ID público da imagem
 * @param size - Tamanho do thumbnail (default: 200)
 */
export function getThumbnailUrl(publicId: string, size: number = 200): string {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: {
      width: size,
      height: size,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
    },
  });
}

// ==================== HEALTH CHECK ====================

/**
 * Verificar se Cloudinary está configurado e funcionando
 */
export async function healthCheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await cloudinary.api.ping();
    return { ok: result.status === 'ok' };
  } catch (error: any) {
    return {
      ok: false,
      error: error.message || 'Cloudinary não está acessível',
    };
  }
}
