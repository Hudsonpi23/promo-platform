"""
IA Publicadora - Gera copy e cria PostDrafts

Responsabilidades:
- Gerar copy usando OpenAI/Claude
- Criar PostDraft para cada Offer
- Sugerir canais e carga
"""
import requests
import random
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
import sys

sys.path.append('..')
from config import API_URL, OPENAI_API_KEY, BATCH_TIMES

# Tentar importar OpenAI
try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False
    logger.warning("OpenAI não instalado, usando gerador de fallback")


class CopyGenerator:
    """Gerador de copy para posts"""
    
    def __init__(self):
        if HAS_OPENAI and OPENAI_API_KEY:
            self.client = OpenAI(api_key=OPENAI_API_KEY)
            self.use_ai = True
        else:
            self.client = None
            self.use_ai = False
            
    def generate_with_ai(self, offer: Dict) -> str:
        """Gera copy usando OpenAI"""
        if not self.use_ai:
            return self.generate_fallback(offer)
            
        try:
            prompt = f"""Crie um texto curto e persuasivo para divulgar esta oferta em redes sociais.

Produto: {offer['title']}
Preço original: R$ {offer['originalPrice']:.2f}
Preço com desconto: R$ {offer['finalPrice']:.2f}
Desconto: {offer['discount']}%
Loja: {offer.get('store', {}).get('name', 'Loja')}

Requisitos:
- Máximo 3 linhas
- Use emojis com moderação
- Crie urgência
- NÃO inclua links (serão adicionados automaticamente)
- NÃO use hashtags
- Seja direto e objetivo

Exemplo de formato:
Oferta imperdível! [produto] com [X]% de desconto.
Aproveite antes que acabe!"""

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "Você é um copywriter especializado em e-commerce brasileiro. Escreva textos curtos e persuasivos."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,
                temperature=0.7,
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Erro ao gerar copy com IA: {e}")
            return self.generate_fallback(offer)
    
    def generate_fallback(self, offer: Dict) -> str:
        """Gera copy usando templates (fallback)"""
        templates = [
            "🔥 OFERTA IMPERDÍVEL!\n\n{title}\n\nDe R$ {original} por apenas R$ {final}!\n\n⚡ {discount}% de desconto - Corre que é por tempo limitado!",
            "💰 PREÇO BAIXOU!\n\n{title}\n\nAntes: R$ {original}\nAgora: R$ {final}\n\n🏷️ Economize {discount}%!",
            "⚡ PROMOÇÃO RELÂMPAGO!\n\n{title}\n\nR$ {final} ({discount}% OFF)\n\n🛒 Aproveite enquanto dura!",
            "🎯 ACHADO DO DIA!\n\n{title}\n\nPreço especial: R$ {final}\nDesconto de {discount}%\n\n✅ Oferta verificada!",
            "🛍️ OPORTUNIDADE!\n\n{title}\n\nDe R$ {original} → R$ {final}\n\n💸 Você economiza {discount}%!",
        ]
        
        template = random.choice(templates)
        
        return template.format(
            title=offer['title'],
            original=f"{offer['originalPrice']:.2f}",
            final=f"{offer['finalPrice']:.2f}",
            discount=offer['discount'],
        )
    
    def generate(self, offer: Dict) -> str:
        """Gera copy para uma oferta"""
        if self.use_ai:
            return self.generate_with_ai(offer)
        return self.generate_fallback(offer)


class ChannelRecommender:
    """Recomenda canais baseado no tipo de oferta"""
    
    def recommend(self, offer: Dict) -> List[str]:
        """Recomenda canais para uma oferta"""
        channels = ["SITE"]  # Sempre publicar no site
        
        discount = offer.get("discount", 0)
        niche = offer.get("niche", {}).get("slug", "")
        
        # Ofertas com alto desconto vão para todos os canais
        if discount >= 40:
            channels.extend(["TELEGRAM", "WHATSAPP", "FACEBOOK"])
            return channels
            
        # Eletrônicos performam bem no Telegram
        if niche == "eletronicos":
            channels.append("TELEGRAM")
            
        # Moda e beleza performam bem no Facebook
        if niche in ["moda", "beleza"]:
            channels.append("FACEBOOK")
            
        # Desconto médio vai para Telegram
        if discount >= 30:
            if "TELEGRAM" not in channels:
                channels.append("TELEGRAM")
                
        return channels


