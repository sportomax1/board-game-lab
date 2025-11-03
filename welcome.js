console.log('Welcome page loaded!');

document.addEventListener('DOMContentLoaded', function() {
	const runBtn = document.getElementById('runApiBtn');
	const resultDiv = document.getElementById('apiResult');
	if (runBtn && resultDiv) {
		runBtn.onclick = async function() {
			resultDiv.innerHTML = '<span style="color:#888;">Loading...</span>';
			try {
				// Use the centralized BGG API helper
				const resp = await fetch('/api/bgg-helper?endpoint=collection&username=sportomax&stats=1&own=1');
				if (!resp.ok) throw new Error('API error');
				const xml = await resp.text();
				const parser = new window.DOMParser();
				const doc = parser.parseFromString(xml, 'text/xml');
				const items = Array.from(doc.querySelectorAll('item')).slice(0, 10);
				if (!items.length) throw new Error('No records found.');
				// Gather all relevant columns, flattening nested attributes
				const fieldSet = new Set([
					'objecttype','objectid','subtype','collid','name','yearpublished','image','thumbnail',
					'stats_minplayers','stats_maxplayers','stats_minplaytime','stats_maxplaytime','stats_playingtime','stats_numowned',
					'rating_value','usersrated_value','average_value','bayesaverage_value','stddev_value','median_value',
					'rank_type','rank_id','rank_name','rank_friendlyname','rank_value','rank_bayesaverage',
					'status_own','status_prevowned','status_fortrade','status_want','status_wanttoplay','status_wanttobuy','status_wishlist','status_wishlistpriority','status_preordered','status_lastmodified',
					'numplays'
				]);
				const records = items.map(item => {
					const rec = {};
					// Top-level attributes
					Array.from(item.attributes).forEach(attr => {
						rec[attr.name] = attr.value;
					});
					// Children
					Array.from(item.children).forEach(child => {
						if (child.tagName === 'name') {
							rec['name'] = child.textContent;
						} else if (child.tagName === 'yearpublished' || child.tagName === 'image' || child.tagName === 'thumbnail' || child.tagName === 'numplays') {
							rec[child.tagName] = child.textContent;
						} else if (child.tagName === 'stats') {
							Array.from(child.attributes).forEach(attr => {
								rec['stats_' + attr.name] = attr.value;
							});
							// rating inside stats
							const rating = child.querySelector('rating');
							if (rating) {
								Array.from(rating.attributes).forEach(attr => {
									rec['rating_' + attr.name] = attr.value;
								});
								// usersrated, average, bayesaverage, stddev, median
								['usersrated','average','bayesaverage','stddev','median'].forEach(tag => {
									const el = rating.querySelector(tag);
									if (el && el.hasAttribute('value')) {
										rec[tag + '_value'] = el.getAttribute('value');
									}
								});
								// ranks/rank
								const rank = rating.querySelector('ranks > rank');
								if (rank) {
									Array.from(rank.attributes).forEach(attr => {
										rec['rank_' + attr.name] = attr.value;
									});
								}
							}
						} else if (child.tagName === 'status') {
							Array.from(child.attributes).forEach(attr => {
								rec['status_' + attr.name] = attr.value;
							});
						}
					});
					return rec;
				});
				const fields = Array.from(fieldSet);
				let html = `<div style='overflow-x:auto;'><table border='1' cellpadding='6' style='border-collapse:collapse; margin:auto; background:#fff; min-width:1200px;'><thead><tr>`;
				fields.forEach(f => {
					html += `<th style='background:#d32f2f; color:#fff; font-weight:600;'>${f}</th>`;
				});
				html += `</tr></thead><tbody>`;
				records.forEach(rec => {
					html += '<tr>';
					fields.forEach(f => { 
						if ((f === 'image' || f === 'thumbnail') && rec[f]) {
							// Show as image
							const maxW = f === 'image' ? 120 : 80;
							const maxH = f === 'image' ? 90 : 60;
							const radius = f === 'image' ? 8 : 6;
							html += `<td style='font-size:0.98em; color:#222;'><img src='${rec[f]}' alt='${f}' style='max-width:${maxW}px; max-height:${maxH}px; border-radius:${radius}px;'></td>`;
						} else {
							html += `<td style='font-size:0.98em; color:#222;'>${rec[f] !== undefined ? rec[f] : ''}</td>`;
						}
					});
					html += '</tr>';
				});
				html += '</tbody></table></div>';
				resultDiv.innerHTML = html;
			} catch (e) {
				resultDiv.innerHTML = `<span style='color:#c00;'>Error: ${e.message}</span>`;
			}
		};
	}
});
