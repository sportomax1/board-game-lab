#!/usr/bin/env node
// Simple parallel API tester - fires batches of requests concurrently.
// Usage:
//   node scripts/parallel_test.js --url "http://localhost:3000/api/bgg-helper?endpoint=thing&id=" --concurrency 100 --batchSize 20 --requests 100

const { argv } = require('process');

function arg(name, def) { const i = argv.indexOf(name); return (i >= 0 && argv[i+1]) ? argv[i+1] : def; }
const base = arg('--url', arg('-u', 'http://localhost:3000/api/bgg-helper?endpoint=thing&id='));
const concurrency = parseInt(arg('--concurrency','100'),10);
const batchSize = parseInt(arg('--batchSize','20'),10);
const requests = parseInt(arg('--requests','100'),10);

function makeIds(n){ const a=[]; for(let i=0;i<n;i++) a.push(Math.floor(Math.random()*200000)+1); return a.join(','); }

async function runOne(i){
  const ids = makeIds(batchSize);
  let url = base;
  if (url.includes('{ids}')) url = url.replace('{ids}', encodeURIComponent(ids));
  else url = base + encodeURIComponent(ids);
  const t0 = Date.now();
  try{
    const res = await fetch(url);
    const text = await res.text();
    return { ok: res.ok, status: res.status, time: Date.now()-t0, len: text.length };
  }catch(e){ return { ok:false, error: e.message, time: Date.now()-t0 }; }
}

async function main(){
  console.log(`Starting: concurrency=${concurrency} batchSize=${batchSize} totalRequests=${requests}`);
  const results = [];
  for(let i=0;i<requests;i+=concurrency){
    const group = [];
    for(let j=0;j<Math.min(concurrency, requests - i); j++) group.push(runOne(i+j));
    const res = await Promise.all(group);
    results.push(...res);
    console.log(`Completed chunk ${i} -> ${i+group.length}`);
  }

  const ok = results.filter(r=>r.ok).length;
  const avg = results.filter(r=>r.ok).reduce((s,r)=>s+r.time,0)/(ok||1);
  console.log(`Summary: total=${results.length} ok=${ok} failed=${results.length-ok} avg_ms=${Math.round(avg)}`);
  const errs = results.filter(r=>!r.ok).slice(0,5);
  if (errs.length) console.log('Sample errors:', errs);
}

main().catch(e=>{ console.error(e); process.exit(1); });
