/**
 * AI Copy Generator Service
 * 
 * Gera textos de marketing para ofertas usando regras determinísticas
 * com fallback para IA externa (OpenAI) quando disponível.
 * 
 * ESTILO:
 * - Tom engraçado, focado em jovens 16-25 anos
 * - Referências à cultura jovem (ex: Malbec = perfume de quem trai)
 * - Frases pequenas e chamativas
 * - SEMPRE destacar desconto quando houver
 * - TODAS as frases em MAIÚSCULAS
 * 
 * A IA:
 * - NÃO acessa Awin
 * - NÃO acessa Mercado Livre
 * - NÃO vê tokens
 * - NÃO decide quais ofertas buscar
 * 
 * A IA RECEBE um JSON limpo e DEVOLVE copies formatados.
 */

// ==================== TYPES ====================

export interface CopyInputData {
  title: string;
  price: number;
  oldPrice?: number | null;
  discountPct: number;
  advertiserName?: string | null;
  storeName?: string | null;
  category?: string | null;
  trackingUrl: string;
  /** Link do produto no site vitrine — adicionado separado do link de afiliado */
  siteUrl?: string | null;
}

export interface GeneratedCopies {
  telegram: string;
  site: string;
  x: string;
  variations?: {
    telegram: string[];
    site: string[];
    x: string[];
  };
}

export interface CopyGeneratorOptions {
  generateVariations?: boolean;   // Gerar 2-3 variações por canal
  useAI?: boolean;                // Usar IA externa (se disponível)
  style?: 'casual' | 'urgente' | 'informativo';
}

// ==================== CONSTANTS ====================

const CHAR_LIMITS = {
  TELEGRAM: 1024, // Limite real do Telegram para caption é 1024 caracteres
  SITE: 600,
  X: 280, // Limite do Twitter/X é 280 caracteres
};

// Templates engraçados para jovens 16-25 anos - TUDO EM MAIÚSCULAS + EMOJIS
const OPENINGS_ENGRAÇADOS = [
  'ACHADO NÃO É ROUBADO',
  'OLHA SÓ ESSE PREÇO 👀',
  'ISSO AQUI É DE GRAÇA',
  'TÁ DE BRINCADEIRA',
  'NÃO É POSSÍVEL',
  'CORRE QUE TÁ BARATO',
  'ISSO É ROUBO (MAS DO BOM)',
  'TÁ MUITO BARATO',
  'OLHA ESSA PROMOÇÃO',
  'ISSO É ACHADO',
];

// Aberturas por categoria com humor jovem + EMOJIS
const OPENINGS_BY_CATEGORY: Record<string, string[]> = {
  'eletronicos': [
    'QUEM TAVA QUERENDO, OLHA ISSO 👀',
    'ESSE DESCONTO É RARO',
    'APARECEU COM PREÇO BOM',
    'TÁ BARATO DEMAIS',
  ],
  'moda': [
    'TÁ VALENDO MUITO',
    'COM DESCONTO ASSIM É ACHADO',
    'BAIXOU PRA VALER',
    'ESSE PREÇO É DE GRAÇA',
  ],
  'casa': [
    'PRA CASA COM DESCONTO BOM',
    'ACHADO PRA QUEM PRECISA',
    'ESSE VALOR É RARO',
    'TÁ MUITO BARATO',
  ],
  'games': [
    'CONSOLE/JOGO COM ESSE DESCONTO É RARO',
    'QUEM TAVA ESPERANDO, CHEGOU A HORA',
    'TÁ JUNTANDO? PODE COMPRAR',
    'ESSE PREÇO É DE GRAÇA',
  ],
  'perfumes': [
    'ESSE TE DEIXA CHEIROSO',
    'PERFUME BOM E BARATO',
    'CHEIRO DE RICO POR PREÇO DE POBRE',
    'TÁ VALENDO MUITO',
  ],
};

