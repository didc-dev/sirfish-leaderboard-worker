// Sir Fish exterior leaderboard worker.
//
// The experience sandbox has no network, so the game cannot tell anything outside when a score
// lands. This worker polls the lot's PUBLIC game table (no key needed) and, only when the visible
// ranking changed, renders a new board image and republishes the building (LODs + lot.json and
// its shaders/script + board.png). Republishing needs the Project 0 key, read from a local file.
//
//   node worker.mjs --once            check once, publish if changed
//   node worker.mjs --once --dry-run  check once, build the package, never call the API with the key
//   node worker.mjs --watch           loop forever (interval from config.json, seconds)
//   node worker.mjs --once --force    publish even if nothing changed
//   node worker.mjs --once --force --validate-only   validate the package, never publish
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run'), FORCE = args.has('--force');
const STATE = path.join(HERE, 'state.json');
const STAGE = path.join(HERE, 'stage');
const LOG = path.join(HERE, 'worker.log');
const API = 'https://project0.city/api';

function log(...a) {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}
const resolveHome = p => p.replace('%USERPROFILE%', os.homedir()).replace(/^~/, os.homedir());

// Score packing from the game (main.js): floor * 1e5 + floor(points / 10)
const decode = s => ({ floor: Math.floor(s / 1e5), points: (s % 1e5) * 10 });

async function fetchTable() {
  const r = await fetch(`${API}/lots/${cfg.lot}/game`, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`table HTTP ${r.status}`);
  const g = (await r.json()).game || {};
  const top = Array.isArray(g.top) ? g.top : [];
  // Owner rows never take a place (platform rule): show them as an unranked "owner" line.
  const owner = top.find(t => t.owner);
  const ranked = top.filter(t => !t.owner).slice(0, cfg.places);
  const row = t => ({ name: String(t.name || '?'), score: t.score, ...decode(t.score) });
  return { owner: owner ? row(owner) : null, rows: ranked.map(row), weekEnds: g.weekEnds || 0 };
}

const signature = t => JSON.stringify([t.owner && [t.owner.name, t.owner.score], t.rows.map(r => [r.name, r.score])]);

function renderBoard(table) {
  fs.mkdirSync(STAGE, { recursive: true });
  const data = {
    owner: table.owner,
    rows: table.rows,
    updated: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    weekEnds: table.weekEnds ? 'Mon 00:00 UTC' : ''
  };
  const json = path.join(STAGE, 'rows.json');
  fs.writeFileSync(json, JSON.stringify(data, null, 2));
  execFileSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(HERE, 'render_board.py'), json, path.join(STAGE, 'board.png')], { stdio: 'inherit' });
}

// Copy the base build and merge the board material into its lot.json.
function stagePackage() {
  const base = path.resolve(HERE, cfg.baseDir);
  for (const f of ['lod0.glb', 'lod1.glb', 'lod2.glb']) {
    if (!fs.existsSync(path.join(base, f))) throw new Error(`missing ${f} in ${base} (put the exterior build there)`);
    fs.copyFileSync(path.join(base, f), path.join(STAGE, f));
  }
  const lot = fs.existsSync(path.join(base, 'lot.json')) ? JSON.parse(fs.readFileSync(path.join(base, 'lot.json'), 'utf8')) : {};
  lot.materials = lot.materials || {};
  // The board is drawn by the existing material's shader (LOD0 is at its 4-material budget),
  // so only make sure that material receives the image.
  const m = lot.materials[cfg.boardMaterial] = lot.materials[cfg.boardMaterial] || {};
  m.textures = { ...(m.textures || {}), [cfg.boardTexture]: 'board.png' };
  fs.writeFileSync(path.join(STAGE, 'lot.json'), JSON.stringify(lot, null, 1));
  // Other files the base lot.json names (its shaders, script, images) travel with it.
  const extra = new Set();
  for (const m of Object.values(lot.materials)) {
    for (const k of ['surface', 'vertex']) if (m[k]) extra.add(m[k]);
    for (const f of m.include || []) extra.add(f);
    for (const f of Object.values(m.textures || {})) extra.add(f);
  }
  if (lot.script) extra.add(lot.script);
  for (const f of extra) {
    if (fs.existsSync(path.join(STAGE, f))) continue;
    if (!fs.existsSync(path.join(base, f))) throw new Error(`lot.json names ${f}, not found in ${base}`);
    fs.copyFileSync(path.join(base, f), path.join(STAGE, f));
  }
  return ['lot.json', ...extra];
}

// Key: P0_KEY environment variable (GitHub Actions secret) or the local key file.
function readKey() {
  if (process.env.P0_KEY) return process.env.P0_KEY.trim();
  const keyFile = resolveHome(cfg.keyFile);
  if (!fs.existsSync(keyFile)) throw new Error(`no P0_KEY and no key file at ${keyFile}`);
  return fs.readFileSync(keyFile, 'utf8').replace(/^﻿/, '').trim();
}

function curl(endpoint, files, withManifest) {
  const key = readKey();
  const a = ['-s', '-X', 'POST', `${API}/agent/lots/${cfg.lot}/${endpoint}`, '-H', `Authorization: Bearer ${key}`,
    '-w', '\nHTTP %{http_code}'];
  if (withManifest) a.push('-F', `manifest=${JSON.stringify(cfg.manifest)}`);
  for (const l of ['lod0', 'lod1', 'lod2']) a.push('-F', `${l}=@${path.join(STAGE, l + '.glb')}`);
  for (const f of files) a.push('-F', `file=@${path.join(STAGE, f)}`);
  const out = execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', a, { encoding: 'utf8', maxBuffer: 1 << 24 });
  const i = out.lastIndexOf('\nHTTP ');
  return { code: Number(out.slice(i + 6)), body: out.slice(0, i) };
}

async function check() {
  const table = await fetchTable();
  const sig = signature(table);
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  if (!FORCE && sig === state.published) return log('no change', table.rows.map(r => r.name).join(','));
  log('ranking changed ->', table.rows.map(r => `${r.name}:${r.score}`).join(' '));
  renderBoard(table);
  const files = stagePackage();
  if (DRY) return log('dry run: package staged in', STAGE, 'files', files.join(','));
  const v = curl('validate', files, false);
  if (v.code !== 200 || /"ok"\s*:\s*false/.test(v.body)) {
    log('validate failed', v.code, v.body.slice(0, 600));
    return;
  }
  if (args.has('--validate-only')) return log('validate ok', v.body.slice(0, 400));
  const p = curl('publish', files, true);
  log('publish', p.code, p.body.slice(0, 300));
  if (p.code === 200 || p.code === 202) fs.writeFileSync(STATE, JSON.stringify({ published: sig, at: new Date().toISOString(), http: p.code }, null, 2));
}

async function main() {
  if (!args.has('--watch')) return check();
  const every = Math.max(60, cfg.intervalSeconds || 60) * 1000;
  log('watching every', every / 1000, 's');
  for (;;) {
    try { await check(); } catch (e) { log('error', e.message); }
    await new Promise(r => setTimeout(r, every));
  }
}
main().catch(e => { log('error', e.message); process.exitCode = 1; });
