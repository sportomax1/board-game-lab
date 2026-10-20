/* Collection Explorer — cache-first BGG browser.
   Thing batches contain at most 20 IDs and run through up to 100 genuine
   concurrent requests, with exponential retry on transient failures. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const API = '/api/bgg-helper';
  const DB_NAME = 'board-game-lab-collection-explorer';
  const DB_VERSION = 1;
  const BATCH_SIZE = 20;
  const WORKER_COUNT = 100;
  const META_TTL_MS = 30 * 86400000;
  const PAGE_SIZE = 60;
  const STATUS_FIELDS = [
    ['own', 'Owned'], ['prevowned', 'Previously owned'], ['fortrade', 'For trade'],
    ['want', 'Want'], ['wishlist', 'Wishlist'], ['wanttoplay', 'Want to play'],
    ['wanttobuy', 'Want to buy'], ['preordered', 'Preordered']
  ];
  const FACETS = [
    {key:'title', label:'Game', icon:'▣'},
    {key:'publisher', label:'Publisher', icon:'▤'},
    {key:'designer', label:'Designer', icon:'✎'},
    {key:'artist', label:'Artist', icon:'◈'},
    {key:'mechanic', label:'Mechanic', icon:'⚙'},
    {key:'category', label:'Category', icon:'▦'},
    {key:'family', label:'Family', icon:'♧'},
    {key:'year', label:'Year', icon:'▦'},
    {key:'players', label:'Players', icon:'♟'},
    {key:'playtime', label:'Playtime', icon:'◷'},
    {key:'weightBand', label:'Complexity', icon:'◉'},
    {key:'ratingBand', label:'BGG rating', icon:'★'},
    {key:'status', label:'Status', icon:'✓'},
    {key:'type', label:'Type', icon:'◇'}
  ];
  const FACET_MAP = new Map(FACETS.map(f => [f.key, f]));
  const CREDIT_FIELDS = ['publisher', 'designer', 'artist'];
  const CREDIT_PROPS = {publisher:'publishers', designer:'designers', artist:'artists'};
  const state = {
    username:'', items:[], metadata:new Map(), games:[], index:[],
    chips:[], query:'', results:[], visible:PAGE_SIZE, selectedSuggestion:0,
    loading:false, controller:null, runId:0, failedBatches:[],
    hasCollection:false, cacheAvailable:true, cacheAt:0, initialUrlApplied:false,
    activeFacet:'',
    creditScopes:{publisher:'all', designer:'all', artist:'all'}
  };
  let db = null;
  let suggestionRows = [];
  let renderTimer = null;
  let urlTimer = null;

  function normalize(value) {
    return String(value == null ? '' : value).normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  }
  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function validId(value) {
    const s = String(value == null ? '' : value);
    return /^\d+$/.test(s) && Number(s) > 0 ? s : '';
  }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function node(tag, className, value) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (value != null) n.textContent = String(value);
    return n;
  }
  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) return reject(new DOMException('Stopped', 'AbortError'));
      const t = setTimeout(done, ms);
      function done() { if (signal) signal.removeEventListener('abort', cancel); resolve(); }
      function cancel() {
        clearTimeout(t);
        if (signal) signal.removeEventListener('abort', cancel);
        reject(new DOMException('Stopped', 'AbortError'));
      }
      if (signal) signal.addEventListener('abort', cancel, {once:true});
    });
  }
  function isAbort(error) { return error && error.name === 'AbortError'; }
  function setMessage(message, type) {
    $('message').textContent = message;
    $('message').className = 'message' + (type ? ' ' + type : '');
  }
  function setProgress(label, fraction) {
    $('progressWrap').hidden = false;
    $('progressText').textContent = label;
    const p = Math.round(Math.max(0, Math.min(1, fraction || 0)) * 100);
    $('progressPct').textContent = p + '%';
    $('progressBar').style.width = p + '%';
  }
  function setBusy(on) {
    state.loading = on;
    $('loadBtn').disabled = on;
    $('refreshBtn').disabled = on || !state.hasCollection;
    $('refreshMetaBtn').disabled = on || !state.hasCollection;
    $('stopBtn').hidden = !on;
    if (!on) $('progressWrap').hidden = true;
  }
  function setEnabled(enabled) {
    ['search','statusScope','sort','exportBtn'].forEach(id => { $(id).disabled = !enabled; });
    $('refreshBtn').disabled = !enabled || state.loading;
    $('refreshMetaBtn').disabled = !enabled || state.loading;
  }
  function note(text, retry) {
    const host = $('workInfo');
    host.replaceChildren();
    if (text) host.append(node('span', '', text));
    if (retry && state.failedBatches.length && !state.loading) {
      const button = node('button', 'text-button', ' · Retry ' + state.failedBatches.length + ' failed batches');
      button.type = 'button';
      button.addEventListener('click', () => runEnrichment(false, state.failedBatches.map(x => x.slice())));
      host.append(button);
    }
  }

  async function openDb() {
    if (!('indexedDB' in window)) throw new Error('IndexedDB unavailable');
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('games')) d.createObjectStore('games', {keyPath:'id'});
        if (!d.objectStoreNames.contains('collections')) d.createObjectStore('collections', {keyPath:'username'});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open IndexedDB'));
      req.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
    });
  }
  async function initializeDb() {
    try {
      db = await openDb();
      db.onversionchange = () => { db.close(); db = null; };
    } catch (error) {
      state.cacheAvailable = false;
      note('Local caching unavailable; this session will still work.');
    }
  }
  function readStore(store, key) {
    if (!db) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  function readMetadata() {
    if (!db) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const req = db.transaction('games', 'readonly').objectStore('games').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  function writeCollection(record) {
    if (!db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite');
      tx.objectStore('collections').put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  function writeMetadata(records) {
    if (!db || !records.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('games', 'readwrite');
      const store = tx.objectStore('games');
      records.forEach(record => store.put(record));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  function xmlDoc(raw) {
    const doc = new DOMParser().parseFromString(raw, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid XML returned by BGG.');
    return doc;
  }
  function xmlAttr(parent, selector, attribute) {
    return parent?.querySelector(selector)?.getAttribute(attribute || 'value') || '';
  }
  function linkList(parent, type) {
    const seen = new Set();
    return Array.from(parent.querySelectorAll('link[type="' + type + '"]'))
      .map(link => ({id:validId(link.getAttribute('id')), name:link.getAttribute('value') || ''}))
      .filter(item => {
        const key = normalize(item.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }
  function parseCollection(doc) {
    return Array.from(doc.querySelectorAll('item[objectid]')).map(item => {
      const id = validId(item.getAttribute('objectid'));
      if (!id) return null;
      const statusElement = item.querySelector('status');
      const statuses = {};
      STATUS_FIELDS.forEach(row => { statuses[row[0]] = statusElement?.getAttribute(row[0]) === '1'; });
      const userRating = item.querySelector('stats > rating');
      return {
        id:id, title:(item.querySelector('name')?.textContent || '').trim() || 'BGG #' + id,
        thumb:(item.querySelector('thumbnail')?.textContent || '').trim(),
        year:num((item.querySelector('yearpublished')?.textContent || '').trim()),
        subtype:item.getAttribute('subtype') || 'boardgame',
        statuses:statuses,
        personalRating:num(userRating?.getAttribute('value')),
        plays:num(item.querySelector('numplays')?.textContent)
      };
    }).filter(Boolean);
  }
  function parseThing(doc) {
    return Array.from(doc.querySelectorAll('item[id]')).map(item => {
      const id = validId(item.getAttribute('id'));
      if (!id) return null;
      const nameNodes = Array.from(item.querySelectorAll('name'));
      const primary = nameNodes.find(n => n.getAttribute('type') === 'primary') || nameNodes[0];
      const alternativeNames = nameNodes.filter(n => n !== primary)
        .map(n => n.getAttribute('value') || '').filter(Boolean);
      const ranks = Array.from(item.querySelectorAll('statistics ratings ranks rank'));
      const rank = ranks.find(r => r.getAttribute('name') === 'boardgame');
      const baseRating = item.querySelector('statistics ratings');
      const meta = {
        id:id, title:primary?.getAttribute('value') || 'BGG #' + id,
        alternativeNames:alternativeNames,
        thumb:(item.querySelector('thumbnail')?.textContent || '').trim(),
        image:(item.querySelector('image')?.textContent || '').trim(),
        year:num(xmlAttr(item, 'yearpublished')),
        subtype:item.getAttribute('type') || 'boardgame',
        publishers:linkList(item, 'boardgamepublisher'),
        designers:linkList(item, 'boardgamedesigner'),
        artists:linkList(item, 'boardgameartist'),
        mechanics:linkList(item, 'boardgamemechanic'),
        categories:linkList(item, 'boardgamecategory'),
        families:linkList(item, 'boardgamefamily'),
        minPlayers:num(xmlAttr(item, 'minplayers')),
        maxPlayers:num(xmlAttr(item, 'maxplayers')),
        playingTime:num(xmlAttr(item, 'playingtime')),
        minPlaytime:num(xmlAttr(item, 'minplaytime')),
        maxPlaytime:num(xmlAttr(item, 'maxplaytime')),
        minAge:num(xmlAttr(item, 'minage')),
        average:num(xmlAttr(baseRating, 'average')),
        weight:num(xmlAttr(baseRating, 'averageweight')),
        rank:rank && /^\d+$/.test(rank.getAttribute('value') || '') ? num(rank.getAttribute('value')) : 0,
        fetchedAt:Date.now()
      };
      return meta;
    }).filter(Boolean);
  }

  async function fetchXml(endpoint, params, signal) {
    const query = new URLSearchParams(Object.assign({endpoint:endpoint}, params));
    let lastError;
    for (let attempt=0; attempt<4; attempt++) {
      // A batch is launched immediately. A failed batch alone backs off and retries;
      // successful batches never wait behind a global five-second request gate.
      if (attempt) await delay(Math.min(30000, 1500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 900), signal);
      try {
        const response = await fetch(API + '?' + query.toString(), {signal:signal, cache:'no-store'});
        const body = await response.text();
        if (!response.ok || response.status === 202) {
          let detail = '';
          try { const json = JSON.parse(body); detail = json.message || json.error || ''; }
          catch (_) { detail = body.slice(0, 120); }
          const error = new Error('BGG returned HTTP ' + response.status + (detail ? ': ' + detail : ''));
          error.retryable = response.status === 202 || response.status === 429 ||
            response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504;
          throw error;
        }
        if (/^\s*[{[]/.test(body)) throw new Error('Expected BGG XML but received JSON.');
        return xmlDoc(body);
      } catch (error) {
        if (isAbort(error) || signal.aborted) throw error;
        lastError = error;
        const temporary = error.retryable || error instanceof TypeError;
        if (!temporary || attempt === 3) break;
      }
    }
    throw lastError || new Error('BGG request failed');
  }

  function facetValues(game, key, creditMode) {
    if (key === 'title') return [game.title].concat(game.alternativeNames || []).filter(Boolean);
    const fields = {publisher:'publishers', designer:'designers', artist:'artists',
      mechanic:'mechanics', category:'categories', family:'families'};
    if (fields[key]) {
      const credits = game[fields[key]] || [];
      // BGG Thing credits preserve their listed order. Top 1 means index 0.
      const mode = creditMode || state.creditScopes[key] || 'all';
      if (CREDIT_FIELDS.includes(key)) {
        if (mode === 'top1') return credits.slice(0, 1).map(x => x.name).filter(Boolean);
        if (mode === 'only1' && credits.length !== 1) return [];
      }
      return credits.map(x => x.name).filter(Boolean);
    }
    if (key === 'year') return game.year ? [String(game.year)] : [];
    if (key === 'players') {
      const min = game.minPlayers, max = game.maxPlayers;
      if (!min) return [];
      const values = [];
      for (let x=min; x<=Math.min(max || min, 12); x++) values.push(String(x));
      if (max > 12) values.push('12+');
      return values;
    }
    if (key === 'playtime') return game.playingTime ? [String(game.playingTime) + ' min'] : [];
    if (key === 'weightBand') return game.weight ? [Math.floor(game.weight) + '.0–' + Math.floor(game.weight) + '.9'] : [];
    if (key === 'ratingBand') return game.average ? [Math.floor(game.average) + '.0–' + Math.floor(game.average) + '.9'] : [];
    if (key === 'status') return STATUS_FIELDS.filter(row => game.statuses[row[0]]).map(row => row[1]);
    if (key === 'type') return [game.subtype === 'boardgameexpansion' ? 'Expansion' : game.subtype === 'boardgame' ? 'Base game' : game.subtype];
    return [];
  }
  function gameSearchText(game) {
    const parts = [game.id, game.title, game.year, game.subtype,
      game.average, game.weight, game.rank, game.minPlayers, game.maxPlayers,
      game.playingTime, game.plays, game.personalRating];
    // Global free-text search remains universal; scope only applies to facet suggestions and chips.
    FACETS.forEach(f => parts.push(...facetValues(game, f.key, 'all')));
    return normalize(parts.join(' '));
  }
  function rebuild() {
    state.games = state.items.map(base => {
      const meta = state.metadata.get(base.id);
      const game = Object.assign({}, base, meta || {});
      game.title = meta?.title || base.title || 'BGG #' + base.id;
      game.thumb = meta?.thumb || base.thumb || '';
      game.year = meta?.year || base.year || 0;
      game.statuses = base.statuses;
      game.personalRating = base.personalRating;
      game.plays = base.plays;
      game.subtype = meta?.subtype || base.subtype;
      game._search = gameSearchText(game);
      return game;
    });
    rebuildFacets();
    render();
  }
  function matchesCreditCountScopes(game) {
    return CREDIT_FIELDS.every(key =>
      state.creditScopes[key] !== 'only1' || (game[CREDIT_PROPS[key]] || []).length === 1);
  }
  function rebuildFacets() {
    const maps = new Map(FACETS.map(f => [f.key,new Map()]));
    for (const game of state.games) {
      if (!matchesCreditCountScopes(game)) continue;
      for (const facet of FACETS) {
        const seen = new Set();
        for (const value of facetValues(game, facet.key)) {
          const n = normalize(value);
          if (!n || seen.has(n)) continue;
          seen.add(n);
          const map = maps.get(facet.key);
          const old = map.get(n);
          if (old) old.count++;
          else map.set(n, {key:facet.key, value:value, normalized:n, count:1, label:facet.label, icon:facet.icon});
        }
      }
    }
    state.index = Array.from(maps.values()).flatMap(m => Array.from(m.values()));
  }
  function chipKey(chip) { return chip.key + ':' + normalize(chip.value); }
  function addChip(key, value) {
    const chip = {key:key, value:String(value)};
    if (!FACET_MAP.has(key) && key !== 'any') return;
    if (!state.chips.some(x => chipKey(x) === chipKey(chip))) state.chips.push(chip);
    state.query = '';
    $('search').value = '';
    state.visible = PAGE_SIZE;
    hideSuggestions();
    render();
    scheduleUrl();
  }
  function removeChip(index) {
    state.chips.splice(index, 1);
    state.visible = PAGE_SIZE;
    render();
    scheduleUrl();
  }
  function matchesChips(game) {
    const fields = new Map();
    state.chips.forEach(chip => {
      if (!fields.has(chip.key)) fields.set(chip.key, []);
      fields.get(chip.key).push(normalize(chip.value));
    });
    for (const [field, values] of fields) {
      const available = field === 'any' ? [game._search] : facetValues(game, field).map(normalize);
      if (!values.some(v => available.some(x => field === 'any' ? x.includes(v) : x === v))) return false;
    }
    return true;
  }
  function compareGames(a, b) {
    const sort = $('sort').value;
    const collator = compareGames.collator || (compareGames.collator = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'}));
    const alpha = collator.compare(a.title, b.title);
    if (sort === 'nameDesc') return -alpha;
    if (sort === 'yearDesc') return (b.year || 0) - (a.year || 0) || alpha;
    if (sort === 'yearAsc') return (a.year || 9999) - (b.year || 9999) || alpha;
    if (sort === 'ratingDesc') return (b.average || 0) - (a.average || 0) || alpha;
    if (sort === 'rank') return (a.rank || Infinity) - (b.rank || Infinity) || alpha;
    if (sort === 'weightDesc') return (b.weight || 0) - (a.weight || 0) || alpha;
    if (sort === 'players') return (a.minPlayers || Infinity) - (b.minPlayers || Infinity) || alpha;
    return alpha;
  }
  function filteredGames() {
    const words = normalize(state.query).split(/\s+/).filter(Boolean);
    return state.games.filter(game => {
      if (!matchesCreditCountScopes(game)) return false;
      if ($('statusScope').value !== 'all' && !game.statuses[$('statusScope').value]) return false;
      if (words.some(word => !game._search.includes(word))) return false;
      return matchesChips(game);
    }).sort(compareGames);
  }
  function renderChips() {
    const host = $('chips'); host.replaceChildren();
    state.chips.forEach((chip,index) => {
      const wrap = node('span','chip');
      wrap.append(node('span','chip-label', FACET_MAP.get(chip.key)?.label || 'Text'));
      wrap.append(node('span','',chip.value));
      const close = node('button','', '×');
      close.type = 'button';
      close.setAttribute('aria-label','Remove ' + chip.value + ' filter');
      close.addEventListener('click', () => removeChip(index));
      wrap.append(close);
      host.append(wrap);
    });
    renderCreditScopes();
  }
  function makeImage(game, className) {
    if (!game.thumb && !game.image) return node('div', className + ' cover-placeholder', '♟');
    const img = node('img', className);
    img.src = game.thumb || game.image;
    img.alt = game.title + ' box art';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.replaceWith(node('div', className + ' cover-placeholder','♟')); };
    return img;
  }
  function makeCard(game) {
    const card = node('button', 'game-card');
    card.type = 'button';
    card.setAttribute('aria-label','View details for ' + game.title);
    card.append(makeImage(game, 'cover'));
    if (game.statuses.own) card.append(node('span','game-status','✓ Owned'));
    const content = node('div','game-content');
    content.append(node('div','game-title',game.title));
    const meta = node('div','game-meta');
    meta.append(node('span','',game.year || 'Year unknown'));
    if (game.minPlayers) {
      meta.append(node('span','meta-dot'));
      meta.append(node('span','',game.minPlayers === game.maxPlayers ? game.minPlayers + ' players' : game.minPlayers + '–' + (game.maxPlayers || '?') + ' players'));
    }
    content.append(meta);
    content.append(node('div','game-publisher',(game.publishers || []).map(x=>x.name).join(', ') || 'Publisher pending'));
    const foot = node('div','game-foot');
    if (game.average) foot.append(node('span','rating-pill','★ ' + game.average.toFixed(1)));
    if (game.weight) foot.append(node('span','weight-pill','◉ ' + game.weight.toFixed(1)));
    content.append(foot);
    card.append(content);
    card.addEventListener('click', () => showDetails(game.id));
    return card;
  }
  function render() {
    renderChips();
    const host = $('cards'); host.replaceChildren();
    state.results = filteredGames();
    const count = state.results.length;
    $('resultCount').textContent = fmt(count) + (count === 1 ? ' game' : ' games');
    const detailed = state.games.filter(g => g.fetchedAt).length;
    $('resultSubtitle').textContent = state.hasCollection
      ? fmt(state.games.length) + ' in collection · ' + fmt(detailed) + ' with full metadata'
      : 'Load a collection to get started';
    const visible = state.results.slice(0,state.visible);
    const frag = document.createDocumentFragment();
    visible.forEach(game => frag.append(makeCard(game)));
    host.append(frag);
    $('empty').hidden = !!visible.length;
    if (!visible.length) {
      $('empty').querySelector('strong').textContent = state.hasCollection ? 'No matching games' : 'Ready to explore?';
      $('empty').querySelector('p').textContent = state.hasCollection
        ? 'Try a different search, remove a filter, or wait for additional Thing metadata.'
        : 'Load a username above. Your collection will appear here immediately, with additional details filling in as they are retrieved.';
    }
    $('moreBtn').hidden = count <= state.visible;
    $('moreBtn').textContent = 'Show more games (' + fmt(count - state.visible) + ' remaining)';
  }
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => { renderTimer=null; rebuild(); }, 180);
  }

  const SEARCH_PLACEHOLDER = 'Search games, publishers, designers, mechanics, years, artists, categories…';
  function setCreditScope(key, mode) {
    if (!CREDIT_FIELDS.includes(key) || !['all', 'top1', 'only1'].includes(mode)) return;
    if (state.creditScopes[key] === mode) return;
    state.creditScopes[key] = mode;
    state.visible = PAGE_SIZE;
    // Counts and available suggestions must reflect the new BGG credit position.
    rebuildFacets();
    render();
    renderFacetButtons();
    if (state.activeFacet && !$('suggestions').hidden) suggestions();
    scheduleUrl();
  }
  function renderCreditScopes() {
    const host = $('creditScopes');
    const keys = CREDIT_FIELDS.filter(key =>
      state.activeFacet === key || state.chips.some(chip => chip.key === key));
    host.replaceChildren();
    host.hidden = keys.length === 0;
    for (const key of keys) {
      const facet = FACET_MAP.get(key);
      const group = node('div', 'credit-scope-group');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', facet.label + ' matching scope');
      group.append(node('span', 'credit-scope-label', facet.label + ':'));
      const options = node('div', 'credit-scope-options');
      for (const mode of ['all', 'top1', 'only1']) {
        const selected = state.creditScopes[key] === mode;
        const button = node('button', 'credit-scope-option' + (selected ? ' selected' : ''),
          mode === 'all' ? 'All' : mode === 'top1' ? 'Top 1' : 'Only 1');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(selected));
        button.title = mode === 'only1'
          ? 'Show only games with exactly one BGG-listed ' + facet.label.toLowerCase().replace(/s$/, '')
          : mode === 'top1' ? 'Match only the first BGG-listed ' + facet.label.toLowerCase() + ' credit'
          : 'Match any credited ' + facet.label.toLowerCase();
        button.addEventListener('click', () => setCreditScope(key, mode));
        options.append(button);
      }
      group.append(options);
      host.append(group);
    }
    if (keys.length) host.append(node('span', 'credit-scope-hint',
      'Top 1 = first BGG-listed credit · Only 1 = exactly one credit'));
  }
  function renderFacetButtons() {
    document.querySelectorAll('[data-facet]').forEach(button => {
      const active = button.dataset.facet === state.activeFacet;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const facet = FACET_MAP.get(state.activeFacet);
    $('search').placeholder = facet ? 'Find ' + facet.label.toLowerCase() + ' tags…' : SEARCH_PLACEHOLDER;
    renderCreditScopes();
  }
  function hideSuggestions(resetFacet = true) {
    $('suggestions').hidden = true;
    $('search').setAttribute('aria-expanded','false');
    $('suggestions').replaceChildren();
    suggestionRows = [];
    state.selectedSuggestion = 0;
    if (resetFacet) { state.activeFacet = ''; renderFacetButtons(); }
  }
  function suggestions() {
    const query = normalize($('search').value);
    const host = $('suggestions');
    host.replaceChildren();
    if ((!query && !state.activeFacet) || !state.hasCollection) { hideSuggestions(false); return; }
    const selected = new Set(state.chips.map(chipKey));
    let matches = state.index.filter(row =>
      (!state.activeFacet || row.key === state.activeFacet) &&
      (!query || row.normalized.includes(query) || normalize(row.label).includes(query)) &&
      !selected.has(chipKey(row))
    );
    matches.sort((a,b) => {
      const aStarts = a.normalized.startsWith(query), bStarts=b.normalized.startsWith(query);
      return Number(bStarts)-Number(aStarts) || b.count-a.count || a.value.localeCompare(b.value);
    });
    suggestionRows = matches.slice(0, 12);
    state.selectedSuggestion = 0;
    const hint = node('div','suggestion-note',state.activeFacet
      ? 'Select a ' + FACET_MAP.get(state.activeFacet).label.toLowerCase() + ' tag · ' +
        (CREDIT_FIELDS.includes(state.activeFacet)
          ? (state.creditScopes[state.activeFacet] === 'top1' ? 'Top 1 credits only'
             : state.creditScopes[state.activeFacet] === 'only1' ? 'Exactly one credit only'
             : 'All credits')
          : 'Filter by tag')
      : 'Search every field · select any result to add a filter');
    host.append(hint);
    suggestionRows.forEach((row,index) => {
      const btn = node('button','suggestion' + (index===0 ? ' active' : ''));
      btn.type='button'; btn.setAttribute('role','option'); btn.setAttribute('aria-selected',index===0?'true':'false');
      const mark = node('span','suggestion-icon',row.icon);
      const text = node('span','suggestion-text');
      text.append(node('strong','',row.value));
      text.append(node('small','',row.label));
      btn.append(mark,text,node('span','suggestion-count',fmt(row.count) + ' games'));
      btn.addEventListener('pointerdown',event=>event.preventDefault());
      btn.addEventListener('click',()=>addChip(row.key,row.value));
      host.append(btn);
    });
    if (!suggestionRows.length) host.append(node('div','suggestion-note','No matching tags. Your text still searches all game details.'));
    host.hidden = false;
    $('search').setAttribute('aria-expanded','true');
  }
  function moveSuggestion(offset) {
    if (!suggestionRows.length) return;
    state.selectedSuggestion = (state.selectedSuggestion + offset + suggestionRows.length) % suggestionRows.length;
    Array.from($('suggestions').querySelectorAll('.suggestion')).forEach((el,index) => {
      const selected = index === state.selectedSuggestion;
      el.classList.toggle('active',selected);
      el.setAttribute('aria-selected',selected?'true':'false');
      if (selected) el.scrollIntoView({block:'nearest'});
    });
  }

  function detailStat(label,value) {
    const box = node('div','detail-stat');
    box.append(node('strong','',value),node('span','',label));
    return box;
  }
  function detailTag(field, value) {
    const b = node('button','detail-tag',value);
    b.type='button';
    b.addEventListener('click',() => {
      addChip(field,value);
      $('details').close();
      $('search').focus();
    });
    return b;
  }
  function detailSection(container, field, heading, values) {
    const row = node('section','detail-field');
    row.append(node('h3','',heading));
    const tags = node('div','detail-tags');
    if (values.length) values.forEach(x => tags.append(detailTag(field,x)));
    else tags.append(node('span','detail-muted','Not available yet'));
    row.append(tags); container.append(row);
  }
  function showDetails(id) {
    const game = state.games.find(g => g.id === id);
    if (!game) return;
    const host = $('detailBody'); host.replaceChildren();
    const lead = node('div','detail-lead');
    lead.append(makeImage(game,'detail-cover'));
    const desc = node('div','');
    desc.append(node('h2','',game.title));
    desc.append(node('div','detail-sub',[
      game.year || 'Year unknown',
      game.subtype === 'boardgameexpansion' ? 'Expansion' : 'Board game',
      game.id ? 'BGG #' + game.id : ''
    ].join(' · ')));
    const stats = node('div','detail-stats');
    if (game.average) stats.append(detailStat('BGG rating','★ ' + game.average.toFixed(2)));
    if (game.weight) stats.append(detailStat('Complexity',game.weight.toFixed(2) + ' / 5'));
    if (game.rank) stats.append(detailStat('BGG rank','#' + fmt(game.rank)));
    if (game.minPlayers) stats.append(detailStat('Players',game.minPlayers === game.maxPlayers ? String(game.minPlayers) : game.minPlayers + '–' + game.maxPlayers));
    if (game.playingTime) stats.append(detailStat('Playtime',game.playingTime + ' min'));
    if (game.plays) stats.append(detailStat('Your plays',fmt(game.plays)));
    desc.append(stats);
    const external = node('a','detail-external','View on BoardGameGeek ↗');
    external.href='https://boardgamegeek.com/boardgame/' + game.id;
    external.target='_blank'; external.rel='noopener noreferrer';
    desc.append(external);
    lead.append(desc);
    host.append(lead);
    const fields = node('div','detail-fields');
    detailSection(fields,'publisher','Publishers',(game.publishers || []).map(x=>x.name));
    detailSection(fields,'designer','Designers',(game.designers || []).map(x=>x.name));
    detailSection(fields,'artist','Artists',(game.artists || []).map(x=>x.name));
    detailSection(fields,'mechanic','Mechanisms',(game.mechanics || []).map(x=>x.name));
    detailSection(fields,'category','Categories',(game.categories || []).map(x=>x.name));
    detailSection(fields,'family','Families',(game.families || []).map(x=>x.name));
    detailSection(fields,'year','Year',facetValues(game,'year'));
    detailSection(fields,'status','Collection status',facetValues(game,'status'));
    if (game.alternativeNames?.length) detailSection(fields,'title','Alternate names',game.alternativeNames);
    host.append(fields);
    if (!$('details').open) $('details').showModal();
  }

  function beginRun() {
    if (state.controller) state.controller.abort();
    state.runId++;
    state.controller = new AbortController();
    state.failedBatches = [];
    setBusy(true);
    return {id:state.runId, signal:state.controller.signal};
  }
  function current(run) { return run.id === state.runId && !run.signal.aborted; }
  function stop() {
    if (state.controller) state.controller.abort();
    state.runId++;
    state.controller = null;
    setBusy(false);
    if (state.hasCollection) setMessage('Stopped. Available collection data remains searchable.', 'success');
    else setMessage('Loading stopped.');
    note('Partial metadata is preserved in your browser cache.');
  }
  async function loadCollection(input, options) {
    const user = String(input || '').trim();
    if (!user) { setMessage('Enter a BGG username to continue.','error'); $('username').focus(); return; }
    const key = user.toLocaleLowerCase();
    const run = beginRun();
    state.username = key;
    state.items = [];
    state.metadata = new Map();
    state.hasCollection = false;
    state.games = []; state.index = [];
    state.visible = PAGE_SIZE;
    setEnabled(false);
    $('empty').hidden = false;
    setProgress('Reading local collection cache…',.02);
    render();
    scheduleUrl();
    try {
      if (db) {
        const cached = await readStore('collections',key);
        const metadata = await readMetadata();
        if (!current(run)) return;
        state.metadata = new Map(metadata.map(record => [record.id,record]));
        if (cached && cached.items?.length) {
          state.items = cached.items;
          state.cacheAt = cached.fetchedAt || 0;
          state.hasCollection = true;
          setEnabled(true);
          rebuild();
          setMessage('Showing cached collection while checking for updates.','success');
        }
      }
      setProgress('Requesting BGG collection for @' + user + '…',.05);
      const xml = await fetchXml('collection',{username:user,stats:'1',excludesubtype:'boardgameaccessory'},run.signal);
      if (!current(run)) return;
      const items = parseCollection(xml);
      state.items = items;
      state.hasCollection = true;
      state.cacheAt = Date.now();
      await writeCollection({username:key,items:items,fetchedAt:state.cacheAt}).catch(() => {
        state.cacheAvailable = false;
      });
      if (!current(run)) return;
      setEnabled(true);
      rebuild();
      if (!items.length) {
        setMessage('BGG returned no collection games for @' + user + '. Check the username and public collection visibility.','error');
        setBusy(false);
        return;
      }
      setMessage('Loaded ' + fmt(items.length) + ' games for @' + user + '. Enriching missing or stale metadata.','success');
      await enrich(run, false);
    } catch (error) {
      if (!current(run) || isAbort(error)) return;
      setBusy(false);
      if (state.hasCollection) {
        setMessage('BGG refresh failed; your cached collection remains available. ' + error.message,'error');
        setEnabled(true);
      } else setMessage('Could not load collection: ' + error.message,'error');
      note('Check the BGG API proxy, your username, or retry later.');
    }
  }
  function batchesFor(force, specified) {
    if (specified?.length) return specified.map(batch=>batch.filter(id=>state.items.some(item=>item.id===id))).filter(batch=>batch.length);
    const ids = state.items.map(item=>item.id).filter(id => {
      const meta=state.metadata.get(id);
      return force || !meta || Date.now() - (meta.fetchedAt || 0) >= META_TTL_MS;
    });
    const batches = [];
    for (let i=0;i<ids.length;i+=BATCH_SIZE) batches.push(ids.slice(i,i+BATCH_SIZE));
    return batches;
  }
  async function enrich(run, force, specified) {
    const batches = batchesFor(force, specified);
    const total = batches.length;
    if (!total) {
      if (current(run)) {
        setBusy(false);
        setMessage('Collection ready. All ' + fmt(state.items.length) + ' games have current cached metadata.','success');
        note('Metadata cached for 30 days · 20 IDs/request · up to 100 parallel requests.');
      }
      return;
    }
    setProgress('Enriching BGG metadata…',0);
    let cursor=0, done=0, loaded=0;
    state.failedBatches = [];
    const failures = [];
    const progress = () => {
      setProgress('Thing metadata: ' + fmt(done) + ' / ' + fmt(total) + ' batches',done/total);
      note(fmt(loaded) + ' games enriched this run · ' + fmt(failures.length) + ' failed batches · 20 IDs/request · up to 100 concurrent');
    };
    progress();
    async function worker() {
      while (current(run)) {
        const index = cursor++;
        if (index >= total) return;
        const ids = batches[index];
        try {
          const doc = await fetchXml('thing',{id:ids.join(','),stats:'1'},run.signal);
          if (!current(run)) return;
          const records = parseThing(doc);
          if (!records.length) throw new Error('Thing returned no game records.');
          records.forEach(row => state.metadata.set(row.id,row));
          loaded += records.length;
          await writeMetadata(records).catch(() => { state.cacheAvailable = false; });
          if (!current(run)) return;
          scheduleRender();
        } catch (error) {
          if (isAbort(error) || !current(run)) return;
          failures.push(ids);
          console.warn('Collection Explorer Thing batch failed:',ids,error);
        } finally {
          if (current(run)) { done++; progress(); }
        }
      }
    }
    await Promise.all(Array.from({length:Math.min(WORKER_COUNT,total)},worker));
    if (!current(run)) return;
    state.failedBatches = failures;
    if (renderTimer) { clearTimeout(renderTimer); renderTimer=null; }
    rebuild();
    setBusy(false);
    if (failures.length) {
      setMessage('Loaded ' + fmt(state.items.length) + ' games; metadata for ' + fmt(failures.reduce((n,a)=>n+a.length,0)) + ' IDs could not be retrieved.','error');
      note('Your successfully loaded data is saved. ',true);
    } else {
      setMessage('Collection ready: ' + fmt(state.items.length) + ' games · ' + fmt(state.games.filter(x=>x.fetchedAt).length) + ' with metadata.','success');
      note((state.cacheAvailable ? 'Stored in IndexedDB' : 'In-memory session') + ' · 30-day metadata cache · ' + fmt(total) + ' Thing batches.');
    }
  }
  async function runEnrichment(force, specified) {
    if (!state.hasCollection || state.loading) return;
    const run = beginRun();
    try { await enrich(run,force,specified); }
    catch (error) {
      if (!current(run) || isAbort(error)) return;
      setBusy(false);
      setMessage('Metadata refresh failed: ' + error.message,'error');
    }
  }
  function makeCsvValue(value) {
    let s = String(value == null ? '' : value);
    // Prevent spreadsheet formula execution when exported data is opened in Excel/Sheets.
    if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g,'""') + '"';
  }
  function exportCsv() {
    const columns = ['BGG ID','Name','Year','Type','Publishers','Designers','Artists',
      'Categories','Mechanisms','Families','Min Players','Max Players','Playtime',
      'BGG Rating','BGG Rank','Complexity','Own','Previously Owned','For Trade','Want',
      'Wishlist','Want To Play','Want To Buy','Preordered','Personal Rating','Plays'];
    const rows = state.results.map(g => [
      g.id,g.title,g.year,g.subtype,
      ...['publishers','designers','artists','categories','mechanics','families'].map(field=>(g[field] || []).map(x=>x.name).join('; ')),
      g.minPlayers,g.maxPlayers,g.playingTime,g.average,g.rank,g.weight,
      ...STATUS_FIELDS.map(row=>g.statuses[row[0]] ? 'Yes' : 'No'),
      g.personalRating,g.plays
    ]);
    const csv = '\ufeff' + [columns].concat(rows).map(row=>row.map(makeCsvValue).join(',')).join('\r\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = node('a');
    link.href = url;
    link.download = 'bgg-' + (state.username || 'collection') + '-filtered.csv';
    document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function scheduleUrl() {
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const q = new URLSearchParams();
      if (state.username) q.set('username',state.username);
      if (state.chips.length) q.set('filters',JSON.stringify(state.chips));
      const top1 = CREDIT_FIELDS.filter(key => state.creditScopes[key] === 'top1');
      if (top1.length) q.set('top1', top1.join(','));
      const only1 = CREDIT_FIELDS.filter(key => state.creditScopes[key] === 'only1');
      if (only1.length) q.set('only1', only1.join(','));
      if (state.query) q.set('q',state.query);
      if ($('sort').value !== 'name') q.set('sort',$('sort').value);
      if ($('statusScope').value !== 'all') q.set('status',$('statusScope').value);
      const url = location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash;
      history.replaceState(null,'',url);
    },250);
  }
  function installEvents() {
    renderFacetButtons();
    $('usernameForm').addEventListener('submit',event=>{event.preventDefault(); loadCollection($('username').value);});
    $('stopBtn').addEventListener('click',stop);
    $('refreshBtn').addEventListener('click',()=>loadCollection(state.username));
    $('refreshMetaBtn').addEventListener('click',()=>runEnrichment(true));
    $('closeDetail').addEventListener('click',()=>$('details').close());
    $('details').addEventListener('click',event=>{ if (event.target === $('details')) $('details').close(); });
    $('clearBtn').addEventListener('click',()=>{
      state.chips=[]; state.query=''; $('search').value=''; $('statusScope').value='all';
      CREDIT_FIELDS.forEach(key => { state.creditScopes[key] = 'all'; });
      state.visible=PAGE_SIZE; rebuildFacets(); hideSuggestions(); render(); scheduleUrl();
    });
    document.querySelectorAll('[data-facet]').forEach(button => {
      button.addEventListener('click', () => {
        if ($('search').disabled) return;
        const key=button.dataset.facet;
        state.activeFacet = state.activeFacet === key ? '' : key;
        renderFacetButtons();
        if (state.activeFacet) { $('search').focus(); suggestions(); }
        else hideSuggestions();
      });
    });
    $('exportBtn').addEventListener('click',exportCsv);
    $('moreBtn').addEventListener('click',()=>{state.visible+=PAGE_SIZE;render();});
    ['sort','statusScope'].forEach(id=>$(id).addEventListener('change',()=>{state.visible=PAGE_SIZE;render();scheduleUrl();}));
    $('search').addEventListener('input',()=>{
      state.query=$('search').value; state.visible=PAGE_SIZE;
      render(); suggestions(); scheduleUrl();
    });
    $('search').addEventListener('focus',suggestions);
    $('search').addEventListener('keydown',event=>{
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if ($('suggestions').hidden) suggestions();
        event.preventDefault(); moveSuggestion(event.key === 'ArrowDown'?1:-1);
      } else if (event.key === 'Escape') hideSuggestions();
      else if (event.key === 'Enter') {
        event.preventDefault();
        const row = suggestionRows[state.selectedSuggestion];
        if (row && !$('suggestions').hidden) addChip(row.key,row.value);
        else if (state.query.trim()) addChip('any',state.query.trim());
      }
    });
    document.addEventListener('pointerdown',event=>{
      if (!$('searchWrap').contains(event.target) && !$('creditScopes').contains(event.target)) hideSuggestions();
    });
    document.addEventListener('keydown',event=>{
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) && !$('details').open && !($('search').disabled)) {
        event.preventDefault(); $('search').focus();
      }
    });
  }
  async function init() {
    installEvents();
    const params = new URLSearchParams(location.search);
    const initialUsername = params.get('username');
    if (initialUsername) $('username').value = initialUsername.slice(0,80);
    if (params.has('filters')) {
      try {
        const parsed = JSON.parse(params.get('filters'));
        if (Array.isArray(parsed)) state.chips=parsed.filter(x=>x && (FACET_MAP.has(x.key) || x.key==='any') &&
          typeof x.value==='string' && x.value.length<250).slice(0,40);
      } catch (_) { /* Ignore malformed shared URL. */ }
    }
    const top1 = new Set((params.get('top1') || '').split(',').filter(Boolean));
    const only1 = new Set((params.get('only1') || '').split(',').filter(Boolean));
    CREDIT_FIELDS.forEach(key => {
      state.creditScopes[key] = only1.has(key) ? 'only1' : top1.has(key) ? 'top1' : 'all';
    });
    if (params.has('q')) { state.query=(params.get('q') || '').slice(0,250); $('search').value=state.query; }
    if (Array.from($('sort').options).some(x=>x.value===params.get('sort'))) $('sort').value=params.get('sort');
    if (Array.from($('statusScope').options).some(x=>x.value===params.get('status'))) $('statusScope').value=params.get('status');
    renderChips();
    await initializeDb();
    if (initialUsername) await loadCollection(initialUsername);
  }
  init().catch(error=>setMessage('Could not initialize Collection Explorer: ' + error.message,'error'));
})();
