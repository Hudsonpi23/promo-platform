"""
Base Dispatcher - Classe base para todos os dispatchers de canais
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class PostContent:
    """Conteúdo do post a ser enviado"""
    id: str
    title: str
    copy_text: str
    price: float
    original_price: Optional[float]
    discount: int
    affiliate_url: str
    niche: str
    store: str
    urgency: str
    image_url: Optional[str] = None
    

@dataclass
class DispatchResult:
    """Resultado do envio"""
    success: bool
    channel: str
    external_id: Optional[str] = None
    error_message: Optional[str] = None
    

class BaseDispatcher(ABC):
    """Classe base para dispatchers de canais"""
    
    channel_name: str = "BASE"
    
    def __init__(self, config: dict):
        self.config = config
        self.logger = logging.getLogger(f"dispatcher.{self.channel_name.lower()}")
        
    @abstractmethod
    async def send(self, post: PostContent) -> DispatchResult:
        """Envia o post para o canal. Deve ser implementado pelas subclasses."""
        pass
    
    @abstractmethod
    async def validate_config(self) -> bool:
        """Valida se a configuração do canal está correta"""
        pass
    
    def format_post(self, post: PostContent) -> str:
        """Formata o post para o canal específico. Pode ser sobrescrito."""
        return post.copy_text
    
    def get_short_url(self, post: PostContent) -> str:
        """Retorna a URL curta do post"""
        base_url = self.config.get('site_base_url', 'https://manupromocoes.com.br')
        return f"{base_url}/go/{post.id}"