// Frases engraçadas específicas por produto (cultura jovem - HUMOR SARCÁSTICO)
// Cada produto tem frases personalizadas e engraçadas
const PRODUCT_SPECIFIC_PHRASES: Record<string, string[]> = {
  // TVs
  'tv': [
    'ESSA TV É TÃO GRANDE QUE DÁ PRA VER ATÉ O ATOR PISCANDO ERRADO 👀',
    'IDEAL PRA ASSISTIR FILME E FINGIR QUE TÁ NO CINEMA (SEM PAGAR INGRESSO) 🎬',
    'IMAGEM TÃO BOA QUE DÁ PRA VER A FOFOCA EM 4K 🔥',
    'ESSA AQUI É PRA QUEM NÃO AGUENTA MAIS TV DO TAMANHO DE TABLET 😤',
    'DÁ PRA VER O JOGO E CONFIRMAR QUE O JUIZ É CEGO ⚽',
    'SE O SOFÁ FOSSE MENOR, ESSA TV JÁ TINHA DOMINADO A SALA 😂',
    'PRA MARATONAR SÉRIE E ESQUECER QUE EXISTE SEGUNDA-FEIRA 📺',
    'IMAGEM TÃO NÍTIDA QUE DÁ ATÉ RAIVA QUANDO ACABA O FILME 😡',
    'ESSA TV FAZ A ANTIGA PARECER DE BRINQUEDO 🎮',
    'DÁ PRA ASSISTIR COLADINHO COM O MOZÃO EM ALTA DEFINIÇÃO 💕',
    'TV GRANDE PRA QUEM GOSTA DE EXAGERO 🔥',
    'IMAGEM TÃO REAL QUE ASSUSTA 😱',
    'ESSA TV NÃO É PRA QUARTO, É PRA EVENTO 🎉',
    'PRA VER FILME, JOGO E ATÉ DISCUSSÃO EM QUALIDADE MÁXIMA 🎯',
    'QUEM COMPRA ESSA TV NÃO CONSEGUE MAIS ASSISTIR EM OUTRA 👑',
  ],
  'televisor': [],
  'smart tv': [
    'DÁ PRA ASSISTIR COLADINHO COM O MOZÃO EM ALTA DEFINIÇÃO 💕',
  ],
  
  // Perfumes
  'malbec': [
    'PERFUME DE QUEM TRAI (MAS AGORA TÁ BARATO) 😏',
    'O CLÁSSICO DOS TRAIDORES EM PROMOÇÃO 🔥',
    'MALBEC EM PROMOÇÃO? ISSO É RARO 💎',
    'O PERFUME MAIS FAMOSO DOS TRAIDORES TÁ BARATO 😂',
  ],
  'uomini': [
    'ESSE TE DEIXA CHEIROSO 🌟',
    'PERFUME BOM E BARATO 💰',
    'CHEIRO DE RICO POR PREÇO DE POBRE 👑',
    'ESSE TE DEIXA CHEIROSO DEMAIS 🔥',
  ],
  'perfume': [
    'CHEIRO DE RICO POR PREÇO DE POBRE 👑',
    'PERFUME QUE CHEGA NA SALA ANTES DE VOCÊ 💨',
    'PASSOU, TODO MUNDO PERCEBEU 👀',
    'CHEIRO DE "ALGUÉM TÁ BEM" 😎',
    'PERFUME PRA QUEM GOSTA DE IMPACTO 💥',
    'ESSE CHEIRO NÃO PASSA DESAPERCEBIDO 👃',
    'PERFUME QUE RENDE PERGUNTA ❓',
    'PASSA POUCO PRA NÃO HUMILHAR 🔥',
    'CHEIRO DE ELOGIO GARANTIDO ⭐',
    'PERFUME QUE FAZ PRESENÇA 💪',
    'ESSE CHEIRO É PERIGO ⚠️',
    'PERFUME PRA MARCAR TERRITÓRIO 🗺️',
    'CHEIRO QUE FICA NA MEMÓRIA 🧠',
    'PASSOU, FICOU 💯',
    'PERFUME PRA NÃO SER ESQUECIDO 🔖',
  ],
  'colônia': [],
  'perfume importado': [
    'PERFUME PRA QUEM GOSTA DE IMPACTO 💥',
  ],
  'perfume feminino': [
    'CHEIRO DE PROTAGONISTA 👑',
    'PERFUME QUE CHEGA CHEGANDO 💨',
    'PASSOU, TODO MUNDO NOTOU 👀',
    'CHEIRO DE MULHER SEGURA 💪',
    'ESSE PERFUME NÃO PEDE LICENÇA 🔥',
    'PERFUME PRA MARCAR PRESENÇA ⭐',
    'CHEIRO DE ELOGIO 💐',
    'PASSA POUCO PRA NÃO HUMILHAR 😏',
  ],
  'perfume masculino': [
    'CHEIRO DE PRESENÇA 💪',
    'PERFUME DE RESPEITO 👔',
    'ESSE PERFUME IMPÕE 🔥',
    'CHEIRO DE HOMEM SEGURO 😎',
    'PASSOU, MARCOU 💯',
    'PERFUME PRA CHEGAR CHEGANDO 🚀',
    'CHEIRO FORTE NA MEDIDA ⚡',
    'ESSE CHEIRO NÃO PASSA BATIDO 👃',
  ],
  
  // Monitores
  'monitor': [
    'ACHADO NÃO É ROUBADO 💰',
    'MONITOR BOM E BARATO 💵',
    'PRA QUEM TAVA QUERENDO 👀',
    'MONITOR BOM PRA JOGAR E TRABALHAR 🖥️',
    'PRA QUEM PASSA HORAS NA FRENTE DO PC ⏰',
  ],
  'monitor gamer': [
    'MONITOR BOM PRA JOGAR 🎮',
    'PRA QUEM QUER JOGAR COM QUALIDADE 🔥',
    'MONITOR GAMER EM PROMOÇÃO É RARO 💎',
  ],
  
  // Smartphones
  'iphone': [
    'IPHONE EM PROMOÇÃO? ISSO É RARO 💎',
    'PRA QUEM QUER SER APPLE SEM GASTAR MUITO 🍎',
    'IPHONE BARATO É ACHADO 💰',
    'O CELULAR DOS SONHOS TÁ BARATO 🌟',
  ],
  'samsung': [
    'SAMSUNG BOM E BARATO 💵',
    'CELULAR TOP EM PROMOÇÃO 🔥',
    'PRA QUEM QUER QUALIDADE SEM GASTAR MUITO ⭐',
    'SAMSUNG EM DESCONTO É ACHADO 💎',
  ],
  'xiaomi': [
    'XIAOMI BOM E BARATO 💰',
    'CELULAR XIAOMI EM PROMOÇÃO É ACHADO 🔥',
    'PRA QUEM QUER QUALIDADE SEM GASTAR MUITO ⭐',
    'XIAOMI TOP EM DESCONTO 💎',
    'CELULAR XIAOMI QUE ENTREGA 💪',
  ],
  'poco': [
    'POCO EM PROMOÇÃO? ISSO É RARO 💎',
    'CELULAR POCO BOM E BARATO 🔥',
    'PRA QUEM QUER POTÊNCIA SEM GASTAR MUITO ⚡',
    'POCO TOP EM DESCONTO 💰',
  ],
  'celular': [
    'CELULAR PRA QUEM NÃO TEM PACIÊNCIA PRA TRAVAMENTO 📱',
    'RODA APP, JOGO E FOFOCA 🎮',
    'NÃO É TOP DE LINHA, MAS NÃO PASSA VERGONHA 😎',
    'PRA QUEM USA CELULAR O DIA TODO ⏰',
    'ESSE AQUI AGUENTA O TRANCO 💪',
    'CELULAR PRA TRABALHAR E PROCRASTINAR 😏',
    'MEMÓRIA PRA FOTO, VÍDEO E PRINT DE CONVERSA 📸',
    'BATERIA QUE AGUENTA MAIS QUE VOCÊ 🔋',
    'CELULAR HONESTO, DO JEITO QUE A GENTE GOSTA ✨',
    'NÃO TRAVA NO BÁSICO (JÁ É MUITO) ✅',
    'PRA QUEM NÃO QUER JOGAR DINHEIRO FORA 💰',
    'CELULAR PRA VIDA REAL 🌍',
    'NÃO TE DEIXA NA MÃO 🤝',
    'FUNCIONA, E FUNCIONA BEM ⚡',
    'ESSE CELULAR NÃO FAZ DRAMA 🎭',
  ],
  'smartphone': [],
  
  // Notebooks
  'notebook': [
    'NOTEBOOK PRA TRABALHAR SEM PASSAR RAIVA 💻',
    'ABRE TUDO, MENOS A PACIÊNCIA ⚡',
    'PRA QUEM NÃO AGUENTA LENTIDÃO 🚀',
    'ESSE AQUI DÁ CONTA ✅',
    'NOTEBOOK PRA VIDA REAL 🌍',
    'RODA PROGRAMA PESADO E FOFOCA LEVE 😏',
    'PRA QUEM TRABALHA E PROCRASTINA 📚',
    'NÃO TRAVA NO MEIO DA REUNIÃO 🎯',
    'PRA QUEM NÃO TEM TEMPO ⏰',
    'NOTEBOOK QUE ENTREGA 💪',
    'PRA HOME OFFICE DE VERDADE 🏠',
    'ESSE NÃO TE HUMILHA 😎',
    'POTÊNCIA NA MEDIDA ⚡',
    'NOTEBOOK PRA PRODUZIR 📊',
    'NÃO FAZ DRAMA 🎭',
  ],
  'laptop': [],
  
  // Fones de ouvido
  'fone': [
    'PRA OUVIR MÚSICA E IGNORAR O MUNDO 🎧',
    'IDEAL PRA FINGIR QUE NÃO TÁ OUVINDO 🙉',
    'ESSE FONE É ÓTIMO PRA FUGIR DE GENTE CHATA 😎',
    'COLOCOU, SUMIU 👻',
    'PRA OUVIR MÚSICA E DESAPARECER SOCIALMENTE 🎵',
    'SOM TÃO BOM QUE DÁ VONTADE DE NÃO RESPONDER 🔇',
    'PERFEITO PRA FAZER CARA DE CONCENTRADO 🤔',
    'PRA TREINAR OU PRA NÃO OUVIR PROBLEMA 💪',
    'ESSE FONE É UM PEDIDO DE PAZ ☮️',
    'COLOCOU NO OUVIDO, O MUNDO FICOU DISTANTE 🌍',
    'PRA OUVIR PODCAST E FINGIR PRODUTIVIDADE 📚',
    'SOM BOM PRA IGNORAR O CAOS 🔥',
    'IDEAL PRA QUEM AMA SILÊNCIO COM MÚSICA 🎶',
    'PRA OUVIR TUDO, MENOS OPINIÃO ALHEIA 🙊',
    'FONE QUE SALVA A SANIDADE 🆘',
  ],
  'headphone': [],
  'airpods': [
    'AIRPODS EM PROMOÇÃO? ISSO É RARO 💎',
    'PRA QUEM QUER SER APPLE SEM GASTAR MUITO 🍎',
    'FONE SEM FIO BOM E BARATO 💰',
  ],
  'fone bluetooth': [],
  
  // Air Fryer
  'air fryer': [
    'FRITA SEM ÓLEO E SEM CULPA (QUASE) 🍟',
    'ESSA AQUI SALVA QUEM NÃO SABE COZINHAR 🆘',
    'PRA FAZER COMIDA E FINGIR QUE É SAUDÁVEL 😏',
    'AIR FRYER É O NOVO FOGÃO 🔥',
    'ESSA COISA FAZ MILAGRE ✨',
    'PRA QUEM TEM PREGUIÇA E FOME 😴',
    'COLOCOU, ESPEROU, COME ⏱️',
    'AIR FRYER: AMOR VERDADEIRO ❤️',
    'ESSA AQUI TRABALHA MAIS QUE EU 💪',
    'FAZ BATATA, CARNE E ILUSÃO 🥔',
    'PRA QUEM NÃO GOSTA DE ÓLEO E SUJEIRA 🧹',
    'AIR FRYER É QUALIDADE DE VIDA 🌟',
    'ESSENCIAL PRA ADULTO FUNCIONAL 👨‍🍳',
    'ESSA MÁQUINA MERECE RESPEITO 👑',
    'DEPOIS DESSA, O FOGÃO FICA CIUMENTO 😤',
  ],
  'fritadeira': [],
  
  // Tênis
  'tênis': [
    'TÊNIS PRA ANDAR O DIA TODO 👟',
    'CONFORTO PRA VIDA REAL 💪',
    'ESSE TÊNIS AGUENTA ⚡',
    'PRA QUEM ANDA MUITO 🚶',
    'CONFORTO SEM DRAMA ✅',
    'TÊNIS PRA TODO DIA 📅',
    'ESSE NÃO CASTIGA O PÉ 🦶',
    'PRA TRABALHAR, SAIR E VOLTAR 🏃',
    'TÊNIS DE CONFIANÇA 🤝',
    'ESSE É PARCEIRO 👯',
    'PRA QUEM NÃO GOSTA DE SAPATO DURO 👠',
    'TÊNIS HONESTO 💰',
    'PRA VIDA CORRIDA ⏰',
    'CONFORTO GARANTIDO ✅',
    'ESSE RESOLVE 💯',
  ],
  'tenis': [],
  'nike': [
    'NIKE EM PROMOÇÃO? ISSO É RARO 💎',
    'TÊNIS DA MARCA MAIS FAMOSA TÁ BARATO 👑',
    'PRA QUEM QUER SER ESTILOSO 😎',
  ],
  'adidas': [
    'ADIDAS EM PROMOÇÃO É ACHADO 💰',
    'TÊNIS DA MARCA TÁ BARATO 💵',
    'PRA QUEM QUER SER ESTILOSO 😎',
  ],
  
  // Jogos de Tabuleiro - Grupo
  'jogo de tabuleiro': [
    'PRA REUNIR A GALERA E JULGAR TODO MUNDO 🎲',
    'ESSE JOGO FAZ BARULHO 🔊',
    'PRA RIR ALTO 😂',
    'JOGO PRA CASA CHEIA 🏠',
    'PRA QUEM GOSTA DE BAGUNÇA ORGANIZADA 🎯',
    'ESSE AQUI NÃO É SILENCIOSO 📢',
    'PRA NOITE DE RISADA 🌙',
    'JOGO PRA ESQUECER O CELULAR 📱',
    'PRA VER QUEM SABE BLEFAR 🃏',
    'JOGO PRA QUEM GOSTA DE DRAMA 🎭',
  ],
  'jogo tabuleiro': [],
  'tabuleiro': [],
  
  // Jogos de Tabuleiro - Estratégico
  'jogo estratégico': [
    'ESSE JOGO ACABA COM A PAZ DA MESA 🎲',
    'PRA QUEM GOSTA DE DOMINAR TERRITÓRIO 🗺️',
    'JOGO PRA CRIAR RANCOR 😤',
    'ESSE JOGO TRANSFORMA AMIGO EM ADVERSÁRIO ⚔️',
    'PRA QUEM NÃO SABE PERDER 😡',
    'AQUI NÃO TEM PIEDADE 💀',
    'JOGO PRA TESTAR A PACIÊNCIA ⏳',
    'PRA DISCUTIR REGRA POR HORAS 📜',
    'ESSE JOGO EXIGE FRIEZA 🧊',
    'PRA QUEM GOSTA DE PODER 👑',
    'JOGO PRA GANHAR CALADO 🤫',
    'AQUI A AMIZADE É TESTADA 🤝',
    'PRA QUEM PLANEJA E SOFRE 🧠',
    'ESSE JOGO DURA MAIS DO QUE PROMESSA ⏰',
    'JOGO PRA NOITE LONGA 🌙',
    'JOGO PRA QUEM SE ACHA INTELIGENTE 🧠',
    'PRA PENSAR DEMAIS E PERDER IGUAL 🤔',
    'JOGO PRA FICAR SÉRIO 😤',
    'PRA QUEM GOSTA DE PLANO MALIGNO 😈',
    'ESSE JOGO CANSA O CÉREBRO 💭',
    'PRA QUEM NÃO JOGA NO AUTOMÁTICO ⚙️',
    'JOGO PRA GENTE COMPETITIVA 🏆',
    'JOGO PRA DISCUTIR REGRA 📜',
    'ESSE AQUI É CEREBRAL 🧩',
  ],
  'estratégico': [],
  'war': [
    'ESSE JOGO ACABA COM A PAZ DA MESA 🎲',
    'PRA QUEM GOSTA DE DOMINAR TERRITÓRIO 🗺️',
    'JOGO PRA CRIAR RANCOR 😤',
    'ESSE JOGO TRANSFORMA AMIGO EM ADVERSÁRIO ⚔️',
    'PRA QUEM NÃO SABE PERDER 😡',
    'AQUI NÃO TEM PIEDADE 💀',
    'JOGO PRA TESTAR A PACIÊNCIA ⏳',
    'PRA DISCUTIR REGRA POR HORAS 📜',
    'ESSE JOGO EXIGE FRIEZA 🧊',
    'PRA QUEM GOSTA DE PODER 👑',
    'JOGO PRA GANHAR CALADO 🤫',
    'AQUI A AMIZADE É TESTADA 🤝',
    'PRA QUEM PLANEJA E SOFRE 🧠',
    'ESSE JOGO DURA MAIS DO QUE PROMESSA ⏰',
    'JOGO PRA NOITE LONGA 🌙',
  ],
  'banco imobiliário': [
    'ESSE JOGO ACABA COM A PAZ DA MESA 🎲',
    'PRA QUEM GOSTA DE DOMINAR TERRITÓRIO 🗺️',
    'JOGO PRA CRIAR RANCOR 😤',
    'ESSE JOGO TRANSFORMA AMIGO EM ADVERSÁRIO ⚔️',
    'PRA QUEM NÃO SABE PERDER 😡',
    'AQUI NÃO TEM PIEDADE 💀',
    'JOGO PRA TESTAR A PACIÊNCIA ⏳',
    'PRA DISCUTIR REGRA POR HORAS 📜',
    'ESSE JOGO EXIGE FRIEZA 🧊',
    'PRA QUEM GOSTA DE PODER 👑',
    'JOGO PRA GANHAR CALADO 🤫',
    'AQUI A AMIZADE É TESTADA 🤝',
    'PRA QUEM PLANEJA E SOFRE 🧠',
    'ESSE JOGO DURA MAIS DO QUE PROMESSA ⏰',
    'JOGO PRA NOITE LONGA 🌙',
  ],
  'monopoly': [
    'ESSE JOGO ACABA COM A PAZ DA MESA 🎲',
    'PRA QUEM GOSTA DE DOMINAR TERRITÓRIO 🗺️',
    'JOGO PRA CRIAR RANCOR 😤',
    'ESSE JOGO TRANSFORMA AMIGO EM ADVERSÁRIO ⚔️',
    'PRA QUEM NÃO SABE PERDER 😡',
    'AQUI NÃO TEM PIEDADE 💀',
    'JOGO PRA TESTAR A PACIÊNCIA ⏳',
    'PRA DISCUTIR REGRA POR HORAS 📜',
    'ESSE JOGO EXIGE FRIEZA 🧊',
    'PRA QUEM GOSTA DE PODER 👑',
    'JOGO PRA GANHAR CALADO 🤫',
    'AQUI A AMIZADE É TESTADA 🤝',
    'PRA QUEM PLANEJA E SOFRE 🧠',
    'ESSE JOGO DURA MAIS DO QUE PROMESSA ⏰',
    'JOGO PRA NOITE LONGA 🌙',
  ],
  
  // Jogos de Tabuleiro - Família
  'jogo família': [
    'JOGO PRA JUNTAR TODO MUNDO 👨‍👩‍👧',
    'PRA NOITE SEM TELA 📺',
    'JOGO PRA RIR EM CASA 😄',
    'PRA BRIGAR SÓ UM POUCO 😏',
    'JOGO PRA VIDA REAL 🌍',
    'PRA CRIAR MEMÓRIA (E PIADA INTERNA) 💭',
    'JOGO PRA DOMINGO ☀️',
    'PRA QUEM GOSTA DE MESA CHEIA 🍽️',
    'JOGO PRA TODO MUNDO SE ENVOLVER 🤝',
    'PRA NOITE TRANQUILA (OU NÃO) 🌙',
  ],
  'jogo familia': [],
  'jogo familiar': [],
  
  // Consoles
  'playstation': [
    'ESSE AQUI ACABA COM SUA VIDA SOCIAL 🎮',
    'PRA QUEM DIZ "SÓ MAIS UMA PARTIDA" ⏰',
    'COMPRA ISSO E DESAPARECE DO MUNDO 👻',
    'CONSOLE PRA QUEM NÃO TEM TEMPO, MAS JOGA MESMO ASSIM 😏',
    'ESSE É O MOTIVO DO ATRASO ⏰',
    'PRA PERDER A NOÇÃO DO TEMPO 🕐',
    'LIGA E ESQUECE DO RESTO 🔥',
    'CONSOLE QUE ROUBA HORAS ⏳',
    'PRA QUEM CHAMA JOGO DE TERAPIA 🎯',
    'ESSE AQUI É COMPROMISSO 💪',
    'COMPRA PERIGOSA ⚠️',
    'PRA QUEM AMA SOFRER EM BOSS FIGHT 😤',
    'CONSOLE DE RESPEITO 👑',
    'ESSE VAI TESTAR SUA PACIÊNCIA 🧠',
    'JOGAR É OBRIGAÇÃO 🎮',
  ],
  'ps5': [
    'PS5 EM PROMOÇÃO? ISSO É RARO 💎',
    'PRA QUEM TAVA ESPERANDO COMPRAR 👀',
    'CONSOLE DOS SONHOS TÁ BARATO 🌟',
  ],
  'xbox': [
    'XBOX EM PROMOÇÃO É ACHADO 💰',
    'PRA QUEM QUER JOGAR COM OS AMIGOS 👥',
    'CONSOLE BOM E BARATO 💵',
  ],
  'nintendo': [
    'NINTENDO EM PROMOÇÃO É ACHADO 💰',
    'PRA QUEM QUER JOGAR COM A FAMÍLIA 👨‍👩‍👧‍👦',
    'CONSOLE BOM PRA TODA A FAMÍLIA 🎮',
  ],
  'switch': [
    'NINTENDO SWITCH EM PROMOÇÃO É ACHADO 💰',
    'PRA QUEM QUER JOGAR EM QUALQUER LUGAR 🌍',
    'CONSOLE PORTÁTIL BOM E BARATO 💵',
  ],
  
  // Geladeira
  'geladeira': [
    'CABE A COMPRA DO MÊS E A CULPA 🛒',
    'ESSA GELADEIRA É MAIOR QUE MEU COMPROMISSO COM DIETA 😂',
    'PRA QUEM ABRE A GELADEIRA DE 5 EM 5 MINUTOS 🚪',
    'ESPAÇO PRA COMIDA E PRA ILUSÃO 🍔',
    'GELADEIRA PRA CASA QUE COME BEM 🏠',
    'SE ESSA GELADEIRA FOSSE MENOR, EU COMIA MAIS FORA 🍕',
    'FRIA POR DENTRO, ECONÔMICA POR FORA ❄️',
    'CABE ATÉ A MARMITA DA SEMANA 🍱',
    'ESSA AQUI NÃO PASSA VERGONHA ✅',
    'PRA QUEM COMPRA COMO SE TIVESSE FAMÍLIA GRANDE 👨‍👩‍👧‍👦',
    'ORGANIZA TUDO, MENOS SUA VIDA 📦',
    'GELADEIRA DE RESPEITO 👑',
    'ESSA AGUENTA O TRANCO 💪',
    'GELADEIRA PRA VIDA REAL 🌍',
    'DEPOIS DESSA, A ANTIGA VIROU MINIBAR 🍻',
  ],
  
  // Microondas
  'microondas': [
    'ESQUENTA RÁPIDO PRA QUEM TEM FOME ⚡',
    'SALVA A MARMITA 🍱',
    'PRA QUEM NÃO TEM TEMPO ⏰',
    'ESQUENTA SEM DRAMA 🔥',
    'ESSENCIAL PRA ROTINA ✅',
    'MICROONDAS É VIDA 💯',
    'PRA QUEM VIVE COM PRESSA 🏃',
    'ESQUENTA E PRONTO ⏱️',
    'ESSA AQUI RESOLVE 💪',
    'PRA CASA REAL 🏠',
    'SEM FOGÃO, SEM PROBLEMA 🍳',
    'ESQUENTA ATÉ A ESPERANÇA 🌟',
    'ESSA FUNCIONA ⚡',
    'MICROONDAS HONESTO 💰',
    'FOME RESOLVIDA 🍽️',
  ],
  
  // Roupas
  'camisa': [
    'CAMISETA PRA PARECER ARRUMADO SEM ESFORÇO 👕',
    'ESSA CAMISETA SALVA O LOOK ✨',
    'PRA QUEM ACORDA SEM CRIATIVIDADE 😴',
    'CAMISETA SIMPLES, EFEITO GRANDE 💪',
    'VESTE E FINGE QUE PENSOU NO LOOK 😏',
    'ESSA CAMISETA É CORINGA 🃏',
    'PRA QUEM NÃO TEM PACIÊNCIA PRA ROUPA COMPLICADA ⏰',
    'CAMISETA PRA VIDA REAL 🌍',
    'ESSA AQUI COMBINA COM TUDO 🎨',
    'PRA SAIR ARRUMADO EM 30 SEGUNDOS ⚡',
    'CAMISETA QUE RESOLVE ✅',
    'ESTILO SEM DRAMA 🎭',
    'ESSA NÃO PASSA VERGONHA 😎',
    'CAMISETA PRA TODO DIA 📅',
    'VESTIU, TÁ PRONTO 🚀',
  ],
  'calça': [
    'CALÇA PRA QUEM NÃO ABRE MÃO DO CONFORTO 👖',
    'ESSA JEANS AGUENTA O TRANCO 💪',
    'PRA USAR O DIA TODO SEM ARREPENDIMENTO ⏰',
    'CALÇA PRA VIDA REAL 🌍',
    'ESSA NÃO APERTA A ALMA 😌',
    'JEANS HONESTO 💰',
    'PRA QUEM ODEIA CALÇA DESCONFORTÁVEL 😤',
    'ESSA JEANS É PARCEIRA 👯',
    'COMBINA COM TUDO 🎨',
    'PRA SAIR, TRABALHAR E VOLTAR 🏃',
    'CALÇA QUE NÃO ENCHE ✅',
    'ESSA ENTREGA 💯',
    'JEANS PRA USO INTENSO 🔥',
    'PRA NÃO PASSAR RAIVA 😎',
    'CALÇA DE CONFIANÇA 🤝',
  ],
  'roupa': [
    'ROUPA BOM PRA SE VESTIR BEM 👔',
    'PRA QUEM QUER SER ESTILOSO 😎',
    'ROUPA EM PROMOÇÃO É ACHADO 💰',
  ],
  
  // Joias - Correntes Masculinas
  'corrente': [
    'ESSA CORRENTE NÃO É PRA OSTENTAR, É PRA MARCAR ⛓️',
    'PRA QUEM GOSTA DE PRESENÇA SILENCIOSA 😏',
    'NÃO É PRA GRITAR, É PRA IMPOR 💪',
    'CORRENTE PRA QUEM TEM SEGURANÇA ✨',
    'DISCRETA ATÉ ALGUÉM NOTAR 👀',
    'ESSA CORRENTE ENTREGA 🔥',
    'PRA QUEM NÃO USA QUALQUER COISA 💎',
    'NÃO É EXAGERO, É CONTROLE 🎯',
    'CORRENTE PRA QUEM NÃO PASSA BATIDO 👑',
    'PRA QUEM SABE QUE MENOS FUNCIONA ✨',
    'ESSA NÃO É PRA TODO PESCOÇO 😎',
    'CORRENTE PRA QUEM TEM POSTURA 💪',
    'PRA QUEM NÃO PRECISA SE EXPLICAR 🤫',
    'ESSA PEÇA FALA POR VOCÊ 📿',
    'CORRENTE PRA QUEM JÁ CHEGOU 👑',
  ],
  'corrente masculina': [],
  
  // Joias - Brincos
  'brinco': [
    'PEQUENO NO TAMANHO, GRANDE NA INTENÇÃO 👂',
    'BRINCO PRA QUEM SABE SER NOTADA SEM FORÇAR ✨',
    'NÃO É PRA CHAMAR ATENÇÃO, MAS CHAMA 👀',
    'DISCRETO, ATÉ ALGUÉM REPARAR 😏',
    'BRINCO PRA QUEM TEM PRESENÇA 💎',
    'NÃO É EXAGERO, É CONTROLE 🎯',
    'PRA QUEM GOSTA DE SER OBSERVADA 👀',
    'BRINCO PRA QUEM ENTENDE DE SILÊNCIO 🤫',
    'PEQUENO, MAS PERIGOSO ⚡',
    'ESSE BRINCO ENTREGA MAIS DO QUE PARECE 🔥',
    'PRA QUEM NÃO PRECISA DE MUITO ✨',
    'DETALHE QUE FAZ GENTE REPARAR 👀',
    'BRINCO PRA QUEM JÁ CHEGOU 👑',
    'SIMPLES SÓ NA APARÊNCIA 😎',
    'PRA QUEM SABE USAR DETALHE COMO ARMA 💍',
  ],
  'brincos': [],
  
  // Joias - Colares
  'colar': [
    'ESSE COLAR NÃO É ACESSÓRIO, É AVISO 📿',
    'PRA QUEM GOSTA DE SER OBSERVADA COM CLASSE ✨',
    'NÃO É SÓ UM COLAR 💎',
    'PRA QUEM SABE QUE O OLHAR DESCE 👀',
    'ESSE COLAR FAZ O TRABALHO 🔥',
    'NÃO É PRA TODO LOOK 😏',
    'COLAR PRA QUEM NÃO PASSA BATIDA 👑',
    'DISCRETO, MAS ESTRATÉGICO 🎯',
    'PRA QUEM SABE ONDE QUER CHEGAR 💪',
    'ESSE COLAR ENTREGA INTENÇÃO ✨',
    'NÃO É EXAGERO, É CONTROLE DE CENA 🎭',
    'PRA QUEM GOSTA DE IMPACTO SILENCIOSO 🤫',
    'COLAR PRA QUEM ENTENDE DE PRESENÇA 👀',
    'ESSE NÃO É PRA ESCONDER 🔥',
    'PRA QUEM SABE O PODER DE UM DETALHE 💍',
  ],
  'colares': [],
  
  // Joias - Pulseiras
  'pulseira': [
    'PULSEIRA PRA QUEM PRESTA ATENÇÃO NOS DETALHES 👀',
    'NÃO É SÓ NO PULSO, É NO RECADO 📿',
    'DISCRETA, MAS NÃO INOCENTE 😏',
    'PRA QUEM SABE USAR O MÍNIMO ✨',
    'ESSA PULSEIRA NÃO PASSA BATIDA 👑',
    'PRA QUEM GOSTA DE SER NOTADA DE LADO 👀',
    'NÃO É PRA OSTENTAR, É PRA CONFIRMAR 💎',
    'PULSEIRA PRA QUEM ENTENDE DE SUTILEZA 🤫',
    'ESSE DETALHE ENTREGA CLASSE 🔥',
    'PRA QUEM SABE QUE MENOS É MAIS ✨',
    'NÃO É SÓ UM ACESSÓRIO 💍',
    'PULSEIRA PRA QUEM NÃO PRECISA SE EXPLICAR 😎',
    'ESSA AQUI FALA BAIXO 🤫',
    'PRA QUEM TEM CONTROLE DO LOOK 🎯',
    'PULSEIRA PRA QUEM SABE O QUE FAZ 👑',
  ],
  'pulseiras': [],
  
  // Joias - Anéis
  'anel': [
    'ANEL PRA QUEM NÃO PASSA DESAPERCEBIDA 👀',
    'NÃO É PROMESSA, É PRESENÇA 💍',
    'PRA QUEM GOSTA DE OLHAR DIRETO NA MÃO ✨',
    'ESSE ANEL NÃO É TÍMIDO 🔥',
    'PRA QUEM SABE IMPOR RESPEITO EM SILÊNCIO 🤫',
    'ANEL PRA QUEM TEM POSTURA 💪',
    'NÃO É SÓ UM DETALHE 💎',
    'PRA QUEM SABE O PESO DE UM ANEL 👑',
    'ESSE ENTREGA MAIS DO QUE PARECE 😏',
    'ANEL PRA QUEM GOSTA DE IMPACTO ⚡',
    'NÃO É PRA TODO DIA (OU É) 📅',
    'PRA QUEM NÃO TEM MEDO DE SER NOTADA 👀',
    'ESSE ANEL É UM RECADO 📿',
    'PRA QUEM SABE O QUE SIGNIFICA ✨',
    'ANEL PRA QUEM JÁ CHEGOU LÁ 👑',
  ],
  'aneis': [],
  'anéis': [],
  
  // Joias - Relógios Masculinos
  'relógio masculino': [
    'PRA QUEM NÃO ATRASA E NÃO SE EXPLICA ⌚',
    'ESSE RELÓGIO NÃO PEDE ATENÇÃO, RECEBE 🔥',
    'PRA QUEM GOSTA DE CONTROLE NO PULSO 💪',
    'NÃO É PRA APARECER, MAS APARECE 👀',
    'RELÓGIO PRA QUEM NÃO VIVE DE DESCULPA 😏',
    'ESSE AQUI ENTREGA AUTORIDADE 👑',
    'PRA QUEM SABE O PESO DO TEMPO ⏰',
    'NÃO É SÓ UM RELÓGIO 💎',
    'PRA QUEM NÃO PRECISA PROVAR NADA ✨',
    'RELÓGIO PRA VIDA REAL 🎯',
  ],
  'relogio masculino': [],
  
  // Joias - Relógios Femininos
  'relógio feminino': [
    'PRA QUEM SABE A HORA DE CHEGAR E A DE SAIR ⌚',
    'ESSE RELÓGIO ENTREGA AUTOCONTROLE 😏',
    'PRA QUEM NÃO TEM TEMPO PRA BOBAGEM ⏰',
    'NÃO É PRA SE EXPLICAR, É PRA CONFIRMAR ✨',
    'RELÓGIO PRA QUEM TEM PRESENÇA 👀',
    'ESSE AQUI NÃO É INOCENTE 🔥',
    'PRA QUEM GOSTA DE DETALHE COM INTENÇÃO 💎',
    'NÃO É PRA TODO PULSO 👑',
    'RELÓGIO PRA QUEM NÃO PASSA DESAPERCEBIDA ✨',
    'PRA QUEM SABE QUE TEMPO É PODER ⚡',
  ],
  'relogio feminino': [],
  'relógio': [
    'PRA QUEM NÃO ATRASA E NÃO SE EXPLICA ⌚',
    'ESSE RELÓGIO NÃO PEDE ATENÇÃO, RECEBE 🔥',
    'PRA QUEM GOSTA DE CONTROLE NO PULSO 💪',
    'NÃO É PRA APARECER, MAS APARECE 👀',
    'RELÓGIO PRA QUEM NÃO VIVE DE DESCULPA 😏',
    'ESSE AQUI ENTREGA AUTORIDADE 👑',
    'PRA QUEM SABE O PESO DO TEMPO ⏰',
    'NÃO É SÓ UM RELÓGIO 💎',
    'PRA QUEM NÃO PRECISA PROVAR NADA ✨',
    'RELÓGIO PRA VIDA REAL 🎯',
  ],
  'relogio': [],
  'watch': [],
  
  // Extensão Elétrica / Régua de Tomadas
  'extensão': [
    'PRA QUEM TEM MAIS COISA PRA LIGAR DO QUE TOMADA NA CASA 🔌',
    'ESSA AQUI SALVA O SETUP ⚡',
    'PRA PARAR DE DISPUTAR TOMADA 😤',
    'TOMADA PRA VIDA REAL 💪',
    'LIGA TUDO E SEGUE A VIDA ✅',
    'ESSA EXTENSÃO É NECESSIDADE 🆘',
    'PRA QUEM TEM MUITA COISA E POUCA TOMADA 🔌',
    'EXTENSÃO PRA NÃO PASSAR RAIVA 😎',
    'ESSA AQUI EVITA BRIGA 🛡️',
    'TOMADA DE SOBREVIVÊNCIA 🆘',
    'PRA CASA MODERNA CHEIA DE CABO 🏠',
    'ESSA SALVA O DIA ⭐',
    'PRA NÃO FICAR TROCANDO PLUG 🔄',
    'LIGA TUDO DE UMA VEZ ⚡',
    'ESSA EXTENSÃO É PARCEIRA 🤝',
  ],
  'extensao': [],
  'réguas': [
    'PRA QUEM TEM MAIS COISA PRA LIGAR DO QUE TOMADA NA CASA 🔌',
    'ESSA AQUI SALVA O SETUP ⚡',
    'PRA PARAR DE DISPUTAR TOMADA 😤',
    'TOMADA PRA VIDA REAL 💪',
    'LIGA TUDO E SEGUE A VIDA ✅',
    'ESSA EXTENSÃO É NECESSIDADE 🆘',
    'PRA QUEM TEM MUITA COISA E POUCA TOMADA 🔌',
    'EXTENSÃO PRA NÃO PASSAR RAIVA 😎',
    'ESSA AQUI EVITA BRIGA 🛡️',
    'TOMADA DE SOBREVIVÊNCIA 🆘',
    'PRA CASA MODERNA CHEIA DE CABO 🏠',
    'ESSA SALVA O DIA ⭐',
    'PRA NÃO FICAR TROCANDO PLUG 🔄',
    'LIGA TUDO DE UMA VEZ ⚡',
    'ESSA EXTENSÃO É PARCEIRA 🤝',
  ],
  'regua': [],
  'tira': [
    'PRA QUEM TEM MAIS COISA PRA LIGAR DO QUE TOMADA NA CASA 🔌',
    'ESSA AQUI SALVA O SETUP ⚡',
    'PRA PARAR DE DISPUTAR TOMADA 😤',
    'TOMADA PRA VIDA REAL 💪',
    'LIGA TUDO E SEGUE A VIDA ✅',
    'ESSA EXTENSÃO É NECESSIDADE 🆘',
    'PRA QUEM TEM MUITA COISA E POUCA TOMADA 🔌',
    'EXTENSÃO PRA NÃO PASSAR RAIVA 😎',
    'ESSA AQUI EVITA BRIGA 🛡️',
    'TOMADA DE SOBREVIVÊNCIA 🆘',
    'PRA CASA MODERNA CHEIA DE CABO 🏠',
    'ESSA SALVA O DIA ⭐',
    'PRA NÃO FICAR TROCANDO PLUG 🔄',
    'LIGA TUDO DE UMA VEZ ⚡',
    'ESSA EXTENSÃO É PARCEIRA 🤝',
  ],
};

