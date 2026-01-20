"""
Twitter/X Dispatcher - Envia posts para o Twitter/X
Usa a API oficial do Twitter (X) v2

Requisitos:
- pip install tweepy
- Credenciais da API do Twitter (Bearer Token, API Key, API Secret, Access Token, Access Secret)
"""

import os
import logging
from typing import Optional
from .base import BaseDispatcher, PostContent, DispatchResult

logger = logging.getLogger(__name__)

# Tenta importar tweepy (biblioteca do Twitter)
try:
    import tweepy
    TWEEPY_AVAILABLE = True
except ImportError:
    TWEEPY_AVAILABLE = False
    logger.warning("tweepy não instalado. Execute: pip install tweepy")


class TwitterDispatcher(BaseDispatcher):
    """Dispatcher para Twitter/X usando API v2"""
    
    channel_name = "TWITTER"
    MAX_TWEET_LENGTH = 280
    
    def __init__(self, config: dict):
        super().__init__(config)
        self.client: Optional['tweepy.Client'] = None
        self._setup_client()
        
    def _setup_client(self):
        """Configura o cliente do Twitter"""
        if not TWEEPY_AVAILABLE:
            self.logger.error("tweepy não disponível")
            return
            
        # Credenciais do ambiente ou config
        bearer_token = self.config.get('twitter_bearer_token') or os.getenv('TWITTER_BEARER_TOKEN')
        api_key = self.config.get('twitter_api_key') or os.getenv('TWITTER_API_KEY')
        api_secret = self.config.get('twitter_api_secret') or os.getenv('TWITTER_API_SECRET')
        access_token = self.config.get('twitter_access_token') or os.getenv('TWITTER_ACCESS_TOKEN')
        access_secret = self.config.get('twitter_access_secret') or os.getenv('TWITTER_ACCESS_SECRET')
        
        if not all([api_key, api_secret, access_token, access_secret]):
            self.logger.warning("Credenciais do Twitter incompletas")
            return
            
        try:
            self.client = tweepy.Client(
                bearer_token=bearer_token,
                consumer_key=api_key,
                consumer_secret=api_secret,
                access_token=access_token,
                access_token_secret=access_secret,
                wait_on_rate_limit=True
            )
            self.logger.info("Cliente Twitter configurado com sucesso")
        except Exception as e:
            self.logger.error(f"Erro ao configurar cliente Twitter: {e}")
            
    async def validate_config(self) -> bool:
        """Valida se as credenciais do Twitter estão configuradas"""
        if not TWEEPY_AVAILABLE:
            return False
        if not self.client:
            return False
        try:
            # Tenta obter informações do usuário autenticado
            me = self.client.get_me()
            if me and me.data:
                self.logger.info(f"Twitter autenticado como @{me.data.username}")
                return True
        except Exception as e:
            self.logger.error(f"Erro ao validar Twitter: {e}")
        return False
        
    def format_post(self, post: PostContent) -> str:
        """
        Formata o post para Twitter (máx 280 caracteres)
        Formato:
        🔥 TÍTULO
        
        💰 De R$ X por R$ Y (-Z%)
        
        🛒 LOJA | 🏷️ NICHO
        
        👉 LINK
        
        #promoção #desconto #oferta
        """
        # URL curta
        short_url = self.get_short_url(post)
        
        # Emoji de urgência
        urgency_emoji = {
            'HOJE': '⚡',
            'ULTIMAS_UNIDADES': '🔥',
            'LIMITADO': '⏰',
            'NORMAL': '💰'
        }.get(post.urgency, '💰')
        
        # Formata preço
        price_original = f"R$ {post.original_price:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.') if post.original_price else None
        price_final = f"R$ {post.price:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        
        # Monta o tweet
        lines = []
        
        # Título (truncado se necessário)
        title = post.title[:60] + "..." if len(post.title) > 60 else post.title
        lines.append(f"{urgency_emoji} {title}")
        lines.append("")
        
        # Preço
        if price_original and post.discount > 0:
            lines.append(f"💰 De {price_original} por {price_final} (-{post.discount}%)")
        else:
            lines.append(f"💰 {price_final}")
        lines.append("")
        
        # Loja e nicho
        lines.append(f"🛒 {post.store}")
        lines.append("")
        
        # Link
        lines.append(f"👉 {short_url}")
        lines.append("")
        
        # Hashtags (ajustar baseado no espaço disponível)
        hashtags = "#promoção #desconto #oferta"
        
        tweet = "\n".join(lines) + hashtags
        
        # Truncar se necessário (garantir que cabe em 280)
        if len(tweet) > self.MAX_TWEET_LENGTH:
            # Remove hashtags se necessário
            tweet = "\n".join(lines[:-1])
            if len(tweet) > self.MAX_TWEET_LENGTH:
                # Trunca o título mais ainda
                remaining = self.MAX_TWEET_LENGTH - len(tweet) + len(lines[0])
                lines[0] = f"{urgency_emoji} {post.title[:remaining-10]}..."
                tweet = "\n".join(lines[:-1])
                
        return tweet[:self.MAX_TWEET_LENGTH]
        
    async def send(self, post: PostContent) -> DispatchResult:
        """Envia o tweet"""
        if not self.client:
            return DispatchResult(
                success=False,
                channel=self.channel_name,
                error_message="Cliente Twitter não configurado"
            )
            
        try:
            # Formata o tweet
            tweet_text = self.format_post(post)
            
            self.logger.info(f"Enviando tweet para post {post.id}")
            self.logger.debug(f"Tweet: {tweet_text}")
            
            # Envia o tweet
            response = self.client.create_tweet(text=tweet_text)
            
            if response and response.data:
                tweet_id = response.data['id']
                self.logger.info(f"Tweet enviado com sucesso: {tweet_id}")
                return DispatchResult(
                    success=True,
                    channel=self.channel_name,
                    external_id=str(tweet_id)
                )
            else:
                return DispatchResult(
                    success=False,
                    channel=self.channel_name,
                    error_message="Resposta vazia do Twitter"
                )
                
        except tweepy.TweepyException as e:
            error_msg = str(e)
            self.logger.error(f"Erro ao enviar tweet: {error_msg}")
            return DispatchResult(
                success=False,
                channel=self.channel_name,
                error_message=error_msg
            )
        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"Erro inesperado ao enviar tweet: {error_msg}")
            return DispatchResult(
                success=False,
                channel=self.channel_name,
                error_message=error_msg
            )


# Função helper para uso direto
async def send_to_twitter(post_data: dict, config: dict = None) -> DispatchResult:
    """
    Helper para enviar post para o Twitter
    
    Args:
        post_data: Dicionário com dados do post
        config: Configuração opcional (usa env vars se não fornecido)
        
    Returns:
        DispatchResult com o resultado do envio
    """
    config = config or {}
    dispatcher = TwitterDispatcher(config)
    
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
