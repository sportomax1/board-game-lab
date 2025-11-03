// Make filterRecords globally available
function filterRecords(records, fields, term) {
    if (!term) return records;
    const lc = term.toLowerCase();
    let searchFields = fields;
    const searchNameOnly = document.getElementById('searchNameOnly');
    if (searchNameOnly && searchNameOnly.checked) {
        searchFields = fields.filter(f => /name.*primary|name$/i.test(f));
        if (searchFields.length === 0) searchFields = fields.filter(f => /name/i.test(f));
    }
    return records.filter(rec => searchFields.some(f => (rec[f] + '').toLowerCase().includes(lc)));
}
// Ensure search event handler is always attached at the end
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchNameOnly = document.getElementById('searchNameOnly');
    function robustLiveSearch() {
        const term = searchInput ? searchInput.value.trim() : '';
        let arr = window.lastRecords || [];
        let fields = window.lastFields || [];
        let displayFields = window.lastDisplayFields || fields;
        console.log('Robust live search fired. Term:', term);
        console.log('Fields being searched:', displayFields);
        if (arr.length === 0 || displayFields.length === 0) {
            const resultDiv = document.getElementById('apiResult');
            if (resultDiv) resultDiv.innerHTML = '<span style="color:#888;">No records loaded.</span>';
            if (typeof renderPagination === 'function') renderPagination();
            return;
        }
        lastFilteredArr = filterRecords(arr, displayFields, term);
        console.log('Filtered records count:', lastFilteredArr.length);
        // Force reset to first page for filtered results
        currentPage = 1;
        const resultDiv = document.getElementById('apiResult');
        if (resultDiv && typeof renderTable === 'function') {
            resultDiv.innerHTML = renderTable(lastFilteredArr, fields, displayFields);
        }
        if (typeof renderPagination === 'function') renderPagination();
    }
    if (searchInput) {
        searchInput.oninput = robustLiveSearch;
        if (searchNameOnly) searchNameOnly.onchange = robustLiveSearch;
    } else {
        console.log('Search input not found.');
    }
});
    console.log('--- TOP OF welcome2.js loaded ---');
    // Collage button logic (in share dropdown, grid size in popup)
console.log('--- BOTTOM OF welcome2.js executed ---');
    const collageBtn = document.getElementById('collageBtn');
    if (collageBtn) {
        collageBtn.onclick = function() {
            // Show modal to choose grid size and generate collage
            const modal = document.createElement('div');
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.25)';
            modal.style.zIndex = '2000';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.innerHTML = `<div style='background:#fff; border-radius:14px; padding:24px 28px; box-shadow:0 8px 32px #0003; position:relative; max-width:98vw; max-height:90vh; overflow:auto;'>
                <h2 style='margin-top:0;'>Create Collage</h2>
                <div style='margin-bottom:18px;'>
                    <label style='font-size:1em; margin-right:12px;'>Rows:
                        <select id='collageRows' style='margin-left:4px; padding:2px 6px; border-radius:4px;'>
                            <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option>
                        </select>
                    </label>
                    <label style='font-size:1em;'>Columns:
                        <select id='collageCols' style='margin-left:4px; padding:2px 6px; border-radius:4px;'>
                            <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option>
                        </select>
                    </label>
                </div>
                <button id='generateCollageBtn' style='background:#ff9800; color:#fff; border:none; border-radius:6px; padding:8px 22px; font-size:1em; font-weight:600; margin-right:10px;'>Generate</button>
                <button id='closeCollageBtn' style='background:#b71c1c; color:#fff; border:none; border-radius:6px; padding:8px 22px; font-size:1em; font-weight:600;'>Cancel</button>
                <div id='collagePreview' style='margin-top:18px;'></div>
            </div>`;
            document.body.appendChild(modal);
            // Set default to 3x3
            modal.querySelector('#collageRows').value = '3';
            modal.querySelector('#collageCols').value = '3';
            modal.querySelector('#closeCollageBtn').onclick = () => { document.body.removeChild(modal); };
            modal.querySelector('#generateCollageBtn').onclick = () => {
                const rows = Math.max(1, Math.min(10, parseInt(modal.querySelector('#collageRows').value)));
                const cols = Math.max(1, Math.min(10, parseInt(modal.querySelector('#collageCols').value)));
                const count = rows * cols;
                // Use current filtered view if available
                let arr = window.lastRecords;
                if (window.lastDisplayFields && window.lastRecords && typeof lastFilteredArr !== 'undefined' && Array.isArray(lastFilteredArr) && lastFilteredArr.length > 0) {
                    arr = lastFilteredArr;
                }
                // Find the first image or thumbnail field in displayFields
                let imgField = null;
                if (window.lastDisplayFields) {
                    for (const f of window.lastDisplayFields) {
                        if (/image|thumbnail/i.test(f)) { imgField = f; break; }
                    }
                }
                if (!imgField) {
                    alert('No image or thumbnail field found in current view.');
                    return;
                }
                // Get top X images
                const images = arr.map(r => r[imgField]).filter(Boolean).slice(0, count);
                if (images.length === 0) {
                    alert('No images found in current view.');
                    return;
                }
                // Create collage HTML
                let collageHtml = `<div style='display:grid; grid-template-rows:repeat(${rows},1fr); grid-template-columns:repeat(${cols},1fr); gap:4px; background:#eee; padding:8px; border-radius:10px; max-width:calc(120px*${cols}); margin:auto;'>`;
                for (let i = 0; i < count; ++i) {
                    if (i < images.length) {
                        collageHtml += `<div style='width:120px; height:90px; display:flex; align-items:center; justify-content:center; background:#fff; border-radius:8px; overflow:hidden;'><img src='${images[i]}' style='max-width:100%; max-height:100%; object-fit:contain;'></div>`;
                    } else {
                        collageHtml += `<div style='width:120px; height:90px; background:#fafafa; border-radius:8px;'></div>`;
                    }
                }
                collageHtml += '</div>';
                modal.querySelector('#collagePreview').innerHTML = collageHtml;
            };
        };
    }
console.log('Welcome2 page loaded! (script start)');