// ==================== FRASES DE VENDAS PARA X/TWITTER ====================
// Ganchos organizados em 3 categorias: urgência, surpresa e curiosidade
// Isso aumenta o alcance pois atinge perfis diferentes de leitores

// 1️⃣ URGÊNCIA — transmite pressa, sensação de perder a oportunidade
const X_HOOKS_URGENCIA = [
  '🔥 ALERTA DE PROMOÇÃO',
  '🔥 ALERTA DE DESCONTO',
  '🔥 ALERTA DE OFERTA',
  '🔥 PROMOÇÃO CHEGANDO',
  '🔥 PROMOÇÃO QUENTE',
  '🔥 PROMOÇÃO FORTE',
  '🔥 DESCONTO ATIVO',
  '🔥 OFERTA DO DIA',
  '🔥 OFERTA QUENTE',
  '🔥 OFERTA ESPECIAL',
  '⚡ PROMOÇÃO RELÂMPAGO',
  '⚡ PROMOÇÃO RÁPIDA',
  '⚡ PROMOÇÃO LIMITADA',
  '⚡ PROMOÇÃO ATIVA',
  '⚡ PROMOÇÃO DO MOMENTO',
  '⚡ PROMOÇÃO TEMPORÁRIA',
  '⚡ PROMOÇÃO EM ANDAMENTO',
  '⚡ PROMOÇÃO LIBERADA',
  '⚡ PROMOÇÃO HOJE',
  '⚡ PROMOÇÃO ONLINE',
  '📢 ATENÇÃO PARA ESSA OFERTA',
  '📢 ATENÇÃO PARA ESSE PREÇO',
  '📢 ATENÇÃO PROMOÇÃO',
  '📢 ATENÇÃO DESCONTO',
  '📢 ATENÇÃO PREÇO BAIXO',
  '📢 ATENÇÃO PROMOÇÃO ATIVA',
  '📢 ATENÇÃO PREÇO REDUZIDO',
  '📢 ATENÇÃO OFERTA',
  '📢 ATENÇÃO DESCONTO HOJE',
  '📢 ATENÇÃO OPORTUNIDADE',
];

