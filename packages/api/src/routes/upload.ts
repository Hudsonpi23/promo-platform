/**
 * Upload Routes
 * 
 * Endpoints para upload de imagens via Cloudinary
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import {
  uploadFromUrl,
  uploadFromBase64,
  uploadFromBuffer,
  deleteImage,
  healthCheck,
  UploadOptions,
} from '../services/cloudinary';

/**
 * Baixar imagem de uma URL, contornando proteções de hotlinking
 */
async function downloadImageAsBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Referer': new URL(imageUrl).origin,
      },
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('[Download] Erro ao baixar imagem:', error);
    return null;
  }
}

// ==================== SCHEMAS ====================

const uploadUrlSchema = z.object({
  imageUrl: z.string().url('URL inválida'),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
  publicId: z.string().optional(),
});

const uploadBase64Schema = z.object({
  base64: z.string().min(100, 'Base64 muito curto'),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
  publicId: z.string().optional(),
});

const deleteSchema = z.object({
  publicId: z.string().min(1, 'PublicId obrigatório'),
});

// ==================== ROUTES ====================

export async function uploadRoutes(fastify: FastifyInstance) {
  // Health check do Cloudinary
  fastify.get('/upload/health', async (request, reply) => {
    const result = await healthCheck();
    
    if (result.ok) {
      return reply.send({ status: 'ok', service: 'cloudinary' });
    }
    
    return reply.status(503).send({
      status: 'error',
      service: 'cloudinary',
      error: result.error,
    });
  });

  // Upload via URL
  fastify.post('/upload/url', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = uploadUrlSchema.parse(request.body);

      const options: UploadOptions = {
        folder: body.folder || 'promo-platform/offers',
        tags: body.tags,
        publicId: body.publicId,
      };

      // Tentar upload direto primeiro
      let result = await uploadFromUrl(body.imageUrl, options);

      // Se falhou, tentar baixar a imagem manualmente (contorna proteção de hotlinking)
      if (!result.success) {
        console.log('[Upload] Upload direto falhou, tentando download manual...');
        
        const buffer = await downloadImageAsBuffer(body.imageUrl);
        
        if (buffer) {
          result = await uploadFromBuffer(buffer, options);
        }
      }

      if (!result.success) {
        // Mensagem de erro mais amigável
        const errorMsg = result.error?.includes('403') || result.error?.includes('forbidden')
          ? 'A imagem está protegida contra download. Tente fazer upload do arquivo diretamente.'
          : result.error || 'Não foi possível fazer upload da imagem';
          
        return reply.status(400).send({
          error: 'UPLOAD_FAILED',
          message: errorMsg,
          hint: 'Baixe a imagem no seu computador e faça upload do arquivo diretamente.',
        });
      }

      return reply.send({
        success: true,
        data: {
          url: result.url,
          publicId: result.publicId,
          width: result.width,
          height: result.height,
          format: result.format,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      console.error('[Upload] Erro:', error);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no upload',
      });
    }
  });

  // Upload via Base64
  fastify.post('/upload/base64', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = uploadBase64Schema.parse(request.body);

      const options: UploadOptions = {
        folder: body.folder || 'promo-platform/offers',
        tags: body.tags,
        publicId: body.publicId,
      };

      const result = await uploadFromBase64(body.base64, options);

      if (!result.success) {
        return reply.status(400).send({
          error: 'UPLOAD_FAILED',
          message: result.error,
        });
      }

      return reply.send({
        success: true,
        data: {
          url: result.url,
          publicId: result.publicId,
          width: result.width,
          height: result.height,
          format: result.format,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      console.error('[Upload] Erro:', error);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no upload',
      });
    }
  });

  // Delete imagem
  fastify.delete('/upload/:publicId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { publicId } = request.params as { publicId: string };

      if (!publicId) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'PublicId é obrigatório',
        });
      }

      // Decodificar publicId (pode conter /)
      const decodedPublicId = decodeURIComponent(publicId);
      const success = await deleteImage(decodedPublicId);

      if (!success) {
        return reply.status(400).send({
          error: 'DELETE_FAILED',
          message: 'Não foi possível deletar a imagem',
        });
      }

      return reply.send({
        success: true,
        message: 'Imagem deletada com sucesso',
      });
    } catch (error: any) {
      console.error('[Upload] Erro ao deletar:', error);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno ao deletar',
      });
    }
  });

  // Upload via Multipart (para form-data)
  fastify.post('/upload/file', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Nenhum arquivo enviado',
        });
      }

      // Verificar tipo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Tipo de arquivo não permitido. Use: JPEG, PNG, WebP ou GIF',
        });
      }

      // Converter stream para buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Verificar tamanho (max 10MB)
      if (buffer.length > 10 * 1024 * 1024) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Arquivo muito grande. Máximo: 10MB',
        });
      }

      // Upload como base64
      const base64 = `data:${data.mimetype};base64,${buffer.toString('base64')}`;
      
      const result = await uploadFromBase64(base64, {
        folder: 'promo-platform/offers',
      });

      if (!result.success) {
        return reply.status(400).send({
          error: 'UPLOAD_FAILED',
          message: result.error,
        });
      }

      return reply.send({
        success: true,
        data: {
          url: result.url,
          publicId: result.publicId,
          width: result.width,
          height: result.height,
          format: result.format,
        },
      });
    } catch (error: any) {
      console.error('[Upload] Erro no upload de arquivo:', error);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no upload',
      });
    }
  });
}
