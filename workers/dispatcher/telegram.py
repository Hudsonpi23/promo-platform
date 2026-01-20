"""
Telegram Dispatcher - Envia posts para canais/grupos do Telegram
Usa a API oficial do Telegram Bot

Requisitos:
- pip install python-telegram-bot
- Bot Token do Telegram
- Chat ID do canal/grupo
"""

import os
import logging
from typing import Optional
from .base import BaseDispatcher, PostContent, DispatchResult

logger = logging.getLogger(__name__)

# Tenta importar telegram (biblioteca do Telegram)
try:
    from telegram import Bot
    from telegram.constants import ParseMode
    TELEGRAM_AVAILABLE = True
except ImportError:
    TELEGRAM_AVAILABLE = False
    logger.warning("python-telegram-bot não instalado. Execute: pip install python-telegram-bot")


class TelegramDispatcher(BaseDispatcher):
    """Dispatcher para Telegram usando Bot API"""
    
    channel_name = "TELEGRAM"
    
    def __init__(self, config: dict):
        super().__init__(config)
        self.bot: Optional['Bot'] = None
        self.chat_id: Optional[str] = None
        self._setup_client()
        
    def _setup_client(self):
        """Configura o cliente do Telegram"""
        if not TELEGRAM_AVAILABLE:
            self.logger.error("python-telegram-bot não disponível")
            return
            
        # Credenciais do ambiente ou config
        bot_token = self.config.get('telegram_bot_token') or os.getenv('TELEGRAM_BOT_TOKEN')
        self.chat_id = self.config.get('telegram_chat_id') or os.getenv('TELEGRAM_CHAT_ID')
        
        if not bot_token:
            self.logger.warning("Token do bot Telegram não configurado")
            return
            
        if not self.chat_id:
            self.logger.warning("Chat ID do Telegram não configurado")
            return
            
        try:
            self.bot = Bot(token=bot_token)
            self.logger.info("Cliente Telegram configurado com sucesso")
        except Exception as e:
            self.logger.error(f"Erro ao configurar cliente Telegram: {e}")
            
    async def validate_config(self) -> bool:
        """Valida se as credenciais do Telegram estão configuradas"""
        if not TELEGRAM_AVAILABLE:
            return False
        if not self.bot or not self.chat_id:
            return False
        try:
            # Tenta obter informações do bot
            me = await self.bot.get_me()
            if me:
                self.logger.info(f"Telegram autenticado como @{me.username}")
                return True
        except Exception as e:
            self.logger.error(f"Erro ao validar Telegram: {e}")
        return False
        
    def format_post(self, post: PostContent) -> str:
        """
        Formata o post para Telegram (suporta HTML/Markdown)
        Formato rico com emojis e formatação
        """
        # URL curta
        short_url = self.get_short_url(post)
        
        # Emoji de urgência
        urgency_text = {
            'HOJE': '🔥 <b>ACABA HOJE!</b>',
            'ULTIMAS_UNIDADES': '⚡ <b>ÚLTIMAS UNIDADES!</b>',
            'LIMITADO': '⏰ <b>OFERTA LIMITADA!</b>',
            'NORMAL': ''
        }.get(post.urgency, '')
        
        # Formata preço
        price_original = f"R$ {post.original_price:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.') if post.original_price else None
        price_final = f"R$ {post.price:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        
        # Monta a mensagem
        lines = []
        
        # Urgência
        if urgency_text:
            lines.append(urgency_text)
            lines.append("")
        
        # Título
        lines.append(f"<b>{post.title}</b>")
        lines.append("")
        
        # Preço
        if price_original and post.discount > 0:
            lines.append(f"💰 <s>{price_original}</s>")
            lines.append(f"✅ <b>{price_final}</b> ({post.discount}% OFF)")
        else:
            lines.append(f"💰 <b>{price_final}</b>")
        lines.append("")
        
        # Copy text (se houver)
        if post.copy_text:
            lines.append(post.copy_text[:500])
            lines.append("")
        
        # Info
        lines.append(f"🏷️ {post.niche} | 🛒 {post.store}")
        lines.append("")
        
        # Link
        lines.append(f'👉 <a href="{short_url}">VER OFERTA</a>')
        lines.append("")
        
        # Assinatura
        lines.append("━━━━━━━━━━━━━━━━━")
        lines.append("📲 @manupromocao")
        
        return "\n".join(lines)
        
    async def send(self, post: PostContent) -> DispatchResult:
        """Envia a mensagem para o Telegram"""
        if not self.bot or not self.chat_id:
            return DispatchResult(
                success=False,
                channel=self.channel_name,
                error_message="Cliente Telegram não configurado"
            )
            
        try:
            # Formata a mensagem
            message_text = self.format_post(post)
            
            self.logger.info(f"Enviando mensagem Telegram para post {post.id}")
            
            # Envia a mensagem
            message = await self.bot.send_message(
                chat_id=self.chat_id,
                text=message_text,
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=False
            )
            
            if message:
                self.logger.info(f"Mensagem Telegram enviada: {message.message_id}")
                return DispatchResult(
                    success=True,
                    channel=self.channel_name,
                    external_id=str(message.message_id)
                )
            else:
                return DispatchResult(
                    success=False,
                    channel=self.channel_name,
                    error_message="Resposta vazia do Telegram"
                )
                
        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"Erro ao enviar mensagem Telegram: {error_msg}")
            return DispatchResult(
                success=False,
                channel=self.channel_name,
                error_message=error_msg
            )


# Função helper para uso direto
async def send_to_telegram(post_data: dict, config: dict = None) -> DispatchResult:
    """
    Helper para enviar post para o Telegram
    
    Args:
        post_data: Dicionário com dados do post
        config: Configuração opcional (usa env vars se não fornecido)
        
    Returns:
        DispatchResult com o resultado do envio
    """
    config = config or {}
    dispatcher = TelegramDispatcher(config)
    
    post = PostContent(
        id=post_data['id'],
        title=post_data['title'],
        copy_text=post_data.get('copy_text', ''),
        price=post_data['price'],
        original_price=post_data.get('original_price'),
        discount=post_data.get('discount', 0),
        affiliate_url=post_data['affiliate_url'],
        niche=post_data.get('niche', ''),
        store=post_data.get('store', ''),
        urgency=post_data.get('urgency', 'NORMAL'),
        image_url=post_data.get('image_url')
    )
    
    return await dispatcher.send(post)