// 2️⃣ SURPRESA — gera impacto, estimula clique por choque
const X_HOOKS_SURPRESA = [
  '😱 OFERTA INSANA',
  '😱 OFERTA ABSURDA',
  '😱 DESCONTO LOUCO',
  '😱 DESCONTO GIGANTE',
  '😱 DESCONTO PESADO',
  '😱 OFERTA IMPERDÍVEL',
  '😱 PREÇO SURPREENDENTE',
  '😱 DESCONTO FORTE',
  '😱 PREÇO MALUCO',
  '😱 OFERTA INACREDITÁVEL',
  '⚠️ PREÇO DESPENCOU',
  '⚠️ PREÇO CAIU',
  '⚠️ PREÇO BAIXOU',
  '⚠️ PREÇO DERRETEU',
  '⚠️ PREÇO REDUZIDO',
  '⚠️ PREÇO EM QUEDA',
  '⚠️ PREÇO ATUALIZADO',
  '⚠️ PREÇO CAIU HOJE',
  '⚠️ PREÇO REBAIXADO',
  '⚠️ PREÇO AJUSTADO',
  '💰 DESCONTO PESADO',
  '💰 DESCONTO ATIVO',
  '💰 DESCONTO LIBERADO',
  '💰 DESCONTO FORTE',
  '💰 DESCONTO ESPECIAL',
  '💰 DESCONTO DO DIA',
  '💰 DESCONTO IMPERDÍVEL',
  '💰 SUPER DESCONTO',
  '💰 ECONOMIA REAL',
  '💰 DESCONTO GRANDE',
];

