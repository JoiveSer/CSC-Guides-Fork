const fs = require('fs');
const path = require('path');
const vm = require('vm');

const [packDir, projectDir] = process.argv.slice(2);

if (!packDir || !projectDir) {
  throw new Error('Usage: node build-v5-site-data.js <pack-dir> <project-dir>');
}

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(packDir, name), 'utf8'));
const loadWindowData = (filePath, globalName) => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
  return context.window[globalName];
};
const writeWindowData = (filePath, globalName, value) => {
  fs.writeFileSync(filePath, `window.${globalName} = ${JSON.stringify(value)};\n`, 'utf8');
};
const pairKey = (left, right) => [left, right].sort((a, b) => a.localeCompare(b, 'ru')).join('\u0000');

const authoritative = readJson('CSC_V5_AUTHORITATIVE.json');
const soloBuilds = readJson('CSC_V5_SOLO_BUILDS.json');
const tierlist = readJson('CSC_V5_CHARACTER_TIERLIST.json');
const duoRatings = readJson('CSC_V5_DUO_RATINGS.json');
const duoFastBuilds = readJson('CSC_V5_DUO_FAST_BUILDS.json');
const duoFullBuilds = readJson('CSC_V5_DUO_FULL_BUILDS.json');
const methodology = readJson('CSC_V5_METHODOLOGY.json');

const offlinePath = path.join(projectDir, 'data', 'offline-data.js');
const currentOffline = loadWindowData(offlinePath, 'CSK_OFFLINE_DATA');
const currentByName = new Map(currentOffline.classes.map((character) => [character.name, character]));
const soloByName = new Map(soloBuilds.map((build) => [build.character, build]));
const tierByName = new Map(tierlist.map((entry) => [entry.name, entry]));
const fullByPair = new Map(duoFullBuilds.map((pair) => [pairKey(...pair.characters), pair]));
const ratingByPair = new Map(duoRatings.map((pair) => [pairKey(...pair.characters), pair]));
const fastByPair = new Map(
  duoFastBuilds.map((pair) => {
    const characters = pair.pair.split(' + ');
    return [pairKey(...characters), pair];
  })
);

const characterNames = authoritative.characters.map((character) => character.name);
const uniquePairCount = new Set(duoRatings.map((pair) => pairKey(...pair.characters))).size;
const missingSolo = characterNames.filter((name) => !soloByName.has(name));
const missingTier = characterNames.filter((name) => !tierByName.has(name));
const scoreMismatches = duoRatings.filter((pair) => {
  const key = pairKey(...pair.characters);
  return fullByPair.get(key)?.score !== pair.score || fastByPair.get(key)?.score !== pair.score;
});

if (
  characterNames.length !== 61 ||
  currentOffline.classes.length !== 61 ||
  soloBuilds.length !== 61 ||
  tierlist.length !== 61 ||
  duoRatings.length !== 1891 ||
  duoFastBuilds.length !== 1891 ||
  duoFullBuilds.length !== 1891 ||
  uniquePairCount !== 1891 ||
  missingSolo.length ||
  missingTier.length ||
  scoreMismatches.length
) {
  throw new Error(
    `V5 validation failed: characters=${characterNames.length}, current=${currentOffline.classes.length}, ` +
    `solo=${soloBuilds.length}, tier=${tierlist.length}, ratings=${duoRatings.length}, ` +
    `fast=${duoFastBuilds.length}, full=${duoFullBuilds.length}, unique=${uniquePairCount}, ` +
    `missingSolo=${missingSolo.length}, missingTier=${missingTier.length}, scoreMismatches=${scoreMismatches.length}`
  );
}

const formatShard = (shard) => {
  if (!shard) return '';
  return `Шард (${shard.priority}): ${shard.buy}; ${shard.upgrade}`;
};

const makeAiBuild = (title, items, order, footer) => ({
  title,
  items: [
    ...items.map((item, index) => `${index + 1}. ${item}`),
    `Порядок покупки: ${order.join(' → ')}`,
    footer
  ].filter(Boolean)
});

