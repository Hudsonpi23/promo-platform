"""
Configurações compartilhadas para os workers Python
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/promo_platform")

# API
API_URL = os.getenv("API_URL", "http://localhost:3001")

# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Lomadee (Programa de Afiliados)
LOMADEE_APP_TOKEN = os.getenv("LOMADEE_APP_TOKEN", "")
LOMADEE_SOURCE_ID = os.getenv("LOMADEE_SOURCE_ID", "")

# Configurações de coleta
MINIMUM_DISCOUNT = int(os.getenv("MINIMUM_DISCOUNT", "20"))  # Desconto mínimo para coletar
MAX_OFFERS_PER_RUN = int(os.getenv("MAX_OFFERS_PER_RUN", "50"))  # Máximo de ofertas por execução

# Horários das cargas
BATCH_TIMES = ["08:00", "11:00", "14:00", "18:00", "22:00"]

# Mapeamento de categorias Lomadee para nichos internos
CATEGORY_TO_NICHE = {
    "Celulares e Smartphones": "eletronicos",
    "Informática": "eletronicos",
    "TV e Vídeo": "eletronicos",
    "Eletrônicos": "eletronicos",
    "Eletrodomésticos": "casa",
    "Móveis": "casa",
    "Cama, Mesa e Banho": "casa",
    "Moda Feminina": "moda",
    "Moda Masculina": "moda",
    "Calçados": "moda",
    "Beleza e Perfumaria": "beleza",
    "Saúde": "beleza",
}

# Lojas conhecidas
KNOWN_STORES = {
    "magazineluiza": "magalu",
    "americanas": "americanas",
    "casasbahia": "casasbahia",
    "amazon": "amazon",
    "shopee": "shopee",
    "mercadolivre": "mercadolivre",
}
