export type LegalPageType = 'terms' | 'privacy' | 'support';

export type Locale = 'pt' | 'en' | 'fr' | 'es' | 'zh';

export type PhaseTranslation = {
  name: string;
  description: string;
};

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalPageContent = {
  title: string;
  sections: LegalSection[];
};

export type Translations = {
  locale: Locale;
  home: {
    badge: string;
    title: string;
    subtitle: string;
    start: string;
    customize: string;
    rules: string;
    settings: string;
  };
  settings: {
    title: string;
    language: string;
    sound: string;
    soundOn: string;
    soundOff: string;
    darkMode: string;
    darkOn: string;
    darkOff: string;
    close: string;
  };
  rules: {
    title: string;
    tabHow: string;
    tabPhases: string;
    tabScoring: string;
    tabSpecials: string;
    objectiveTitle: string;
    objectiveBody: string;
    turnTitle: string;
    turnSteps: [string, string][];
    advanceTitle: string;
    advanceBody: string;
    phasesHint: string;
    scoringIntro: string;
    scoringCards: [string, string][];
    wildTitle: string;
    wildBody: string;
    wildTip: string;
    skipTitle: string;
    skipBody: string;
    close: string;
  };
  lobby: {
    configureMatch: string;
    yourProfile: string;
    random: string;
    playerName: string;
    playerNamePlaceholder: string;
    createCharacter: string;
    themeColor: string;
    continue: string;
    step2Title: string;
    backToProfile: string;
    backHome: string;
    nameTooLong: string;
    chooseGame: string;
    gamePhase10: string;
    gamePhase10Desc: string;
    gameTruco: string;
    gameTrucoDesc: string;
    gamePoker: string;
    gamePokerDesc: string;
    gameTower: string;
    gameTowerDesc: string;
    inDevelopment: string;
    gameInDevelopment: string;
    onlinePhase10Only: string;
    minPlayersPhase10: string;
    minPlayersTruco: string;
    minPlayersPoker: string;
  };
  legal: {
    close: string;
    terms: LegalPageContent;
    privacy: LegalPageContent;
    support: LegalPageContent;
  };
  footer: {
    terms: string;
    privacy: string;
    support: string;
    copyright: string;
  };
  cookies: {
    message: string;
    accept: string;
    learnMore: string;
  };
  phases: PhaseTranslation[];
};