const v5Classes = currentOffline.classes.map((current) => {
  const solo = soloByName.get(current.name);
  const tier = tierByName.get(current.name);
  const communityBuilds = current.builds.filter((build) => !build.title.startsWith('Закуп от ИИ'));

  return {
    ...current,
    builds: [
      makeAiBuild('Закуп от ИИ · PvP V5', solo.soloPvpBuild, solo.purchaseOrderPvp, formatShard(solo.shard)),
      makeAiBuild('Закуп от ИИ · PvE V5', solo.soloPveBuild, solo.purchaseOrderPve, solo.midasPlan),
      ...communityBuilds
    ],
    counters: solo.counters,
    v5: {
      tier: tier.tier,
      score: tier.score,
      confidence: tier.confidence,
      role: tier.role,
      type: tier.type,
      bestFormat: tier.bestFormat,
      explanation: tier.explanation,
      strengths: tier.strengths,
      weaknesses: tier.weaknesses,
      metrics: tier.metrics,
      coreItems: solo.coreItems,
      keyLightItems: solo.keyLightItems,
      situationalItems: solo.situationalItems,
      badEarlyPurchases: solo.badEarlyPurchases,
      purchaseOrderPvp: solo.purchaseOrderPvp,
      purchaseOrderPve: solo.purchaseOrderPve,
      shard: solo.shard,
      midasPlan: solo.midasPlan,
      logic: solo.logic
    }
  };
});

const v5Offline = {
  ...currentOffline,
  classes: v5Classes,
  dataVersion: 'solo-v5-csc-3.3',
  dataDisclaimer: 'Теоретическая редакционная база CSC 3.3. Оценки не являются серверными винрейтами.'
};

const roleLabels = {
  balanced: 'сбалансированная пара',
  'double ranged': 'двойная дальняя линия',
  'mirror duo': 'зеркальная пара',
  'summon duo': 'пара через призывов',
  'support + carry': 'поддержка + керри',
  'tempo / economy': 'темп и экономика'
};
const adjustmentLabels = {
  vsTanks: 'танки и толстые цели',
  vsMagic: 'магический урон и контроль',
  vsArchers: 'дальнобойные персонажи',
  vsSummoners: 'призыватели',
  vsPhysicalBurst: 'физический бурст',
  vsHealing: 'сильное лечение',
  vsMobile: 'мобильные цели'
};

const makeBuildMap = (pair, mode) => {
  const result = {};
  pair.players.forEach((player, index) => {
    const label = pair.characters[0] === pair.characters[1] ? `Игрок ${index + 1}` : player.character;
    result[label] = player[`${mode}Build`];
  });
  return result;
};

const v5Pairs = duoFullBuilds.map((pair) => {
  const defensive = pair.players.find((player) => player.character === pair.defensivePlayer) || pair.players[1];
  const aggressive = pair.players.find((player) => player.character === pair.aggressivePlayer) || pair.players[0];
  return {
    pair: pair.characters,
    score: pair.score,
    tier: pair.tier,
    confidence: pair.confidence,
    holder: pair.defensivePlayer,
    carry: pair.aggressivePlayer,
    roleOfPair: roleLabels[pair.roleOfPair] || pair.roleOfPair,
    pvp: makeBuildMap(pair, 'pvp'),
    pve: makeBuildMap(pair, 'pve'),
    reason: pair.mainSynergy,
    combo: [
      `${pair.defensivePlayer}: ${defensive.notes}`,
      `${pair.aggressivePlayer}: ${aggressive.notes}`,
      pair.midasPlan,
      `Учитывай главное слабое место: ${pair.mainWeakness}`
    ],
    midasPlan: pair.midasPlan,
    scoreBreakdown: {
      pvpStrength: pair.pvpStrength,
      pveStrength: pair.pveStrength,
      earlyStrength: pair.earlyStrength,
      lateStrength: pair.lateStrength,
      control: pair.control,
      damage: pair.damage,
      survivability: pair.survivability,
      economy: pair.economy,
      reliability: pair.reliability,
      executionDifficulty: pair.executionDifficulty,
      counterability: pair.counterability
    },
    weaknesses: [pair.mainWeakness],
    counterAdjustments: Object.entries(pair.adjustments).map(([against, change]) => ({
      against: adjustmentLabels[against] || against,
      change
    }))
  };
});