document.addEventListener('DOMContentLoaded', function() {
    // Share button logic
    const shareBtn = document.getElementById('shareBtn');
    const shareDropdown = document.getElementById('shareDropdown');
    const downloadTableBtn = document.getElementById('downloadTableBtn');
    const copyTableBtn = document.getElementById('copyTableBtn');
        const runBtn = document.getElementById('runApiBtn');
        const prepBtn = document.getElementById('prepApiBtn');
        let prepUsername = 'sportomax';
        if (prepBtn) {
            prepBtn.onclick = function() {
                // Show popup for username entry, owned games only checkbox, and max records input
                const mainMaxInput = document.getElementById('maxRecordsInput');
                const currentMax = mainMaxInput && !isNaN(parseInt(mainMaxInput.value)) ? parseInt(mainMaxInput.value) : 10;
                const modal = document.createElement('div');
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.width = '100vw';
                modal.style.height = '100vh';
                modal.style.background = 'rgba(0,0,0,0.25)';
                modal.style.zIndex = '2000';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.innerHTML = `<div style='background:#fff; border-radius:14px; padding:24px 28px; box-shadow:0 8px 32px #0003; position:relative; max-width:98vw; max-height:90vh; overflow:auto;'>
                    <h2 style='margin-top:0;'>Enter BoardGameGeek Username</h2>
                    <div style='margin-bottom:18px;'>
                        <label style='font-size:1em; margin-right:12px;'>Username:
                            <input id='prepUsernameInput' type='text' value='${prepUsername}' style='margin-left:4px; padding:2px 8px; border-radius:4px; border:1px solid #bbb; font-size:1em;'>
                        </label>
                    </div>
                    <div style='margin-bottom:18px;'>
                        <label for='prepMaxRecordsInput' style='font-weight:600;'>Max records to load:</label>
                        <input id='prepMaxRecordsInput' type='number' min='1' max='200' value='${currentMax}' style='width:60px; font-size:1em; margin-left:8px; padding:3px 6px; border-radius:4px; border:1px solid #bbb;'>
                    </div>
                    <div style='margin-bottom:18px;'>
                        <label style='font-size:1em;'><input id='prepOwnCheckbox' type='checkbox' style='margin-right:7px;'> Owned games only</label>
                    </div>
                    <button id='prepSaveBtn' style='background:#1976d2; color:#fff; border:none; border-radius:6px; padding:8px 22px; font-size:1em; font-weight:600; margin-right:10px;'>Save</button>
                    <button id='prepCancelBtn' style='background:#b71c1c; color:#fff; border:none; border-radius:6px; padding:8px 22px; font-size:1em; font-weight:600;'>Cancel</button>
                </div>`;
                document.body.appendChild(modal);
                // Set checkbox state from previous session or default (checked)
                if (typeof window.prepOwnOnly === 'undefined') window.prepOwnOnly = true;
                modal.querySelector('#prepOwnCheckbox').checked = window.prepOwnOnly;
                modal.querySelector('#prepCancelBtn').onclick = () => { document.body.removeChild(modal); };
                modal.querySelector('#prepSaveBtn').onclick = async () => {
                    // Log API calls for debugging
                    prepUsername = modal.querySelector('#prepUsernameInput').value.trim() || 'sportomax';
                    window.prepOwnOnly = modal.querySelector('#prepOwnCheckbox').checked;
                    // Sync max records value to main input, but always use user value for API
                    const prepMaxInput = modal.querySelector('#prepMaxRecordsInput');
                    let maxRecords = 10;
                    if (prepMaxInput) {
                        let val = parseInt(prepMaxInput.value);
                        if (isNaN(val) || val < 1) val = 1;
                        if (val > 200) val = 200;
                        maxRecords = val;
                        if (mainMaxInput) mainMaxInput.value = val;
                    }
                    document.body.removeChild(modal);
                    // --- FULL RUN LOGIC BELOW, using popup's username, own, and maxRecords ---
                    const resultDiv = document.getElementById('apiResult');
                    let currentPage = 1;
                    if (resultDiv) {
                        resultDiv.innerHTML = '<span style="color:#888;">Loading collection...</span>';
                        try {
                            // Get values from popup
                            const username = prepUsername || 'sportomax';
                            const ownParam = (typeof window.prepOwnOnly === 'undefined' || window.prepOwnOnly) ? '&own=1' : '';
                            const collectionUrl = `https://boardgamegeek.com/xmlapi2/collection?stats=1&username=${encodeURIComponent(username)}${ownParam}`;
                            console.log('PREP: Fetching collection API:', collectionUrl);
                            // API 1: Fetch user collection
                            const resp = await fetch(collectionUrl);
                            // Log each thing API call
                            if (!resp.ok) throw new Error('API error');
                            const xml = await resp.text();
                            const parser = new window.DOMParser();
                            const doc = parser.parseFromString(xml, 'text/xml');
                            let items = Array.from(doc.querySelectorAll('item'));
                            // Only process up to maxRecords
                            items = items.slice(0, maxRecords);
                            if (!items.length) {
                                let diag = `<div style='color:#c00;'><b>Error: No records found.</b></div>`;
                                diag += `<div style='margin:8px 0;'><b>Parsed items:</b> ${doc.querySelectorAll('item').length}</div>`;
                                diag += `<details><summary>Show raw XML response</summary><pre style='max-height:300px;overflow:auto;background:#f8f8f8;border:1px solid #ccc;'>${xml.replace(/</g,'&lt;')}</pre></details>`;
                                resultDiv.innerHTML = diag;
                                return;
                            }
                            // Add progress bar
                            resultDiv.innerHTML = `
                                <div id="progressContainer" style="width:80%;margin:20px auto 10px auto;max-width:500px;">
                                    <div id="progressBar" style="height:22px;width:0%;background:#1976d2;border-radius:8px;transition:width 0.3s;"></div>
                                </div>
                                <div id="progressText" style="text-align:center;font-size:1.1em;margin-bottom:10px;">Loading details for each game...</div>
                            `;
                            const progressBar = document.getElementById('progressBar');
                            const progressText = document.getElementById('progressText');
                            // API 2: Fetch thing details for each objectid
                            function flattenXML(node, prefix = '', out = {}) {
                                if (node.attributes) {
                                    Array.from(node.attributes).forEach(attr => {
                                        out[prefix + attr.name] = attr.value;
                                    });
                                }
                                Array.from(node.children || []).forEach(child => {
                                    const tag = child.tagName;
                                    if (tag === 'link' || tag === 'name') {
                                        const type = child.getAttribute('type') || tag;
                                        const key = prefix + tag + '_' + type;
                                        const val = child.getAttribute('value') || child.getAttribute('id') || child.textContent;
                                        if (!out[key]) out[key] = [];
                                        out[key].push(val);
                                    } else if (tag === 'rank') {
                                        const name = child.getAttribute('name') || 'rank';
                                        const key = prefix + 'rank_' + name;
                                        out[key] = Array.from(child.attributes).map(a => `${a.name}:${a.value}`).join('; ');
                                    } else if (child.children.length === 0 && child.textContent) {
                                        out[prefix + tag] = child.textContent;
                                    } else {
                                        flattenXML(child, prefix + tag + '_', out);
                                    }
                                });
                                return out;
                            }
                            // Batch objectids in groups of 20 for the second API call
                            const objectids = items.map(item => item.getAttribute('objectid'));
                            function chunk(arr, size) {
                                const out = [];
                                for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
                                return out;
                            }
                            const batches = chunk(objectids, 20);
                            let thingItems = [];
                            function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
                            let batchNum = 0;
                            const batchStartTime = Date.now();
                            for (const batch of batches) {
                                const ids = batch.join(',');
                                const thingUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${ids}&stats=1`;
                                console.log('PREP: Fetching thing API:', thingUrl);
                                try {
                                    const resp = await fetch(thingUrl);
                                    if (!resp.ok) throw new Error('Thing API error');
                                    const xml = await resp.text();
                                    const parser = new window.DOMParser();
                                    const doc = parser.parseFromString(xml, 'text/xml');
                                    const itemsInBatch = Array.from(doc.querySelectorAll('item'));
                                    thingItems = thingItems.concat(itemsInBatch);
                                } catch (e) {
                                    console.log('Thing batch fetch error:', e);
                                }
                                batchNum++;
                                const percent = Math.round((batchNum / batches.length) * 100);
                                if (progressBar) progressBar.style.width = percent + '%';
                                const elapsed = ((Date.now() - batchStartTime) / 1000).toFixed(1);
                                if (progressText) progressText.textContent = `Loading details: Batch ${batchNum} of ${batches.length} (${percent}%) - ${elapsed}s`;
                                await sleep(1000);
                            }
                            // Map objectid to flattened thing data
                            const thingMap = {};
                            function extractPlayerAgePollTable(thingItem) {
                                const poll = Array.from(thingItem.querySelectorAll('poll[name="suggested_playerage"]')).find(p => (p.getAttribute('title')||'').trim() === 'User Suggested Player Age');
                                if (!poll) return '';
                                let html = `<table style='border-collapse:collapse; font-size:0.98em; background:#f9f9f9; margin:0 auto;'>`;
                                html += `<tr><th style='padding:2px 6px; background:#eee; font-weight:600;'>Player Age</th><th style='padding:2px 6px; background:#eee;'>Votes</th></tr>`;
                                const results = poll.querySelectorAll('result');
                                let hasRows = false;
                                results.forEach(res => {
                                    const age = res.getAttribute('value');
                                    const votes = parseInt(res.getAttribute('numvotes'), 10);
                                    if (votes > 0) {
                                        html += `<tr><td style='padding:2px 6px; text-align:center;'>${age}</td>` +
                                            `<td style='padding:2px 6px; text-align:center;'>${votes}</td></tr>`;
                                        hasRows = true;
                                    }
                                });
                                html += `</table>`;
                                return hasRows ? html : '';
                            }
                            function extractLanguagePollTable(thingItem) {
                                const poll = Array.from(thingItem.querySelectorAll('poll[name="language_dependence"]')).find(p => (p.getAttribute('title')||'').trim() === 'Language Dependence');
                                if (!poll) return '';
                                let html = `<table style='border-collapse:collapse; font-size:0.98em; background:#f9f9f9; margin:0 auto;'>`;
                                html += `<tr><th style='padding:2px 6px; background:#eee; font-weight:600;'>Level</th><th style='padding:2px 6px; background:#eee;'>Description</th><th style='padding:2px 6px; background:#eee;'>Votes</th></tr>`;
                                const results = poll.querySelectorAll('result');
                                let hasRows = false;
                                results.forEach(res => {
                                    const level = res.getAttribute('level');
                                    const desc = res.getAttribute('value');
                                    const votes = parseInt(res.getAttribute('numvotes'), 10);
                                    if (votes > 0) {
                                        html += `<tr><td style='padding:2px 6px; text-align:center;'>${level}</td>` +
                                            `<td style='padding:2px 6px;'>${desc}</td>` +
                                            `<td style='padding:2px 6px; text-align:center;'>${votes}</td></tr>`;
                                        hasRows = true;
                                    }
                                });
                                html += `</table>`;
                                return hasRows ? html : '';
                            }
                            function extractPollTable(thingItem) {
                                const poll = thingItem.querySelector('poll[name="suggested_numplayers"]');
                                if (!poll) return '';
                                let html = `<table style='border-collapse:collapse; font-size:0.98em; background:#f9f9f9; margin:0 auto;'>`;
                                html += `<tr><th style='padding:2px 6px; background:#eee; font-weight:600;'># Players</th><th style='padding:2px 6px; background:#eee;'>Best</th><th style='padding:2px 6px; background:#eee;'>Recommended</th><th style='padding:2px 6px; background:#eee;'>Not Rec.</th></tr>`;
                                const results = poll.querySelectorAll('results');
                                results.forEach(res => {
                                    const num = res.getAttribute('numplayers');
                                    let best = 0, rec = 0, not = 0;
                                    res.querySelectorAll('result').forEach(r => {
                                        const v = r.getAttribute('value');
                                        const n = parseInt(r.getAttribute('numvotes')||'0',10);
                                        if (v === 'Best') best = n;
                                        else if (v === 'Recommended') rec = n;
                                        else if (v === 'Not Recommended') not = n;
                                    });
                                    html += `<tr><td style='padding:2px 6px; text-align:center;'>${num}</td>` +
                                        `<td style='padding:2px 6px; color:#fff; background:#388e3c; text-align:center;'>${best}</td>` +
                                        `<td style='padding:2px 6px; color:#fff; background:#1976d2; text-align:center;'>${rec}</td>` +
                                        `<td style='padding:2px 6px; color:#fff; background:#b71c1c; text-align:center;'>${not}</td></tr>`;
                                });
                                html += `</table>`;
                                return html;
                            }
                            thingItems.forEach(thingItem => {
                                const objectid = thingItem.getAttribute('id');
                                const flat = flattenXML(thingItem);
                                Object.keys(flat).forEach(k => {
                                    if (Array.isArray(flat[k])) flat[k] = flat[k].join(', ');
                                });
                                flat['poll_numplayers_table'] = extractPollTable(thingItem);
                                flat['poll_playerage_table'] = extractPlayerAgePollTable(thingItem);
                                const playerAgePoll = Array.from(thingItem.querySelectorAll('poll[name="suggested_playerage"]')).find(p => (p.getAttribute('title')||'').trim() === 'User Suggested Player Age');
                                if (playerAgePoll) {
                                    flat['suggested_playerage_votes'] = playerAgePoll.getAttribute('totalvotes') || '';
                                }
                                const poll = thingItem.querySelector('poll[name="suggested_numplayers"]');
                                if (poll) {
                                    flat['suggested_numplayers_votes'] = poll.getAttribute('totalvotes') || '';
                                }
                                const langPoll = thingItem.querySelector('poll[name="language_dependence"]');
                                if (langPoll) {
                                    flat['language_votes'] = langPoll.getAttribute('totalvotes') || '';
                                    flat['poll_language_table'] = extractLanguagePollTable(thingItem);
                                }
                                const pollSummary = thingItem.querySelector('poll-summary[name="suggested_numplayers"]');
                                if (pollSummary) {
                                    const bestwith = pollSummary.querySelector('result[name="bestwith"]');
                                    if (bestwith) {
                                        let val = bestwith.getAttribute('value') || '';
                                        val = val.replace(/^Best with\s*/i, '').trim();
                                        flat['bestwith'] = val;
                                    }
                                    const recommendedwith = pollSummary.querySelector('result[name="recommmendedwith"]');
                                    if (recommendedwith) {
                                        let val = recommendedwith.getAttribute('value') || '';
                                        val = val.replace(/^Recommended with\s*/i, '').trim();
                                        flat['recommendedwith'] = val;
                                    }
                                }
                                thingMap[objectid] = flat;
                            });
                            const thingArr = items.map(item => {
                                const rec = {};
                                Array.from(item.attributes).forEach(attr => {
                                    rec['collection_' + attr.name] = attr.value;
                                });
                                Array.from(item.children).forEach(child => {
                                    if (child.tagName === 'status') {
                                        Array.from(child.attributes).forEach(attr => {
                                            rec['collection_status_' + attr.name] = attr.value;
                                        });
                                    } else if (child.tagName === 'stats') {
                                        Array.from(child.attributes).forEach(attr => {
                                            rec['collection_stats_' + attr.name] = attr.value;
                                        });
                                        const rating = child.querySelector('rating');
                                        if (rating) {
                                            Array.from(rating.attributes).forEach(attr => {
                                                rec['collection_rating_' + attr.name] = attr.value;
                                            });
                                            ['usersrated','average','bayesaverage','stddev','median'].forEach(tag => {
                                                const el = rating.querySelector(tag);
                                                if (el && el.hasAttribute('value')) {
                                                    rec['collection_rating_' + tag] = el.getAttribute('value');
                                                }
                                            });
                                        }
                                    } else if (child.children.length === 0 && child.textContent) {
                                        rec['collection_' + child.tagName] = child.textContent;
                                    } else if (child.tagName === 'name') {
                                        const key = 'collection_name_' + (child.getAttribute('type') || 'unknown');
                                        if (!rec[key]) rec[key] = [];
                                        rec[key].push(child.getAttribute('value'));
                                    } else if (child.tagName === 'link') {
                                        const type = child.getAttribute('type') || 'unknown';
                                        const key = 'collection_link_' + type;
                                        if (!rec[key]) rec[key] = [];
                                        rec[key].push(child.getAttribute('value'));
                                    } else {
                                        rec['collection_' + child.tagName] = child.outerHTML;
                                    }
                                });
                                Object.keys(rec).forEach(k => {
                                    if (Array.isArray(rec[k])) rec[k] = rec[k].join(', ');
                                });
                                const objectid = item.getAttribute('objectid');
                                const flat = thingMap[objectid];
                                if (flat) {
                                    Object.keys(flat).forEach(k => {
                                        rec['t_' + k] = flat[k];
                                    });
                                }
                                return rec;
                            });
                            const collectionKeys = [];
                            let thingKeys = [];
                            let numPlayersCols = [];
                            if (thingItems.length > 0) {
                                const flatFirst = flattenXML(thingItems[0]);
                                thingKeys = Object.keys(flatFirst).map(k => 't_' + k);
                            }
                            thingArr.forEach(obj => {
                                Object.keys(obj).forEach(k => {
                                    if (k.startsWith('collection_')) {
                                        if (!collectionKeys.includes(k)) collectionKeys.push(k);
                                    } else if (k.startsWith('t_')) {
                                        if (!thingKeys.includes(k)) thingKeys.push(k);
                                    } else if (k.startsWith('numplayers_')) {
                                        if (!numPlayersCols.includes(k)) numPlayersCols.push(k);
                                    }
                                });
                            });
                            let fields = ['idx', ...collectionKeys, ...thingKeys];
                            const maxPlayersIdx = fields.indexOf('t_maxplayers_value');
                            if (maxPlayersIdx !== -1 && numPlayersCols.length > 0) {
                                fields = [
                                    ...fields.slice(0, maxPlayersIdx + 1),
                                    ...numPlayersCols.map(c => 't_' + c),
                                    ...fields.slice(maxPlayersIdx + 1)
                                ];
                            } else if (numPlayersCols.length > 0) {
                                fields = [...fields, ...numPlayersCols.map(c => 't_' + c)];
                            }
                            window.lastFields = fields;
                            let displayFields = fields;
                            if (selectedColumns.length > 0) {
                                displayFields = fields.filter(f => selectedColumns.includes(f));
                            }
                            window.lastFields = fields;
                            window.lastRecords = thingArr;
                            window.lastDisplayFields = displayFields;
                            const pollCol = 't_poll_numplayers_table';
                            const suggestedCol = 't_suggested_numplayers_votes';
                            const bestwithCol = 't_bestwith';
                            const recommendedwithCol = 't_recommendedwith';
                            const maxPlayersCol = 't_maxplayers_value';
                            const playerAgeCol = 't_poll_playerage_table';
                            const minAgeCol = 't_minage_value';
                            const pollSummaryCols = [
                                't_poll-summary_name',
                                't_poll-summary_title',
                                't_poll-summary_result_name',
                                't_poll-summary_result_value'
                            ];
                            const pollCols = [
                                't_poll_name',
                                't_poll_title',
                                't_poll_totalvotes',
                                't_poll_results_numplayers',
                                't_poll_results_result_value',
                                't_poll_results_result_numvotes'
                            ];
                            [pollCol, suggestedCol, bestwithCol, recommendedwithCol, playerAgeCol, ...pollSummaryCols, ...pollCols].forEach(col => {
                                let idx = displayFields.indexOf(col);
                                while (idx !== -1) {
                                    displayFields.splice(idx, 1);
                                    idx = displayFields.indexOf(col);
                                }
                            });
                            let minAgeIdx = displayFields.indexOf(minAgeCol);
                            if (minAgeIdx === -1) minAgeIdx = displayFields.length - 1;
                            const playerAgeVotesCol = 't_suggested_playerage_votes';
                            let idxVotes = displayFields.indexOf(playerAgeVotesCol);
                            if (idxVotes !== -1) displayFields.splice(idxVotes, 1);
                            let idxPlayerAge = displayFields.indexOf(playerAgeCol);
                            if (idxPlayerAge !== -1) displayFields.splice(idxPlayerAge, 1);
                            displayFields.splice(minAgeIdx + 1, 0, playerAgeVotesCol, playerAgeCol);
                            let insertIdx = displayFields.indexOf(maxPlayersCol);
                            if (insertIdx === -1) insertIdx = displayFields.length - 1;
                            displayFields.splice(insertIdx + 1, 0, suggestedCol, pollCol);
                            let pollInsertIdx = displayFields.indexOf(pollCol);
                            displayFields.splice(pollInsertIdx + 1, 0, bestwithCol, recommendedwithCol);
                            resultDiv.innerHTML = renderTable(thingArr, fields, displayFields);
                            renderPagination();
                        } catch (e) {
                            resultDiv.innerHTML = `<span style='color:#c00;'>Error: ${e.message}</span>`;
                            renderPagination();
                        }
                    }
                };
            };
        }
    // Toggle dropdown
    if (shareBtn && shareDropdown) {
        shareBtn.onclick = (e) => {
            e.stopPropagation();
            shareDropdown.style.display = shareDropdown.style.display === 'block' ? 'none' : 'block';
        };
        document.addEventListener('click', (e) => {
            if (shareDropdown.style.display === 'block') shareDropdown.style.display = 'none';
        });
    }
    // Download table as CSV
    if (downloadTableBtn) {
        downloadTableBtn.onclick = () => {
            if (!window.lastRecords || !window.lastDisplayFields) return;
            const arr = window.lastRecords;
            const fields = window.lastDisplayFields;
            let csv = fields.join(',') + '\n';
            arr.forEach(row => {
                csv += fields.map(f => '"' + (row[f] ? ('' + row[f]).replace(/"/g, '""') : '') + '"').join(',') + '\n';
            });
            const blob = new Blob([csv], {type: 'text/csv'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'table.csv';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        };
    }
    // Copy table to clipboard
    if (copyTableBtn) {
        copyTableBtn.onclick = async () => {
            if (!window.lastRecords || !window.lastDisplayFields) return;
            const arr = window.lastRecords;
            const fields = window.lastDisplayFields;
            let tsv = fields.join('\t') + '\n';
            arr.forEach(row => {
                tsv += fields.map(f => row[f] ? ('' + row[f]).replace(/\t/g, ' ') : '').join('\t') + '\n';
            });
            try {
                await navigator.clipboard.writeText(tsv);
                alert('Table copied to clipboard!');
            } catch (e) {
                alert('Failed to copy table.');
            }
        };
    }
    // Pagination state
    let currentPage = 1;
    let pageSize = 25;
    let lastFilteredArr = [];
    const paginationTop = document.getElementById('paginationTop');
    const paginationBottom = document.getElementById('paginationBottom');
    const searchNameOnly = document.getElementById('searchNameOnly');
    // Helper to render the table from records and fields
    function renderTable(records, fields, displayFields) {
    // Always use lastFilteredArr for rendering
    const filteredRecords = (Array.isArray(lastFilteredArr) && lastFilteredArr.length > 0) ? lastFilteredArr : records;
    const localTotalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    if (currentPage > localTotalPages) currentPage = localTotalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pagedRecords = filteredRecords.slice(startIdx, endIdx);
    let html = `<div style='overflow-x:auto;'><table border='1' cellpadding='6' style='border-collapse:collapse; margin:auto; background:#fff; min-width:1200px; border: 4px solid #a020f0;'><thead><tr>`;
        displayFields.forEach(f => {
            let bg = f === 'idx' ? '#333' : (f.startsWith('collection_') ? '#b71c1c' : (f.startsWith('t_') ? '#008080' : '#1976d2'));
            html += `<th style='background:${bg}; color:#fff; font-weight:600; position:sticky; top:0; z-index:2;'>${f}</th>`;
        });
        html += `</tr></thead><tbody>`;
        pagedRecords.forEach((rec, i) => {
            html += '<tr>';
            displayFields.forEach((f, colIdx) => {
                if (f === 'idx') {
                    html += `<td style='font-size:0.98em; color:#222; font-weight:bold;'>${startIdx + i + 1}</td>`;
                } else if (/image|thumbnail/i.test(f) && rec[f]) {
                    // Use larger size for main images, smaller for thumbnails
                    const isThumb = /thumbnail/i.test(f);
                    const maxW = isThumb ? 80 : 120;
                    const maxH = isThumb ? 60 : 90;
                    const radius = isThumb ? 6 : 8;
                    html += `<td style='font-size:0.98em; color:#222;'><img src='${rec[f]}' alt='${f}' style='max-width:${maxW}px; max-height:${maxH}px; border-radius:${radius}px;'></td>`;
                } else if (f === 't_poll_numplayers_table' && rec[f]) {
                    html += `<td style='font-size:0.98em; color:#222;'>${rec[f]}</td>`;
                } else if (f === 't_poll_playerage_table') {
                    // Only render the poll table, never fallback to other data
                    html += `<td style='font-size:0.98em; color:#222;'>${rec[f] ? rec[f] : ''}</td>`;
                } else if (f === 't_poll_language_table' && rec[f]) {
                    // Render language poll table as HTML
                    html += `<td style='font-size:0.98em; color:#222;'>${rec[f]}</td>`;
                } else {
                    let val = rec[f] !== undefined ? rec[f] : '';
                    if (f === 't_name_alternate' && typeof val === 'string') {
                        let arr = val.split(/,\s?/);
                        if (arr.length > 5) {
                            val = arr.slice(0,5).join('\n') + '\n...';
                        } else {
                            val = arr.join('\n');
                        }
                    } else if (typeof val === 'string') {
                        const lines = val.split(/\r?\n/);
                        if (val.length > 100 || lines.length > 10) {
                            val = val.slice(0, 100);
                            if (lines.length > 10) {
                                val = lines.slice(0, 10).join('\n');
                            }
                            val += '...';
                        }
                    }
                    html += `<td style='font-size:0.98em; color:#222; white-space:pre-line;'>${val}</td>`;
                }
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        return html;
    }
    // Pagination controls rendering
    function renderPagination() {
        if (!paginationTop || !paginationBottom) return;
    // Always compute totalPages from the filtered array
    const arr = (Array.isArray(lastFilteredArr) && lastFilteredArr.length > 0) ? lastFilteredArr : (window.lastRecords || []);
    const localTotalPages = Math.max(1, Math.ceil(arr.length / pageSize));
        const makeControls = (pos) => {
            return `
                <div style="display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:0.7em; width:100%; max-width:100vw;">
                    <button id="firstPageBtn${pos}" ${currentPage === 1 ? 'disabled' : ''} style="padding:7px 16px; font-size:1em; border-radius:6px;">First</button>
                    <button id="prevPageBtn${pos}" ${currentPage === 1 ? 'disabled' : ''} style="padding:7px 16px; font-size:1em; border-radius:6px;">Prev</button>
                    <span style="font-size:1em;">Page</span>
                    <input id="pageInput${pos}" type="number" min="1" max="${localTotalPages}" value="${currentPage}" style="width:54px; font-size:1em; text-align:center; border-radius:5px; border:1px solid #bbb; max-width:70px;">
                    <span style="font-size:1em;">of ${localTotalPages}</span>
                    <button id="nextPageBtn${pos}" ${currentPage === localTotalPages ? 'disabled' : ''} style="padding:7px 16px; font-size:1em; border-radius:6px;">Next</button>
                    <button id="lastPageBtn${pos}" ${currentPage === localTotalPages ? 'disabled' : ''} style="padding:7px 16px; font-size:1em; border-radius:6px;">Last</button>
                    <span style="color:#888; font-size:0.98em; margin-left:0.7em;">(${arr.length} records)</span>
                </div>
            `;
        };
        paginationTop.innerHTML = makeControls('Top');
        paginationBottom.innerHTML = makeControls('Bottom');
        // Add event listeners for both top and bottom controls
        const firstBtnTop = document.getElementById('firstPageBtnTop');
        const prevBtnTop = document.getElementById('prevPageBtnTop');
        const nextBtnTop = document.getElementById('nextPageBtnTop');
        const lastBtnTop = document.getElementById('lastPageBtnTop');
        const pageInputTop = document.getElementById('pageInputTop');
        const firstBtnBottom = document.getElementById('firstPageBtnBottom');
        const prevBtnBottom = document.getElementById('prevPageBtnBottom');
        const nextBtnBottom = document.getElementById('nextPageBtnBottom');
        const lastBtnBottom = document.getElementById('lastPageBtnBottom');
        const pageInputBottom = document.getElementById('pageInputBottom');
        if (firstBtnTop) firstBtnTop.onclick = () => { if (currentPage > 1) { currentPage = 1; updateTable(); }};
        if (prevBtnTop) prevBtnTop.onclick = () => { if (currentPage > 1) { currentPage--; updateTable(); }};
        if (nextBtnTop) nextBtnTop.onclick = () => { if (currentPage < localTotalPages) { currentPage++; updateTable(); }};
        if (lastBtnTop) lastBtnTop.onclick = () => { if (currentPage < localTotalPages) { currentPage = localTotalPages; updateTable(); }};
        if (pageInputTop) pageInputTop.onchange = (e) => {
            let val = parseInt(e.target.value);
            if (!isNaN(val) && val >= 1 && val <= localTotalPages) {
                currentPage = val;
                updateTable();
            } else {
                e.target.value = currentPage;
            }
        };
        if (firstBtnBottom) firstBtnBottom.onclick = () => { if (currentPage > 1) { currentPage = 1; updateTable(); }};
        if (prevBtnBottom) prevBtnBottom.onclick = () => { if (currentPage > 1) { currentPage--; updateTable(); }};
        if (nextBtnBottom) nextBtnBottom.onclick = () => { if (currentPage < localTotalPages) { currentPage++; updateTable(); }};
        if (lastBtnBottom) lastBtnBottom.onclick = () => { if (currentPage < localTotalPages) { currentPage = localTotalPages; updateTable(); }};
        if (pageInputBottom) pageInputBottom.onchange = (e) => {
            let val = parseInt(e.target.value);
            if (!isNaN(val) && val >= 1 && val <= localTotalPages) {
                currentPage = val;
                updateTable();
            } else {
                e.target.value = currentPage;
            }
        };
    }
    // Update table and pagination
    function updateTable() {
        if (window.lastRecords && window.lastFields && window.lastDisplayFields) {
            // Always use lastFilteredArr if it exists, else use all records
            let arr = (Array.isArray(lastFilteredArr) && lastFilteredArr.length > 0) ? lastFilteredArr : window.lastRecords;
            // If currentPage is out of range after filtering, set to last page
            const totalPages = Math.max(1, Math.ceil(arr.length / pageSize));
            if (currentPage > totalPages) currentPage = totalPages;
            resultDiv.innerHTML = renderTable(arr, window.lastFields, window.lastDisplayFields);
            renderPagination();
        }
    }
    const searchInput = document.getElementById('searchInput');
    let lastSearchTerm = '';
    function filterRecords(records, fields, term) {
    if (!term) return records;
        const lc = term.toLowerCase();
        let searchFields = fields;
        if (searchNameOnly && searchNameOnly.checked) {
            searchFields = fields.filter(f => /name.*primary|name$/i.test(f));
            if (searchFields.length === 0) searchFields = fields.filter(f => /name/i.test(f));
        }
    return records.filter(rec => searchFields.some(f => (rec[f] + '').toLowerCase().includes(lc)));
    }
    // Settings modal logic
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const settingsColumnsDiv = document.getElementById('settingsColumns');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const selectNoneBtn = document.getElementById('selectNoneBtn');
    const selectBasicBtn = document.getElementById('selectBasicBtn');
    if (selectBasicBtn && settingsColumnsDiv) {
        selectBasicBtn.onclick = function() {
            // Basic columns to select
            const basicCols = ['idx', 'collection_thumbnail', 'collection_rating_bayesaverage'];
            // Deselect all first
            Array.from(settingsColumnsDiv.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
                cb.checked = false;
            });
            // Select only basic columns
            Array.from(settingsColumnsDiv.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
                if (basicCols.includes(cb.value)) {
                    cb.checked = true;
                }
            });
            // Hide all t_ columns
            Array.from(settingsColumnsDiv.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
                if (/^t_/.test(cb.value)) {
                    cb.checked = false;
                }
            });
        };
    }
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    let allColumns = [];
    let selectedColumns = [];
    // Load from sessionStorage if available
    if (sessionStorage.getItem('selectedColumns')) {
        selectedColumns = JSON.parse(sessionStorage.getItem('selectedColumns'));
    }
    function showSettingsModal(columns) {
        allColumns = columns;
        settingsColumnsDiv.innerHTML = '';
        columns.forEach(col => {
            const id = 'col_' + col.replace(/[^a-zA-Z0-9_]/g, '_');
            const checked = selectedColumns.length === 0 || selectedColumns.includes(col) ? 'checked' : '';
            settingsColumnsDiv.innerHTML += `<div style='margin-bottom:4px;'><label><input type='checkbox' class='colCheckbox' id='${id}' value='${col}' ${checked}> ${col}</label></div>`;
        });
        settingsModal.style.display = 'flex';
    }
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            // Use last fields if available, else default
            if (allColumns.length === 0 && window.lastFields) allColumns = window.lastFields;
            showSettingsModal(allColumns);
        };
    }
    if (closeSettingsBtn) closeSettingsBtn.onclick = () => { settingsModal.style.display = 'none'; };
    if (selectAllBtn) selectAllBtn.onclick = () => {
        document.querySelectorAll('.colCheckbox').forEach(cb => cb.checked = true);
    };
    if (selectNoneBtn) selectNoneBtn.onclick = () => {
        document.querySelectorAll('.colCheckbox').forEach(cb => cb.checked = false);
    };
    if (saveSettingsBtn) saveSettingsBtn.onclick = () => {
    selectedColumns = Array.from(document.querySelectorAll('.colCheckbox')).filter(cb => cb.checked).map(cb => cb.value);
    sessionStorage.setItem('selectedColumns', JSON.stringify(selectedColumns));
    settingsModal.style.display = 'none';
    // Re-render table and pagination with new columns immediately
    if (window.lastRecords && selectedColumns.length > 0) {
        window.lastDisplayFields = selectedColumns;
        lastFilteredArr = filterRecords(window.lastRecords, selectedColumns, searchInput ? searchInput.value.trim() : '');
        currentPage = 1;
        const resultDiv = document.getElementById('apiResult');
        if (resultDiv && typeof renderTable === 'function') {
            resultDiv.innerHTML = renderTable(lastFilteredArr, window.lastFields, selectedColumns);
        }
        if (typeof renderPagination === 'function') renderPagination();
    }
    };
    // const runBtn = document.getElementById('runApiBtn'); // Removed duplicate declaration
    const resultDiv = document.getElementById('apiResult');
    if (runBtn && resultDiv) {
        runBtn.onclick = async function() {
            currentPage = 1;
            console.log('RUN button clicked, starting API calls...');
            resultDiv.innerHTML = '<span style="color:#888;">Loading collection...</span>';
            try {
                console.log('Starting collection API fetch...');
                // Get max records from input
                let maxRecords = 50;
                const maxInput = document.getElementById('maxRecordsInput');
                if (maxInput && !isNaN(parseInt(maxInput.value))) {
                    maxRecords = Math.max(1, Math.min(200, parseInt(maxInput.value)));
                }
                // Use username and own filter from PREP popup
                const username = prepUsername || 'sportomax';
                const ownParam = (typeof window.prepOwnOnly === 'undefined' || window.prepOwnOnly) ? '&own=1' : '';
                // API 1: Fetch user collection via centralized BGG helper
                const resp = await fetch(`/api/bgg-helper?endpoint=collection&stats=1&username=${encodeURIComponent(username)}${ownParam}`);
                if (!resp.ok) throw new Error('API error');
                const xml = await resp.text();
                const parser = new window.DOMParser();
                const doc = parser.parseFromString(xml, 'text/xml');
                let items = Array.from(doc.querySelectorAll('item'));
                // Only process up to maxRecords
                items = items.slice(0, maxRecords);
                if (!items.length) {
                    let diag = `<div style='color:#c00;'><b>Error: No records found.</b></div>`;
                    diag += `<div style='margin:8px 0;'><b>Parsed items:</b> ${doc.querySelectorAll('item').length}</div>`;
                    diag += `<details><summary>Show raw XML response</summary><pre style='max-height:300px;overflow:auto;background:#f8f8f8;border:1px solid #ccc;'>${xml.replace(/</g,'&lt;')}</pre></details>`;
                    resultDiv.innerHTML = diag;
                    return;
                }
                                // Add progress bar
                                resultDiv.innerHTML = `
                                    <div id="progressContainer" style="width:80%;margin:20px auto 10px auto;max-width:500px;">
                                        <div id="progressBar" style="height:22px;width:0%;background:#1976d2;border-radius:8px;transition:width 0.3s;"></div>
                                    </div>
                                    <div id="progressText" style="text-align:center;font-size:1.1em;margin-bottom:10px;">Loading details for each game...</div>
                                `;
                                const progressBar = document.getElementById('progressBar');
                                const progressText = document.getElementById('progressText');
                console.log('Collection API fetch complete, starting thing API calls...');
                // API 2: Fetch thing details for each objectid
                // Helper to deeply flatten XML into a flat object with combined values for repeated fields
                function flattenXML(node, prefix = '', out = {}) {
                    // Attributes
                    if (node.attributes) {
                        Array.from(node.attributes).forEach(attr => {
                            out[prefix + attr.name] = attr.value;
                        });
                    }
                    // Children
                    Array.from(node.children || []).forEach(child => {
                        const tag = child.tagName;
                        // For links, names, expansions, publishers, etc, combine by type or tag
                        if (tag === 'link' || tag === 'name') {
                            const type = child.getAttribute('type') || tag;
                            const key = prefix + tag + '_' + type;
                            const val = child.getAttribute('value') || child.getAttribute('id') || child.textContent;
                            if (!out[key]) out[key] = [];
                            out[key].push(val);
                        } else if (tag === 'rank') {
                            // For ranks, combine by name/type
                            const name = child.getAttribute('name') || 'rank';
                            const key = prefix + 'rank_' + name;
                            out[key] = Array.from(child.attributes).map(a => `${a.name}:${a.value}`).join('; ');
                        } else if (child.children.length === 0 && child.textContent) {
                            // Simple text node
                            out[prefix + tag] = child.textContent;
                        } else {
                            // Nested: recurse
                            flattenXML(child, prefix + tag + '_', out);
                        }
                    });
                    return out;
                }

                // Batch objectids in groups of 20 for the second API call
                const objectids = items.map(item => item.getAttribute('objectid'));
                function chunk(arr, size) {
                    const out = [];
                    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
                    return out;
                }
                const batches = chunk(objectids, 20);
                let thingItems = [];
                // Helper to pause between requests
                function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
                let batchNum = 0;
                const batchStartTime = Date.now();
                for (const batch of batches) {
                    const ids = batch.join(',');
                    try {
                        // Use centralized BGG helper for thing API calls
                        const resp = await fetch(`/api/bgg-helper?endpoint=thing&id=${ids}&stats=1`);
                        if (!resp.ok) throw new Error('Thing API error');
                        const xml = await resp.text();
                        const parser = new window.DOMParser();
                        const doc = parser.parseFromString(xml, 'text/xml');
                        const itemsInBatch = Array.from(doc.querySelectorAll('item'));
                        thingItems = thingItems.concat(itemsInBatch);
                    } catch (e) {
                        console.log('Thing batch fetch error:', e);
                    }
                    batchNum++;
                    // Update progress bar
                    const percent = Math.round((batchNum / batches.length) * 100);
                    if (progressBar) progressBar.style.width = percent + '%';
                    const elapsed = ((Date.now() - batchStartTime) / 1000).toFixed(1);
                    if (progressText) progressText.textContent = `Loading details: Batch ${batchNum} of ${batches.length} (${percent}%) - ${elapsed}s`;
                    await sleep(1000);
                }
                // Map objectid to flattened thing data
                const thingMap = {};
                // Helper to extract and format poll data for number of players
                // Helper to extract and format poll data for suggested player age
                function extractPlayerAgePollTable(thingItem) {
                    // Only use poll with title 'User Suggested Player Age'
                    const poll = Array.from(thingItem.querySelectorAll('poll[name="suggested_playerage"]')).find(p => (p.getAttribute('title')||'').trim() === 'User Suggested Player Age');
                    if (!poll) return '';
                    let html = `<table style='border-collapse:collapse; font-size:0.98em; background:#f9f9f9; margin:0 auto;'>`;
                    html += `<tr><th style='padding:2px 6px; background:#eee; font-weight:600;'>Player Age</th><th style='padding:2px 6px; background:#eee;'>Votes</th></tr>`;
                    const results = poll.querySelectorAll('result');
                    let hasRows = false;
                    results.forEach(res => {
                        const age = res.getAttribute('value');
                        const votes = parseInt(res.getAttribute('numvotes'), 10);
                        if (votes > 0) {
                            html += `<tr><td style='padding:2px 6px; text-align:center;'>${age}</td>` +
                                `<td style='padding:2px 6px; text-align:center;'>${votes}</td></tr>`;
                            hasRows = true;
                        }
                    });
                    html += `</table>`;
                    return hasRows ? html : '';
                }
                    // Extract language dependence poll table
                    function extractLanguagePollTable(thingItem) {
                        // Only use poll with name 'language_dependence' and title 'Language Dependence'
                        const poll = Array.from(thingItem.querySelectorAll('poll[name="language_dependence"]')).find(p => (p.getAttribute('title')||'').trim() === 'Language Dependence');
                        if (!poll) return '';
                        let html = `<table style='border-collapse:collapse; font-size:0.98em; background:#f9f9f9; margin:0 auto;'>`;
                        html += `<tr><th style='padding:2px 6px; background:#eee; font-weight:600;'>Level</th><th style='padding:2px 6px; background:#eee;'>Description</th><th style='padding:2px 6px; background:#eee;'>Votes</th></tr>`;
                        const results = poll.querySelectorAll('result');
                        let hasRows = false;
                        results.forEach(res => {
                            const level = res.getAttribute('level');
                            const desc = res.getAttribute('value');
                            const votes = parseInt(res.getAttribute('numvotes'), 10);
                            if (votes > 0) {
                                html += `<tr><td style='padding:2px 6px; text-align:center;'>${level}</td>` +
                                    `<td style='padding:2px 6px;'>${desc}</td>` +
                                    `<td style='padding:2px 6px; text-align:center;'>${votes}</td></tr>`;
                                hasRows = true;
                            }
                        });
                        html += `</table>`;
                        return hasRows ? html : '';
                    }
                function extractPollTable(thingItem) {
                    const poll = thingItem.querySelector('poll[name="suggested_numplayers"]');
                    if (!poll) return '';
                    let html = `<table style='border-collapse:collapse; font-size:0.98em; background:#f9f9f9; margin:0 auto;'>`;
                    html += `<tr><th style='padding:2px 6px; background:#eee; font-weight:600;'># Players</th><th style='padding:2px 6px; background:#eee;'>Best</th><th style='padding:2px 6px; background:#eee;'>Recommended</th><th style='padding:2px 6px; background:#eee;'>Not Rec.</th></tr>`;
                    const results = poll.querySelectorAll('results');
                    results.forEach(res => {
                        const num = res.getAttribute('numplayers');
                        let best = 0, rec = 0, not = 0;
                        res.querySelectorAll('result').forEach(r => {
                            const v = r.getAttribute('value');
                            const n = parseInt(r.getAttribute('numvotes')||'0',10);
                            if (v === 'Best') best = n;
                            else if (v === 'Recommended') rec = n;
                            else if (v === 'Not Recommended') not = n;
                        });
                        html += `<tr><td style='padding:2px 6px; text-align:center;'>${num}</td>` +
                            `<td style='padding:2px 6px; color:#fff; background:#388e3c; text-align:center;'>${best}</td>` +
                            `<td style='padding:2px 6px; color:#fff; background:#1976d2; text-align:center;'>${rec}</td>` +
                            `<td style='padding:2px 6px; color:#fff; background:#b71c1c; text-align:center;'>${not}</td></tr>`;
                    });
                    html += `</table>`;
                    return html;
                }
                thingItems.forEach(thingItem => {
                    const objectid = thingItem.getAttribute('id');
                    const flat = flattenXML(thingItem);
                    Object.keys(flat).forEach(k => {
                        if (Array.isArray(flat[k])) flat[k] = flat[k].join(', ');
                    });
                    // Add pretty poll table as a special field
                    flat['poll_numplayers_table'] = extractPollTable(thingItem);

                    // Add suggested player age poll table as a special field
                    flat['poll_playerage_table'] = extractPlayerAgePollTable(thingItem);

                    // Add t_suggested_playerage_votes (totalvotes from poll with title 'User Suggested Player Age')
                    const playerAgePoll = Array.from(thingItem.querySelectorAll('poll[name="suggested_playerage"]')).find(p => (p.getAttribute('title')||'').trim() === 'User Suggested Player Age');
                    if (playerAgePoll) {
                        flat['suggested_playerage_votes'] = playerAgePoll.getAttribute('totalvotes') || '';
                    }

                    // Add t_suggested_numplayers_votes (totalvotes from poll)
                    const poll = thingItem.querySelector('poll[name="suggested_numplayers"]');
                    if (poll) {
                        flat['suggested_numplayers_votes'] = poll.getAttribute('totalvotes') || '';
                        // (numplayers columns logic remains commented out)
                    }

                    // Add t_language_votes and t_language_results
                    const langPoll = thingItem.querySelector('poll[name="language_dependence"]');
                    if (langPoll) {
                        flat['language_votes'] = langPoll.getAttribute('totalvotes') || '';
                        flat['poll_language_table'] = extractLanguagePollTable(thingItem);
                    }
                    // Add bestwith and recommendedwith from <poll-summary>
                    const pollSummary = thingItem.querySelector('poll-summary[name="suggested_numplayers"]');
                    if (pollSummary) {
                        const bestwith = pollSummary.querySelector('result[name="bestwith"]');
                        if (bestwith) {
                            let val = bestwith.getAttribute('value') || '';
                            // Remove 'Best with' prefix if present
                            val = val.replace(/^Best with\s*/i, '').trim();
                            flat['bestwith'] = val;
                        }
                        const recommendedwith = pollSummary.querySelector('result[name="recommmendedwith"]');
                        if (recommendedwith) {
                            let val = recommendedwith.getAttribute('value') || '';
                            // Remove 'Recommended with' prefix if present
                            val = val.replace(/^Recommended with\s*/i, '').trim();
                            flat['recommendedwith'] = val;
                        }
                    }
                    thingMap[objectid] = flat;
                });
                // Merge collection and thing data
                const thingArr = items.map(item => {
                    const rec = {};
                    Array.from(item.attributes).forEach(attr => {
                        rec['collection_' + attr.name] = attr.value;
                    });
                    Array.from(item.children).forEach(child => {
                        if (child.tagName === 'status') {
                            // Flatten status attributes
                            Array.from(child.attributes).forEach(attr => {
                                rec['collection_status_' + attr.name] = attr.value;
                            });
                        } else if (child.tagName === 'stats') {
                            // Flatten stats attributes
                            Array.from(child.attributes).forEach(attr => {
                                rec['collection_stats_' + attr.name] = attr.value;
                            });
                            // Flatten rating inside stats
                            const rating = child.querySelector('rating');
                            if (rating) {
                                Array.from(rating.attributes).forEach(attr => {
                                    rec['collection_rating_' + attr.name] = attr.value;
                                });
                                // usersrated, average, bayesaverage, stddev, median
                                ['usersrated','average','bayesaverage','stddev','median'].forEach(tag => {
                                    const el = rating.querySelector(tag);
                                    if (el && el.hasAttribute('value')) {
                                        rec['collection_rating_' + tag] = el.getAttribute('value');
                                    }
                                });
                            }
                        } else if (child.children.length === 0 && child.textContent) {
                            rec['collection_' + child.tagName] = child.textContent;
                        } else if (child.tagName === 'name') {
                            const key = 'collection_name_' + (child.getAttribute('type') || 'unknown');
                            if (!rec[key]) rec[key] = [];
                            rec[key].push(child.getAttribute('value'));
                        } else if (child.tagName === 'link') {
                            const type = child.getAttribute('type') || 'unknown';
                            const key = 'collection_link_' + type;
                            if (!rec[key]) rec[key] = [];
                            rec[key].push(child.getAttribute('value'));
                        } else {
                            rec['collection_' + child.tagName] = child.outerHTML;
                        }
                    });
                    Object.keys(rec).forEach(k => {
                        if (Array.isArray(rec[k])) rec[k] = rec[k].join(', ');
                    });
                    const objectid = item.getAttribute('objectid');
                    const flat = thingMap[objectid];
                    if (flat) {
                        Object.keys(flat).forEach(k => {
                            rec['t_' + k] = flat[k];
                        });
                    }
                    return rec;
                });
                // Build table with ordered columns: collection_ fields first, then t_ fields
                const collectionKeys = [];
                let thingKeys = [];
                let numPlayersCols = [];
                // Try to order thingKeys as in the first thingItem's XML
                if (thingItems.length > 0) {
                    const flatFirst = flattenXML(thingItems[0]);
                    thingKeys = Object.keys(flatFirst).map(k => 't_' + k);
                }
                // Add any extra thingKeys not in the first item (fallback for missing fields)
                thingArr.forEach(obj => {
                    Object.keys(obj).forEach(k => {
                        if (k.startsWith('collection_')) {
                            if (!collectionKeys.includes(k)) collectionKeys.push(k);
                        } else if (k.startsWith('t_')) {
                            if (!thingKeys.includes(k)) thingKeys.push(k);
                        } else if (k.startsWith('numplayers_')) {
                            if (!numPlayersCols.includes(k)) numPlayersCols.push(k);
                        }
                    });
                });
                // Add idx as the first column
                // Insert numplayers columns after t_maxplayers_value
                let fields = ['idx', ...collectionKeys, ...thingKeys];
                const maxPlayersIdx = fields.indexOf('t_maxplayers_value');
                if (maxPlayersIdx !== -1 && numPlayersCols.length > 0) {
                    fields = [
                        ...fields.slice(0, maxPlayersIdx + 1),
                        ...numPlayersCols.map(c => 't_' + c),
                        ...fields.slice(maxPlayersIdx + 1)
                    ];
                } else if (numPlayersCols.length > 0) {
                    fields = [...fields, ...numPlayersCols.map(c => 't_' + c)];
                }
                window.lastFields = fields;
                // Use selectedColumns if set
                let displayFields = fields;
                if (selectedColumns.length > 0) {
                    displayFields = fields.filter(f => selectedColumns.includes(f));
                }
                // Save for search
                window.lastFields = fields;
                window.lastRecords = thingArr;
                window.lastDisplayFields = displayFields;
                // Insert t_suggested_numplayers_votes and t_poll_numplayers_table after t_maxplayers_value
                // Then insert t_bestwith and t_recommendedwith after t_poll_numplayers_table
                // Insert t_poll_playerage_table after t_minage_value
                const pollCol = 't_poll_numplayers_table';
                const suggestedCol = 't_suggested_numplayers_votes';
                const bestwithCol = 't_bestwith';
                const recommendedwithCol = 't_recommendedwith';
                const maxPlayersCol = 't_maxplayers_value';
                const playerAgeCol = 't_poll_playerage_table';
                const minAgeCol = 't_minage_value';
                // Remove pollCol, suggestedCol, bestwithCol, recommendedwithCol, playerAgeCol from displayFields if present
                // Also remove poll-summary and poll columns if present
                const pollSummaryCols = [
                    't_poll-summary_name',
                    't_poll-summary_title',
                    't_poll-summary_result_name',
                    't_poll-summary_result_value'
                ];
                const pollCols = [
                    't_poll_name',
                    't_poll_title',
                    't_poll_totalvotes',
                    't_poll_results_numplayers',
                    't_poll_results_result_value',
                    't_poll_results_result_numvotes'
                ];
                [pollCol, suggestedCol, bestwithCol, recommendedwithCol, playerAgeCol, ...pollSummaryCols, ...pollCols].forEach(col => {
                    let idx = displayFields.indexOf(col);
                    while (idx !== -1) {
                        displayFields.splice(idx, 1);
                        idx = displayFields.indexOf(col);
                    }
                });
                // Insert playerAgeCol after minAgeCol
                let minAgeIdx = displayFields.indexOf(minAgeCol);
                if (minAgeIdx === -1) minAgeIdx = displayFields.length - 1;
                // Insert t_suggested_playerage_votes before t_poll_playerage_table
                const playerAgeVotesCol = 't_suggested_playerage_votes';
                // Remove if present
                let idxVotes = displayFields.indexOf(playerAgeVotesCol);
                if (idxVotes !== -1) displayFields.splice(idxVotes, 1);
                // Remove playerAgeCol if present (will re-insert)
                let idxPlayerAge = displayFields.indexOf(playerAgeCol);
                if (idxPlayerAge !== -1) displayFields.splice(idxPlayerAge, 1);
                // Insert votes then table
                // Insert language columns after player age poll columns
                const languageVotesCol = 't_language_votes';
                const languageResultsCol = 't_poll_language_table';
                // Remove if present
                [languageVotesCol, languageResultsCol].forEach(col => {
                    let idx = displayFields.indexOf(col);
                    if (idx !== -1) displayFields.splice(idx, 1);
                });
                displayFields.splice(minAgeIdx + 1, 0, playerAgeVotesCol, playerAgeCol, languageVotesCol, languageResultsCol);
                // Find where to insert poll columns
                let insertIdx = displayFields.indexOf(maxPlayersCol);
                if (insertIdx === -1) insertIdx = displayFields.length - 1;
                // Insert suggestedCol and pollCol after maxPlayersCol
                displayFields.splice(insertIdx + 1, 0, suggestedCol, pollCol);
                // Insert bestwith and recommendedwith after pollCol
                let pollInsertIdx = displayFields.indexOf(pollCol);
                displayFields.splice(pollInsertIdx + 1, 0, bestwithCol, recommendedwithCol);
                console.log('Ordered table columns:', displayFields);
                console.log('All merged records:', thingArr);
                let html = `<div style='overflow-x:auto;'><table border='1' cellpadding='6' style='border-collapse:collapse; margin:auto; background:#fff; min-width:1200px;'><thead><tr>`;
                displayFields.forEach(f => {
                    let bg = f === 'idx' ? '#333' : (f.startsWith('collection_') ? '#b71c1c' : (f.startsWith('t_') ? '#008080' : '#1976d2'));
                    html += `<th style='background:${bg}; color:#fff; font-weight:600; position:sticky; top:0; z-index:2;'>${f}</th>`;
                });
                html += `</tr></thead><tbody>`;
                let filteredArr = thingArr;
                let initialFilteredArr = thingArr;
                if (searchInput && searchInput.value.trim()) {
                    initialFilteredArr = filterRecords(thingArr, displayFields, searchInput.value.trim());
                }
                lastFilteredArr = initialFilteredArr;
                resultDiv.innerHTML = renderTable(initialFilteredArr, fields, displayFields);
                currentPage = 1;
                renderPagination();
                // Live search: update table as user types
                // Robust real-time search feature
                function robustLiveSearch() {
                    const term = searchInput.value.trim();
                    let arr = window.lastRecords || [];
                    let fields = window.lastFields || [];
                    let displayFields = window.lastDisplayFields || fields;
                    console.log('Robust live search fired. Term:', term);
                    console.log('Fields being searched:', displayFields);
                    if (arr.length === 0 || displayFields.length === 0) {
                        resultDiv.innerHTML = '<span style="color:#888;">No records loaded.</span>';
                        renderPagination();
                        return;
                    }
                    lastFilteredArr = filterRecords(arr, displayFields, term);
                    console.log('Filtered records count:', lastFilteredArr.length);
                    currentPage = 1;
                    resultDiv.innerHTML = renderTable(lastFilteredArr, fields, displayFields);
                    renderPagination();
                }
                if (searchInput) {
                    searchInput.oninput = robustLiveSearch;
                    if (searchNameOnly) searchNameOnly.onchange = robustLiveSearch;
                }
            } catch (e) {
                resultDiv.innerHTML = `<span style='color:#c00;'>Error: ${e.message}</span>`;
                renderPagination();
            }
        };
        // Ensure search event handler is always attached
        const searchInput = document.getElementById('searchInput');
        const searchNameOnly = document.getElementById('searchNameOnly');
        function robustLiveSearch() {
            const term = searchInput ? searchInput.value.trim() : '';
            let arr = window.lastRecords || [];
            let fields = window.lastFields || [];
            let displayFields = window.lastDisplayFields || fields;
            console.log('Robust live search fired. Term:', term);
            console.log('Fields being searched:', displayFields);
            if (arr.length === 0 || displayFields.length === 0) {
                resultDiv.innerHTML = '<span style="color:#888;">No records loaded.</span>';
                renderPagination();
                return;
            }
            lastFilteredArr = filterRecords(arr, displayFields, term);
            console.log('Filtered records count:', lastFilteredArr.length);
            currentPage = 1;
            resultDiv.innerHTML = renderTable(lastFilteredArr, fields, displayFields);
            renderPagination();
        }
        if (searchInput) {
            searchInput.oninput = robustLiveSearch;
            if (searchNameOnly) searchNameOnly.onchange = robustLiveSearch;
        } else {
            console.log('Search input not found.');
        }
    }
});
