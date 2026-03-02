/**
 * Serviço de detecção automática de nicho por título de produto.
 * Palavras-chave extensas para minimizar produtos sem nicho detectado.
 */
import { prisma } from '../lib/prisma.js';

export const NICHE_KEYWORDS: Record<string, string[]> = {

  // ─── ELETRÔNICOS ────────────────────────────────────────────────────────────
  eletronicos: [
    // Celulares e smartphones
    'celular', 'smartphone', 'iphone', 'galaxy', 'moto g', 'redmi', 'xiaomi',
    'motorola', 'samsung galaxy', 'poco', 'realme', 'oneplus', 'nokia',
    'telefone', 'aparelho celular',
    // Computadores e periféricos
    'notebook', 'laptop', 'ultrabook', 'macbook', 'chromebook', 'netbook',
    'computador', 'pc ', 'desktop', 'all in one', 'mini pc',
    'monitor', 'tela ', 'display', 'monitor gamer', 'monitor curvo',
    'teclado', 'mouse ', 'mousepad', 'webcam', 'hub usb', 'hub-usb',
    'placa de vídeo', 'placa de video', 'gpu ', 'processador', 'cpu ',
    'memória ram', 'memoria ram', 'ssd ', 'hd externo', 'pendrive',
    'fonte de alimentação', 'gabinete pc', 'cooler pc', 'water cooler',
    // Tablets e leitores
    'tablet', 'ipad', 'kindle', 'e-reader', 'leitor digital',
    // TV e vídeo
    'tv ', 'televisão', 'televisor', 'smart tv', 'qled', 'oled', 'led tv',
    'projetor', 'retroprojetor', 'mini projetor', 'chromecast', 'fire stick',
    // Áudio
    'fone de ouvido', 'headphone', 'headset', 'earphone', 'airpods',
    'caixa de som', 'caixinha de som', 'soundbar', 'home theater',
    'speaker bluetooth', 'caixa bluetooth', 'som portátil',
    // Foto e vídeo
    'câmera', 'camera ', 'câmera fotográfica', 'câmera digital', 'dslr',
    'mirrorless', 'câmera de ação', 'gopro', 'drone ', 'gimbal', 'lente ',
    'tripé', 'flash câmera', 'estabilizador câmera',
    // Acessórios e redes
    'roteador', 'wi-fi', 'wifi ', 'modem', 'switch de rede', 'extensor wi-fi',
    'carregador ', 'cabo usb', 'cabo hdmi', 'adaptador ', 'conversor ',
    'bateria portátil', 'powerbank', 'power bank',
    'smartwatch', 'relógio inteligente', 'banda fitness', 'mi band',
    'leitor de cartão', 'cartão de memória', 'memória sd',
    // Automação e outros
    'impressora', 'multifuncional', 'scanner', 'projeção',
    'fritadeira elétrica', 'air fryer', 'cafeteira', 'chaleira elétrica',
    'robô aspirador', 'aspirador robô',
  ],

  // ─── GAMES ──────────────────────────────────────────────────────────────────
  games: [
    'game ', 'games ', 'jogo ', 'jogos ', 'videogame', 'video game',
    'playstation', 'ps4 ', 'ps5 ', 'xbox ', 'nintendo', 'switch ',
    'controle gamer', 'controle playstation', 'controle xbox', 'controle sem fio',
    'joystick', 'gamepad', 'gamer ',
    'headset gamer', 'cadeira gamer', 'rgb gamer', 'pc gamer', 'setup gamer',
    'teclado gamer', 'mouse gamer', 'monitor gamer', 'placa de captura',
    'jogo de tabuleiro', 'card game', 'jogo de cartas',
    'action figure', 'funko pop', 'boneco action', 'figura de ação',
    'lego ', 'quebra-cabeça', 'quebra cabeça', 'puzzle',
  ],

  // ─── CASA E MÓVEIS ───────────────────────────────────────────────────────────
  casa: [
    // Móveis
    'sofá', 'sofa ', 'poltrona', 'puff ', 'ottomano',
    'mesa de jantar', 'mesa de centro', 'mesa de escritório', 'mesa lateral',
    'cadeira ', 'cadeiras ', 'banco ', 'banqueta ', 'banquinho',
    'armário', 'guarda-roupa', 'guarda roupa', 'closet ', 'roupeiro',
    'estante ', 'prateleira ', 'rack tv', 'rack para tv', 'painel tv',
    'cama ', 'beliche', 'cama box', 'cama solteiro', 'cama casal', 'berço',
    'colchão', 'colchonete', 'base cama',
    // Cama, mesa e banho
    'travesseiro', 'almofada', 'cobertor', 'lençol', 'edredom', 'fronha',
    'toalha ', 'jogo de cama', 'jogo de banho', 'kit cama',
    'tapete ', 'passadeira ', 'tapete de banheiro',
    // Decoração
    'quadro ', 'quadros ', 'decorativo', 'decoração', 'decorativos',
    'espelho ', 'porta-retrato', 'porta retrato', 'luminária', 'abajur',
    'vaso decorativo', 'velas aromáticas', 'difusor de ambiente',
    'cortina ', 'persiana ', 'trilho para cortina',
    'relógio de parede', 'relógio de mesa',
    // Cozinha e utilidades
    'panela ', 'panelas ', 'conjunto de panelas', 'kit panelas',
    'frigideira ', 'wok ', 'caçarola ', 'assadeira ', 'forma de bolo',
    'chaleira ', 'bule ', 'xícara', 'caneca ', 'copo ', 'taça',
    'prato ', 'pratos ', 'travessa ', 'saladeira', 'tigela ',
    'talheres', 'faca ', 'garfo ', 'colher ', 'conjunto de talheres',
    'jarra ', 'garrafa termica', 'garrafa térmica', 'copo térmico',
    'pote ', 'vasilha ', 'pote hermético', 'marmita',
    'liquidificador', 'batedeira ', 'processador de alimentos', 'mixer ',
    'micro-ondas', 'forno elétrico', 'forno a gás', 'fogão ', 'cooktop',
    'geladeira', 'refrigerador', 'freezer',
    'máquina de lavar', 'lava e seca', 'secadora de roupas',
    'lava-louças', 'lava louças',
    'ventilador ', 'climatizador', 'ar condicionado', 'purificador de ar',
    'aspirador de pó', 'vassoura elétrica',
    // Limpeza e organização
    'vassoura ', 'rodo ', 'mop ', 'balde ', 'esfregão',
    'organizador ', 'caixa organizadora', 'porta objetos',
    'cabide ', 'cesto ', 'cesto de roupa', 'suporte ',
    // Ferramentas e jardim
    'furadeira ', 'parafusadeira', 'chave de fenda', 'alicate ', 'martelo',
    'kit ferramenta', 'caixa de ferramentas', 'extensão elétrica',
    'mangueira ', 'regador ', 'vaso de planta', 'terra para plantas',
    'jardim ', 'jardinagem', 'planta ',
    // Segurança
    'câmera de segurança', 'alarme residencial', 'fechadura digital',
    'cadeado ', 'tranca ',
  ],

  // ─── MODA E VESTUÁRIO ────────────────────────────────────────────────────────
  moda: [
    // Roupas femininas
    'vestido ', 'saia ', 'blusa ', 'cropped', 'top feminino',
    'calça feminina', 'shorts feminino', 'regata feminina',
    'body feminino', 'macacão', 'conjunto feminino',
    'maiô ', 'biquíni', 'bikini', 'saída de praia',
    // Roupas masculinas
    'camisa ', 'camiseta ', 'polo ', 'camisão',
    'calça masculina', 'bermuda ', 'short masculino',
    'cueca ', 'boxer ', 'sunga ',
    // Unissex
    'moletom ', 'jaqueta ', 'casaco ', 'sobretudo ', 'blazer ', 'terno',
    'roupa ', 'roupas ', 'conjunto ', 'pijama ', 'camisola',
    'roupa infantil', 'roupa bebê', 'roupa criança',
    'roupa feminina', 'roupa masculina', 'moda feminina', 'moda masculina',
    'meias ', 'meia ', 'meia-calça', 'legging ',
    'sutiã', 'calcinha ', 'lingerie', 'kit lingerie',
    'roupa de academia', 'legging fitness', 'top fitness',
    // Calçados
    'sapato ', 'sandália ', 'chinelo ', 'rasteira',
    'bota ', 'botinha ', 'ankle boot',
    'tênis casual', 'tênis feminino', 'tênis masculino', 'tênis infantil',
    'sapatilha ', 'scarpin ', 'tamanco ',
    // Acessórios de moda
    'bolsa ', 'carteira ', 'bolsinha', 'clutch ', 'mochila de moda',
    'cinto ', 'gravata ', 'lenço de pescoço',
    'óculos de sol', 'óculos solar',
    'brinco ', 'colar ', 'pulseira ', 'anel ', 'joias ', 'bijuteria',
    'relógio feminino', 'relógio masculino', 'relógio fashion',
    'chapéu ', 'boné ', 'touca ', 'cachecol ', 'luvas de inverno',
    'kit meias', 'kit cuecas', 'kit camisetas',
    'roupinha para pet', 'roupa para cachorro', 'roupa para gato',
  ],

  // ─── BELEZA E CUIDADOS PESSOAIS ──────────────────────────────────────────────
  beleza: [
    // Maquiagem
    'maquiagem', 'make ', 'base ', 'batom ', 'gloss ', 'lip ',
    'blush ', 'bronzer', 'iluminador', 'contorno', 'paleta de sombra',
    'sombra ', 'delineador', 'lápis de olho', 'rímel ', 'máscara de cílios',
    'fixador de maquiagem', 'primer ', 'pó compacto', 'bb cream', 'cc cream',
    'esponja de maquiagem', 'pincel de maquiagem', 'kit maquiagem',
    // Skincare
    'skincare', 'creme facial', 'creme para rosto', 'hidratante facial',
    'sérum ', 'sérum facial', 'ácido hialurônico', 'vitamina c facial',
    'protetor solar', 'fps ', 'filtro solar',
    'tônico facial', 'água micelar', 'demaquilante', 'esfoliante facial',
    'máscara facial', 'máscara de argila', 'colágeno ', 'retinol',
    // Cabelo
    'shampoo', 'condicionador', 'máscara capilar', 'leave-in',
    'óleo capilar', 'queratina', 'selagem', 'progressiva',
    'creme de pentear', 'definidor de cachos',
    'escova ', 'pente ', 'babyliss', 'chapinha', 'prancha de cabelo',
    'secador de cabelo', 'difusor de cabelo',
    'tintura de cabelo', 'coloração', 'mechas',
    // Corpo
    'hidratante corporal', 'loção corporal', 'óleo corporal',
    'esfoliante corporal', 'creme para o corpo',
    'perfume ', 'colônia ', 'desodorante', 'sabonete ', 'sabonete líquido',
    'gel de banho', 'espuma de banho',
    // Unhas
    'esmalte ', 'base para unhas', 'top coat', 'kit unhas',
    'removedor de esmalte', 'acetona', 'lima de unhas', 'alicate de cutícula',
    'gel para unhas', 'unhas de fibra',
    // Depilação e higiene
    'depilação', 'cera depilatória', 'lâmina de barbear', 'aparelho de barbear',
    'barbeador ', 'barbeador elétrico', 'aparador de pelos',
    'creme depilatório', 'epilador',
    'fio dental', 'escova de dente', 'creme dental', 'enxaguante',
    // Spa e relaxamento
    'kit spa', 'kit beleza', 'kit cuidados',
  ],

  // ─── ESPORTES E FITNESS ──────────────────────────────────────────────────────
  esportes: [
    // Futebol e esportes coletivos
    'futebol', 'chuteira', 'bola de futebol', 'uniforme esportivo',
    'camiseta de futebol', 'short de futebol', 'meião ',
    'basquete', 'bola de basquete', 'tênis de basquete',
    'vôlei', 'bola de vôlei', 'joelheira ', 'cotoveleira',
    // Academia e musculação
    'academia', 'musculação', 'haltere ', 'anilha ', 'barra de treino',
    'kettlebell', 'elástico de academia', 'faixa elástica',
    'banco de supino', 'step fitness', 'corda de pular',
    'suporte de barra', 'apoio de flexão',
    // Cardio e corrida
    'tênis de corrida', 'tênis esportivo', 'tênis running',
    'esteira ', 'bicicleta ergométrica', 'spinning',
    'corrida ', 'maratona ', 'trail',
    // Natação e aquático
    'natação', 'óculos de natação', 'touca de natação', 'maio esportivo',
    'prancha de surf', 'surf ', 'stand up paddle',
    // Ciclismo e skate
    'bike ', 'bicicleta ', 'capacete de bike',
    'patins ', 'skate ', 'shape de skate',
    // Yoga e pilates
    'yoga ', 'pilates', 'tapete de yoga', 'bloco de yoga', 'faixa de yoga',
    // Suplementos
    'suplemento esportivo', 'whey protein', 'whey ', 'creatina',
    'pré-treino', 'pré treino', 'bcaa ', 'hipercalórico', 'proteína em pó',
    // Outros
    'luva de treino', 'luva de boxe', 'capacete esportivo',
    'fitness ', 'treino ', 'workout',
    'escalada', 'corda de escalada', 'capacete escalada',
  ],

  // ─── BRINQUEDOS ──────────────────────────────────────────────────────────────
  brinquedos: [
    'pelúcia ', 'pelucia ', 'ursinho de pelúcia', 'urso de pelúcia',
    'boneca ', 'boneco ', 'barbie ', 'ken ', 'bebê reborn',
    'brinquedo ', 'brinquedos ', 'brincar ',
    'carrinho de brinquedo', 'pista de carrinho',
    'lego ', 'duplo ', 'blocos de montar', 'blocos de construção',
    'quebra-cabeça infantil', 'puzzle infantil',
    'escorregador ', 'balanço ', 'brinquedo de parque',
    'piscina de bolinhas', 'piscina infantil',
    'bicicleta infantil', 'triciclo ', 'patinete infantil', 'andador ',
    'bola infantil', 'kit de pintura infantil',
    'jogo de tabuleiro infantil', 'jogo de memória', 'jogo de cartas infantil',
    'massinha ', 'argila infantil', 'slime ',
    'kit ciência', 'kit química infantil', 'telescópio infantil',
    'fantasia infantil', 'fantasia de criança', 'roupa de super herói',
    'action figure', 'funko ', 'figura de ação',
    'mini ',  // mini versões de brinquedos
    'nerf ', 'arma de brinquedo',
    'pião ', 'yoyo ', 'yo-yo',
    'casinha de boneca', 'casinha de brinquedo',
    'instrumentos musicais infantis', 'teclado infantil',
  ],

  // ─── PETS ────────────────────────────────────────────────────────────────────
  pets: [
    'cachorro', 'cão ', 'gato ', 'pet ',
    'ração ', 'ração para cachorro', 'ração para gato',
    'coleira ', 'guia para cachorro', 'focinheira ',
    'cama para pet', 'cama para cachorro', 'cama para gato',
    'arranhador para gato', 'brinquedo para cachorro', 'brinquedo para gato',
    'aquário ', 'peixe ', 'tartaruga ',
    'coelho ', 'hamster ', 'ave ', 'gaiola ',
    'casinha para cachorro', 'casinha para gato',
    'transportadora pet', 'mochila pet',
    'antiparasitário', 'antipulgas', 'vacina pet',
    'shampoo para cachorro', 'shampoo pet',
    'comedouro ', 'bebedouro pet', 'tigela pet',
    'areia para gato', 'caixinha de areia',
    'petisco ', 'ossinho', 'brinquedo mordedor',
  ],

  // ─── LIVROS ──────────────────────────────────────────────────────────────────
  livros: [
    'livro ', 'livros ', 'book ', 'books ',
    'harry potter', 'romance literário', 'novel ',
    'coleção ', 'saga ', 'trilogia ', 'série de livros',
    'literatura ', 'editora ', 'edição ', 'exemplar ',
    'bíblia ', 'bíblia sagrada', 'devocional ', 'espiritismo', 'umbanda',
    'poesia ', 'conto ', 'crônica ', 'almanaque ',
    'enciclopédia', 'dicionário ',
    'mangá ', 'hq ', 'quadrinho ', 'graphic novel',
    'rowling', 'tolkien', 'stephen king', 'agatha christie',
    'autobiografia', 'biografia ', 'autoajuda ', 'desenvolvimento pessoal',
    'curso em dvd', 'apostila ',
    'livro de receitas', 'livro de culinária',
    'atlas ', 'mapa livro', 'guia de viagem livro',
    'infantil livro', 'livro infantil', 'livro escolar',
  ],

  // ─── MERCADO / ALIMENTOS ─────────────────────────────────────────────────────
  mercado: [
    'alimento ', 'alimentos ', 'comida ', 'bebida ', 'bebidas ',
    'café solúvel', 'café em cápsula', 'nespresso ', 'dolce gusto',
    'leite condensado', 'creme de leite', 'leite em pó',
    'suco ', 'refrigerante ', 'energético ', 'água mineral',
    'óleo de cozinha', 'azeite ', 'vinagre ',
    'arroz ', 'feijão ', 'lentilha ', 'grão-de-bico',
    'macarrão ', 'massa ', 'farinha ', 'fubá ', 'amido de milho',
    'açúcar ', 'sal ', 'fermento ',
    'biscoito ', 'snack ', 'salgadinho ', 'pipoca', 'barra de cereal',
    'chocolate ', 'bombom ', 'trufa ', 'brigadeiro ',
    'vitamina ', 'proteína em pó alimentar',
    'tempero ', 'molho ', 'ketchup ', 'mostarda ', 'maionese ',
    'conserva ', 'enlatado ', 'atum enlatado', 'sardinha ',
    'farinha lacta', 'leite ninho', 'danone ', 'nestlé',
    'whiskás', 'purina ', 'golden pet',
    'kit lanche', 'cesta básica', 'kit alimentar',
  ],

  // ─── SAÚDE E MEDICAMENTOS ────────────────────────────────────────────────────
  saude: [
    'medicamento', 'remédio ', 'farmácia', 'vitamina ',
    'suplemento vitamínico', 'complexo vitamínico',
    'colágeno ', 'ômega 3', 'omega 3', 'vitamina c',
    'pressão arterial', 'aparelho de pressão', 'oxímetro ',
    'termômetro ', 'estetoscópio', 'aparelho de glicose',
    'fralda ', 'absorvente ', 'coletor menstrual',
    'preservativo', 'anticoncepcional',
    'curativo ', 'esparadrapo', 'gaze ', 'kit primeiros socorros',
    'nebulizador ', 'inalador ',
    'bengala ', 'muleta ', 'cadeira de rodas', 'andador adulto',
    'massageador ', 'almofada ortopédica',
    'protetor auricular', 'óculos de grau',
    'cinto ortopédico', 'suporte lombar',
  ],

  // ─── PAPELARIA E ESCRITÓRIO ──────────────────────────────────────────────────
  papelaria: [
    'caneta ', 'lápis ', 'lapiseira ', 'marca-texto',
    'caderno ', 'agenda ', 'planner ', 'bloco de notas',
    'post-it ', 'papel ', 'folha ',
    'mochila escolar', 'lancheira ', 'estojo ',
    'cola ', 'fita adesiva', 'grampeador', 'perfurador',
    'calculadora ', 'régua ', 'compasso ',
    'caixa arquivo', 'pasta ', 'porta-caneta',
    'tinta para impressora', 'cartucho impressora', 'toner ',
    'papel a4', 'papel fotográfico',
    'kit escolar', 'material escolar',
  ],

  // ─── INFANTIL / BEBÊ ─────────────────────────────────────────────────────────
  bebe: [
    'bebê ', 'bebe ', 'recém-nascido', 'recem nascido',
    'fralda ', 'fraldas ', 'lenço umedecido', 'pomada para assaduras',
    'carrinho de bebê', 'bebê conforto', 'berço ', 'moisés',
    'mamadeira ', 'chupeta ', 'bico de mamadeira',
    'babador ', 'fralda de pano', 'kit higiene bebê',
    'monitor de bebê', 'baby monitor',
    'brinquedo para bebê', 'chocalho ', 'mordedor ',
    'poltrona amamentação', 'almofada amamentação',
    'kit banho bebê', 'banheira bebê',
    'andador bebê', 'cadeira para carro infantil', 'bebê conforto',
    'body bebê', 'macacão bebê', 'pijama bebê',
    'kit bebê', 'enxoval bebê',
  ],

  // ─── AUTOMOTIVO ──────────────────────────────────────────────────────────────
  automotivo: [
    // Veículos
    'carro ', 'carros ', 'automóvel', 'veículo ', 'veículos ',
    'sedan ', 'hatch ', 'suv ', 'pickup ', 'caminhonete',
    'moto ', 'motocicleta ', 'scooter ', 'motoneta ', 'ciclomotor',
    'caminhão ', 'van ', 'utilitário',

    // Pneus e rodas
    'pneu ', 'pneus ', 'pneu aro', 'pneu para carro', 'pneu moto',
    'pneu remold', 'pneu recauchutado', 'pneu off-road', 'pneu slick',
    'roda ', 'rodas ', 'roda liga leve', 'roda esportiva', 'aro ',
    'calota ', 'calotas ', 'parafuso de roda', 'porca de roda',
    'câmara de ar', 'válvula de pneu',

    // Peças do motor e mecânica
    'peça automotiva', 'peças para carro', 'peças auto',
    'filtro de óleo', 'filtro de ar', 'filtro de combustível', 'filtro de cabine',
    'vela de ignição', 'vela de platina', 'bobina de ignição',
    'correia dentada', 'correia serpentina', 'kit correia',
    'amortecedor ', 'mola suspensão', 'kit amortecedor', 'buchas suspensão',
    'pastilha de freio', 'disco de freio', 'lona de freio', 'kit freio',
    'bateria automotiva', 'bateria de carro', 'bateria 60ah', 'bateria 70ah',
    'alternador ', 'motor de arranque', 'virabrequim', 'bomba de combustível',
    'radiador ', 'mangueira do radiador', 'tampa do radiador',
    'embreagem ', 'kit embreagem', 'disco de embreagem',
    'junta homocinética', 'semi-eixo ', 'pivô ',
    'rolamento ', 'kit rolamento',
    'bujão de óleo', 'cárter ', 'bloco do motor',
    'sensor de temperatura', 'sensor de oxigênio', 'sensor abs',

    // Revisão e lubrificantes
    'óleo motor', 'óleo de motor', 'lubrificante automotivo',
    'kit revisão', 'kit troca de óleo',
    'aditivo para combustível', 'aditivo para motor',
    'fluido de freio', 'fluido de direção', 'fluido de transmissão',
    'graxa automotiva', 'silicone automotivo',

    // Elétrica e eletrônica automotiva
    'som automotivo', 'radio automotivo', 'rádio automotivo',
    'alto-falante automotivo', 'subwoofer automotivo', 'módulo de potência',
    'câmera de ré', 'câmera frontal carro', 'sensor de estacionamento',
    'central multimídia', 'dvd automotivo', 'gps automotivo',
    'carregador veicular', 'inversor de tensão veicular',
    'rastreador veicular', 'alarme automotivo', 'trava elétrica',
    'modulo de vidro', 'limpador de para-brisa', 'motor do limpador',

    // Iluminação
    'lâmpada automotiva', 'lâmpada para carro', 'farol automotivo',
    'led automotivo', 'kit led carro', 'lâmpada h1', 'lâmpada h4', 'lâmpada h7',
    'lanterna automotiva', 'milha automotiva', 'luz de freio',
    'xenon automotivo', 'led de placa', 'led interior carro',

    // Acessórios externos
    'suporte celular carro', 'suporte veicular', 'suporte para moto',
    'tapete automotivo', 'tapete para carro', 'tapete emborrachado',
    'capa de carro', 'protetor de carro', 'coberta para carro',
    'capa de banco', 'banco automotivo', 'estofado automotivo',
    'capa de volante', 'volante esportivo',
    'calço de roda', 'spoiler ', 'aerofólio',
    'engate reboque', 'bola de engate',
    'grade dianteira', 'para-choque ', 'protetor de para-choque',
    'estribo ', 'rack de teto', 'bagageiro para carro',

    // Acessórios internos
    'organizador automotivo', 'bolsa para porta-malas',
    'câmbio automotivo', 'manopla de câmbio', 'pedaleira automotiva',
    'película automotiva', 'película para vidro', 'película insulfilm',
    'ar condicionado automotivo', 'compressor ar carro',

    // Ferramentas automotivas
    'macaco automotivo', 'macaco hidráulico', 'macaco de garrafa',
    'chave de roda', 'chave de porca', 'torquímetro ',
    'compressor de ar', 'inflador de pneu', 'calibrador de pneu',
    'extrator de óleo', 'bomba de óleo',
    'estetoscópio automotivo', 'scanner automotivo', 'leitor de falhas',
    'multímetro automotivo',

    // Limpeza automotiva
    'cera automotiva', 'polish automotivo', 'produto para carro',
    'shampoo automotivo', 'espuma automotiva', 'pretinho automotivo',
    'renovador de plástico', 'cristalizador de vidro',
    'aspirador automotivo', 'aspirador de carro',
    'flanela automotiva', 'esponja automotiva',

    // Moto específico
    'capacete moto', 'capacete de moto', 'capacete aberto', 'capacete fechado',
    'luva moto', 'jaqueta moto', 'bota moto', 'calça moto',
    'baú moto', 'bauleto moto', 'bagageiro moto',
    'espelho retrovisor moto', 'manopla moto', 'guidão moto',
    'protetor de motor moto', 'slider moto',
  ],
};