const topPairs = duoRatings
  .filter((pair) => pair.characters[0] !== pair.characters[1])
  .sort((a, b) => b.score - a.score || pairKey(...a.characters).localeCompare(pairKey(...b.characters), 'ru'))
  .slice(0, 30);

const v5Authoritative = {
  version: 'authoritative-v5-csc-3.3',
  basis: methodology,
  pair_count: 1891,
  characters: characterNames,
  topPairs: topPairs.map((pair) => pair.characters),
  pairs: v5Pairs
};

const quickClasses = characterNames.map((name) => {
  const quick = authoritative.quickDuo[name];
  const solo = soloByName.get(name);
  return {
    name,
    buildLabel: 'Быстрый ДУО V5 · ядро из полной базы 1891 пары',
    build: quick.coreBuild.map((item, index) => ({
      slot: index + 1,
      item,
      replacement: solo.soloPveBuild[index] ? `${solo.soloPveBuild[index]} (PvE)` : ''
    })),
    shard: formatShard(solo.shard),
    pairs: quick.bestPartners.map((partner, index) => {
      const full = fullByPair.get(pairKey(name, partner.partner));
      return {
        rank: index + 1,
        name: partner.partner,
        score: partner.score,
        tier: partner.tier,
        confidence: partner.confidence,
        description: partner.why,
        how: full
          ? [full.mainSynergy, `Роль пары: ${roleLabels[full.roleOfPair] || full.roleOfPair}`, full.midasPlan, `Слабое место: ${full.mainWeakness}`]
          : []
      };
    })
  };
});

const v5Summary = {
  version: 'authoritative-v5-csc-3.3-summary',
  rules: [
    'Быстрый ДУО-закуп и список союзников автоматически собраны из той же полной базы 1891 пары.',
    methodology.scale,
    'Для каждой пары отдельно учтены PvP, PvE, ранняя и поздняя игра, надёжность и сложность реализации.',
    methodology.slotAssumption,
    'Оценки теоретические и не являются серверными винрейтами или пикрейтами.'
  ],
  topPairs: topPairs.map((pair) => ({
    left: pair.characters[0],
    right: pair.characters[1],
    summary: pair.mainSynergy,
    score: pair.score,
    tier: pair.tier,
    confidence: pair.confidence
  })),
  classes: quickClasses
};

const v5Meta = {
  version: authoritative.version,
  gameVersion: authoritative.gameVersion,
  characterTierlist: tierlist,
  methodology,
  confidence: authoritative.confidence,
  warnings: authoritative.warnings,
  changelog: [
    'Абсолютная редакционная шкала вместо принудительной нормализации 0–10.',
    'Снижена автоматическая переоценка setup- и ult-зависимых персонажей.',
    'Быстрые ДУО-закупы производятся из полной базы пар.',
    'Для каждого персонажа добавлены отдельные SOLO PvP и PvE-наборы.',
    'Для каждой из 1891 пар добавлены confidence и расширенные контр-корректировки.'
  ]
};

writeWindowData(offlinePath, 'CSK_OFFLINE_DATA', v5Offline);
writeWindowData(path.join(projectDir, 'data', 'duo-authoritative-v3.js'), 'CSK_DUO_V3', v5Authoritative);
writeWindowData(path.join(projectDir, 'data', 'duo-summary-v3.js'), 'CSK_DUO_DATA_V3', v5Summary);
writeWindowData(path.join(projectDir, 'data', 'v5-meta.js'), 'CSK_V5_META', v5Meta);

console.log(`V5 generated: ${v5Classes.length} SOLO, ${quickClasses.length} quick DUO, ${v5Pairs.length} full DUO.`);
console.log(`Score range: ${Math.min(...duoRatings.map((pair) => pair.score))}–${Math.max(...duoRatings.map((pair) => pair.score))}.`);
