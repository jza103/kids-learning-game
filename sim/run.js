#!/usr/bin/env node
// Run many simulated school years and print a table per play style.
//
//   node sim/run.js                      every style, 12 kids each
//   node sim/run.js --style crammer --runs 40
//   node sim/run.js --style mix --runs 100   a random mix of styles (see MIX in styles.js)
//   node sim/run.js --seed 7 --json sim/out/latest.json
//   node sim/run.js --memory forgetful   kids who forget faster (see MEMORY_PRESETS)
//   node sim/run.js --rules dailyFrom=2,missDrop=2   try other star rules (STAR_RULES in src/srs.js)
//
// Runs in parallel on every CPU core. Each kid is random but repeatable: the
// same --seed gives the same kids.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);

export const MEMORY_PRESETS = {
  normal: {},
  forgetful: { firstLearn: 0.5, growth: 12 },
  sharp: { firstLearn: 2, growth: 28 },
};

function args() {
  const a = process.argv.slice(2);
  const get = (k, d) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : d;
  };
  const rules = Object.fromEntries(
    String(get('rules', '')).split(',').filter(Boolean).map((kv) => {
      const [k, v] = kv.split('=');
      return [k, v === 'null' ? null : Number(v)];
    }),
  );
  return { style: get('style', 'all'), runs: Number(get('runs', 12)), seed: Number(get('seed', 1)), json: get('json', null), memory: get('memory', 'normal'), rules };
}

