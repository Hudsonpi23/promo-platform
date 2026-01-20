"""
Orquestrador Principal dos Workers Python

Executa os workers de coleta, validação e publicação
em sequência ou de forma agendada.
"""
import schedule
import time
from datetime import datetime
from loguru import logger

from collector.main import run_collector
from validator.main import run_validator
from publisher.main import run_publisher


def run_pipeline():
    """Executa o pipeline completo: coleta → validação → publicação"""
    logger.info("=" * 60)
    logger.info(f"🚀 Iniciando pipeline - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)
    
    try:
        # 1. Coletar ofertas
        logger.info("\n📥 ETAPA 1: Coleta de ofertas")
        collected = run_collector()
        
        # 2. Validar ofertas
        logger.info("\n✅ ETAPA 2: Validação de ofertas")
        validated = run_validator()
        
        # 3. Criar drafts (posts)
        logger.info("\n📝 ETAPA 3: Criação de drafts")
        published = run_publisher()
        
        logger.info("\n" + "=" * 60)
        logger.info("📊 RESUMO DO PIPELINE:")
        logger.info(f"   - Ofertas coletadas: {collected}")
        logger.info(f"   - Ofertas validadas: {validated}")
        logger.info(f"   - Drafts criados: {published}")
        logger.info("=" * 60)
        
        return {
            "collected": collected,
            "validated": validated,
            "published": published,
        }
        
    except Exception as e:
        logger.error(f"❌ Erro no pipeline: {e}")
        return None


def run_collector_only():
    """Executa apenas o coletor"""
    logger.info("📥 Executando apenas coleta...")
    return run_collector()


def run_publisher_only():
    """Executa apenas o publicador (para ofertas já existentes)"""
    logger.info("📝 Executando apenas publicação...")
    return run_publisher()


def setup_scheduler():
    """Configura agendamento dos workers"""
    
    # Pipeline completo: 4x ao dia (antes das cargas principais)
    schedule.every().day.at("07:00").do(run_pipeline)
    schedule.every().day.at("10:00").do(run_pipeline)
    schedule.every().day.at("13:00").do(run_pipeline)
    schedule.every().day.at("17:00").do(run_pipeline)
    
    # Publicador adicional: 1h antes de cada carga
    schedule.every().day.at("07:30").do(run_publisher_only)
    schedule.every().day.at("10:30").do(run_publisher_only)
    schedule.every().day.at("13:30").do(run_publisher_only)
    schedule.every().day.at("17:30").do(run_publisher_only)
    schedule.every().day.at("21:30").do(run_publisher_only)
    
    logger.info("📅 Scheduler configurado:")
    logger.info("   Pipeline completo: 07:00, 10:00, 13:00, 17:00")
    logger.info("   Publicador: 07:30, 10:30, 13:30, 17:30, 21:30")


def run_scheduler():
    """Executa o scheduler em loop"""
    setup_scheduler()
    
    logger.info("🔄 Scheduler iniciado. Pressione Ctrl+C para parar.")
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # Verificar a cada minuto


if __name__ == "__main__":
    import sys
    
    # Configurar logging
    logger.remove()
    logger.add(sys.stdout, level="INFO", format="<green>{time:HH:mm:ss}</green> | <level>{message}</level>")
    logger.add("workers.log", rotation="1 day", retention="7 days", level="DEBUG")
    
    # Verificar argumentos
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "pipeline":
            run_pipeline()
        elif command == "collect":
            run_collector_only()
        elif command == "validate":
            run_validator()
        elif command == "publish":
            run_publisher_only()
        elif command == "scheduler":
            run_scheduler()
        else:
            print(f"Comando desconhecido: {command}")
            print("Comandos disponíveis: pipeline, collect, validate, publish, scheduler")
    else:
        # Executar pipeline por padrão
        run_pipeline()
