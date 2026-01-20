# Dispatcher Workers - Canais de Divulgação
# Responsáveis por enviar posts para os diferentes canais

from .twitter import TwitterDispatcher
from .telegram import TelegramDispatcher
from .base import BaseDispatcher

__all__ = ['TwitterDispatcher', 'TelegramDispatcher', 'BaseDispatcher']