// 3️⃣ CURIOSIDADE — instiga o clique para saber o preço/produto
const X_HOOKS_CURIOSIDADE = [
  '🔥 PREÇO HISTÓRICO',
  '🔥 MENOR PREÇO',
  '🔥 PREÇO MÍNIMO',
  '🔥 PREÇO BAIXO',
  '🔥 PREÇO DIFERENCIADO',
  '🔥 PREÇO ESPECIAL',
  '🔥 PREÇO PROMOCIONAL',
  '🔥 PREÇO REDUZIDO',
  '🔥 PREÇO BAIXO HOJE',
  '🔥 PREÇO AJUSTADO',
  '🛒 OPORTUNIDADE',
  '🛒 OPORTUNIDADE HOJE',
  '🛒 OPORTUNIDADE DE COMPRA',
  '🛒 BOA OFERTA',
  '🛒 VALE A PENA',
  '🛒 OFERTA INTERESSANTE',
  '🛒 ACHADO DO DIA',
  '🛒 PREÇO BOM',
  '🛒 PREÇO LEGAL',
  '🛒 COMPRA INTELIGENTE',
];

// Pool completo (usado como fallback)
const X_HOOKS_ALL = [
  ...X_HOOKS_URGENCIA,
  ...X_HOOKS_SURPRESA,
  ...X_HOOKS_CURIOSIDADE,
];

// ── Frases complementares por categoria ────────────────────────────────────
// Aparecem logo abaixo do gancho, sem linha em branco entre eles.
// Reforçam a emoção do gancho e estimulam o clique.

// Complementares de URGÊNCIA — reforçam pressa/limite
const X_SUBTITLES_URGENCIA = [
  'Corre antes que acabe!',
  'Aproveite enquanto dura!',
  'Pode acabar a qualquer momento!',
  'Estoque limitado, não perca!',
  'Hoje pode ser o último dia!',
  'Não vai durar muito não!',
  'Por tempo limitado!',
  'Já estão acabando as unidades!',
  'Essa oferta não espera!',
  'Quem chega primeiro leva!',
  'Não deixa pra amanhã!',
  'Enquanto tiver em estoque!',
  'É agora ou nunca!',
  'Não perca essa chance!',
  'Oferta por tempo limitado!',
];

// Complementares de SURPRESA — reforçam o choque/impacto
const X_SUBTITLES_SURPRESA = [
  'Nunca vi tão barato assim!',
  'Esse preço não vai durar!',
  'Olha o valor que chegou...',
  'Raramente vejo desconto assim!',
  'Tô chocado com esse preço!',
  'Difícil ver desconto desse nível!',
  'Isso é impressionante demais!',
  'Não acredito no que estou vendo!',
  'Esse desconto é absurdo mesmo!',
  'Preço que aparece uma vez na vida!',
  'Me surpreendeu essa promoção!',
  'Quase não acreditei quando vi!',
  'Isso dificilmente se repete!',
  'Desconto que vale a pena demais!',
  'Que oferta ridícula de boa!',
];

// Complementares de CURIOSIDADE — instigam a conferir
const X_SUBTITLES_CURIOSIDADE = [
  'Você não vai acreditar no preço...',
  'Olha só o que achei pra você',
  'Dá uma olhada nisso...',
  'Um achado que você precisa ver',
  'Confira antes que suma do ar',
  'O preço vai te surpreender',
  'Vai querer saber quanto ficou?',
  'Olha o que apareceu hoje...',
  'Esse é aquele produto que você queria',
  'Acho que esse é pra você',
  'Achei e já vim te avisar',
  'Viu que oferta boa?',
  'Esse eu não consegui ignorar',
  'Precisei te mostrar isso',
  'Que achado é esse...',
];

// CTAs variados
const X_CTAS = [
  '👉 aproveitar oferta',
  '👉 pegar promoção',
  '👉 ver oferta',
  '👉 garantir o meu',
  '👉 aproveitar agora',
  '👉 pegar agora',
  '👉 quero essa oferta',
  '👉 comprar com desconto',
  '👉 aproveitar enquanto tem',
  '👉 ver oferta completa',
];

// Templates de preço em MAIÚSCULAS
const PRICE_TEMPLATES = [
  (old: string, now: string) => `DE ${old} POR ${now}`,
  (old: string, now: string) => `ERA ${old}, AGORA TÁ ${now}`,
  (old: string, now: string) => `CAIU DE ${old} PRA ${now}`,
  (old: string, now: string) => `SAIU DE ${old} PRA ${now}`,
];

const PRICE_TEMPLATES_NO_OLD = [
  (now: string) => `POR ${now}`,
  (now: string) => `TÁ ${now}`,
  (now: string) => `SAINDO POR ${now}`,
];