/**
 * Detecta o slug do nicho mais adequado com base no título do produto.
 * Retorna null se nenhum nicho for identificado.
 */
export function detectNicheSlug(title: string): string | null {
  const t = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const titleNorm = title.toLowerCase();

  // Verificar cada nicho e contar quantas palavras-chave batem
  const scores: Array<{ slug: string; score: number }> = [];

  for (const [slug, keywords] of Object.entries(NICHE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (t.includes(kwNorm) || titleNorm.includes(kw.toLowerCase())) {
        // Palavras mais longas têm mais peso (mais específicas)
        score += kw.trim().length >= 8 ? 3 : kw.trim().length >= 5 ? 2 : 1;
      }
    }
    if (score > 0) scores.push({ slug, score });
  }

  if (scores.length === 0) return null;

  // Retornar o nicho com maior pontuação
  scores.sort((a, b) => b.score - a.score);
  return scores[0].slug;
}

/**
 * Resolve o nicheId no banco a partir do título do produto.
 * Fallback para o primeiro nicho ativo se não detectar.
 */
export async function resolveNicheFromTitle(title: string): Promise<string | null> {
  const allNiches = await prisma.niche.findMany({ where: { isActive: true } });
  if (allNiches.length === 0) return null;

  const slug = detectNicheSlug(title);
  if (slug) {
    const matched = allNiches.find(n => n.slug === slug || n.name?.toLowerCase().includes(slug));
    if (matched) return matched.id;
  }

  // Fallback: retornar primeiro nicho disponível
  return allNiches[0].id;
}