async function main() {
  const { STYLES, MIX } = await import('./styles.js');
  const opt = args();
  const jobs = [];
  if (opt.style === 'mix') {
    const { mulberry32 } = await import('../src/rng.js');
    const rng = mulberry32(opt.seed);
    const total = Object.values(MIX).reduce((a, b) => a + b, 0);
    for (let i = 0; i < opt.runs; i++) {
      let x = rng() * total;
      const style = Object.keys(MIX).find((k) => (x -= MIX[k]) < 0) || 'steady';
      jobs.push({ style, seed: opt.seed * 1000 + i });
    }
  } else {
    const styles = opt.style === 'all' ? Object.keys(STYLES) : opt.style.split(',');
    for (const style of styles) for (let i = 0; i < opt.runs; i++) jobs.push({ style, seed: opt.seed * 1000 + i });
  }
  const t0 = Date.now();
  const results = await runPool(jobs, opt.memory, opt.rules);
  process.stderr.write(`${jobs.length} kids in ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  const byStyle = {};
  for (const j of results) (byStyle[j.style] ||= []).push(j.r);
  console.log(report(byStyle, STYLES, opt));
  if (opt.json) {
    mkdirSync(dirname(opt.json), { recursive: true });
    writeFileSync(opt.json, JSON.stringify(results.map((j) => ({ style: j.style, seed: j.seed, ...j.r })), null, 1));
    process.stderr.write(`wrote ${opt.json}\n`);
  }
}

function runPool(jobs, memory, rules = {}) {
  return new Promise((resolve) => {
    const out = [];
    let next = 0;
    const n = Math.min(cpus().length, jobs.length);
    for (let w = 0; w < n; w++) {
      const worker = new Worker(here, { workerData: { memory, rules } });
      const feed = () => worker.postMessage(next < jobs.length ? jobs[next++] : null);
      worker.on('message', (m) => {
        out.push(m);
        if (process.stderr.isTTY) process.stderr.write(`\r${out.length}/${jobs.length}`);
        if (out.length === jobs.length) {
          process.stderr.write('\n');
          resolve(out);
        }
        feed();
      });
      feed();
    }
  });
}

// ---------- report ----------
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const week = (d) => (d == null ? null : Math.floor(d / 7) + 1);

/** The numbers shown per kid. */
export const METRICS = [
  ['Learning min per play day', (r) => r.learnMinPerPlayDay],
  ['Play days per week', (r) => r.playDaysPerWeek],
  ['Grove min per week', (r) => r.groveMinPerWeek],
  ['Spelling: really known %', (r) => pct(r.curriculum.spelling.reallyKnown, r.curriculum.spelling.total)],
  ['Spelling: ever mastered %', (r) => pct(r.curriculum.spelling.everMastered, r.curriculum.spelling.total)],
  ['Spelling: 5 stars at year end %', (r) => pct(r.curriculum.spelling.masteredNow, r.curriculum.spelling.total)],
  ['Word Match: really known %', (r) => pct(r.curriculum.vocab.reallyKnown, r.curriculum.vocab.total)],
  ['Word Match: ever mastered %', (r) => pct(r.curriculum.vocab.everMastered, r.curriculum.vocab.total)],
  ['Math 3-12: really known %', (r) => pct(r.curriculum.math.reallyKnown, r.curriculum.math.total)],
  ['Math 3-12: ever mastered %', (r) => pct(r.curriculum.math.everMastered, r.curriculum.math.total)],
  ['Week Stars (of 25)', (r) => r.weekStars],
  ['Super Packs opened', (r) => r.superPacks],
  ['Legendaries (of 34)', (r) => r.friends.legendary],
  ['Ultras (of 24)', (r) => r.friends.ultra],
  ['Friends owned (of 178)', (r) => r.friends.total],
  ['Packs opened', (r) => r.packs],
  ['Coins unspent at year end', (r) => r.coins.left],
  ['Shards from expeditions', (r) => r.shards.trips],
  ['Shards unspent at year end', (r) => r.shards.left],
  ['Sunshine earned', (r) => r.sun.earned],
  ['Sunshine left in jar', (r) => r.sun.leftInJar],
  ['Golden Season Sunshine', (r) => r.sun.golden],
  ['Farm level', (r) => r.grove?.level ?? 0],
  ['Grove Bells earned', (r) => r.grove?.bellsEarned ?? 0],
  ['Grove Bells spent', (r) => r.grove?.bellsSpent ?? 0],
  ['Week: first 60 pack friends', (r) => week(r.milestones.first60PackFriends)],
  ['Week: all math mastered', (r) => week(r.milestones.allMathMastered)],
  ['Week: farm level 15', (r) => week(r.milestones.farmLevel15)],
  ['Week: all 5 lands open', (r) => week(r.milestones.allLands)],
  ['Week: everything in the Grove built', (r) => week(r.milestones.groveAllBuilt)],
];

function quantile(xs, q) {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
const fmt = (x) => (x == null ? '–' : x >= 10000 ? `${Math.round(x / 1000)}k` : String(Math.round(x * 10) / 10));

function cell(values) {
  const n = values.filter((x) => x != null).length;
  if (!n) return 'never';
  const mid = fmt(quantile(values, 0.5));
  const lo = fmt(quantile(values, 0.1));
  const hi = fmt(quantile(values, 0.9));
  const never = n < values.length ? ` (${values.length - n} never)` : '';
  return (lo === hi ? mid : `${mid} (${lo}–${hi})`) + never;
}

export function report(byStyle, STYLES, opt) {
  const styles = Object.keys(byStyle);
  const head = `| | ${styles.map((s) => `${STYLES[s]?.name || s} (${byStyle[s].length})`).join(' | ')} |`;
  const lines = [
    `Simulated school year: ${opt.style}, seed ${opt.seed}, memory ${opt.memory}, star rules ${JSON.stringify(opt.rules)}. Median (10th–90th percentile) across kids.`,
    '',
    head,
    `|---|${styles.map(() => '---').join('|')}|`,
  ];
  for (const [label, get] of METRICS) lines.push(`| ${label} | ${styles.map((s) => cell(byStyle[s].map(get))).join(' | ')} |`);
  return lines.join('\n');
}

if (!isMainThread) {
  const { runYear } = await import('./year.js');
  const { MEMORY } = await import('./memory.js');
  Object.assign(MEMORY, MEMORY_PRESETS[workerData.memory] || {});
  const { STAR_RULES } = await import('../src/srs.js');
  Object.assign(STAR_RULES, workerData.rules);
  parentPort.on('message', (job) => {
    if (job == null) return process.exit(0);
    const r = runYear(job.style, job.seed);
    parentPort.postMessage({ ...job, r });
  });
} else {
  await main();
}
