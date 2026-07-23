const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('assets/app/app.css', 'utf8');
const context = { window: {} };
vm.createContext(context);
[
  'data/offline-data.js',
  'data/duo-authoritative-v3.js',
  'data/duo-summary-v3.js',
  'data/v5-meta.js'
].forEach(file => vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }));

const offline = context.window.CSK_OFFLINE_DATA;
const database = context.window.CSK_DUO_V3;
const quick = context.window.CSK_DUO_DATA_V3;
const meta = context.window.CSK_V5_META;
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
const openingBraces = (css.match(/{/g) || []).length;
const closingBraces = (css.match(/}/g) || []).length;
const localReferences = [...html.matchAll(/(?:src|href)="(\.\/[^"#?]+)[^" ]*"/g)].map(match => match[1]);
const missingFiles = localReferences.filter(reference => !fs.existsSync(decodeURIComponent(reference.slice(2))));
const missingCharacterIcons = (database?.characters || []).filter(name => !fs.existsSync(`assets/icons/${name}.png`));
const pairKey = (left, right) => [left, right].sort((a, b) => a.localeCompare(b, 'ru')).join('\u0000');
const fullByPair = new Map((database?.pairs || []).map(pair => [pairKey(...pair.pair), pair]));
const quickScoreMismatches = (quick?.classes || []).flatMap(character => (
  character.pairs.map(pair => ({ character: character.name, pair }))
)).filter(({ character, pair }) => fullByPair.get(pairKey(character, pair.name))?.score !== pair.score);

const report = {
  pairs: database?.pairs?.length,
  characters: database?.characters?.length,
  soloCharacters: offline?.classes?.length,
  soloBuildCounts: [...new Set((offline?.classes || []).map(character => character.builds.length))],
  quickCharacters: quick?.classes?.length,
  tierlistCharacters: meta?.characterTierlist?.length,
  uniquePairs: new Set((database?.pairs || []).map(pair => pairKey(...pair.pair))).size,
  scoreRange: [
    Math.min(...(database?.pairs || []).map(pair => pair.score)),
    Math.max(...(database?.pairs || []).map(pair => pair.score))
  ],
  quickScoreMismatches: quickScoreMismatches.length,
  duplicateIds,
  cssBraces: [openingBraces, closingBraces],
  missingFiles,
  missingCharacterIcons,
  activeScripts: [
    'offline-data.js',
    'duo-authoritative-v3.js',
    'duo-summary-v3.js',
    'v5-meta.js',
    'assets/app/app.js'
  ].every(name => html.includes(name)),
  legacyScripts: ['duo-imba-v2.js', 'duo-all-builds.js', 'duo-data.js'].filter(name => html.includes(name))
};

console.log(JSON.stringify(report, null, 2));

if (
  report.pairs !== 1891 ||
  report.characters !== 61 ||
  report.soloCharacters !== 61 ||
  report.soloBuildCounts.join() !== '5' ||
  report.quickCharacters !== 61 ||
  report.tierlistCharacters !== 61 ||
  report.uniquePairs !== 1891 ||
  report.quickScoreMismatches ||
  duplicateIds.length ||
  openingBraces !== closingBraces ||
  missingFiles.length ||
  missingCharacterIcons.length ||
  !report.activeScripts ||
  report.legacyScripts.length
) {
  process.exitCode = 1;
}
