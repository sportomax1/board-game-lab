(async () => {
  'use strict';

  if (
    !/boardgamearena\.com$/.test(location.hostname) ||
    !location.pathname.includes('/audiencelist')
  ) {
    alert('Open https://boardgamearena.com/audiencelist first.');
    return;
  }

  if (window.__bgaAudienceBusy) {
    alert('An audience export is already running.');
    return;
  }

  const raw = prompt(
    'How many months BACK, including the displayed month? (1–120)',
    '12'
  );

  if (raw === null) return;

  const months = Number(raw);

  if (!Number.isInteger(months) || months < 1 || months > 120) {
    alert('Enter a whole number between 1 and 120.');
    return;
  }

  window.__bgaAudienceBusy = true;

  const pause = ms => new Promise(ok => setTimeout(ok, ms));
  const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();

  const names = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];

  const dateRe =
    /\bAudiences? for (January|February|March|April|May|June|July|August|September|October|November|December) (20\d{2})\b/i;

  const columns = [
    'month',
    'game_id',
    'game',
    'audience_share_pct',
    'premium_audience_share_pct',
    'played_realtime',
    'played_turnbased',
    'played_total',
    'average_duration_min',
    'time_spent_hr',
    'premium_time_spent_hr',
    'model',
    'game_url'
  ];

  const rows = [];
  const monthStats = [];
  const seen = new Set();

  let cancelled = false;

  // Status panel
  const panel = document.createElement('div');

  panel.style.cssText = `
    position:fixed;
    z-index:2147483647;
    bottom:14px;
    right:14px;
    width:350px;
    max-width:calc(100vw - 28px);
    background:#192330;
    color:white;
    font:13px system-ui;
    padding:14px;
    border-radius:10px;
    box-shadow:0 6px 30px #0007;
  `;

  panel.innerHTML = `
    <div style="font-weight:700;font-size:15px;margin-bottom:6px">
      BGA Audience Export
    </div>
    <div data-message>Starting…</div>
    <div data-detail style="
      margin:8px 0;
      font-size:12px;
      color:#c9d2dc;
      max-height:120px;
      overflow:auto
    "></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button data-stop>Stop & export</button>
      <button data-copy hidden>Copy CSV</button>
      <button data-close hidden>Close</button>
    </div>
  `;

  for (const button of panel.querySelectorAll('button')) {
    button.style.cssText = `
      border:0;
      border-radius:5px;
      padding:7px 10px;
      cursor:pointer;
      background:#e5eaf0;
      color:#16202b
    `;
  }

  document.body.appendChild(panel);

  const msg = panel.querySelector('[data-message]');
  const detail = panel.querySelector('[data-detail]');
  const stop = panel.querySelector('[data-stop]');
  const copy = panel.querySelector('[data-copy]');
  const close = panel.querySelector('[data-close]');

  stop.onclick = () => {
    cancelled = true;
    msg.textContent = 'Stopping and exporting collected data…';
  };

  close.onclick = () => panel.remove();

  function report(text) {
    console.log('[BGA audience]', text);
    detail.textContent += text + '\n';
    detail.style.whiteSpace = 'pre-wrap';
    detail.scrollTop = detail.scrollHeight;
  }

  function displayed(el) {
    const r = el.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      getComputedStyle(el).visibility !== 'hidden'
    );
  }

  function getPeriod() {
    const matches = [
      ...document.querySelectorAll(
        'h1,h2,h3,h4,span,div,p,strong'
      )
    ].map(el => {
      const text = clean(el.textContent);
      if (text.length > 55) return null;

      const match = text.match(dateRe);
      if (!match || !displayed(el)) return null;

      const index = names.findIndex(
        n => n.toLowerCase() === match[1].toLowerCase()
      );

      const rect = el.getBoundingClientRect();

      return {
        el,
        year: Number(match[2]),
        index,
        key: `${match[2]}-${String(index + 1).padStart(2, '0')}`,
        area: rect.width * rect.height
      };
    }).filter(Boolean);

    matches.sort((a, b) => a.area - b.area);
    return matches[0] || null;
  }

  function table() {
    return [...document.querySelectorAll('table')].find(t => {
      const headers = [...t.querySelectorAll('th')]
        .map(th => clean(th.textContent).toLowerCase());

      return (
        headers[0] === 'game' &&
        headers.some(h => h.includes('audience share')) &&
        headers.some(h => h.includes('played'))
      );
    });
  }

  function number(text) {
    const s = clean(text).replace(/[\u00a0\u202f\s]/g, '');

    if (!s || s === '—' || s === '-') return '';

    const match = s.match(/-?[\d,.]+/);
    if (!match) return '';

    let x = match[0];

    if (x.includes(',') && x.includes('.')) {
      x = x.replace(/,/g, '');
    } else if (/^\d{1,3}(,\d{3})+$/.test(x)) {
      x = x.replace(/,/g, '');
    } else {
      x = x.replace(',', '.');
    }

    const n = Number(x);
    return Number.isFinite(n) ? n : '';
  }

  function duration(text, outputUnit) {
    const s = clean(text).toLowerCase();

    if (!s || s === '-' || s === '—') return '';

    const parts = [
      ...s.matchAll(
        /([\d,.]+)\s*(days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|seconds?|secs?|sec|s)\b/g
      )
    ];

    if (!parts.length) return number(s);

    const minutes = parts.reduce((sum, match) => {
      const value = number(match[1]);
      const unit = match[2];

      const multiplier = /^d/.test(unit)
        ? 1440
        : /^h/.test(unit)
          ? 60
          : /^s/.test(unit)
            ? 1 / 60
            : 1;

      return sum + value * multiplier;
    }, 0);

    return Number(
      (outputUnit === 'hours' ? minutes / 60 : minutes).toFixed(3)
    );
  }

  function extract(period) {
    const t = table();

    if (!t) throw Error('Game audience table not found.');

    const found = [];

    for (const tr of t.querySelectorAll('tr')) {
      const cells = [
        ...tr.querySelectorAll(':scope > td')
      ];

      if (cells.length < 8) continue;

      const values = cells.map(c => clean(c.textContent));
      const link = cells[0].querySelector('a[href*="game="]');
      const game = clean(link?.textContent || values[0]);

      if (!game) continue;

      const url = link
        ? new URL(link.getAttribute('href'), location.origin)
        : null;

      const realtime = number(values[3]);
      const turnbased = number(values[4]);

      found.push({
        month: period.key,
        game_id: url?.searchParams.get('game') || '',
        game,
        audience_share_pct: number(values[1]),
        premium_audience_share_pct: number(values[2]),
        played_realtime: realtime,
        played_turnbased: turnbased,
        played_total:
          typeof realtime === 'number' &&
          typeof turnbased === 'number'
            ? realtime + turnbased
            : '',
        average_duration_min: duration(values[5], 'minutes'),
        time_spent_hr: duration(values[6], 'hours'),
        premium_time_spent_hr: duration(values[7], 'hours'),
        model: values[8] || '',
        game_url: url?.href || ''
      });
    }

    return found;
  }

  function fingerprint() {
    const t = table();
    if (!t) return '';

    const records = [...t.querySelectorAll('tr')];

    return `${records.length}:${
      records.slice(1, 4)
        .concat(records.slice(-3))
        .map(r => clean(r.textContent))
        .join('|')
    }`;
  }

  function previousControl(period) {
    const r = period.el.getBoundingClientRect();
    const centerY = r.top + r.height / 2;
    const controls = new Set();

    for (const el of document.querySelectorAll(
      'button,a,[role="button"],svg,i,span,div'
    )) {
      if (!displayed(el)) continue;

      const b = el.getBoundingClientRect();
      const cy = b.top + b.height / 2;

      if (
        Math.abs(cy - centerY) > 75 ||
        b.right > r.right + 25 ||
        b.right < r.left - 450
      ) continue;

      const label = `${
        el.getAttribute('title') || ''
      } ${
        el.getAttribute('aria-label') || ''
      }`.toLowerCase();

      const own = clean(
        [...el.childNodes]
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent)
          .join('')
      );

      const icon = clean(el.textContent);

      const arrow =
        /^[<‹«◀❮❰←]$/.test(own) ||
        (
          el.children.length === 0 &&
          /^[<‹«◀❮❰←]$/.test(icon)
        );

      const named =
        /previous|prior|earlier|precedent|précédent|vorherig/.test(label);

      const svg =
        el.matches('svg,i') &&
        /left|chevron|arrow|prev/i.test(
          el.outerHTML.slice(0, 450)
        );

      if (!arrow && !named && !svg) continue;

      const parent =
        el.closest('button,a,[role="button"],[onclick]') || el;

      if (parent.contains(period.el) || !displayed(parent)) {
        continue;
      }

      controls.add(parent);
    }

    const ranked = [...controls].map(el => {
      const b = el.getBoundingClientRect();

      return {
        el,
        score:
          Math.abs(b.right - r.left) +
          Math.abs((b.top + b.bottom) / 2 - centerY) * 3 +
          (b.left > r.left ? 150 : 0)
      };
    }).sort((a, b) => a.score - b.score);

    return ranked[0]?.el || null;
  }

  async function nextPeriod(before, oldFingerprint) {
    const wanted = new Date(
      before.year,
      before.index - 1,
      1
    );

    const expected =
      `${wanted.getFullYear()}-` +
      `${String(wanted.getMonth() + 1).padStart(2, '0')}`;

    const control = previousControl(before);

    if (control) {
      control.click();
    } else {
      report(
        'Previous-month arrow not detected. Click the left arrow manually.'
      );

      msg.textContent = `Click BGA's left arrow to reach ${expected}`;
    }

    let changedAt = 0;
    let lastFingerprint = '';
    let stableAt = 0;

    const startedAt = Date.now();

    while (
      Date.now() - startedAt < 60000 &&
      !cancelled
    ) {
      await pause(200);

      const current = getPeriod();

      if (!current || current.key === before.key) {
        continue;
      }

      if (current.key !== expected) {
        throw Error(
          `Expected ${expected}, but arrived at ${current.key}. ` +
          'Stopped to avoid incorrect month labels.'
        );
      }

      if (!changedAt) changedAt = Date.now();

      const fp = fingerprint();
      if (!fp) continue;

      if (fp !== lastFingerprint) {
        lastFingerprint = fp;
        stableAt = Date.now();
      }

      if (
        Date.now() - changedAt >= 1400 &&
        Date.now() - stableAt >= 650 &&
        (
          fp !== oldFingerprint ||
          Date.now() - changedAt >= 4000
        )
      ) {
        if (fp === oldFingerprint) {
          report(
            `Warning: ${expected} has identical visible ` +
            'table values. Verify this month.'
          );
        }

        return current;
      }
    }

    if (cancelled) return null;

    throw Error(
      `Timed out waiting for ${expected}. ` +
      'Previous-month navigation may have failed.'
    );
  }

  function csvValue(x) {
    return `"${String(x ?? '').replace(/"/g, '""')}"`;
  }

  function buildCsv() {
    return [
      columns.map(csvValue).join(','),
      ...rows.map(r =>
        columns.map(c => csvValue(r[c])).join(',')
      )
    ].join('\r\n');
  }

  function download(csv, filename) {
    const link = document.createElement('a');

    const url = URL.createObjectURL(
      new Blob(['\ufeff', csv], {
        type: 'text/csv;charset=utf-8'
      })
    );

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function configureCopy(csv) {
    copy.hidden = false;

    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(csv);
        copy.textContent = 'Copied!';
      } catch (error) {
        console.error('Clipboard unavailable:', error);
        copy.textContent = 'Clipboard blocked';
      }
    };
  }

  try {
    let period = getPeriod();

    if (!period || !table()) {
      throw Error(
        'Month heading or statistics table missing. ' +
        'Wait for BGA to load, then rerun.'
      );
    }

    const startingMonth = period.key;

    report(
      `Starting ${startingMonth}, collecting ${months} month(s).`
    );

    for (
      let i = 0;
      i < months && !cancelled;
      i++
    ) {
      msg.textContent =
        `Collecting ${period.key}: ${i + 1}/${months} months`;

      const currentRows = extract(period);

      if (!currentRows.length) {
        report(`Warning: zero visible rows in ${period.key}.`);
      }

      let count = 0;

      for (const row of currentRows) {
        const key =
          `${row.month}|${row.game_id || row.game}`;

        if (!seen.has(key)) {
          seen.add(key);
          rows.push(row);
          count++;
        }
      }

      monthStats.push({
        month: period.key,
        games: count
      });

      report(`${period.key}: ${count} games captured`);

      if (i !== months - 1) {
        period = await nextPeriod(
          period,
          fingerprint()
        );
      }

      if (!period) break;
    }

    if (!rows.length) {
      throw Error('No game rows were found.');
    }

    const csv = buildCsv();

    const filename =
      `bga_audience_${startingMonth}_` +
      `${monthStats.length}months.csv`;

    window.BGA_AUDIENCE_ROWS = rows;
    window.BGA_AUDIENCE_CSV = csv;
    window.BGA_AUDIENCE_MONTHS = monthStats;

    download(csv, filename);
    configureCopy(csv);

    msg.textContent =
      `Exported ${rows.length} rows from ` +
      `${monthStats.length} months`;

    report(`Downloaded ${filename}`);

    console.table(monthStats);

  } catch (error) {
    console.error('[BGA audience]', error);

    msg.textContent = `Stopped: ${error.message}`;

    window.BGA_AUDIENCE_ROWS = rows;

    if (rows.length) {
      const csv = buildCsv();

      window.BGA_AUDIENCE_CSV = csv;

      download(
        csv,
        `bga_audience_partial_${monthStats.length}months.csv`
      );

      configureCopy(csv);

      report(`Saved ${rows.length} rows in partial CSV.`);
    }

  } finally {
    window.__bgaAudienceBusy = false;

    stop.hidden = true;
    close.hidden = false;
  }
})();