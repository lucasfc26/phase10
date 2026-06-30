import type { Translations } from './types';

const phases: Translations['phases'] = [
  { name: 'Fase 1', description: '2 Trincas (2 grupos de 3 cartas de mesmo valor)' },
  { name: 'Fase 2', description: '1 Trinca + 1 Sequência de 4 cartas' },
  { name: 'Fase 3', description: '1 Quadra + 1 Sequência de 4 cartas' },
  { name: 'Fase 4', description: '1 Sequência de 7 cartas' },
  { name: 'Fase 5', description: '1 Sequência de 8 cartas' },
  { name: 'Fase 6', description: '1 Sequência de 9 cartas' },
  { name: 'Fase 7', description: '2 Quadras (2 grupos de 4 cartas de mesmo valor)' },
  { name: 'Fase 8', description: '7 cartas de uma mesma cor' },
  { name: 'Fase 9', description: '1 Grupo de 5 + 1 Dupla (mesmo valor)' },
  { name: 'Fase 10', description: '1 Grupo de 5 + 1 Trinca (mesmo valor)' },
];

export const pt: Translations = {
  locale: 'pt',
  home: {
    badge: 'Online, local e contra bots',
    title: 'Mestre da Cartas',
    subtitle: 'Escolha seu jogo de cartas favorito — Fase 10, Truco, Poker e Mestre da Torre.',
    start: 'Iniciar',
    customize: 'Personalizar',
    rules: 'Ver Regras',
    settings: 'Configurar',
  },
  settings: {
    title: 'Configurações',
    language: 'Idioma',
    sound: 'Som',
    soundOn: 'Ligado',
    soundOff: 'Desligado',
    darkMode: 'Modo escuro',
    darkOn: 'Ligado',
    darkOff: 'Desligado',
    close: 'Fechar',
  },
  rules: {
    title: 'Regras — Mestre da Cartas',
    tabPhase10: 'Fase 10',
    tabTruco: 'Truco',
    tabPoker: 'Poker',
    tabTower: 'Mestre da Torre',
    towerComingSoon: 'MVP jogável: usa a base de fases atual com suporte para 2 a 10 jogadores. Poderes, energia e personagens serão adicionados no próximo balanceamento.',
    phase10: {
      tabHow: 'Como jogar',
      tabPhases: 'As 10 fases',
      tabScoring: 'Pontuação',
      tabSpecials: 'Cartas especiais',
      objectiveTitle: 'Objetivo',
      objectiveBody:
        'Complete as 10 fases em ordem. Vence quem terminar a fase 10 com a menor pontuação acumulada.',
      turnTitle: 'Fluxo do turno',
      turnSteps: [
        ['1. Comprar', 'Compre do monte ou do descarte visível.'],
        ['2. Jogar', 'Baixe sua fase e/ou bata cartas em fases na mesa.'],
        ['3. Descartar', 'Descarte uma carta para encerrar o turno.'],
      ],
      advanceTitle: 'Avanço de fase',
      advanceBody:
        'Só avança quem baixar a fase na rodada — exceto quando todos baixam, caso em que todos avançam.',
      phasesHint:
        'Grupo: mesmo valor. Sequência: valores consecutivos. Cor: mesma cor.',
      scoringIntro:
        'A rodada termina quando alguém descarta a última carta ou quando todos baixam suas fases.',
      scoringCards: [
        ['5', 'Cartas 1–9'],
        ['10', 'Cartas 10–12'],
        ['15', 'Skip'],
        ['25', 'Curinga'],
      ],
      wildTitle: 'Curinga',
      wildBody: 'Substitui qualquer número ou cor. Cada grupo precisa de ao menos uma carta natural.',
      wildTip: 'Pelo menos uma carta natural em cada grupo baixado.',
      skipTitle: 'Skip',
      skipBody: 'Ao descartar, escolha um oponente para pular o próximo turno. Não entra em grupos na mesa.',
    },
    truco: [
      {
        title: 'Objetivo',
        paragraphs: [
          'Truco Paulista para 4 jogadores em 2 duplas (parceiros sentados em frente).',
          'Vence a dupla que chegar primeiro a 12 pontos na partida.',
        ],
      },
      {
        title: 'Baralho e distribuição',
        paragraphs: [
          'Baralho espanhol de 40 cartas (4, 5, 6, 7, valete, dama, rei, ás, 2 e 3).',
          'Cada jogador recebe 3 cartas. São jogadas 3 vazas por mão.',
        ],
      },
      {
        title: 'Força das cartas',
        paragraphs: [
          'Manilhas (do maior para o menor): 4 de paus ♣, 7 de copas ♥, ás de espadas ♠, 7 de ouros ♦.',
          'Demais cartas: 3 > 2 > A > K > J > Q > 7 > 6 > 5 > 4.',
          'Na vaza, vence a carta mais forte. Empate na vaza não define vencedor imediato.',
        ],
      },
      {
        title: 'Pontuação da mão',
        paragraphs: [
          'Quem vencer 2 das 3 vazas ganha a mão e marca pontos.',
          'Mão normal vale 1 ponto. Truco eleva para 3, Seis para 6, Nove para 9 e Doze para 12.',
          'Se a dupla adversária correr, quem pediu ganha os pontos do nível anterior.',
        ],
      },
      {
        title: 'Pedir Truco',
        paragraphs: [
          'No seu turno, antes de jogar a carta, você pode pedir Truco para aumentar o valor da mão.',
          'A dupla adversária aceita (continua jogando pelo novo valor) ou corre (desiste da mão).',
        ],
      },
    ],
    poker: [
      {
        title: 'Objetivo',
        paragraphs: [
          'Texas Hold\'em: forme a melhor mão de 5 cartas usando suas 2 cartas fechadas e as 5 comunitárias.',
          'Vence quem tiver a mão mais forte no showdown ou quem fizer todos desistirem.',
        ],
      },
      {
        title: 'Jogadores e fichas',
        paragraphs: [
          'De 2 a 6 jogadores. Todos começam com fichas.',
          'Small blind e big blind são postos automaticamente antes de cada mão.',
        ],
      },
      {
        title: 'Rodadas de apostas',
        paragraphs: [
          'Pré-flop: cada jogador recebe 2 cartas fechadas.',
          'Flop: 3 cartas comunitárias. Turn: +1 carta. River: +1 carta (5 no total).',
          'Após cada rodada de cartas, há uma rodada de apostas.',
        ],
      },
      {
        title: 'Ações',
        paragraphs: [
          'Desistir (fold): abandona a mão.',
          'Passar (check): não aposta se ninguém apostou antes.',
          'Pagar (call): iguala a aposta atual.',
          'Aumentar (raise): eleva a aposta. All-in: aposta todas as fichas.',
        ],
      },
      {
        title: 'Ranking das mãos (maior → menor)',
        paragraphs: [
          'Royal flush, straight flush, quadra, full house, flush, sequência, trinca, dois pares, par, carta alta.',
          'No showdown, a melhor mão de 5 cartas possível vence o pote.',
        ],
      },
    ],
    tower: [
      {
        title: 'Objetivo',
        paragraphs: [
          'Seja o primeiro jogador a completar todos os andares da torre.',
          'Nesta primeira versão jogável, cada andar usa combinações parecidas com Fase 10, preparada para partidas de 2 a 10 jogadores.',
        ],
      },
      {
        title: 'Combate e poderes',
        paragraphs: [
          'O modo completo terá cartas de poder, energia, reações, personagens e raridades.',
          'O MVP já separa o modo no lobby e na partida para receber essas regras sem misturar com o Fase 10 clássico.',
        ],
      },
    ],
    close: 'Fechar',
  },
  lobby: {
    configureMatch: 'Configurar partida',
    yourProfile: 'Seu perfil',
    random: 'Aleatório',
    playerName: 'Seu Nome de Jogador',
    playerNamePlaceholder: 'Ex: Pedro, Marta_Sets...',
    createCharacter: 'Crie seu Personagem',
    themeColor: 'Sua Cor do Tema',
    continue: 'Continuar',
    step2Title: 'Passo 2: Jogo e Conexão',
    backToProfile: 'Voltar ao Perfil',
    backHome: 'Voltar ao início',
    nameTooLong: 'O nome pode ter no máximo 18 caracteres.',
    chooseGame: 'Escolha o Jogo',
    gamePhase10: 'Fase 10',
    gamePhase10Desc: 'Monte trincas e sequências nas 10 fases clássicas.',
    gameTruco: 'Truco',
    gameTrucoDesc: 'O clássico jogo de blefe e estratégia brasileiro.',
    gamePoker: 'Poker',
    gamePokerDesc: 'Texas Hold\'em — blefe, apostas e melhor mão vence.',
    gameTower: 'Mestre da Torre',
    gameTowerDesc: 'Suba os andares em uma disputa de 2 a 10 jogadores.',
    inDevelopment: 'Em Desenvolvimento',
    gameInDevelopment: 'Este modo de jogo ainda está em desenvolvimento.',
    onlinePhase10Only: 'Multijogador online disponível apenas para Fase 10.',
    minPlayersPhase10: 'O Fase 10 precisa de pelo menos 3 jogadores.',
    minPlayersTruco: 'O Truco precisa de exatamente 4 jogadores.',
    minPlayersPoker: 'O Poker precisa de pelo menos 2 jogadores.',
    minPlayersTower: 'O Mestre da Torre precisa de pelo menos 2 jogadores.',
  },
  legal: {
    close: 'Fechar',
    terms: {
      title: 'Termos de Uso',
      sections: [
        {
          title: '1. Aceitação',
          paragraphs: [
            'Ao acessar e utilizar o Mestre da Cartas, operado pela Maselcorp, você concorda com estes Termos de Uso. Se não concordar, não utilize o serviço.',
          ],
        },
        {
          title: '2. Descrição do serviço',
          paragraphs: [
            'O Mestre da Cartas é uma plataforma de jogos de cartas digital para entretenimento, com modos como Fase 10, Truco e Mestre da Torre. Disponível em modo local, contra bots e multijogador online. O serviço pode ser alterado ou atualizado a qualquer momento.',
          ],
        },
        {
          title: '3. Conta e conduta',
          paragraphs: [
            'Você é responsável pelo nome de jogador escolhido e pelo uso adequado do chat e das salas online. Não é permitido assédio, linguagem ofensiva, trapaça ou qualquer uso que prejudique outros jogadores.',
          ],
        },
        {
          title: '4. Propriedade intelectual',
          paragraphs: [
            'O software, interface, arte e demais elementos do jogo pertencem à Maselcorp ou a seus licenciadores. Phase 10 é uma marca de jogo de cartas; este produto é uma implementação independente para fins recreativos.',
          ],
        },
        {
          title: '5. Limitação de responsabilidade',
          paragraphs: [
            'O jogo é fornecido "como está". A Maselcorp não se responsabiliza por interrupções, perda de dados de partida ou danos indiretos decorrentes do uso do serviço.',
          ],
        },
      ],
    },
    privacy: {
      title: 'Política de Privacidade',
      sections: [
        {
          title: '1. Dados que coletamos',
          paragraphs: [
            'Podemos armazenar localmente no seu navegador preferências (idioma, tema, som, personagem e consentimento de cookies). Em partidas online, coletamos nome de jogador, avatar e dados necessários para conexão à sala.',
          ],
        },
        {
          title: '2. Uso dos dados',
          paragraphs: [
            'Os dados são usados para operar o jogo, personalizar sua experiência e manter salas multijogador. Não vendemos seus dados pessoais a terceiros.',
          ],
        },
        {
          title: '3. Cookies e armazenamento local',
          paragraphs: [
            'Utilizamos armazenamento local (localStorage) para salvar configurações e consentimento de cookies. Esses dados permanecem no seu dispositivo até serem removidos por você.',
          ],
        },
        {
          title: '4. Seus direitos',
          paragraphs: [
            'Você pode limpar os dados armazenados nas configurações do navegador a qualquer momento. Para dúvidas sobre privacidade, entre em contato pelo canal de suporte.',
          ],
        },
      ],
    },
    support: {
      title: 'Suporte',
      sections: [
        {
          title: 'Central de ajuda',
          paragraphs: [
            'Precisa de ajuda com o Mestre da Cartas? Consulte as regras do jogo na tela inicial ou entre em contato conosco pelos canais abaixo.',
          ],
        },
        {
          title: 'Contato',
          paragraphs: [
            'E-mail: suporte@maselcorp.com.br',
            'Horário de atendimento: segunda a sexta, 9h às 18h (horário de Brasília).',
          ],
        },
        {
          title: 'Problemas comuns',
          paragraphs: [
            'Conexão online: verifique sua internet e se o servidor está acessível.',
            'Personagem ou som: acesse Configurar na tela inicial para ajustar preferências.',
            'Partida travada: saia da partida e inicie uma nova sala.',
          ],
        },
      ],
    },
  },
  footer: {
    terms: 'Termos de Uso',
    privacy: 'Política de Privacidade',
    support: 'Suporte',
    copyright: '© 2026 Maselcorp. Todos os direitos reservados.',
  },
  cookies: {
    message:
      'Utilizamos cookies e armazenamento local para salvar suas preferências e melhorar sua experiência.',
    accept: 'Aceitar cookies',
    learnMore: 'Saiba mais',
  },
  phases,
};
