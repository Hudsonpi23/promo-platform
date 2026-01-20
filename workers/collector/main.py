"""
IA Coletora - Busca ofertas de programas de afiliados

Responsabilidades:
- Integrar com Lomadee API
- Buscar ofertas com desconto > 20%
- Salvar no banco como Offer
"""
import requests
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
import sys

# Adicionar path do parent para imports
sys.path.append('..')
from config import (
    API_URL,
    LOMADEE_APP_TOKEN,
    LOMADEE_SOURCE_ID,
    MINIMUM_DISCOUNT,
    MAX_OFFERS_PER_RUN,
    CATEGORY_TO_NICHE,
)


class LomadeeCollector:
    """Coletor de ofertas da Lomadee API"""
    
    BASE_URL = "https://api.lomadee.com/v3"
    
    def __init__(self):
        self.app_token = LOMADEE_APP_TOKEN
        self.source_id = LOMADEE_SOURCE_ID
        
    def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Optional[Dict]:
        """Faz requisição para a API Lomadee"""
        if not self.app_token:
            logger.warning("LOMADEE_APP_TOKEN não configurado")
            return None
            
        url = f"{self.BASE_URL}/{self.app_token}/{endpoint}"
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Erro na requisição Lomadee: {e}")
            return None
    
    def get_offers(self, category: str = None, keyword: str = None) -> List[Dict]:
        """Busca ofertas na Lomadee"""
        params = {
            "sourceId": self.source_id,
            "size": MAX_OFFERS_PER_RUN,
        }
        
        if category:
            params["categoryId"] = category
        if keyword:
            params["keyword"] = keyword
            
        data = self._make_request("offer/_search", params)
        
        if not data or "offers" not in data:
            return []
            
        return data["offers"]
    
    def get_coupons(self) -> List[Dict]:
        """Busca cupons de desconto"""
        data = self._make_request("coupon/_all")
        
        if not data or "coupons" not in data:
            return []
            
        return data["coupons"]
    
    def filter_by_discount(self, offers: List[Dict], min_discount: int = MINIMUM_DISCOUNT) -> List[Dict]:
        """Filtra ofertas com desconto mínimo"""
        filtered = []
        
        for offer in offers:
            try:
                price = float(offer.get("price", 0))
                price_from = float(offer.get("priceFrom", price))
                
                if price_from > 0 and price < price_from:
                    discount = int(((price_from - price) / price_from) * 100)
                    if discount >= min_discount:
                        offer["calculated_discount"] = discount
                        filtered.append(offer)
            except (ValueError, TypeError):
                continue
                
        return filtered
    
    def map_to_internal_format(self, offer: Dict) -> Dict:
        """Converte oferta Lomadee para formato interno"""
        # Determinar nicho
        category = offer.get("category", {}).get("name", "")
        niche_slug = CATEGORY_TO_NICHE.get(category, "outros")
        
        # Determinar loja
        store_name = offer.get("store", {}).get("name", "Loja")
        store_slug = store_name.lower().replace(" ", "")
        
        return {
            "title": offer.get("name", ""),
            "description": offer.get("description", ""),
            "originalPrice": float(offer.get("priceFrom", 0)),
            "finalPrice": float(offer.get("price", 0)),
            "affiliateUrl": offer.get("link", ""),
            "imageUrl": offer.get("thumbnail", ""),
            "nicheSlug": niche_slug,
            "storeSlug": store_slug,
            "storeName": store_name,
            "externalId": offer.get("id", ""),
            "discount": offer.get("calculated_discount", 0),
        }


class ManualCollector:
    """Coletor manual para quando APIs não estão disponíveis"""
    
    def __init__(self):
        pass
    
    def collect_from_csv(self, filepath: str) -> List[Dict]:
        """Coleta ofertas de arquivo CSV"""
        # TODO: Implementar leitura de CSV
        return []
    
    def collect_from_json(self, filepath: str) -> List[Dict]:
        """Coleta ofertas de arquivo JSON"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception as e:
            logger.error(f"Erro ao ler JSON: {e}")
            return []


class OfferSaver:
    """Salva ofertas no banco via API"""
    
    def __init__(self, api_url: str = API_URL):
        self.api_url = api_url
        
    def get_or_create_niche(self, slug: str, name: str = None) -> Optional[str]:
        """Obtém ou cria nicho"""
        try:
            # Tentar buscar existente
            response = requests.get(f"{self.api_url}/api/offers/niches")
            niches = response.json()
            
            for niche in niches:
                if niche["slug"] == slug:
                    return niche["id"]
            
            # Criar novo
            response = requests.post(
                f"{self.api_url}/api/offers/niches",
                json={"name": name or slug.title(), "slug": slug}
            )
            return response.json().get("id")
        except Exception as e:
            logger.error(f"Erro ao obter/criar nicho: {e}")
            return None
    
    def get_or_create_store(self, slug: str, name: str) -> Optional[str]:
        """Obtém ou cria loja"""
        try:
            # Tentar buscar existente
            response = requests.get(f"{self.api_url}/api/offers/stores")
            stores = response.json()
            
            for store in stores:
                if store["slug"] == slug:
                    return store["id"]
            
            # Criar novo
            response = requests.post(
                f"{self.api_url}/api/offers/stores",
                json={"name": name, "slug": slug}
            )
            return response.json().get("id")
        except Exception as e:
            logger.error(f"Erro ao obter/criar loja: {e}")
            return None
    
    def save_offer(self, offer: Dict) -> Optional[str]:
        """Salva oferta no banco"""
        try:
            # Obter IDs de nicho e loja
            niche_id = self.get_or_create_niche(offer["nicheSlug"])
            store_id = self.get_or_create_store(offer["storeSlug"], offer["storeName"])
            
            if not niche_id or not store_id:
                logger.error("Não foi possível obter nicho ou loja")
                return None
            
            # Criar oferta
            response = requests.post(
                f"{self.api_url}/api/offers",
                json={
                    "title": offer["title"],
                    "description": offer.get("description", ""),
                    "originalPrice": offer["originalPrice"],
                    "finalPrice": offer["finalPrice"],
                    "affiliateUrl": offer["affiliateUrl"],
                    "imageUrl": offer.get("imageUrl", ""),
                    "nicheId": niche_id,
                    "storeId": store_id,
                    "urgency": "NORMAL",
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Oferta salva: {offer['title'][:50]}...")
                return data.get("id")
            else:
                logger.error(f"Erro ao salvar oferta: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Erro ao salvar oferta: {e}")
            return None


def run_collector():
    """Executa o coletor de ofertas"""
    logger.info("=== Iniciando IA Coletora ===")
    
    # Inicializar componentes
    lomadee = LomadeeCollector()
    saver = OfferSaver()
    
    # Buscar ofertas
    logger.info("Buscando ofertas na Lomadee...")
    offers = lomadee.get_offers()
    logger.info(f"Encontradas {len(offers)} ofertas")
    
    # Filtrar por desconto
    filtered = lomadee.filter_by_discount(offers)
    logger.info(f"Após filtro de desconto >= {MINIMUM_DISCOUNT}%: {len(filtered)} ofertas")
    
    # Salvar ofertas
    saved = 0
    for offer in filtered[:MAX_OFFERS_PER_RUN]:
        mapped = lomadee.map_to_internal_format(offer)
        if saver.save_offer(mapped):
            saved += 1
    
    logger.info(f"=== Coleta finalizada: {saved} ofertas salvas ===")
    return saved


if __name__ == "__main__":
    # Configurar logging
    logger.add("collector.log", rotation="1 day", retention="7 days")
    
    # Executar
    run_collector()