class BatchSelector:
    """Seleciona carga apropriada para o post"""
    
    def __init__(self, api_url: str = API_URL):
        self.api_url = api_url
        
    def get_next_batch(self) -> Optional[str]:
        """Obtém ou cria a próxima carga disponível"""
        try:
            # Buscar cargas do dia
            response = requests.get(f"{self.api_url}/api/batches")
            batches = response.json()
            
            if not batches:
                # Criar cargas do dia
                return self.create_today_batches()
            
            # Encontrar carga com menos posts pendentes
            now = datetime.now()
            current_time = now.strftime("%H:%M")
            
            # Filtrar cargas futuras
            future_batches = [
                b for b in batches 
                if b["scheduledTime"] > current_time
            ]
            
            if not future_batches:
                # Se não há cargas futuras hoje, pegar a primeira do dia
                future_batches = batches
                
            # Ordenar por quantidade de pendentes (menor primeiro)
            future_batches.sort(key=lambda x: x.get("pendingCount", 0))
            
            return future_batches[0]["id"] if future_batches else None
            
        except Exception as e:
            logger.error(f"Erro ao buscar batch: {e}")
            return None
    
    def create_today_batches(self) -> Optional[str]:
        """Cria cargas para hoje"""
        try:
            first_batch_id = None
            
            for time in BATCH_TIMES:
                response = requests.post(
                    f"{self.api_url}/api/batches",
                    json={"scheduledTime": time}
                )
                
                if response.status_code == 200 and not first_batch_id:
                    first_batch_id = response.json().get("id")
                    
            return first_batch_id
            
        except Exception as e:
            logger.error(f"Erro ao criar batches: {e}")
            return None


class DraftCreator:
    """Cria PostDrafts a partir de ofertas"""
    
    def __init__(self, api_url: str = API_URL):
        self.api_url = api_url
        self.copy_generator = CopyGenerator()
        self.channel_recommender = ChannelRecommender()
        self.batch_selector = BatchSelector(api_url)
        
    def create_draft(self, offer: Dict) -> Optional[str]:
        """Cria um PostDraft para uma oferta"""
        try:
            # Gerar copy
            copy_text = self.copy_generator.generate(offer)
            
            # Recomendar canais
            channels = self.channel_recommender.recommend(offer)
            
            # Selecionar batch
            batch_id = self.batch_selector.get_next_batch()
            if not batch_id:
                logger.error("Não foi possível obter batch")
                return None
            
            # Criar draft via API
            response = requests.post(
                f"{self.api_url}/api/offers/{offer['id']}/create-draft",
                json={
                    "copyText": copy_text,
                    "batchId": batch_id,
                    "channels": channels,
                    "priority": self._determine_priority(offer),
                }
            )
            
            if response.status_code == 200:
                draft = response.json()
                logger.info(f"✅ Draft criado: {offer['title'][:50]}... → {channels}")
                return draft.get("id")
            else:
                logger.error(f"Erro ao criar draft: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Erro ao criar draft: {e}")
            return None
    
    def _determine_priority(self, offer: Dict) -> str:
        """Determina prioridade do post"""
        discount = offer.get("discount", 0)
        
        if discount >= 50:
            return "HIGH"
        if discount >= 30:
            return "NORMAL"
        return "LOW"


def get_offers_without_drafts() -> List[Dict]:
    """Busca ofertas que ainda não têm drafts"""
    try:
        response = requests.get(
            f"{API_URL}/api/offers",
            params={"active": "true", "limit": 50}
        )
        offers = response.json()
        
        # Filtrar ofertas sem drafts
        return [o for o in offers if o.get("_count", {}).get("drafts", 0) == 0]
        
    except Exception as e:
        logger.error(f"Erro ao buscar ofertas: {e}")
        return []


def run_publisher():
    """Executa o publicador de ofertas"""
    logger.info("=== Iniciando IA Publicadora ===")
    
    creator = DraftCreator()
    
    # Buscar ofertas sem drafts
    offers = get_offers_without_drafts()
    logger.info(f"Encontradas {len(offers)} ofertas sem drafts")
    
    # Criar drafts
    created = 0
    for offer in offers:
        if creator.create_draft(offer):
            created += 1
    
    logger.info(f"=== Publicação finalizada: {created} drafts criados ===")
    return created


if __name__ == "__main__":
    logger.add("publisher.log", rotation="1 day", retention="7 days")
    run_publisher()
