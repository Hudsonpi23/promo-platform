"""
IA Validadora - Verifica e classifica ofertas

Responsabilidades:
- Verificar se desconto é real
- Classificar por nicho
- Remover duplicatas
- Validar links
"""
import requests
import re
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from loguru import logger
import sys

sys.path.append('..')
from config import API_URL, MINIMUM_DISCOUNT, CATEGORY_TO_NICHE


class OfferValidator:
    """Validador de ofertas"""
    
    def __init__(self, api_url: str = API_URL):
        self.api_url = api_url
        
    def validate_discount(self, original_price: float, final_price: float) -> Tuple[bool, int]:
        """
        Valida se o desconto é real e significativo
        
        Returns:
            Tuple[bool, int]: (é_válido, percentual_desconto)
        """
        if original_price <= 0 or final_price <= 0:
            return False, 0
            
        if final_price >= original_price:
            return False, 0
            
        discount = int(((original_price - final_price) / original_price) * 100)
        
        # Desconto muito alto pode ser erro ou fraude
        if discount > 90:
            logger.warning(f"Desconto suspeito: {discount}%")
            return False, discount
            
        return discount >= MINIMUM_DISCOUNT, discount
    
    def validate_url(self, url: str) -> bool:
        """Valida se URL está acessível"""
        if not url or not url.startswith("http"):
            return False
            
        try:
            response = requests.head(url, timeout=10, allow_redirects=True)
            return response.status_code < 400
        except:
            return False
    
    def validate_title(self, title: str) -> bool:
        """Valida título da oferta"""
        if not title or len(title) < 10:
            return False
            
        # Verificar se não é spam
        spam_keywords = ["clique aqui", "compre já", "oferta imperdível", "xxx"]
        title_lower = title.lower()
        
        for keyword in spam_keywords:
            if keyword in title_lower:
                return False
                
        return True
    
    def detect_niche(self, title: str, description: str = "") -> str:
        """Detecta nicho baseado no título e descrição"""
        text = f"{title} {description}".lower()
        
        # Keywords por nicho
        niche_keywords = {
            "eletronicos": ["smartphone", "celular", "iphone", "samsung", "tv", "notebook", 
                          "laptop", "fone", "headphone", "tablet", "console", "playstation", 
                          "xbox", "câmera", "drone"],
            "moda": ["vestido", "calça", "camisa", "tênis", "sapato", "bolsa", "roupa",
                    "blusa", "saia", "jaqueta", "casaco", "moda"],
            "casa": ["sofá", "cama", "mesa", "cadeira", "geladeira", "fogão", "microondas",
                    "máquina de lavar", "aspirador", "panela", "colchão"],
            "beleza": ["perfume", "maquiagem", "creme", "shampoo", "condicionador",
                      "hidratante", "batom", "base", "rímel", "skincare"],
        }
        
        for niche, keywords in niche_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    return niche
                    
        return "outros"
    
    def check_duplicate(self, title: str, affiliate_url: str) -> bool:
        """Verifica se oferta já existe"""
        try:
            # Buscar ofertas existentes
            response = requests.get(
                f"{self.api_url}/api/offers",
                params={"limit": 100, "active": "true"}
            )
            offers = response.json()
            
            for offer in offers:
                # Verificar por URL
                if offer.get("affiliateUrl") == affiliate_url:
                    return True
                    
                # Verificar por título similar (simplificado)
                existing_title = offer.get("title", "").lower()
                if title.lower() == existing_title:
                    return True
                    
            return False
        except Exception as e:
            logger.error(f"Erro ao verificar duplicata: {e}")
            return False
    
    def determine_urgency(self, offer: Dict) -> str:
        """Determina urgência da oferta"""
        # Por desconto
        discount = offer.get("discount", 0)
        if discount >= 50:
            return "HOJE"
        if discount >= 40:
            return "ULTIMAS_UNIDADES"
        if discount >= 30:
            return "LIMITADO"
            
        # Por data de expiração
        expires_at = offer.get("expiresAt")
        if expires_at:
            try:
                expires = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                now = datetime.now(expires.tzinfo)
                
                if expires - now < timedelta(hours=24):
                    return "HOJE"
                if expires - now < timedelta(days=3):
                    return "LIMITADO"
            except:
                pass
                
        return "NORMAL"


class OfferProcessor:
    """Processa e valida ofertas em lote"""
    
    def __init__(self):
        self.validator = OfferValidator()
        
    def process_offers(self, offers: List[Dict]) -> List[Dict]:
        """Processa lista de ofertas, retornando apenas válidas"""
        valid_offers = []
        
        for offer in offers:
            result = self.validate_offer(offer)
            if result:
                valid_offers.append(result)
                
        return valid_offers
    
    def validate_offer(self, offer: Dict) -> Optional[Dict]:
        """Valida uma oferta individual"""
        title = offer.get("title", "")
        original_price = float(offer.get("originalPrice", 0))
        final_price = float(offer.get("finalPrice", 0))
        affiliate_url = offer.get("affiliateUrl", "")
        
        # Validar título
        if not self.validator.validate_title(title):
            logger.debug(f"Título inválido: {title[:50]}")
            return None
            
        # Validar desconto
        is_valid_discount, discount = self.validator.validate_discount(original_price, final_price)
        if not is_valid_discount:
            logger.debug(f"Desconto inválido: {discount}%")
            return None
            
        # Verificar duplicata
        if self.validator.check_duplicate(title, affiliate_url):
            logger.debug(f"Oferta duplicada: {title[:50]}")
            return None
            
        # Detectar nicho se não informado
        if not offer.get("nicheSlug"):
            offer["nicheSlug"] = self.validator.detect_niche(
                title, 
                offer.get("description", "")
            )
            
        # Determinar urgência
        offer["urgency"] = self.validator.determine_urgency(offer)
        
        # Atualizar desconto calculado
        offer["discount"] = discount
        
        logger.info(f"✅ Oferta válida: {title[:50]}... ({discount}% OFF)")
        return offer


def get_pending_offers() -> List[Dict]:
    """Busca ofertas pendentes de validação"""
    try:
        response = requests.get(
            f"{API_URL}/api/offers",
            params={"active": "true", "limit": 50}
        )
        return response.json()
    except Exception as e:
        logger.error(f"Erro ao buscar ofertas: {e}")
        return []


def update_offer(offer_id: str, data: Dict) -> bool:
    """Atualiza oferta no banco"""
    try:
        response = requests.patch(
            f"{API_URL}/api/offers/{offer_id}",
            json=data
        )
        return response.status_code == 200
    except Exception as e:
        logger.error(f"Erro ao atualizar oferta: {e}")
        return False


def run_validator():
    """Executa o validador de ofertas"""
    logger.info("=== Iniciando IA Validadora ===")
    
    processor = OfferProcessor()
    
    # Buscar ofertas
    offers = get_pending_offers()
    logger.info(f"Encontradas {len(offers)} ofertas para validar")
    
    # Processar
    validated = 0
    for offer in offers:
        result = processor.validate_offer(offer)
        if result:
            # Atualizar urgência se mudou
            if result.get("urgency") != offer.get("urgency"):
                update_offer(offer["id"], {"urgency": result["urgency"]})
            validated += 1
    
    logger.info(f"=== Validação finalizada: {validated}/{len(offers)} ofertas válidas ===")
    return validated


if __name__ == "__main__":
    logger.add("validator.log", rotation="1 day", retention="7 days")
    run_validator()