// ==================== HELPERS ====================

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function pickRandom<T>(arr: T[], seed?: number): T {
  const idx = seed !== undefined 
    ? Math.abs(seed) % arr.length 
    : Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function getShortTitle(title: string, maxLength: number = 50): string {
  if (title.length <= maxLength) return title;
  
  const words = title.split(' ');
  let result = '';
  
  for (const word of words) {
    if ((result + ' ' + word).length > maxLength - 3) break;
    result = result ? result + ' ' + word : word;
  }
  
  return result + '...';
}

function getCategoryKey(category?: string | null, title?: string): string {
  const text = ((category || '') + ' ' + (title || '')).toLowerCase();
  
  if (text.match(/celular|smartphone|iphone|samsung|galaxy|xiaomi/)) return 'eletronicos';
  if (text.match(/notebook|laptop|computador|pc|macbook/)) return 'eletronicos';
  if (text.match(/tv|televisor|smart tv|oled|qled/)) return 'eletronicos';
  if (text.match(/fone|headphone|earbuds|airpod/)) return 'eletronicos';
  if (text.match(/monitor/)) return 'eletronicos';
  if (text.match(/tênis|tenis|nike|adidas|puma|roupa|camisa|calça/)) return 'moda';
  if (text.match(/air ?fryer|geladeira|microondas|fogão|cozinha|panela/)) return 'casa';
  if (text.match(/playstation|xbox|nintendo|ps5|switch|jogo|game/)) return 'games';
  if (text.match(/perfume|colônia|colonia|malbec|uomini|boticário|boticario/)) return 'perfumes';
  
  return 'geral';
}

// Detecta produtos específicos para usar frases engraçadas
// Prioriza produtos mais específicos primeiro
// IMPORTANTE: Usa Math.random() para escolher ALEATORIAMENTE a cada vez
function getProductSpecificPhrase(title: string, useRandom: boolean = true): string | null {
  const titleLower = title.toLowerCase();
  
  // Detecção especial para relógios (verificar tipo específico primeiro)
  // Relógio masculino
  if (titleLower.match(/relógio masculino|relogio masculino|relógio.*masculino|relogio.*masculino/)) {
    const phrases = PRODUCT_SPECIFIC_PHRASES['relógio masculino'];
    if (phrases && phrases.length > 0) {
      return useRandom 
        ? phrases[Math.floor(Math.random() * phrases.length)]
        : phrases[0];
    }
  }
  // Relógio feminino
  if (titleLower.match(/relógio feminino|relogio feminino|relógio.*feminino|relogio.*feminino/)) {
    const phrases = PRODUCT_SPECIFIC_PHRASES['relógio feminino'];
    if (phrases && phrases.length > 0) {
      return useRandom 
        ? phrases[Math.floor(Math.random() * phrases.length)]
        : phrases[0];
    }
  }
  
  // Detecção especial para jogos de tabuleiro (verificar tipo específico primeiro)
  // Verificar jogos específicos primeiro (War, Banco Imobiliário, Monopoly)
  if (titleLower.includes('war') || titleLower.includes('banco imobiliário') || titleLower.includes('banco imobiliario') || titleLower.includes('monopoly')) {
    const phrases = PRODUCT_SPECIFIC_PHRASES['war'];
    if (phrases && phrases.length > 0) {
      return useRandom 
        ? phrases[Math.floor(Math.random() * phrases.length)]
        : phrases[0];
    }
  }
  
  if (titleLower.includes('jogo') && (titleLower.includes('tabuleiro') || titleLower.includes('tabuleiro'))) {
    // Jogo estratégico (palavras-chave: estratégico, xadrez, damas, war, risk, etc)
    if (titleLower.match(/estratégico|estrategico|xadrez|damas|war|risk|dominion|catan|chess|banco imobiliário|banco imobiliario|monopoly/)) {
      const phrases = PRODUCT_SPECIFIC_PHRASES['jogo estratégico'];
      if (phrases && phrases.length > 0) {
        return useRandom 
          ? phrases[Math.floor(Math.random() * phrases.length)]
          : phrases[0];
      }
    }
    // Jogo família (palavras-chave: família, familiar, kids, criança, infantil)
    if (titleLower.match(/família|familia|familiar|kids|criança|crianca|infantil|party|festa/)) {
      const phrases = PRODUCT_SPECIFIC_PHRASES['jogo família'];
      if (phrases && phrases.length > 0) {
        return useRandom 
          ? phrases[Math.floor(Math.random() * phrases.length)]
          : phrases[0];
      }
    }
    // Jogo em grupo (padrão para jogos de tabuleiro sem especificação)
    const phrases = PRODUCT_SPECIFIC_PHRASES['jogo de tabuleiro'];
    if (phrases && phrases.length > 0) {
      return useRandom 
        ? phrases[Math.floor(Math.random() * phrases.length)]
        : phrases[0];
    }
  }
  
  // Ordem de prioridade: produtos mais específicos primeiro
  // IMPORTANTE: Produtos principais (smartphone, celular) vêm ANTES de acessórios (fone)
  const priorityOrder = [
    // Produtos muito específicos primeiro
    'monitor gamer', 'smart tv', 'air fryer', 'airpods', 'ps5', 'nintendo switch',
    // Perfumes específicos (ANTES de "perfume" genérico)
    'perfume feminino', 'perfume masculino', 'perfume importado',
    'malbec', 'uomini',
    // Smartphones/Celulares específicos (ANTES de "fone" - produto principal vem primeiro)
    'iphone', 'samsung', 'xiaomi', 'poco',
    // Jogos de Tabuleiro (específicos primeiro)
    'war', 'banco imobiliário', 'monopoly',
    'jogo estratégico', 'jogo família', 'jogo familia', 'jogo familiar',
    'jogo de tabuleiro', 'jogo tabuleiro',
    // Joias (específicas primeiro)
    'relógio masculino', 'relogio masculino', 'relógio feminino', 'relogio feminino',
    'corrente masculina', 'corrente', 'brinco', 'brincos', 'colar', 'colares',
    'pulseira', 'pulseiras', 'anel', 'aneis', 'anéis', 'relógio', 'relogio', 'watch',
    // Produtos específicos
    'playstation', 'xbox', 'nintendo',
    'nike', 'adidas',
    // Categorias gerais de produtos principais (ANTES de acessórios)
    'tv', 'televisor', 'monitor', 'celular', 'smartphone', 'notebook', 'laptop',
    // Jogos de Tabuleiro (geral)
    'tabuleiro', 'estratégico',
    // Extensão Elétrica / Régua (produto útil, mas não principal)
    'extensão', 'extensao', 'réguas', 'regua', 'tira',
    // Acessórios (vêm depois dos produtos principais)
    'fone', 'headphone', 'tênis', 'tenis', 'perfume', 'colônia', 'colonia',
    'geladeira', 'microondas', 'camisa', 'calça', 'roupa', 'fritadeira',
  ];
  
  // Verificar produtos na ordem de prioridade
  for (const product of priorityOrder) {
    if (titleLower.includes(product)) {
      const phrases = PRODUCT_SPECIFIC_PHRASES[product];
      if (phrases && phrases.length > 0) {
        // ALEATÓRIO: escolher frase aleatória a cada vez
        if (useRandom) {
          return phrases[Math.floor(Math.random() * phrases.length)];
        } else {
          // Fallback determinístico (para testes)
          const seed = title.length + title.charCodeAt(0);
          return pickRandom(phrases, seed);
        }
      }
    }
  }
  
  // Fallback: verificar todos os produtos (caso algum não esteja na lista de prioridade)
  for (const [product, phrases] of Object.entries(PRODUCT_SPECIFIC_PHRASES)) {
    if (!priorityOrder.includes(product) && titleLower.includes(product)) {
      if (phrases && phrases.length > 0) {
        // ALEATÓRIO: escolher frase aleatória a cada vez
        if (useRandom) {
          return phrases[Math.floor(Math.random() * phrases.length)];
        } else {
          const seed = title.length + title.charCodeAt(0);
          return pickRandom(phrases, seed);
        }
      }
    }
  }
  
  return null;
}

function generateSeed(input: CopyInputData): number {
  // Gera seed baseado no título para consistência
  let hash = 0;
  const str = input.title + input.price;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ==================== COPY GENERATION ====================

/**
 * Gera linha de preço formatada
 */
function generatePriceLine(input: CopyInputData, seed: number): string {
  // VALIDAÇÃO: Garantir que temos preço
  if (!input.price || input.price <= 0) {
    console.warn('[generatePriceLine] Preço inválido, usando fallback');
    return 'PREÇO NÃO DISPONÍVEL';
  }
  
  const priceNow = formatPrice(input.price);
  
  if (input.oldPrice && input.oldPrice > input.price) {
    const priceOld = formatPrice(input.oldPrice);
    const template = pickRandom(PRICE_TEMPLATES, seed);
    const result = template(priceOld, priceNow);
    // VALIDAÇÃO: Garantir que retornou algo
    if (result && result.trim().length > 0) {
      return result;
    }
  }
  
  const template = pickRandom(PRICE_TEMPLATES_NO_OLD, seed);
  const result = template(priceNow);
  // VALIDAÇÃO: Garantir que retornou algo
  if (result && result.trim().length > 0) {
    return result;
  }
  
  // Fallback absoluto
  return `POR ${priceNow}`;
}

/**
 * Gera abertura baseada na categoria e produto (com humor jovem)
 * OBRIGATÓRIO: Sempre usa frases personalizadas quando disponíveis
 * ALEATÓRIO: Escolhe frase aleatória a cada chamada
 * @param channelSeedOffset - Offset adicional para variar por canal (0, 1000, 2000)
 */
function generateOpening(input: CopyInputData, seed: number, channelSeedOffset: number = 0): string {
  // OBRIGATÓRIO: Primeiro, verificar se tem frase específica do produto
  // Se encontrar, SEMPRE usar (não é opcional) - ALEATORIAMENTE
  const productPhrase = getProductSpecificPhrase(input.title, true); // true = usar Math.random()
  if (productPhrase) {
    // Garantir que está em MAIÚSCULAS, mas PRESERVAR EMOJIS
    // Emojis não são afetados por toUpperCase(), mas vamos garantir que estão preservados
    return productPhrase.toUpperCase();
  }
  
  // Se não encontrou frase específica, usar categoria ou geral
  const categoryKey = getCategoryKey(input.category, input.title);
  const combinedSeed = seed + channelSeedOffset;
  
  if (OPENINGS_BY_CATEGORY[categoryKey]) {
    // 80% chance de usar abertura específica da categoria
    if (combinedSeed % 10 < 8) {
      const phrase = pickRandom(OPENINGS_BY_CATEGORY[categoryKey], combinedSeed);
      if (phrase && phrase.trim().length > 0) {
        return phrase.toUpperCase();
      }
    }
  }
  
  const phrase = pickRandom(OPENINGS_ENGRAÇADOS, combinedSeed);
  // VALIDAÇÃO: Garantir que sempre retorna uma frase
  if (phrase && phrase.trim().length > 0) {
    return phrase.toUpperCase();
  }
  
  // Fallback absoluto
  return 'ACHADO NÃO É ROUBADO';
}

/**
 * Retorna emoji baseado no desconto e produto
 */
function getDiscountEmoji(discountPct: number, title: string): string {
  // 🔥 para descontos altos (20% ou mais) - sempre usar
  if (discountPct >= 20) {
    return '🔥';
  }
  // Para descontos menores, não usar emoji
  return '';
}

/**
 * Gera copy para Telegram (≤ 350 caracteres) - TUDO EM MAIÚSCULAS + EMOJIS
 */
function generateTelegramCopy(input: CopyInputData, seed: number): string {
  // VALIDAÇÃO: Garantir que temos dados mínimos
  if (!input.title || !input.price || !input.trackingUrl) {
    console.error('[generateTelegramCopy] Dados inválidos:', { 
      hasTitle: !!input.title, 
      hasPrice: !!input.price, 
      hasTrackingUrl: !!input.trackingUrl 
    });
    // Fallback mínimo no formato correto (link PRIMEIRO)
    const fallbackPrice = formatPrice(input.price || 0);
    const fallbackTitle = (input.title || 'PRODUTO').toUpperCase();
    const trackingUrl = (input.trackingUrl || '').toLowerCase(); // Link sempre em minúsculas
    
    // Link PRIMEIRO (garante preview do Telegram)
    let fallbackText = `${trackingUrl}\n\nACHADO NÃO É ROUBADO\nPOR ${fallbackPrice}`;
    if (input.discountPct && input.discountPct >= 20) {
      fallbackText += ` 🔥 (-${Math.round(input.discountPct)}% OFF)`;
    }
    fallbackText += `\n\n${fallbackTitle}`;
    return fallbackText.toUpperCase();
  }
  
  const opening = generateOpening(input, seed, 0); // Canal Telegram: offset 0
  const priceLine = generatePriceLine(input, seed + 1);
  const discountEmoji = getDiscountEmoji(input.discountPct, input.title);
  
  // LOG: Verificar o que foi gerado
  console.log('[generateTelegramCopy] Verificando conteúdo gerado:');
  console.log('  - Opening:', opening ? opening.substring(0, 50) : 'VAZIO');
  console.log('  - PriceLine:', priceLine ? priceLine.substring(0, 50) : 'VAZIO');
  
  // VALIDAÇÃO: Garantir que opening e priceLine não estão vazios
  if (!opening || opening.trim().length === 0) {
    console.warn('[generateTelegramCopy] Opening vazio, usando fallback');
    const fallbackOpening = pickRandom(OPENINGS_ENGRAÇADOS, seed);
    const finalOpening = fallbackOpening || 'ACHADO NÃO É ROUBADO';
    const finalPriceLine = priceLine || generatePriceLine(input, seed + 1);
    
    // Conteúdo PRIMEIRO, link DEPOIS - sempre em minúsculas
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    let text = `${finalOpening}\n`;
    
    if (input.discountPct > 0) {
      const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20 && discountEmoji) {
        text += `${finalPriceLine} ${discountEmoji} ${discountText}`;
      } else {
        text += `${finalPriceLine} ${discountText}`;
      }
    } else {
      text += finalPriceLine;
    }
    
    const shortTitle = getShortTitle(input.title, 50).toUpperCase();
    const textWithTitle = text + `\n\n${shortTitle}`;
    if (textWithTitle.length <= CHAR_LIMITS.TELEGRAM) {
      text = textWithTitle;
    }
    
    // ADICIONAR LINK NO FINAL
    text = text + `\n\n${normalizedUrl}`;
    
    return text.toUpperCase();
  }
  
  if (!priceLine || priceLine.trim().length === 0) {
    console.warn('[generateTelegramCopy] PriceLine vazio, gerando novamente');
    const finalPriceLine = generatePriceLine(input, seed + 1);
    
    // Link PRIMEIRO (garante preview do Telegram) - sempre em minúsculas
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    let text = `${normalizedUrl}\n\n${opening}\n`;
    
    if (input.discountPct > 0) {
      const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20 && discountEmoji) {
        text += `${finalPriceLine} ${discountEmoji} ${discountText}`;
      } else {
        text += `${finalPriceLine} ${discountText}`;
      }
    } else {
      text += finalPriceLine;
    }
    
    const shortTitle = getShortTitle(input.title, 50).toUpperCase();
    const textWithTitle = text + `\n\n${shortTitle}`;
    if (textWithTitle.length <= CHAR_LIMITS.TELEGRAM) {
      text = textWithTitle;
    }
    
    // ADICIONAR LINK NO FINAL
    text = text + `\n\n${normalizedUrl}`;
    
    return text.toUpperCase();
  }
  
  // Montar texto no formato que garante preview do Telegram:
  // MUDANÇA: Conteúdo PRIMEIRO, link DEPOIS (para texto aparecer antes do preview)
  // 1. Frase de abertura (com emoji se tiver)
  // 2. Linha de preço: "SAIU DE R$ X PRA R$ Y 🔥 (-X% OFF)"
  // 3. Título do produto
  // 4. Link (DEPOIS - Telegram ainda gera preview mesmo no final)
  
  // IMPORTANTE: Link sempre em minúsculas (URLs devem ser minúsculas)
  const normalizedUrl = input.trackingUrl.toLowerCase();
  
  // VALIDAÇÃO CRÍTICA: Garantir que opening e priceLine existem ANTES de construir
  const finalOpening = (opening && opening.trim().length > 0) ? opening : 'ACHADO NÃO É ROUBADO';
  const finalPriceLine = (priceLine && priceLine.trim().length > 0) ? priceLine : `POR ${formatPrice(input.price)}`;
  
  // LOG: Verificar valores antes de construir
  console.log('[generateTelegramCopy] Valores antes de construir texto:');
  console.log('  - finalOpening:', finalOpening);
  console.log('  - finalOpening tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑/u.test(finalOpening));
  console.log('  - finalPriceLine:', finalPriceLine);
  console.log('  - discountPct:', input.discountPct);
  console.log('  - discountEmoji:', discountEmoji);
  
  // Construir texto COMPLETO de uma vez - CONTEÚDO PRIMEIRO, link DEPOIS
  // GARANTIR que o opening tem emoji (se a frase específica não tiver, adicionar)
  let openingWithEmoji = finalOpening;
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑|💎|⭐|💰|💵|🍎|🌟|💪|⚡/u.test(finalOpening);
  if (!hasEmoji) {
    // SEMPRE adicionar emoji na frase de abertura (mesmo sem desconto alto)
    // Se tiver desconto alto, usar 🔥, senão usar outro emoji
    if (input.discountPct >= 20) {
      openingWithEmoji = `${finalOpening} 🔥`;
    } else {
      openingWithEmoji = `${finalOpening} 🔥`; // Sempre usar 🔥 para destacar
    }
  }
  
  let text = `${openingWithEmoji}\n`;
  
  // Linha de preço com emoji ANTES do desconto (formato da imagem)
  if (input.discountPct > 0) {
    const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
    // Adicionar 🔥 ANTES do desconto se >= 20%
    if (input.discountPct >= 20 && discountEmoji) {
      text += `${finalPriceLine} ${discountEmoji} ${discountText}`;
    } else {
      text += `${finalPriceLine} ${discountText}`;
    }
  } else {
    text += finalPriceLine;
  }
  
  // LOG: Verificar texto após adicionar preço
  console.log('[generateTelegramCopy] Texto após adicionar preço:', text.substring(0, 200));
  console.log('[generateTelegramCopy] Tamanho após preço:', text.length);
  
  // Adicionar título do produto (sempre, se couber)
  const shortTitle = getShortTitle(input.title, 50).toUpperCase();
  const textWithTitle = text + `\n\n${shortTitle}`;
  if (textWithTitle.length <= CHAR_LIMITS.TELEGRAM) {
    text = textWithTitle;
  }
  
  // ADICIONAR LINK NO FINAL (depois do conteúdo)
  text = text + `\n\n${normalizedUrl}`;
  
  // LOG: Verificar o texto antes de processar
  console.log('[generateTelegramCopy] 📝 Texto ANTES de processar:');
  console.log('[generateTelegramCopy] Tamanho:', text.length);
  console.log('[generateTelegramCopy] Conteúdo completo:', JSON.stringify(text));
  console.log('[generateTelegramCopy] Linhas totais:', text.split('\n').length);
  console.log('[generateTelegramCopy] Linhas não vazias:', text.split('\n').filter(l => l.trim().length > 0).length);
  
  // VALIDAÇÃO CRÍTICA: Garantir que há conteúdo além do link ANTES de processar
  const textLines = text.split('\n').filter(line => line.trim().length > 0);
  console.log('[generateTelegramCopy] TextLines:', textLines.length, 'linhas');
  console.log('[generateTelegramCopy] Primeira linha (conteúdo):', textLines[0]?.substring(0, 50));
  console.log('[generateTelegramCopy] Última linha (link):', textLines[textLines.length - 1]?.substring(0, 50));
  console.log('[generateTelegramCopy] Resto das linhas:', textLines.slice(1).join(' | ').substring(0, 200));
  
  if (textLines.length <= 1) {
    console.error('[generateTelegramCopy] ❌ ERRO CRÍTICO: Texto contém apenas o link!');
    console.error('[generateTelegramCopy] Texto atual completo:', JSON.stringify(text));
    console.error('[generateTelegramCopy] finalOpening:', finalOpening);
    console.error('[generateTelegramCopy] finalPriceLine:', finalPriceLine);
    console.error('[generateTelegramCopy] shortTitle:', shortTitle);
    
    // Reconstruir com conteúdo garantido - FORÇAR conteúdo (conteúdo PRIMEIRO, link DEPOIS)
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    let reconstructedText = `${finalOpening}\n`;
    
    if (input.discountPct > 0) {
      const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20 && discountEmoji) {
        reconstructedText += `${finalPriceLine} ${discountEmoji} ${discountText}`;
      } else {
        reconstructedText += `${finalPriceLine} ${discountText}`;
      }
    } else {
      reconstructedText += finalPriceLine;
    }
    
    reconstructedText += `\n\n${shortTitle}`;
    
    // ADICIONAR LINK NO FINAL
    reconstructedText += `\n\n${normalizedUrl}`;
    
    text = reconstructedText;
    console.log('[generateTelegramCopy] ✅ Texto FORÇADO reconstruído:');
    console.log('[generateTelegramCopy] Novo texto:', JSON.stringify(text));
    console.log('[generateTelegramCopy] Novo tamanho:', text.length);
    console.log('[generateTelegramCopy] Novas linhas não vazias:', text.split('\n').filter(l => l.trim().length > 0).length);
  }
  
  // VALIDAÇÃO FINAL ABSOLUTA: Verificar se o texto tem conteúdo além do link ANTES de processar
  const textBeforeProcessing = text;
  const linesBeforeProcessing = textBeforeProcessing.split('\n').filter(line => line.trim().length > 0);
  
  console.log('[generateTelegramCopy] 🔍 VALIDAÇÃO FINAL antes de processar:');
  console.log('[generateTelegramCopy] Texto completo:', JSON.stringify(textBeforeProcessing));
  console.log('[generateTelegramCopy] Linhas não vazias:', linesBeforeProcessing.length);
  console.log('[generateTelegramCopy] Primeira linha (conteúdo):', linesBeforeProcessing[0]?.substring(0, 80));
  console.log('[generateTelegramCopy] Última linha (deve ser link):', linesBeforeProcessing[linesBeforeProcessing.length - 1]?.substring(0, 80));
  console.log('[generateTelegramCopy] Resto das linhas:', linesBeforeProcessing.slice(1).join(' | '));
  
  // Se tiver apenas 1 linha (apenas o link), FORÇAR adição de conteúdo
  if (linesBeforeProcessing.length <= 1) {
    console.error('[generateTelegramCopy] ❌❌❌ ERRO CRÍTICO: Texto tem apenas o link antes de processar!');
    console.error('[generateTelegramCopy] Texto atual:', JSON.stringify(textBeforeProcessing));
    
    // FORÇAR reconstrução com conteúdo garantido (conteúdo PRIMEIRO, link DEPOIS)
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    const guaranteedOpening = finalOpening || 'ACHADO NÃO É ROUBADO';
    const guaranteedPrice = finalPriceLine || `POR ${formatPrice(input.price)}`;
    const guaranteedTitle = shortTitle || input.title.toUpperCase().substring(0, 50);
    
    let forcedText = `${guaranteedOpening}\n`;
    
    if (input.discountPct > 0) {
      const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20) {
        forcedText += `${guaranteedPrice} 🔥 ${discountText}`;
      } else {
        forcedText += `${guaranteedPrice} ${discountText}`;
      }
    } else {
      forcedText += guaranteedPrice;
    }
    
    forcedText += `\n\n${guaranteedTitle}`;
    
    // ADICIONAR LINK NO FINAL
    forcedText += `\n\n${normalizedUrl}`;
    
    text = forcedText;
    console.log('[generateTelegramCopy] ✅✅✅ Texto FORÇADO reconstruído:', JSON.stringify(text));
  }
  
  // LOG CRÍTICO: Verificar o texto ANTES de processar
  console.log('[generateTelegramCopy] 🔍 ANTES DE PROCESSAR:');
  console.log('[generateTelegramCopy] Texto completo:', JSON.stringify(text));
  console.log('[generateTelegramCopy] Tamanho:', text.length);
  console.log('[generateTelegramCopy] Todas as linhas:', text.split('\n').map((l, i) => `[${i}]: ${l.substring(0, 60)}`));
  
  // MUDANÇA: Texto PRIMEIRO, link DEPOIS (para aparecer antes do preview)
  // O Telegram ainda gera o preview mesmo com o link no final
  const lines = text.split('\n');
  const link = lines[lines.length - 1]?.trim() || ''; // Última linha é o link (já está em minúsculas)
  const contentLines = lines.slice(0, -1).filter(line => line.trim().length > 0); // Todas as linhas exceto a última (link)
  
  // Converter para maiúsculas PRESERVANDO EMOJIS
  // toUpperCase() não afeta emojis, mas vamos garantir que estão preservados
  const content = contentLines.map(line => {
    // Separar texto de emojis (emojis são preservados automaticamente)
    return line.toUpperCase();
  }).join('\n');
  
  // Formato final: conteúdo PRIMEIRO, link DEPOIS
  // Isso faz o texto aparecer ANTES do preview do link
  
  console.log('[generateTelegramCopy] 🔍 APÓS PROCESSAR:');
  console.log('[generateTelegramCopy] Link extraído:', link.substring(0, 80));
  console.log('[generateTelegramCopy] Linhas de conteúdo:', contentLines.length);
  console.log('[generateTelegramCopy] Conteúdo extraído:', JSON.stringify(content.substring(0, 300)));
  
  // VALIDAÇÃO CRÍTICA: Se não houver conteúdo além do link, usar fallback
  if (!content || content.trim().length === 0) {
    console.error('[generateTelegramCopy] ❌❌❌ ERRO CRÍTICO: Conteúdo está vazio após processamento!');
    console.error('[generateTelegramCopy] Texto original completo:', JSON.stringify(text));
    console.error('[generateTelegramCopy] Total de linhas:', lines.length);
    console.error('[generateTelegramCopy] Linhas de conteúdo encontradas:', contentLines.length);
    console.error('[generateTelegramCopy] Todas as linhas originais:', lines.map((l, i) => `[${i}]: "${l}"`));
    
    // Fallback completo com conteúdo garantido (conteúdo PRIMEIRO, link DEPOIS)
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    const fallbackContent = `ACHADO NÃO É ROUBADO 🔥\n\n${input.title.toUpperCase()}\nPOR ${formatPrice(input.price)}`;
    const fallbackText = `${fallbackContent}\n\n${normalizedUrl}`;
    console.log('[generateTelegramCopy] ✅✅✅ Retornando FALLBACK completo:', JSON.stringify(fallbackText));
    return fallbackText;
  }
  
  // INVERTER ORDEM: Conteúdo PRIMEIRO, link DEPOIS
  // Isso faz o texto aparecer ANTES do preview do Telegram
  let finalText = content + '\n\n' + link;

  // Adicionar link do site vitrine separado do link de afiliado
  if (input.siteUrl) {
    finalText += `\n\n🌐 ${input.siteUrl}`;
  }
  
  // LOG: Verificar o que está sendo gerado
  console.log('[generateTelegramCopy] ✅ Texto gerado com sucesso');
  console.log('[generateTelegramCopy] Link:', link.substring(0, 50));
  console.log('[generateTelegramCopy] Conteúdo (primeiros 200 chars):', content.substring(0, 200));
  console.log('[generateTelegramCopy] Conteúdo tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑/u.test(content));
  console.log('[generateTelegramCopy] Tamanho total:', finalText.length, 'caracteres');
  console.log('[generateTelegramCopy] Texto final tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑/u.test(finalText));
  
  // Truncar se necessário (mas manter link no final e NUNCA truncar a frase de abertura)
  if (finalText.length > CHAR_LIMITS.TELEGRAM) {
    const linkPart = '\n\n' + link; // Link + quebras de linha
    const maxContentLength = CHAR_LIMITS.TELEGRAM - linkPart.length - 3;
    
    // IMPORTANTE: Preservar a primeira linha (frase de abertura) e truncar apenas o resto
    const contentLines = content.split('\n');
    const openingLine = contentLines[0] || ''; // Primeira linha (frase de abertura)
    const restOfContent = contentLines.slice(1).join('\n'); // Resto do conteúdo
    
    // Calcular quanto espaço sobra para o resto (preservando abertura)
    const openingWithNewline = openingLine + '\n';
    const maxRestLength = maxContentLength - openingWithNewline.length;
    
    if (maxRestLength > 0 && restOfContent.length > maxRestLength) {
      // Truncar apenas o resto, mantendo abertura completa
      const truncatedRest = restOfContent.substring(0, maxRestLength - 3) + '...';
      finalText = openingWithNewline + truncatedRest + linkPart;
    } else {
      // Se couber tudo, usar conteúdo completo
      finalText = content + linkPart;
    }
    
    console.warn('[generateTelegramCopy] ⚠️ Texto truncado para', finalText.length, 'caracteres');
    console.warn('[generateTelegramCopy] Frase de abertura preservada:', openingLine);
    console.warn('[generateTelegramCopy] Conteúdo truncado:', finalText.substring(0, 150));
  }
  
  // VALIDAÇÃO ABSOLUTA: Se ainda estiver vazio, retornar fallback
  if (!finalText || finalText.trim().length < 10) {
    console.error('[generateTelegramCopy] ❌ Texto final ainda vazio após todas as validações!');
    // Conteúdo PRIMEIRO, link DEPOIS no fallback
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    return `ACHADO NÃO É ROUBADO 🔥\n\n${input.title.toUpperCase()}\nPOR ${formatPrice(input.price)}\n\n${normalizedUrl}`;
  }
  
  // VALIDAÇÃO FINAL ABSOLUTA: Verificar se o texto final tem apenas o link
  const finalLines = finalText.split('\n').filter(line => line.trim().length > 0);
  if (finalLines.length <= 1 || finalText.trim() === input.trackingUrl) {
    console.error('[generateTelegramCopy] ❌❌❌ ERRO EXTREMO: Texto final contém apenas o link!');
    console.error('[generateTelegramCopy] finalText:', JSON.stringify(finalText));
    console.error('[generateTelegramCopy] finalLines:', finalLines.length);
    
    // ÚLTIMO RECURSO: Forçar texto mínimo (conteúdo PRIMEIRO, link DEPOIS)
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    const minTitle = input.title.toUpperCase().substring(0, 40);
    const minPrice = formatPrice(input.price).toUpperCase();
    
    let forcedMinText = `ACHADO NÃO É ROUBADO 🔥\n\n${minTitle}\nPOR ${minPrice}`;
    
    if (input.discountPct > 0) {
      forcedMinText += ` (-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20) {
        forcedMinText = forcedMinText.replace('POR', 'POR').replace('(-', '🔥 (-');
      }
    }
    
    forcedMinText += `\n\n${normalizedUrl}`;
    
    console.log('[generateTelegramCopy] ✅✅✅ Retornando texto MÍNIMO forçado:', JSON.stringify(forcedMinText));
    return forcedMinText;
  }
  
  console.log('[generateTelegramCopy] ✅✅✅ Texto final validado e pronto:', finalText.substring(0, 200));
  return finalText;
}

/**
 * Gera copy para Site (≤ 600 caracteres) - TUDO EM MAIÚSCULAS + EMOJIS
 */
function generateSiteCopy(input: CopyInputData, seed: number): string {
  const opening = generateOpening(input, seed, 1000); // Canal Site: offset 1000
  const priceLine = generatePriceLine(input, seed + 1);
  const shortTitle = getShortTitle(input.title, 80).toUpperCase();
  const discountEmoji = getDiscountEmoji(input.discountPct, input.title);
  
  // Site pode ter mais contexto
  let text = `${opening}\n\n${shortTitle}\n\n${priceLine}`;
  
  // SEMPRE destacar desconto quando houver
  if (input.discountPct > 0) {
    const discountText = ` (-${Math.round(input.discountPct)}% OFF)`;
    // Adicionar 🔥 se desconto >= 20%
    if (input.discountPct >= 20 && discountEmoji) {
      text += ` ${discountEmoji}${discountText}`;
    } else {
      text += discountText;
    }
  }
  
  // Adicionar loja se conhecida
  const storeName = input.storeName || input.advertiserName;
  if (storeName && text.length + storeName.length + 15 <= CHAR_LIMITS.SITE) {
    text += `\n\nNA ${storeName.toUpperCase()}`;
  }
  
  // Truncar se necessário
  if (text.length > CHAR_LIMITS.SITE) {
    text = text.substring(0, CHAR_LIMITS.SITE - 3) + '...';
  }
  
  // Garantir que está tudo em MAIÚSCULAS (exceto emojis)
  return text.toUpperCase();
}

/**
 * Gera copy para X/Twitter no formato estruturado por linhas.
 * Mistura 3 tipos de ganchos: urgência, surpresa e curiosidade.
 *
 *  🔥 ALERTA DE PROMOÇÃO          ← gancho (linha 1)
 *
 *  Nome do Produto                ← linha 2
 *
 *  De R$ XX,XX                    ← linha 3
 *  por R$ YY,YY                   ← linha 4
 *
 *  🔥 -35% OFF                    ← linha 5 (desconto)
 *
 *  👉 aproveitar oferta           ← linha 6 (CTA — sempre em linha própria)
 *
 *  https://link-afiliado
 *  🌐 https://link-site
 */
function generateXCopy(input: CopyInputData, seed: number): string {
  const priceNow = formatPrice(input.price);
  const discountPct = Math.round(input.discountPct || (
    input.oldPrice && input.oldPrice > input.price
      ? ((input.oldPrice - input.price) / input.oldPrice * 100)
      : 0
  ));

  // ── Escolher gancho com aleatoriedade real ──
  // Usamos Math.random() em vez da seed determinística para garantir que
  // posts consecutivos NUNCA repitam o mesmo gancho ou frase.
  let hook: string;
  let subtitle: string;

  // Para descontos altos (≥30%) forçar categoria surpresa (mais impacto);
  // caso contrário, sortear entre as 3 categorias de forma aleatória.
  const hookType = discountPct >= 30 ? 1 : Math.floor(Math.random() * 3);

  if (hookType === 0) {
    hook     = X_HOOKS_URGENCIA[Math.floor(Math.random() * X_HOOKS_URGENCIA.length)];
    subtitle = X_SUBTITLES_URGENCIA[Math.floor(Math.random() * X_SUBTITLES_URGENCIA.length)];
  } else if (hookType === 1) {
    hook     = X_HOOKS_SURPRESA[Math.floor(Math.random() * X_HOOKS_SURPRESA.length)];
    subtitle = X_SUBTITLES_SURPRESA[Math.floor(Math.random() * X_SUBTITLES_SURPRESA.length)];
  } else {
    hook     = X_HOOKS_CURIOSIDADE[Math.floor(Math.random() * X_HOOKS_CURIOSIDADE.length)];
    subtitle = X_SUBTITLES_CURIOSIDADE[Math.floor(Math.random() * X_SUBTITLES_CURIOSIDADE.length)];
  }

  // ── Escolher CTA também de forma aleatória ──
  const cta = X_CTAS[Math.floor(Math.random() * X_CTAS.length)];

  // ── Nome curto do produto ──
  const shortTitle = getShortTitle(input.title, 40);

  // ── Bloco de preço ──
  const priceBlock: string[] = [];
  if (input.oldPrice && input.oldPrice > input.price) {
    priceBlock.push(`De ${formatPrice(input.oldPrice)}`);
    priceBlock.push(`por ${priceNow}`);
  } else {
    priceBlock.push(`por ${priceNow}`);
  }

  // ── Linha de desconto ──
  const discountLine = discountPct > 0
    ? `${discountPct >= 30 ? '🔥' : '💰'} -${discountPct}% OFF`
    : '';

  // ── Montar post linha a linha ──
  // Estrutura:
  //   🔥 GANCHO            ← linha 1 (hook)
  //   Frase complementar   ← linha 2 (subtitle — sem linha em branco entre hook e subtitle)
  //                        ← linha em branco
  //   Nome do Produto
  //                        ← linha em branco
  //   De R$ XX,XX
  //   por R$ YY,YY
  //                        ← linha em branco
  //   🔥 -35% OFF          ← desconto em linha própria
  //                        ← linha em branco
  //   👉 aproveitar oferta ← CTA em linha própria
  const lines: string[] = [
    hook,
    subtitle,   // frase complementar colada ao gancho (sem linha em branco)
    '',
    shortTitle,
    '',
    ...priceBlock,
  ];

  if (discountLine) {
    lines.push('');
    lines.push(discountLine);  // desconto em linha própria
  }

  lines.push('');
  lines.push(cta);             // CTA sempre em linha própria, separado do desconto

  let finalText = lines.join('\n') + `\n\n${input.trackingUrl}`;
  if (input.siteUrl) {
    finalText += `\n🌐 ${input.siteUrl}`;
  }

  console.log('[generateXCopy] Gancho:', hook, '| Subtitle:', subtitle, '| Tipo:', ['urgência', 'surpresa', 'curiosidade'][hookType] ?? 'surpresa(alto desconto)');
  console.log('[generateXCopy] Texto final:', finalText.substring(0, 250));
  return finalText;
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Gera copies para todos os canais
 * 
 * Regras obrigatórias:
 * - Tom engraçado para jovens 16-25 anos
 * - Referências à cultura jovem quando aplicável
 * - Frases pequenas e chamativas
 * - SEMPRE destacar desconto quando houver
 * - TODAS as frases em MAIÚSCULAS
 * - Sempre mencionar preço
 * - Não prometer estoque
 * - Não inventar urgência falsa
 */
export function generateCopies(
  input: CopyInputData,
  options?: CopyGeneratorOptions
): GeneratedCopies {
  const baseSeed = generateSeed(input);
  const generateVariations = options?.generateVariations ?? false;
  
  // Usar seeds diferentes para cada canal para garantir frases diferentes
  // Telegram: seed base
  // Site: seed + 1000 (mudança significativa)
  // X: seed + 2000 (mudança significativa)
  const telegramSeed = baseSeed;
  const siteSeed = baseSeed + 1000;
  const xSeed = baseSeed + 2000;
  
  // Gerar copy principal com seeds diferentes
  const telegram = generateTelegramCopy(input, telegramSeed);
  const site = generateSiteCopy(input, siteSeed);
  const x = generateXCopy(input, xSeed);
  
  const result: GeneratedCopies = { telegram, site, x };
  
  // Gerar variações se solicitado
  if (generateVariations) {
    result.variations = {
      telegram: [
        generateTelegramCopy(input, telegramSeed + 100),
        generateTelegramCopy(input, telegramSeed + 200),
      ],
      site: [
        generateSiteCopy(input, siteSeed + 100),
        generateSiteCopy(input, siteSeed + 200),
      ],
      x: [
        generateXCopy(input, xSeed + 100),
        generateXCopy(input, xSeed + 200),
      ],
    };
  }
  
  return result;
}

/**
 * Valida se copy está dentro dos limites do canal
 */
export function validateCopy(
  text: string,
  channel: 'TELEGRAM' | 'SITE' | 'X'
): { valid: boolean; length: number; limit: number; overflow: number } {
  const limit = CHAR_LIMITS[channel];
  const length = text.length;
  
  return {
    valid: length <= limit,
    length,
    limit,
    overflow: Math.max(0, length - limit),
  };
}

/**
 * Prepara dados limpos para enviar à IA (se usar IA externa)
 * 
 * Importante: Este JSON NÃO contém tokens nem URLs de API.
 */
export function prepareDataForAI(input: CopyInputData): Record<string, unknown> {
  return {
    title: input.title,
    price: input.price,
    oldPrice: input.oldPrice || null,
    discountPct: Math.round(input.discountPct),
    advertiserName: input.advertiserName || null,
    category: input.category || null,
    trackingUrl: input.trackingUrl,
    // NÃO incluir: tokens, secrets, API keys, etc.
  };
}

/**
 * Formata prompt para IA externa (OpenAI, etc.)
 */
export function generateAIPrompt(input: CopyInputData): string {
  const data = prepareDataForAI(input);
  
  return `Você é um copywriter de promoções brasileiro.

Gere textos de marketing para esta oferta:
${JSON.stringify(data, null, 2)}

REGRAS OBRIGATÓRIAS:
1. Sempre mencionar preço atual e % de desconto
2. NÃO prometer estoque ("enquanto durar" etc.)
3. NÃO inventar urgência falsa ("CORRE", "ÚLTIMAS HORAS")
4. CTA simples: "Ver oferta" ou "Aproveitar"
5. Tom casual, como amigo avisando sobre promoção
6. Máximo 1 emoji por texto (ou nenhum)

GERAR:
1. copyTelegram: ≤ 350 caracteres, 2-3 linhas + link no final
2. copySite: ≤ 600 caracteres, pode ter mais contexto
3. copyX: ≤ 240 caracteres, bem curto, direto ao ponto

Responda em JSON:
{
  "copyTelegram": "...",
  "copySite": "...",
  "copyX": "..."
}`;
}

// ==================== EXPORTS ====================

export default {
  generateCopies,
  validateCopy,
  prepareDataForAI,
  generateAIPrompt,
  CHAR_LIMITS,
};
