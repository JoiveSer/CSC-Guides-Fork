(() => {
  'use strict';

  const offline = window.CSK_OFFLINE_DATA || { classes: [], tips: [], useful: [] };
  const duo = window.CSK_DUO_DATA_V3 || { classes: [], topPairs: [], rules: [] };
  const allDuo = window.CSK_DUO_V3 || { pair_count: 0, characters: [], topPairs: [], pairs: [] };
  const classes = Array.isArray(offline.classes) ? offline.classes : [];
  const duoClasses = Array.isArray(duo.classes) ? duo.classes : [];
  const classByName = new Map(classes.map(item => [item.name, item]));
  const duoByName = new Map(duoClasses.map(item => [item.name, item]));
  const imbaPairs = Array.isArray(allDuo.pairs) ? allDuo.pairs : [];
  const imbaCharacters = Array.isArray(allDuo.characters) ? allDuo.characters : [];
  const pairKey = (left, right) => [left, right].sort((a, b) => a.localeCompare(b, 'ru')).join('\u0000');
  const imbaByPair = new Map(imbaPairs.map(pair => [pairKey(pair.pair?.[0], pair.pair?.[1]), pair]));
  const rankedPairKeys = Array.isArray(allDuo.topPairs)
    ? allDuo.topPairs.map(pair => pairKey(pair?.[0], pair?.[1]))
    : [];
  const rankedPairs = rankedPairKeys.map(key => imbaByPair.get(key)).filter(Boolean);
  const rankedKeySet = new Set(rankedPairKeys);
  const topImbaPairs = [
    ...rankedPairs,
    ...imbaPairs
      .filter(pair => pair.pair?.[0] && pair.pair?.[1] && pair.pair[0] !== pair.pair[1] && !rankedKeySet.has(pairKey(...pair.pair)))
      .sort((a, b) => (b.score || 0) - (a.score || 0) || pairKey(...a.pair).localeCompare(pairKey(...b.pair), 'ru'))
  ];
  let openAllBuilds = () => {};

  const state = {
    route: 'home',
    drawerMode: null,
    drawerName: null,
    drawerTab: null,
    tipsCategory: 'Все',
    homeBuildMode: 'pvp',
    allBuildsMode: 'pvp',
    allBuildsPair: null
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const iconFor = name => classByName.get(name)?.icon || `assets/icons/${encodeURIComponent(name)}.png`;

  function setRoute(route) {
    if (!['home','solo','duo','tips','useful'].includes(route)) route = 'home';
    state.route = route;
    $$('.page').forEach(page => page.classList.toggle('active', page.dataset.page === route));
    $$('[data-route]').forEach(btn => btn.classList.toggle('active', btn.dataset.route === route));
    closeMenu();
    closeDrawer();
    try { history.replaceState(null, '', route === 'home' ? location.pathname : `#${route}`); } catch (_) {}
    window.scrollTo({ top: 0, behavior: 'auto' });
    $('#app')?.focus({ preventScroll: true });
  }

  function openMenu() {
    const menu = $('#mobileMenu');
    const button = $('#menuButton');
    menu.classList.add('open');
    button.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', 'Закрыть меню');
    menu.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-open');
    const activeItem = $('.mobile-menu-nav .active', menu) || $('.mobile-menu-nav button', menu);
    requestAnimationFrame(() => activeItem?.focus());
  }
  function closeMenu() {
    const menu = $('#mobileMenu');
    const button = $('#menuButton');
    menu.classList.remove('open');
    button.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Открыть меню');
    menu.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
  }

  function applyTheme(theme) {
    const themes = ['studio', 'night'];
    if (!themes.includes(theme)) theme = 'night';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('csc-theme-v3', theme);
    $$('[data-set-theme]').forEach(button => {
      const active = button.dataset.setTheme === theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const themeColors = { studio: '#e9ecea', night: '#06090d' };
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme]);
  }

  function setupReveals() {
    const items = $$('[data-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(item => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(item => observer.observe(item));
  }

  function openThemePicker() {
    const picker = $('#themePicker');
    picker.hidden = false;
    $('#themeButton').setAttribute('aria-expanded', 'true');
  }

  function closeThemePicker() {
    $('#themePicker').hidden = true;
    $('#themeButton').setAttribute('aria-expanded', 'false');
  }

  function makeCharacterCard(item, mode) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-card';
    button.dataset.name = item.name;
    button.innerHTML = `<img src="${escapeHtml(iconFor(item.name))}" alt="" loading="lazy"><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>`;
    button.addEventListener('click', () => openDrawer(mode, item.name));
    return button;
  }

  function renderCharacterGrid(grid, items, mode) {
    const fragment = document.createDocumentFragment();
    items.forEach(item => fragment.append(makeCharacterCard(item, mode)));
    grid.replaceChildren(fragment);
  }

  function setupSearch(input, grid, count, empty, allItems, mode, matcher) {
    const run = () => {
      const query = input.value.trim().toLocaleLowerCase('ru');
      const filtered = query ? allItems.filter(item => matcher(item).toLocaleLowerCase('ru').includes(query)) : allItems;
      renderCharacterGrid(grid, filtered, mode);
      count.textContent = `${filtered.length} из ${allItems.length}`;
      empty.hidden = filtered.length !== 0;
    };
    input.addEventListener('input', run);
    run();
  }

  const cleanMarkdown = value => String(value || '').replace(/\*\*/g, '');

  function pairBuildCards(pair, mode, compact = false) {
    const builds = pair?.[mode] || {};
    const names = Object.keys(builds);
    return names.map((label, index) => {
      const character = /^Игрок\s/.test(label) ? pair.pair[index] : label;
      const items = builds[label] || [];
      return `<article class="pair-build-card${compact ? ' compact' : ''}">
        <header><img src="${escapeHtml(iconFor(character))}" alt=""><span><small>${escapeHtml(label)}</small><strong>${escapeHtml(character)}</strong></span></header>
        <ol>${items.map((item, itemIndex) => `<li><span>${String(itemIndex + 1).padStart(2, '0')}</span>${escapeHtml(item)}</li>`).join('')}</ol>
      </article>`;
    }).join('');
  }

  function homePairMarkup(pair) {
    if (!pair) return '<div class="finder-empty">Для этой пары пока нет данных.</div>';
    const [left, right] = pair.pair;
    return `<div class="finder-result-head">
        <span class="finder-result-icons"><img src="${escapeHtml(iconFor(left))}" alt=""><img src="${escapeHtml(iconFor(right))}" alt=""></span>
        <span><small>ГОТОВАЯ СВЯЗКА</small><strong>${escapeHtml(left)} + ${escapeHtml(right)}</strong></span>
        <span class="tier-badge tier-${escapeHtml(pair.tier).replace('+', 'plus').toLowerCase()}">${escapeHtml(pair.tier)}<small>${escapeHtml(pair.score)}/10</small></span>
      </div>
      <p class="finder-reason">${escapeHtml(pair.reason)}</p>
      <div class="finder-builds">${pairBuildCards(pair, state.homeBuildMode, true)}</div>`;
  }

  function battlePlanMarkup(pair) {
    if (!pair) return '';
    return `<div class="battle-plan-head">
        <span><small>РОЛИ В ПАРЕ</small><strong>${escapeHtml(pair.pair.join(' + '))}</strong></span>
        <span class="score-orb">${escapeHtml(pair.score)}<small>/ 10</small></span>
      </div>
      <div class="battle-roles"><span><small>Держит командные</small><strong>${escapeHtml(pair.holder)}</strong></span><span><small>Основной урон</small><strong>${escapeHtml(pair.carry)}</strong></span></div>
      <ol class="combo-steps">${(pair.combo || []).map((step, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(cleanMarkdown(step))}</p></li>`).join('')}</ol>`;
  }

  function renderHome() {
    const first = $('#homeFirst');
    const second = $('#homeSecond');
    const result = $('#homePairResult');
    const battlePlan = $('#homeBattlePlan');
    const topContainer = $('#homeTopPairsV2');
    if (!first || !second || !result || !battlePlan || !topContainer) return;

    $('#homeV2PairCount').textContent = allDuo.pair_count || allDuo.pairCount || imbaPairs.length;
    $('#homeV2ClassCount').textContent = imbaCharacters.length || classes.length;
    const options = imbaCharacters.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    first.innerHTML = options;
    second.innerHTML = options;
    first.value = imbaCharacters.includes('Алхимик') ? 'Алхимик' : imbaCharacters[0] || '';
    second.value = imbaCharacters.includes('Некромант') ? 'Некромант' : imbaCharacters[1] || imbaCharacters[0] || '';

    const update = () => {
      const pair = imbaByPair.get(pairKey(first.value, second.value));
      $('#homeFirstIcon').src = iconFor(first.value);
      $('#homeFirstIcon').alt = '';
      $('#homeSecondIcon').src = iconFor(second.value);
      $('#homeSecondIcon').alt = '';
      result.innerHTML = homePairMarkup(pair);
      battlePlan.innerHTML = battlePlanMarkup(pair);
      $$('[data-home-mode]').forEach(button => button.classList.toggle('active', button.dataset.homeMode === state.homeBuildMode));
    };

    first.addEventListener('change', update);
    second.addEventListener('change', update);
    $$('[data-home-mode]').forEach(button => button.addEventListener('click', () => {
      state.homeBuildMode = button.dataset.homeMode;
      update();
    }));

    topContainer.replaceChildren(...topImbaPairs.slice(0, 8).map((pair, index) => {
      const [left, right] = pair.pair;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'imba-pair-card';
      button.innerHTML = `<span class="imba-pair-rank">${String(index + 1).padStart(2, '0')}</span><span class="pair-icons"><img src="${escapeHtml(iconFor(left))}" alt=""><img src="${escapeHtml(iconFor(right))}" alt=""></span><span class="imba-pair-copy"><strong>${escapeHtml(left)} + ${escapeHtml(right)}</strong><small>${escapeHtml(pair.reason)}</small></span><span class="imba-score"><strong>${escapeHtml(pair.score)}</strong><small>${escapeHtml(pair.tier)} TIER</small></span>`;
      button.addEventListener('click', () => {
        first.value = left;
        second.value = right;
        update();
        $('.duo-finder')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return button;
    }));
    update();
  }

  function renderTopPairs() {
    const container = $('#topPairs');
    container.replaceChildren(...topImbaPairs.slice(0, 10).map((pair, index) => {
      const [left, right] = pair.pair;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'top-pair-card';
      button.innerHTML = `<span class="pair-icons"><img src="${escapeHtml(iconFor(left))}" alt=""><img src="${escapeHtml(iconFor(right))}" alt=""></span><span class="top-pair-copy"><strong>${index + 1}. ${escapeHtml(left)} + ${escapeHtml(right)}</strong><small>${escapeHtml(pair.reason)}</small></span><span class="top-pair-tier"><strong>${escapeHtml(pair.score)}</strong><small>${escapeHtml(pair.tier)} TIER</small></span><b>→</b>`;
      button.addEventListener('click', () => openAllBuilds(pair));
      return button;
    }));
  }

  function openDrawer(mode, name, tab) {
    const item = mode === 'solo' ? classByName.get(name) : duoByName.get(name);
    if (!item) return;
    state.drawerMode = mode;
    state.drawerName = name;
    state.drawerTab = tab || (mode === 'solo' ? 'builds' : 'build');
    $('#drawerIcon').src = iconFor(name);
    $('#drawerIcon').alt = name;
    $('#drawerTitle').textContent = name;
    $('#drawerMode').textContent = mode === 'solo' ? 'СОЛО' : 'ДУО';
    renderDrawerTabs();
    renderDrawerBody();
    $('#drawerBackdrop').hidden = false;
    requestAnimationFrame(() => $('#detailDrawer').classList.add('open'));
    $('#detailDrawer').setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    const drawer = $('#detailDrawer');
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
    setTimeout(() => { $('#drawerBackdrop').hidden = true; }, 240);
  }

  function renderDrawerTabs() {
    const tabs = state.drawerMode === 'solo'
      ? [['builds','Закупы'],['tips','Советы'],['counters','Контры']]
      : [['build','Закуп'],['pairs','Лучшие пары']];
    $('#drawerTabs').replaceChildren(...tabs.map(([id, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.toggle('active', state.drawerTab === id);
      button.textContent = label;
      button.addEventListener('click', () => { state.drawerTab = id; renderDrawerTabs(); renderDrawerBody(); });
      return button;
    }));
  }

  function renderSoloBody(item) {
    if (state.drawerTab === 'tips' || state.drawerTab === 'counters') {
      const values = item[state.drawerTab] || [];
      const title = state.drawerTab === 'tips' ? 'Советы по персонажу' : 'Как контрить';
      return `<section class="drawer-section"><div class="drawer-section-title">${title}</div>${values.length ? `<ul class="note-list">${values.map(v => `<li>${escapeHtml(v)}</li>`).join('')}</ul>` : '<p class="empty-state">Пока нет данных.</p>'}</section>`;
    }
    const builds = item.builds || [];
    return `<section class="drawer-section"><div class="drawer-section-title">Варианты закупа</div>${builds.length ? builds.map(build => `<article class="build-card"><h3>${escapeHtml(build.title || 'Закуп')}</h3><ul class="build-list">${(build.items || []).map(line => `<li>${line}</li>`).join('')}</ul></article>`).join('') : '<p class="empty-state">Пока нет данных.</p>'}</section>`;
  }

  function renderDuoBody(item) {
    if (state.drawerTab === 'pairs') {
      const pairs = item.pairs || [];
      return `<section class="drawer-section"><div class="drawer-section-title">Лучшие союзники · рейтинг DUO v4</div><div class="pair-list">${pairs.map(pair => `<button class="pair-row" type="button" data-open-exact-pair="${escapeHtml(item.name)}" data-pair-ally="${escapeHtml(pair.name)}"><img src="${escapeHtml(iconFor(pair.name))}" alt=""><span><strong>${pair.rank}. ${escapeHtml(pair.name)} · ${escapeHtml(pair.tier || '')} ${escapeHtml(pair.score ?? '')}</strong><small>${escapeHtml(pair.description || 'Рекомендуемая синергия для этого пика.')}</small></span><b>→</b></button>`).join('')}</div></section>`;
    }
    return `<section class="drawer-section"><div class="drawer-section-title">${escapeHtml(item.buildLabel || 'Универсальный ДУО-закуп')}</div><ol class="duo-build-list">${(item.build || []).map(entry => `<li><span class="slot">${escapeHtml(entry.slot)}</span><span><strong>${escapeHtml(entry.item)}</strong>${entry.replacement ? `<small>→ ${escapeHtml(entry.replacement)}</small>` : ''}</span></li>`).join('')}</ol>${item.shard ? `<div class="shard-row">${escapeHtml(item.shard)}</div>` : ''}</section><section class="drawer-section"><div class="drawer-section-title">Выбери союзника — откроется точный закуп пары</div><div class="pair-list">${(item.pairs || []).slice(0,5).map(pair => `<button class="pair-row" type="button" data-open-exact-pair="${escapeHtml(item.name)}" data-pair-ally="${escapeHtml(pair.name)}"><img src="${escapeHtml(iconFor(pair.name))}" alt=""><span><strong>${pair.rank}. ${escapeHtml(pair.name)} · ${escapeHtml(pair.tier || '')} ${escapeHtml(pair.score || '')}</strong><small>${escapeHtml(pair.description || 'Один из лучших вариантов для этого персонажа.')}</small></span><b>→</b></button>`).join('')}</div></section>`;
  }

  function renderDrawerBody() {
    const item = state.drawerMode === 'solo' ? classByName.get(state.drawerName) : duoByName.get(state.drawerName);
    const body = $('#drawerBody');
    body.innerHTML = state.drawerMode === 'solo' ? renderSoloBody(item) : renderDuoBody(item);
    $$('[data-open-exact-pair]', body).forEach(button => button.addEventListener('click', () => {
      const pair = imbaByPair.get(pairKey(button.dataset.openExactPair, button.dataset.pairAlly));
      if (pair) openAllBuilds(pair);
    }));
    body.scrollTop = 0;
  }

  function renderTips() {
    const tips = Array.isArray(offline.tips) ? offline.tips : [];
    const categories = ['Все', ...new Set(tips.map(item => item.category || 'Другое'))];
    const filters = $('#tipsFilters');
    const list = $('#tipsList');

    function draw() {
      filters.replaceChildren(...categories.map(category => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-button';
        button.classList.toggle('active', state.tipsCategory === category);
        button.textContent = category;
        button.addEventListener('click', () => { state.tipsCategory = category; draw(); });
        return button;
      }));
      const shown = state.tipsCategory === 'Все' ? tips : tips.filter(item => (item.category || 'Другое') === state.tipsCategory);
      list.innerHTML = shown.map(item => `<article class="article-card${item.important ? ' important' : ''}"><header><h3>${escapeHtml(item.title || 'Совет')}</h3><span class="category">${escapeHtml(item.category || 'Другое')}</span></header><p>${escapeHtml(item.content || '')}</p></article>`).join('');
    }
    draw();
  }

  function renderUseful() {
    const items = Array.isArray(offline.useful) ? offline.useful : [];
    $('#usefulList').innerHTML = items.map(item => `<a class="link-card" href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHtml(item.title || item.url)}</strong><small>${escapeHtml(item.description || item.category || '')}</small></span><b>↗</b></a>`).join('');
  }

  function renderRules() {
    $('#rulesList').innerHTML = (duo.rules || []).map(rule => `<li>${escapeHtml(rule)}</li>`).join('');
  }

  function renderAllBuildsDetail(pair) {
    const detail = $('#allBuildsDetail');
    if (!detail || !pair) return;
    const [left, right] = pair.pair;
    const scoreLabels = {
      combat: 'Индивидуальная боевая сила',
      roleCoverage: 'Покрытие ролей',
      controlRealization: 'Реализация контроля',
      damageSynergy: 'Синергия урона',
      sustain: 'Лечение и живучесть',
      pveEconomy: 'PvE и экономика',
      damageDiversity: 'Разнообразие типов урона',
      reliability: 'Надёжность плана',
      slotEfficiency: 'Эффективность слотов',
      execution: 'Простота реализации'
    };
    const confidenceLabels = { high: 'высокая', medium: 'средняя', low: 'низкая' };
    const breakdown = Object.entries(pair.scoreBreakdown || {});
    const weaknesses = Array.isArray(pair.weaknesses) ? pair.weaknesses : [];
    const adjustments = Array.isArray(pair.counterAdjustments) ? pair.counterAdjustments : [];
    detail.innerHTML = `
      <div class="all-pair-title">
        <div class="all-pair-icons"><img src="${escapeHtml(iconFor(left))}" alt=""><img src="${escapeHtml(iconFor(right))}" alt=""></div>
        <div><span>DUO V4 · ТОЧНЫЙ ПЛАН ПАРЫ</span><h3>${escapeHtml(left)} + ${escapeHtml(right)}</h3></div>
        <span class="all-pair-score"><strong>${escapeHtml(pair.score)}</strong><small>${escapeHtml(pair.tier)} TIER</small><small>Теоретическая оценка по механикам CSC 3.3, не серверный винрейт.</small></span>
      </div>
      <div class="all-pair-meta"><span><small>Командные предметы</small><strong>${escapeHtml(pair.holder)}</strong></span><span><small>Основной урон</small><strong>${escapeHtml(pair.carry)}</strong></span></div>
      <section class="all-pair-note accent"><span>Почему работает</span><p>${escapeHtml(pair.reason)}</p></section>
      <div class="all-mode-switch" aria-label="Режим полного закупа">
        <button class="${state.allBuildsMode === 'pvp' ? 'active' : ''}" type="button" data-detail-mode="pvp">PvP <small>против игроков</small></button>
        <button class="${state.allBuildsMode === 'pve' ? 'active' : ''}" type="button" data-detail-mode="pve">PvE <small>против волн</small></button>
      </div>
      <div class="all-build-grid v2">${pairBuildCards(pair, state.allBuildsMode)}</div>
      <section class="all-combo-section"><span>Как разыгрывать</span><ol class="combo-steps">${(pair.combo || pair.how || []).map((step, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(cleanMarkdown(step))}</p></li>`).join('')}</ol></section>
      <details class="all-combo-section">
        <summary>Почему такая оценка</summary>
        <p class="finder-reason">Уверенность: ${escapeHtml(confidenceLabels[pair.confidence] || pair.confidence || 'не указана')}. Шкала относительная: от 0.00 до 10.00 среди текущих 1891 сочетания.</p>
        <ol class="combo-steps">${breakdown.map(([key, value], index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(scoreLabels[key] || key)} — ${escapeHtml(value)}</p></li>`).join('')}</ol>
      </details>
      ${weaknesses.length ? `<section class="all-pair-note"><span>Слабые стороны</span><p>${weaknesses.map(escapeHtml).join(' · ')}</p></section>` : ''}
      ${adjustments.length ? `<section class="all-combo-section"><span>Корректировки против контрпиков</span><ul class="note-list">${adjustments.map(item => `<li><strong>${escapeHtml(item.against)}</strong>: ${escapeHtml(item.change)}</li>`).join('')}</ul></section>` : ''}
    `;
    detail.scrollTop = 0;
  }

  function setupAllBuilds() {
    const dialog = $('#allBuildsDialog');
    const openButton = $('#allBuildsButton');
    const first = $('#allBuildsFirst');
    const second = $('#allBuildsSecond');
    const search = $('#allBuildsSearch');
    const results = $('#allBuildsResults');
    const count = $('#allBuildsCount');
    const detail = $('#allBuildsDetail');
    if (!dialog || !openButton || !first || !second || !search || !results || !count || !detail) return;

    if (!imbaPairs.length) {
      if (openButton) {
        openButton.disabled = true;
        openButton.title = 'Данные полного справочника не загрузились';
      }
      return;
    }

    const optionHtml = imbaCharacters.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    first.insertAdjacentHTML('beforeend', optionHtml);
    second.insertAdjacentHTML('beforeend', optionHtml);

    const entries = topImbaPairs.concat(imbaPairs.filter(pair => pair.pair?.[0] === pair.pair?.[1])).map((pair, index) => ({
      pair,
      index,
      search: [pair.pair?.join(' '), pair.tier, pair.reason, pair.holder, pair.carry, ...(pair.combo || []), ...Object.values(pair.pvp || {}).flat(), ...Object.values(pair.pve || {}).flat()].join(' ').toLocaleLowerCase('ru')
    }));

    const selectPair = index => {
      const pair = entries[index]?.pair;
      if (!pair) return;
      state.allBuildsPair = index;
      $$('[data-all-pair]', results).forEach(button => button.classList.toggle('active', Number(button.dataset.allPair) === index));
      renderAllBuildsDetail(pair);
    };

    const pairCountLabel = value => {
      const mod10 = value % 10;
      const mod100 = value % 100;
      if (mod10 === 1 && mod100 !== 11) return `${value} сочетание`;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} сочетания`;
      return `${value} сочетаний`;
    };

    const draw = () => {
      const firstName = first.value;
      const secondName = second.value;
      const query = search.value.trim().toLocaleLowerCase('ru');
      const filtered = entries.filter(entry => {
        const [left, right] = entry.pair.pair;
        if (firstName && left !== firstName && right !== firstName) return false;
        if (secondName && left !== secondName && right !== secondName) return false;
        if (firstName && secondName && firstName === secondName && (left !== firstName || right !== firstName)) return false;
        return !query || entry.search.includes(query);
      });
      const shown = filtered.slice(0, 100);
      count.textContent = filtered.length > shown.length
        ? `${pairCountLabel(filtered.length)} · показаны первые ${shown.length}`
        : pairCountLabel(filtered.length);
      results.innerHTML = shown.length ? shown.map(entry => `
        <button type="button" data-all-pair="${entry.index}">
          <span><img src="${escapeHtml(iconFor(entry.pair.pair[0]))}" alt=""><img src="${escapeHtml(iconFor(entry.pair.pair[1]))}" alt=""></span>
          <div><strong>${escapeHtml(entry.pair.pair.join(' + '))}</strong><small>${escapeHtml(entry.pair.reason || 'Готовый закуп')}</small></div>
          <em><strong>${escapeHtml(entry.pair.score)}</strong><small>${escapeHtml(entry.pair.tier)}</small></em><b>→</b>
        </button>
      `).join('') : '<p class="all-builds-no-results">Сочетание не найдено.</p>';
      if (filtered.length === 1) selectPair(filtered[0].index);
      else if (state.allBuildsPair !== null && shown.some(entry => entry.index === state.allBuildsPair)) selectPair(state.allBuildsPair);
    };

    results.addEventListener('click', event => {
      const button = event.target.closest('[data-all-pair]');
      if (button) selectPair(Number(button.dataset.allPair));
    });
    detail.addEventListener('click', event => {
      const button = event.target.closest('[data-detail-mode]');
      if (!button || state.allBuildsPair === null) return;
      state.allBuildsMode = button.dataset.detailMode;
      renderAllBuildsDetail(entries[state.allBuildsPair]?.pair);
    });
    first.addEventListener('change', draw);
    second.addEventListener('change', draw);
    search.addEventListener('input', draw);
    dialog.addEventListener('close', () => document.body.classList.remove('all-builds-open'));
    openAllBuilds = pair => {
      if (pair?.pair) {
        first.value = pair.pair[0];
        second.value = pair.pair[1];
        const targetIndex = entries.findIndex(entry => entry.pair === pair || pairKey(...entry.pair.pair) === pairKey(...pair.pair));
        state.allBuildsPair = targetIndex >= 0 ? targetIndex : null;
      }
      draw();
      if (state.allBuildsPair !== null) selectPair(state.allBuildsPair);
      document.body.classList.add('all-builds-open');
      dialog.showModal();
      requestAnimationFrame(() => search.focus());
    };
    openButton?.addEventListener('click', () => openAllBuilds());
    $$('[data-open-all-builds]').forEach(button => button.addEventListener('click', () => openAllBuilds()));
    draw();
  }

  function init() {
    renderHome();
    renderTopPairs();
    renderTips();
    renderUseful();
    renderRules();
    setupAllBuilds();
    setupReveals();

    setupSearch($('#soloSearch'), $('#soloGrid'), $('#soloCount'), $('#soloEmpty'), classes, 'solo', item => item.name);
    setupSearch($('#duoSearch'), $('#duoGrid'), $('#duoCount'), $('#duoEmpty'), duoClasses, 'duo', item => [item.name, ...(item.build || []).flatMap(v => [v.item, v.replacement]), ...(item.pairs || []).map(v => v.name)].join(' '));

    $$('[data-route]').forEach(button => button.addEventListener('click', () => setRoute(button.dataset.route)));
    $('#menuButton').addEventListener('click', () => $('#mobileMenu').classList.contains('open') ? closeMenu() : openMenu());
    $('#themeButton').addEventListener('click', event => {
      event.stopPropagation();
      $('#themePicker').hidden ? openThemePicker() : closeThemePicker();
    });
    $$('[data-set-theme]').forEach(button => button.addEventListener('click', () => {
      applyTheme(button.dataset.setTheme);
      closeThemePicker();
      $('#themeButton').focus();
    }));
    $('#themePicker').addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', closeThemePicker);
    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#drawerBackdrop').addEventListener('click', closeDrawer);
    $('#rulesButton').addEventListener('click', () => $('#rulesDialog').showModal());
    $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const menuWasOpen = $('#mobileMenu').classList.contains('open');
        closeMenu();
        closeDrawer();
        closeThemePicker();
        if (menuWasOpen) $('#menuButton').focus();
      }
      if (event.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) {
        event.preventDefault();
        if (state.route === 'solo') $('#soloSearch').focus();
        if (state.route === 'duo') $('#duoSearch').focus();
      }
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 980) closeMenu(); });

    const savedTheme = localStorage.getItem('csc-theme-v3');
    applyTheme(savedTheme || 'night');

    const hashRoute = location.hash.replace('#','');
    setRoute(['solo','duo','tips','useful'].includes(hashRoute) ? hashRoute : 'home');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
