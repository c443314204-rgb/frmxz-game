'use strict';
/* =============================================================
   凡人修仙传 · 寿元 —— 引擎层
   ============================================================= */

let S = null;
const SAVE_KEY = 'fanren_shouyuan_v4';
const ROOT_REF = 0.22;
const $ = (id) => document.getElementById(id);

/* ---------------- 状态 ---------------- */
function freshState(name, root, diff) {
  const d = typeof diff === 'number' ? diff : 1;
  return {
    name: name || '无名',
    root: root || ROOTS[3],
    diff: d,
    age: 16,
    realm: 0,
    sub: 0,
    progress: 0,
    life: REALMS[0].life,
    wits: 5 + (root ? root.wits || 0 : 0),
    attrs: {
      wits: 5 + (root ? root.wits || 0 : 0),
      body: 5, str: 5, agi: 5, spirit: 5, mind: 5,
    },
    mood: clamp(60 + (root ? root.mood || 0 : 0), 0, 100),
    stones: 3,
    hp: REALMS[0].hp,
    mp: REALMS[0].mp,
    items: { heal: 1, mana: 1, break: 0, escape: 1, revive: d === 0 ? 1 : 0, marrow: 0, calm: 0 },
    artifacts: [],
    techs: [],
    manuals: [],
    chain: null,
    mainTech: null,
    origin: null,
    trait: null,
    npcs: {},
    npcOrder: [],
    bottle: false,
    world: pick(WORLD_MOODS).id,
    used: {},
    recent: [],
    eventId: null,
    phase: 'event',
    result: null,
    deltas: null,
    pending: false,
    over: null,
    overText: '',
    battle: null,
    flags: {},
    turn: 1,
  };
}

/* ---------------- 难度与世界 ---------------- */
function diffInfo() { return DIFFS[(S && S.diff) || 1] || DIFFS[1]; }
function worldInfo() { return WORLD_MOODS.find((w) => w.id === (S && S.world)) || WORLD_MOODS[0]; }

/* 难度修正后的判定 */
function chk(p) {
  const d = S ? S.diff : 1;
  const base = DIFFS[d] ? DIFFS[d].check : 0;
  const moodMod = S ? ((S.mood - 50) / 100) * 0.08 : 0;
  const witsMod = S ? clamp((S.wits - 5) * 0.006, 0, 0.06) : 0;
  return Math.random() < clamp(p - base + moodMod + witsMod, 0.03, 0.97);
}

/* ---------------- 属性 ---------------- */
function attr(k) {
  if (k === 'wits') return S.wits || 5;
  return (S.attrs && S.attrs[k]) || 5;
}
function addAttr(k, n) {
  if (k === 'wits') {
    addWits(n);
    if (S.attrs) S.attrs.wits = S.wits;
    return;
  }
  if (!S.attrs) S.attrs = { wits: S.wits || 5, body: 5, str: 5, agi: 5, spirit: 5, mind: 5 };
  S.attrs[k] = clamp((S.attrs[k] || 5) + n, 1, 40);
}

/* ---------------- 小境界 ---------------- */
function subCount(realm) {
  const r = typeof realm === 'number' ? realm : S.realm;
  if (r === 1) return 13;
  if (r === 0 || r === 5) return 1;
  return 4;
}
const SUB_PHASES = ['初期', '中期', '后期', '巅峰'];
function subName(realm, sub) {
  const r = typeof realm === 'number' ? realm : S.realm;
  const s = typeof sub === 'number' ? sub : (S.sub || 0);
  if (r === 1) return '炼气' + cn(s + 1) + '层';
  if (r === 0) return '凡人';
  if (r === 5) return '化神期';
  return REALMS[r].name + SUB_PHASES[Math.min(s, 3)];
}
function realmLabel() { return subName(S.realm, S.sub || 0); }
function subNeed() {
  const r = REALMS[S.realm];
  const n = subCount(S.realm);
  return r.need ? r.need / n : 0;
}
function subProgressNeed() { return subNeed(); }
function subScale() { return 1 + (S.sub || 0) * 0.06; }

/* ---------------- 功法要求 ---------------- */
function meetsTechReq(id) {
  const t = TECHS[id];
  if (!t) return false;
  const req = t.req || {};
  return Object.keys(req).every((k) => attr(k) >= req[k]);
}
function techReqText(id) {
  const t = TECHS[id];
  if (!t) return '';
  const req = t.req || {};
  const keys = Object.keys(req);
  if (!keys.length) return '无门槛';
  return keys.map((k) => attrName(k) + ' ' + req[k]).join(' · ');
}
function techReqMetList(id) {
  const t = TECHS[id];
  if (!t) return [];
  return Object.keys(t.req || {}).map((k) => ({
    k, name: attrName(k), need: t.req[k], have: attr(k), ok: attr(k) >= t.req[k],
  }));
}

/* ---------------- 功法 ----------------
   规则：功法须先「得秘籍」（manuals），方能修炼或改修。
   秘籍只能从传承链（三阶段连续事件）中取得，且要过判定。
   一人只修一门主修功法；改修要耗年数，也要再看一次成算。
------------------------------------------------ */
function hasTech(id) { return !!(S && S.mainTech === id); }
function hasManual(id) { return !!(S && S.manuals && S.manuals.includes(id)); }

function grantManual(id) {
  const t = TECHS[id];
  if (!t || !S) return false;
  if (!S.manuals) S.manuals = [];
  if (S.manuals.includes(id)) return false;
  S.manuals.push(id);
  return true;
}

/* 修炼一门功法要耗多少年 */
function techLearnYears(id) {
  const t = TECHS[id];
  const tier = (t && t.tier) || 1;
  const base = YEAR_COST[S.realm] || 1;
  return Math.max(1, Math.round(Math.max(base * 1.2, tier * 3)));
}

/* 参悟成算：属性溢出越多、心境越好，越容易 */
function techMasterChance(id) {
  const t = TECHS[id];
  if (!t) return 0;
  const req = t.req || {};
  let surplus = 0;
  Object.keys(req).forEach((k) => { surplus += Math.max(0, attr(k) - req[k]); });
  let p = 0.55 + surplus * 0.045 + (S.mood - 50) / 600 + (S.wits - 5) * 0.01;
  if (!Object.keys(req).length) p += 0.10;
  if (S.mainTech && S.mainTech !== id) p -= 0.12;   // 改修比初修更难
  if (S.flags && S.flags.techHint) p += 0.08;
  return clamp(p, 0.12, 0.95);
}

function forceLearnTech(id) {
  const t = TECHS[id];
  if (!t) return false;
  S.mainTech = id;
  S.techs = [id];
  return true;
}

/* 修成（内部用）：必须已有秘籍且满足门槛 */
function learnTech(id) {
  const t = TECHS[id];
  if (!t || !S) return false;
  if (!hasManual(id)) return false;
  if (hasTech(id)) return false;
  if (!meetsTechReq(id)) return false;
  forceLearnTech(id);
  const ps = t.passive || {};
  if (ps.hp) S.hp = Math.min(maxHp(), S.hp + ps.hp);
  if (ps.mp) S.mp = Math.min(maxMp(), S.mp + ps.mp);
  if (ps.wits) addAttr('wits', ps.wits);
  return true;
}

/* 修炼 / 改修：耗时 + 判定 */
function practiceTech(id) {
  const t = TECHS[id];
  if (!t) return { ok: false, msg: '无此功法' };
  if (!hasManual(id)) return { ok: false, msg: '尚未得到《' + t.name + '》的秘籍' };
  if (hasTech(id)) return { ok: false, msg: '已在修《' + t.name + '》' };
  if (S.phase === 'battle') return { ok: false, msg: '争斗之中无法静心参悟' };
  if (!meetsTechReq(id)) return { ok: false, msg: '属性不足：' + techReqText(id) };
  const years = techLearnYears(id);
  const p = techMasterChance(id);
  const was = S.mainTech;
  passTime(years);
  if (S.over) return { ok: false, msg: '寿元已尽' };
  if (chance(p)) {
    learnTech(id);
    addMood(was ? -4 : 6);
    return {
      ok: true,
      msg: '耗去 ' + years + ' 年，' + (was ? '改修' : '修成') + '《' + t.name + '》',
    };
  }
  addMood(-8);
  loseHp(0.12);
  return { ok: false, msg: '耗去 ' + years + ' 年，参悟未成，心神受损' };
}
function techStats() {
  const s = { hp: 0, mp: 0, atk: 0, def: 0, crit: 0, lifesteal: 0, flee: 0, cult: 0, dmgReduce: 0, wits: 0,
    spellPower: 0, execute: 0, healOnKill: 0, manaRegen: 0, thorns: 0, shieldStart: 0, firstStrike: 0, mood: 0 };
  const list = S.mainTech ? [S.mainTech] : [];
  list.forEach((id) => {
    const t = TECHS[id];
    if (!t || !t.passive) return;
    Object.keys(t.passive).forEach((k) => {
      if (typeof t.passive[k] === 'number' && typeof s[k] === 'number') s[k] += t.passive[k];
    });
  });
  return s;
}
function knownSpells() {
  const out = [];
  const list = S.mainTech ? [S.mainTech] : [];
  list.forEach((tid) => {
    const t = TECHS[tid];
    if (!t) return;
    (t.spells || []).forEach((sid) => { if (SPELLS[sid] && !out.includes(sid)) out.push(sid); });
  });
  (S.artifacts || []).forEach((n) => {
    const a = ARTS[n];
    if (a && a.fx && a.fx.active && SPELLS[a.fx.active] && !out.includes(a.fx.active)) out.push(a.fx.active);
  });
  return out;
}
function hasSpell(id) { return knownSpells().includes(id); }
function artifactActives() {
  const out = [];
  (S.artifacts || []).forEach((n) => {
    const a = ARTS[n];
    if (a && a.fx && a.fx.active && SPELLS[a.fx.active]) out.push({ art: n, spell: a.fx.active });
  });
  return out;
}
function randomTech(maxTier) {
  const pool = Object.keys(TECHS)
    .filter((id) => TECHS[id].tier <= (maxTier || 4) && !hasTech(id) && !hasManual(id))
    .map((id) => ({ id: id, name: TECHS[id].name }));
  return pool.length ? pick(pool) : null;
}
function randomArt() {
  const pool = ART_KEYS.filter((n) => !S.artifacts.includes(n));
  return pool.length ? pick(pool) : null;
}

/* ---------------- 属性 ---------------- */
function artStats() {
  const s = { atk: 0, def: 0, hp: 0, mp: 0, cult: 0, crit: 0, lifesteal: 0, flee: 0, mood: 0, wits: 0,
    dmgReduce: 0, spellPower: 0, healOnKill: 0, execute: 0, manaRegen: 0, thorns: 0, shieldStart: 0 };
  (S.artifacts || []).forEach((n) => {
    const a = ARTS[n];
    if (!a) return;
    Object.keys(a).forEach((k) => {
      if (typeof a[k] === 'number' && typeof s[k] === 'number') s[k] += a[k];
    });
    if (a.fx) {
      Object.keys(a.fx).forEach((k) => {
        if (typeof a.fx[k] === 'number' && typeof s[k] === 'number') s[k] += a.fx[k];
      });
    }
  });
  return s;
}
function maxHp() {
  return Math.round(REALMS[S.realm].hp * subScale() + artStats().hp + techStats().hp + attr('body') * 8 +
    (S.trait && S.trait.id === 'tough' ? REALMS[S.realm].hp * 0.15 : 0));
}
function maxMp() { return Math.round(REALMS[S.realm].mp * subScale() + artStats().mp + techStats().mp + attr('spirit') * 6); }
function pAtk() { return Math.round(REALMS[S.realm].atk * subScale() + artStats().atk + techStats().atk + S.wits * 2 + attr('str') * 2); }
function pDef() { return Math.round(REALMS[S.realm].def * subScale() + artStats().def + techStats().def + attr('body') * 1.2); }
function pCrit() {
  return clamp(0.05 + artStats().crit + techStats().crit + attr('agi') * 0.004 +
    (S.trait && S.trait.id === 'evil' ? 0.06 : 0), 0, 0.75);
}
function pLifeSteal() { return clamp(artStats().lifesteal + techStats().lifesteal, 0, 0.8); }
function pDmgReduce() { return clamp(artStats().dmgReduce + techStats().dmgReduce, 0, 0.6); }
function pFlee() {
  return clamp(artStats().flee + techStats().flee + attr('agi') * 0.004 +
    (S.trait && S.trait.id === 'sense' ? 0.08 : 0), 0, 0.85);
}

function rootMult() {
  const rel = (S.root.mult || 0.22) / ROOT_REF;
  return rel * (1 + (S.wits - 5) * 0.01) * (S.bottle ? 1.35 : 1) *
    (1 + artStats().cult + techStats().cult) * worldInfo().cult;
}
function gainPct(p) {
  const full = REALMS[S.realm].need;
  const need = subNeed();
  if (!need) return 0;
  const v = full * p * rootMult() * rnd(0.85, 1.15);
  S.progress += v;
  const maxSub = subCount(S.realm);
  // 小境界自动精进：修为填满一层，直接踏入下一层，不再额外耗去一年
  let guard = 0;
  while (S.progress >= need - 1e-9 && (S.sub || 0) < maxSub - 1 && guard++ < 20) {
    S.progress -= need;
    S.sub = (S.sub || 0) + 1;
    S.hp = Math.min(maxHp(), S.hp + Math.round(maxHp() * 0.12));
    S.mp = Math.min(maxMp(), S.mp + Math.round(maxMp() * 0.15));
  }
  if (S.progress >= need - 1e-9) {
    S.progress = need;
    if (S.realm < 5 || (S.sub || 0) < maxSub - 1) S.pending = true;
  }
  return v;
}
function addStones(n) { S.stones = Math.max(0, S.stones + n); }
function addItem(id, n) {
  if (!ITEMS[id]) return;
  S.items[id] = clamp((S.items[id] || 0) + n, 0, 99);
}
function addPills(n) { addItem('break', n); }
function itemCount(id) { return S.items[id] || 0; }
function addMood(n) {
  S.mood = clamp(S.mood + n, 0, 100);
  if (S.mood <= 0) die('demon');
}
function addWits(n) { S.wits = clamp(S.wits + n, 1, 30); }
function shortenLife(n) {
  S.life = Math.max(S.age, S.life - n);
  if (S.age >= S.life) die('old');
}
function addLife(n) { S.life = Math.max(S.age + 1, S.life + n); }
function addArtifact(name) {
  if (!name || !ARTS[name] || S.artifacts.includes(name)) return false;
  S.artifacts.push(name);
  S.hp = Math.min(maxHp(), Math.max(S.hp, S.hp + (ARTS[name].hp || 0)));
  S.mp = Math.min(maxMp(), Math.max(S.mp, S.mp + (ARTS[name].mp || 0)));
  return true;
}
function healHp(frac) { S.hp = clamp(S.hp + Math.round(maxHp() * frac), 0, maxHp()); }
function healMp(frac) { S.mp = clamp(S.mp + Math.round(maxMp() * frac), 0, maxMp()); }
function loseHp(frac) { S.hp = Math.max(1, S.hp - Math.round(maxHp() * frac)); }
function loseMp(frac) { S.mp = Math.max(0, S.mp - Math.round(maxMp() * frac)); }
function upgradeRoot() {
  const i = ROOTS.findIndex((r) => r.name === S.root.name);
  if (i <= 0) return false;
  S.root = ROOTS[i - 1];
  return true;
}
function die(kind, text) {
  if (S.over) return;
  S.over = kind;
  S.overText = text || '';
}

/* =============================================================
   战斗
   ============================================================= */
function pushLog(t) {
  if (!S.battle) return;
  S.battle.log.push(t);
  if (S.battle.log.length > 60) S.battle.log.shift();
}
function stSum(st, k) {
  if (!st) return 0;
  return st.filter((x) => x.k === k).reduce((a, x) => a + x.v, 0);
}
function stHas(st, k) { return stSum(st, k) > 0; }
function addSt(st, k, v, turns) {
  if (!v) return;
  st.push({ k: k, v: v, turns: Math.max(1, turns || 1) });
}
function pSt() { return S.battle ? S.battle.p.st : []; }
function eSt() { return S.battle ? S.battle.e.st : []; }

const TRAIT_SKILLS = {
  caster: ['cast', 'wail'],
  drain: ['drain'],
  poison: ['poison'],
  physResist: ['heavy'],
  enrage: ['heavy'],
  fast: [],
  regen: [],
  shieldStart: [],
  bleed: ['heavy'],
  spellImmune: [],
};

function makeEnemy(power, forcedName, opts) {
  power = power || 1;
  opts = opts || {};
  const r = S.realm;
  const pool = ENEMY_POOL[r] || ENEMY_POOL[0];
  let proto = null;
  if (forcedName) {
    proto = pool.find((p) => p.name === forcedName) || null;
    if (!proto) proto = pick(pool);
  } else {
    const total = pool.reduce((a, p) => a + (p.w || 1), 0);
    let x = Math.random() * total;
    proto = pool[pool.length - 1];
    for (const p of pool) { x -= (p.w || 1); if (x <= 0) { proto = p; break; } }
  }
  const di = diffInfo();
  const wd = worldInfo();
  const eliteChance = di.el + (wd.el || 0) + (opts.elite ? 1 : 0);
  const elite = chance(clamp(eliteChance, 0, 1));
  const traits = (proto.traits || []).slice();
  if (elite && !traits.includes('enrage')) traits.push('enrage');

  const baseHp = REALMS[r].hp;
  let hp = Math.round(baseHp * proto.hp * rnd(0.9, 1.1) * power * di.enemy);
  if (elite) hp = Math.round(hp * 1.35);
  const e = {
    name: forcedName || (elite ? '强悍的' : '') + proto.name,
    baseName: proto.name,
    tags: proto.tags || [],
    hp: hp,
    maxHp: hp,
    mp: Math.round(maxMp() * 0.6),
    maxMp: Math.max(1, Math.round(maxMp() * 0.6)),
    atk: Math.round(baseHp * proto.atk * (0.9 + power * 0.18) * di.enemy * (elite ? 1.18 : 1)),
    def: Math.round(pDef() * proto.def * (elite ? 1.1 : 1)),
    elite: elite,
    traits: traits,
    power: power,
    skills: [],
    cd: {},
    rage: 0,
  };
  traits.forEach((t) => {
    (TRAIT_SKILLS[t] || []).forEach((sid) => {
      if (ENEMY_SKILLS[sid] && !e.skills.includes(sid)) e.skills.push(sid);
    });
  });
  // 精英必带一门强力招式
  if (elite && !e.skills.includes('breath')) e.skills.push('breath');
  if (!e.skills.length) e.skills.push('heavy');
  return e;
}

function startBattle(enemy, intro) {
  S.battle = {
    enemy: enemy,
    turn: 1,
    log: [],
    over: null,
    cd: {},
    artCd: {},
    p: { st: [], shield: 0 },
    e: { st: [], shield: 0 },
    extraTurn: false,
    before: snapshot(),
  };
  S.phase = 'battle';
  if (intro) pushLog(intro);
  pushLog('【' + enemy.name + '】拦住了去路。');
  // 法宝开局效果
  const as = artStats();
  if (as.shieldStart > 0) {
    S.battle.p.shield = Math.round(maxHp() * as.shieldStart);
    pushLog('法宝自行护主，凝成一层护罩。');
  }
  if (as.firstStrike > 0) {
    const d = Math.round(pAtk() * as.firstStrike);
    enemy.hp = Math.max(1, enemy.hp - d);
    pushLog('遁光梭抢先发难，伤敌 <b>' + d + '</b> 点。');
  }
  if (enemy.traits.includes('shieldStart')) {
    S.battle.e.shield = Math.round(enemy.maxHp * 0.18);
    pushLog('【' + enemy.name + '】周身浮起一层灵光。');
  }

  // 先手判定
  if (chance(0.25)) {
    pushLog('【' + enemy.name + '】抢了先手！');
    enemyTurn();
  }
}

function canCast() { return !!(S && S.realm >= 1); }

function spellCost(sp) {
  if (!sp) return 0;
  let mod = 1;
  const root = S.root || {};
  if (root.cost) mod *= root.cost;
  if (root.elem && sp.elem && root.elem === sp.elem) mod *= 0.85;
  if (root.elem === '天') mod *= 0.94;
  return Math.max(1, Math.round(maxMp() * sp.cost * mod));
}
function spellReady(id) {
  const sp = SPELLS[id];
  if (!sp) return { ok: false, reason: '无此术' };
  if (!canCast()) return { ok: false, reason: '未引气入体' };
  const cost = spellCost(sp);
  if (S.mp < cost) return { ok: false, reason: '法力不足' };
  const cd = (S.battle && S.battle.cd[id]) || 0;
  if (cd > 0) return { ok: false, reason: '冷却 ' + cd + ' 回合' };
  if (sp.hpCost && S.hp <= maxHp() * (sp.hpCost + 0.05)) return { ok: false, reason: '气血不足' };
  return { ok: true, reason: '' };
}

/* 对敌造成伤害 */
function hitEnemy(mult, opts) {
  opts = opts || {};
  const b = S.battle, e = b.enemy;
  const raw = pAtk() * mult * (1 + stSum(b.p.st, 'atk')) * rnd(0.92, 1.08);
  const ignore = opts.ignoreDef || 0;
  const def = e.def * (1 - clamp(ignore, 0, 1)) * (1 - stSum(b.e.st, 'sund'));
  let d = raw - def * 0.6;
  if (opts.spell) {
    d *= 1 + (artStats().spellPower || 0) + (techStats().spellPower || 0) + (stSum(b.p.st, 'spellPower') || 0);
  }
  if (opts.bonusVs && opts.bonus) {
    const hitTag = e.tags.some((t) => opts.bonusVs.includes(t));
    if (hitTag) d *= (1 + opts.bonus);
  }
  const exec = Math.max(artStats().execute, opts.execute || 0);
  if (exec && e.hp / e.maxHp <= exec) d *= 2;
  d *= (1 - stSum(b.e.st, 'dmgReduce'));
  let crit = false;
  if (chance(pCrit() + stSum(b.p.st, 'crit'))) { crit = true; d *= 1.85; }
  if (!Number.isFinite(d)) d = Number.isFinite(raw) ? raw : pAtk();
  d = Math.max(1, Math.round(d));
  // 护盾吸收
  if (b.e.shield > 0) {
    const abs = Math.min(b.e.shield, d);
    b.e.shield -= abs; d -= abs;
    if (abs > 0 && d <= 0) {
      pushLog('【' + e.name + '】的护体灵光挡下了这一击。');
      return 0;
    }
  }
  e.hp = Math.max(0, e.hp - d);
  return { dmg: d, crit: crit };
}

function playerHealSelf(frac) {
  const h = Math.round(maxHp() * frac);
  S.hp = clamp(S.hp + h, 0, maxHp());
  return h;
}

/* 施法 */
function castSpell(id) {
  const b = S.battle;
  if (!b || b.over || S.over) return;
  if (!canCast()) {
    pushLog('<span class="warn">你尚未引气入体，经脉未开，施展不出法术。</span>');
    return;
  }
  const sp = SPELLS[id];
  if (!sp) return;
  const ready = spellReady(id);
  if (!ready.ok) return;
  const cost = spellCost(sp);
  S.mp = Math.max(0, S.mp - cost);
  if (sp.hpCost) {
    S.hp = Math.max(1, S.hp - Math.round(maxHp() * sp.hpCost));
  }
  if (S.battle.cd) S.battle.cd[id] = sp.cd || 0;

  pushLog('你施展「<b>' + sp.name + '</b>」。');
  const e = b.enemy;

  if (sp.kind === 'heal') {
    const h = playerHealSelf(sp.power);
    pushLog('气血恢复 <b>' + h + '</b> 点。');
    b.p.st = b.p.st.filter((x) => x.k !== 'poison');
  } else if (sp.kind === 'shield') {
    const sh = Math.round(maxHp() * sp.power);
    b.p.shield += sh;
    if (sp.fx && sp.fx.thorns) addSt(b.p.st, 'thorns', sp.fx.thorns, sp.fx.turns || 3);
    pushLog('护罩成形，可挡 <b>' + sh + '</b> 点伤害。');
  } else if (sp.kind === 'buff') {
    const fx = sp.fx || {};
    if (fx.atk) addSt(b.p.st, 'atk', fx.atk, fx.turns || 3);
    if (fx.def) addSt(b.p.st, 'def', fx.def, fx.turns || 3);
    if (fx.crit) addSt(b.p.st, 'crit', fx.crit, fx.turns || 3);
    if (fx.evade) addSt(b.p.st, 'evade', fx.evade, fx.turns || 3);
    if (fx.dmgReduce) addSt(b.p.st, 'dmgReduce', fx.dmgReduce, fx.turns || 3);
    if (fx.spellPower) addSt(b.p.st, 'spellPower', fx.spellPower, fx.turns || 3);
    pushLog('气机一变，威势大涨。');
  } else if (sp.kind === 'special') {
    castSpecial(id, sp);
  } else {
    // attack
    const hits = sp.hits || 1;
    let total = 0, anyCrit = false;
    for (let i = 0; i < hits; i++) {
      if (e.hp <= 0) break;
      const r = hitEnemy(sp.power, {
        spell: true, ignoreDef: sp.fx && sp.fx.ignoreDef,
        bonusVs: sp.fx && sp.fx.bonusVs, bonus: sp.fx && sp.fx.bonus,
        execute: sp.fx && sp.fx.execute,
      });
      if (r === 0) break;
      total += r.dmg; anyCrit = anyCrit || r.crit;
    }
    if (total > 0) {
      pushLog('击中【' + e.name + '】，造成 <b>' + total + '</b> 点伤害' + (anyCrit ? '（暴击）' : '') +
        (hits > 1 ? '（' + hits + ' 段）' : '') + '。');
    }
    const ls = (sp.fx && sp.fx.lifesteal) || 0;
    if (ls > 0 && total > 0) {
      const h = Math.round(total * ls);
      S.hp = Math.min(maxHp(), S.hp + h);
      pushLog('血光回涌，你回复了 <b>' + h + '</b> 点气血。');
    }
    if (sp.fx && sp.fx.poison) {
      addSt(b.e.st, 'poison', sp.fx.poison, sp.fx.turns || 3);
      pushLog('【' + e.name + '】中了毒。');
    }
    if (sp.fx && sp.fx.stun) addSt(b.e.st, 'stun', 1, sp.fx.stun);
    if (sp.fx && sp.fx.sund) addSt(b.e.st, 'sund', sp.fx.sund, sp.fx.turns || 3);
  }

  if (b.enemy.hp <= 0) { winBattle(); return; }
  finishPlayerTurn();
}

function castSpecial(id, sp) {
  const b = S.battle, e = b.enemy;
  const fx = sp.fx || {};
  if (id === 'fenshen') {
    b.extraTurn = true;
    pushLog('分神代劳，你还有一次出手机会。');
    return;
  }
  if (id === 'yuancishu') {
    addSt(b.e.st, 'stun', 1, fx.stun || 2);
    addSt(b.e.st, 'sund', fx.sund || 0.25, fx.turns || 3);
    pushLog('元磁之力将【' + e.name + '】钉在原地。');
    return;
  }
  if (id === 'xuedun') {
    const gain = Math.round(maxMp() * (fx.mpGain || 0.25));
    S.mp = clamp(S.mp + gain, 0, maxMp());
    addSt(b.p.st, 'evade', fx.evade || 0.4, fx.turns || 2);
    pushLog('血光一闪，你遁出数丈，法力回复 <b>' + gain + '</b>。');
    return;
  }
  if (id === 'mingwang') {
    // 伤害 + 回血
    const r = hitEnemy(sp.power, { spell: true });
    if (r && r.dmg) pushLog('明王法相镇下，造成 <b>' + r.dmg + '</b> 点伤害。');
    const h = playerHealSelf(fx.heal || 0.2);
    pushLog('佛光回流，你回复 <b>' + h + '</b> 点气血。');
    return;
  }
  // 通用：重击型（血魔遁、天魔解体）
  const r = hitEnemy(sp.power, { spell: true, ignoreDef: fx.ignoreDef });
  if (r && r.dmg) {
    pushLog('重创【' + e.name + '】，造成 <b>' + r.dmg + '</b> 点伤害' + (r.crit ? '（暴击）' : '') + '。');
  }
  if (fx.evade) addSt(b.p.st, 'evade', fx.evade, fx.turns || 2);
}

function finishPlayerTurn() {
  const b = S.battle;
  if (!b) return;
  if (b.extraTurn) {
    b.extraTurn = false;
    S.battle.turn += 1;
    return;
  }
  if (b.enemy.hp <= 0) { winBattle(); return; }
  enemyTurn();
  if (!S.battle || S.battle.over || S.over) return;
  tickRound();
}

function tickRound() {
  const b = S.battle;
  if (!b) return;
  // 久战不下：避免永远打不死的僵局
  if (b.turn >= 30) {
    endBattle('这一战缠斗了太久，' + b.enemy.name + '见讨不到便宜，退走了。你也没有再追。');
    return;
  }
  // 中毒
  const ep = stSum(b.e.st, 'poison');
  if (ep > 0) {
    const d = Math.max(1, Math.round(b.enemy.maxHp * ep));
    b.enemy.hp = Math.max(0, b.enemy.hp - d);
    pushLog('毒素发作，【' + b.enemy.name + '】失了 <b>' + d + '</b> 点气血。');
    if (b.enemy.hp <= 0) { winBattle(); return; }
  }
  const pp = stSum(b.p.st, 'poison');
  if (pp > 0) {
    const tough = S.trait && S.trait.id === 'tough' ? 0.5 : 1;
    const d = Math.max(1, Math.round(maxHp() * pp * tough));
    S.hp = Math.max(0, S.hp - d);
    pushLog('你中了毒，失了 <b>' + d + '</b> 点气血。');
    if (S.hp <= 0) { loseBattle(); return; }
  }
  // 状态计时
  [b.p, b.e].forEach((side) => {
    side.st = side.st.filter((x) => {
      x.turns -= 1;
      return x.turns > 0;
    });
  });
  // 冷却
  Object.keys(b.cd || {}).forEach((k) => { if (b.cd[k] > 0) b.cd[k] -= 1; });
  Object.keys(b.artCd || {}).forEach((k) => { if (b.artCd[k] > 0) b.artCd[k] -= 1; });
  // 法宝每回合回法
  const mr = artStats().manaRegen;
  if (mr > 0) S.mp = clamp(S.mp + Math.round(maxMp() * mr), 0, maxMp());
  // 敌恢复
  if (b.enemy.traits.includes('regen')) {
    const h = Math.round(b.enemy.maxHp * 0.04);
    b.enemy.hp = Math.min(b.enemy.maxHp, b.enemy.hp + h);
  }
  b.turn += 1;
}

function enemyTurn(opening) {
  const b = S.battle;
  if (!b || b.over || S.over) return;
  const e = b.enemy;
  if (stHas(b.e.st, 'stun')) {
    pushLog('【' + e.name + '】被禁制缠住，动弹不得。');
    return;
  }
  // 玩家闪避
  if (chance(stSum(b.p.st, 'evade'))) {
    pushLog('你身形一晃，避开了【' + e.name + '】的攻势。');
    return;
  }
  // 选招
  const ready = (e.skills || []).filter((sid) => (e.cd[sid] || 0) <= 0);
  let skill = null;
  if (ready.length && chance(0.62)) skill = pick(ready);
  if (skill) {
    e.cd[skill] = ENEMY_SKILLS[skill].cd;
    const sk = ENEMY_SKILLS[skill];
    if (sk.mpDamage) S.mp = Math.max(0, S.mp - Math.round(maxMp() * sk.mpDamage));
    let mult = sk.power;
    if (e.traits.includes('enrage') && e.hp / e.maxHp < 0.35) mult *= 1.35;
    mult *= (1 + b.turn * 0.01);
    const d = enemyStrike(mult);
    pushLog('【' + e.name + '】' + sk.log + '，' +
      (d > 0 ? '你受了 <b>' + d + '</b> 点伤。' : '<span class="good">被护罩尽数化去。</span>'));
    if (sk.drain && d > 0) {
      const h = Math.round(d * sk.drain);
      e.hp = Math.min(e.maxHp, e.hp + h);
      pushLog('它吸走你一缕气血，回复了 <b>' + h + '</b> 点。');
    }
    if (sk.poison) addSt(b.p.st, 'poison', sk.poison, 3);
  } else {
    const d = enemyStrike(1.0, true);
    pushLog('【' + e.name + '】欺身攻来，' +
      (d > 0 ? '你受了 <b>' + d + '</b> 点伤。' : '<span class="good">被护罩挡了下来。</span>'));
  }
  if (e.traits.includes('fast') && chance(0.4) && S.hp > 0) {
    const d2 = enemyStrike(0.7);
    pushLog('【' + e.name + '】身形再动，又补上一击，' +
      (d2 > 0 ? '<b>' + d2 + '</b> 点。' : '<span class="good">被护罩挡下。</span>'));
  }
  if (S.hp <= 0) loseBattle();
}

function enemyStrike(mult, basic) {
  const b = S.battle, e = b.enemy;
  let d = e.atk * mult * (1 + e.rage * 0.02) * rnd(0.9, 1.12);
  const def = pDef() * (1 + stSum(b.p.st, 'def'));
  d -= def * 0.42;
  // 物理抗性：普通攻击减半
  if (basic && e.traits.includes('physResist')) d *= 0.62;
  d *= (1 - pDmgReduce());
  if (e.traits.includes('physResist') && !basic) d *= 0.85;
  if (e.traits.includes('spellImmune')) d *= 0.9;
  d = Math.max(1, Math.round(d));
  // 护盾
  if (b.p.shield > 0) {
    const abs = Math.min(b.p.shield, d);
    b.p.shield -= abs; d -= abs;
  }
  S.hp = Math.max(0, S.hp - d);
  // 反弹
  const th = stSum(b.p.st, 'thorns') + artStats().thorns;
  if (th > 0) {
    const r = Math.round(d * th);
    e.hp = Math.max(0, e.hp - r);
    if (r > 0) pushLog('护体之力反震，【' + e.name + '】受了 <b>' + r + '</b> 点伤。');
  }
  return d;
}

function endBattle(text) {
  if (!S.battle) return;
  S.result = text;
  S.deltas = diffOf(S.battle.before);
  S.phase = 'result';
  S.battle = null;
  S.eventId = null;
}

function loseBattle() {
  if (S.over) return;
  if (itemCount('revive') > 0) {
    addItem('revive', -1);
    S.hp = Math.round(maxHp() * 0.3);
    const e = S.battle ? S.battle.enemy : { name: '对手' };
    endBattle('你还魂丹碎裂，硬生生从' + e.name + '爪下抢回一条命。气血只剩三成，这一战你输了。');
    return;
  }
  const e = S.battle ? S.battle.enemy : { name: '对手' };
  die('dead', '你倒在' + e.name + '面前。血很快渗进土里，修仙界又多了一具无名的尸骨。');
  endBattle('你倒了下去。');
}

function winBattle() {
  if (!S.battle) return;
  const e = S.battle.enemy;
  const gain = 0.06 + 0.035 * e.power;
  gainPct(gain);
  const stones = Math.round((3 + S.realm * 7) * rnd(0.7, 1.4) * (e.elite ? 1.7 : 1));
  addStones(stones);
  addMood(4);
  let extra = '你得了 ' + stones + ' 枚灵石。';
  const hk = artStats().healOnKill;
  if (hk > 0) {
    const h = Math.round(maxHp() * hk);
    S.hp = clamp(S.hp + h, 0, maxHp());
    extra += ' 法宝饮血，你回复了 ' + h + ' 点气血。';
  }
  if (chance(0.5)) {
    const id = chance(0.5) ? 'heal' : 'mana';
    addItem(id, 1);
    extra += ' 从它身上搜出一枚' + ITEMS[id].name + '。';
  }
  if (chance(0.05)) { addItem('marrow', 1); extra += ' 残骸里还藏着一枚<span class="good">洗髓丹</span>。'; }
  if (chance(0.04)) { addItem('revive', 1); extra += ' 你摸到一枚<span class="good">还魂丹</span>，收进贴身的玉瓶。'; }
  if (chance(e.elite ? 0.26 : 0.08)) {
    const n = randomArt();
    if (n) { addArtifact(n); extra += ' 你还得到一件法宝：<span class="good">' + n + '</span>。'; }
  }
  endBattle('你斩落' + e.name + '。' + extra);
}

function battleAct(kind, id) {
  const b = S.battle;
  if (!b || b.over || S.over) return;

  if (kind === 'flee') {
    const p = clamp(0.38 + pFlee() + (S.flags.deer ? 0.05 : 0) - (b.enemy.elite ? 0.12 : 0), 0.10, 0.85);
    if (chance(p)) {
      endBattle('你且战且退，借着山势甩脱了' + b.enemy.name + '。这一战没有输赢，只是又耗去了几年。');
    } else {
      pushLog('<span class="warn">遁走失败！</span>');
      enemyTurn();
      if (S.battle && !S.battle.over && !S.over) tickRound();
    }
    return;
  }

  if (kind === 'item') {
    if (id === 'escape') {
      if (itemCount('escape') <= 0) return;
      addItem('escape', -1);
      endBattle('你捏碎遁地符，化作一道黄光遁出百里。' + b.enemy.name + '追之不及。');
      return;
    }
    if (id === 'heal' || id === 'mana' || id === 'calm') {
      if (itemCount(id) <= 0) return;
      if (id === 'heal' && S.hp >= maxHp()) return;
      if (id === 'mana' && S.mp >= maxMp()) return;
      addItem(id, -1);
      if (id === 'heal') { healHp(0.42 * (S.trait && S.trait.id === 'herb' ? 1.3 : 1)); pushLog('你服下回春丹，气血恢复。'); }
      else if (id === 'mana') { healMp(0.42); pushLog('你服下聚灵丹，法力恢复。'); }
      else { addMood(8); pushLog('你服下凝神丹，心神一清。'); }
      enemyTurn();
      if (S.battle && !S.battle.over && !S.over) tickRound();
      return;
    }
    return;
  }

  if (kind === 'attack') {
    const r = hitEnemy(1.0, {});
    if (r && r.dmg) {
      pushLog('你一剑命中【' + b.enemy.name + '】，造成 <b>' + r.dmg + '</b> 点伤害' + (r.crit ? '（暴击）' : '') + '。');
      const ls = pLifeSteal();
      if (ls > 0) {
        const h = Math.round(r.dmg * ls);
        S.hp = Math.min(maxHp(), S.hp + h);
      }
    }
    if (b.enemy.hp <= 0) { winBattle(); return; }
    finishPlayerTurn();
    return;
  }

  if (kind === 'spell') {
    if (!canCast()) {
      pushLog('<span class="warn">凡人经脉未开，纵有法诀也施展不出。</span>');
      return;
    }
    castSpell(id);
    return;
  }

  if (kind === 'art') {
    // id 为法术 id（法宝祭出）或法宝名（普通祭出）
    if (id && SPELLS[id] && SPELLS[id].art) {
      if (!canCast()) {
        pushLog('<span class="warn">法力未生，法宝催动不起来。</span>');
        return;
      }
      const sp = SPELLS[id];
      const cost = spellCost(sp);
      if (S.mp < cost) return;
      const cd = (b.artCd[id] || 0);
      if (cd > 0) return;
      S.mp -= cost;
      b.artCd[id] = sp.cd || 0;
      pushLog('你祭出「<b>' + sp.art + '</b>」。');
      const e = b.enemy;
      const r = hitEnemy(sp.power, { spell: true, ignoreDef: sp.fx && sp.fx.ignoreDef });
      if (r && r.dmg) pushLog('法宝威能加身，造成 <b>' + r.dmg + '</b> 点伤害。');
      const ls = (sp.fx && sp.fx.lifesteal) || 0;
      if (ls > 0 && r && r.dmg) {
        const h = Math.round(r.dmg * ls);
        S.hp = Math.min(maxHp(), S.hp + h);
        pushLog('阴魂回噬，你回复了 ' + h + ' 点气血。');
      }
      if (sp.fx && sp.fx.poison) addSt(e.st, 'poison', sp.fx.poison, sp.fx.turns || 3);
      if (e.hp <= 0) { winBattle(); return; }
      finishPlayerTurn();
      return;
    }
    // 普通祭出：取攻击最高的法宝
    let best = null;
    S.artifacts.forEach((n) => {
      const a = ARTS[n];
      if (a && a.atk && (!best || a.atk > ARTS[best].atk)) best = n;
    });
    if (!best) return;
    const r = hitEnemy(1.15 + (ARTS[best].atk / Math.max(1, pAtk())) * 1.2, {});
    if (r && r.dmg) {
      pushLog('你祭出「' + best + '」，造成 <b>' + r.dmg + '</b> 点伤害' + (r.crit ? '（暴击）' : '') + '。');
      const ls = pLifeSteal();
      if (ls > 0) S.hp = Math.min(maxHp(), S.hp + Math.round(r.dmg * ls));
    }
    if (b.enemy.hp <= 0) { winBattle(); return; }
    finishPlayerTurn();
  }
}

/* 遭遇事件 */
function encounterEvent() {
  const elite = chance(0.16 + (diffInfo().el || 0));
  const e = makeEnemy(elite ? 1.4 : 1, null, { elite: false });
  const cost = 6 + S.realm * 12;
  const intro = e.name + '从暗处现身，' + (e.elite ? '气息沉凝，显然不是寻常角色。' : '目光在你身上来回打量。');
  return {
    id: 'enc', realm: S.realm, title: '遭遇 · ' + e.name, text: intro, battle: true,
    opts: [
      ['拔剑迎战', '险', () => { startBattle(e); return '你握紧了手中的剑。'; }],
      ['屏息退走', '稳', () => {
        if (chk(clamp(0.5 + pFlee(), 0.2, 0.9))) {
          addMood(-2);
          return '你缓缓后退，退进林子里，转身便走。' + e.name + '没有追来。';
        }
        startBattle(e);
        return '你刚退半步，' + e.name + '已经扑了上来！';
      }],
      ['掷灵石买路', '耗', () => {
        if (S.stones >= cost) {
          addStones(-cost); addMood(-2);
          return '你抛出 ' + cost + ' 枚灵石。' + e.name + '接住掂了掂，让开了路。';
        }
        startBattle(e);
        return '你摸遍全身也凑不出买路的灵石，' + e.name + '已经不耐烦了。';
      }],
    ],
  };
}

function battleWith(power, name, intro) {
  startBattle(makeEnemy(power || 1, name), intro);
  return '你迎了上去。';
}

/* =============================================================
   冲关
   ============================================================= */
function breakChance() {
  const r = REALMS[S.realm];
  return clamp(
    r.bb + S.root.bb + S.wits * 0.006 + S.mood / 900 + attr('mind') * 0.004 +
    (S.trait && S.trait.id === 'calm' ? 0.05 : 0) +
    Math.min(S.artifacts.length, 3) * 0.012 + Math.min(S.techs.length, 3) * 0.01 -
    (S.flags.tribulation ? 0.06 : 0) - (S.diff === 2 ? 0.04 : S.diff === 0 ? -0.03 : 0),
    0.05, 0.95
  );
}

function attemptBreak(extra) {
  const info = BREAK_INFO[S.realm];
  const p = clamp(breakChance() + (extra || 0), 0.05, 0.95);
  if (chance(p)) {
    S.realm += 1;
    S.sub = 0;
    S.pending = false;
    S.progress = 0;
    S.life = REALMS[S.realm].life;
    S.hp = maxHp();
    S.mp = maxMp();
    S.eventId = null;
    addMood(6);
    addAttr(pick(['body', 'str', 'agi', 'spirit', 'mind']), 1);
    addAttr(pick(['body', 'str', 'agi', 'spirit', 'mind']), 1);
    if (!S.breakAges) S.breakAges = {};
    S.breakAges[S.realm] = S.age;
    if (S.realm === 5) {
      S.over = 'ascend';
      S.overText = info.win;
    }
    return info.win;
  }
  S.pending = false;
  S.progress = Math.round(S.progress * (S.realm === 4 ? 0.4 : 0.55));
  addMood(-10);
  shortenLife(info.pen);
  if (!S.over && chance(0.25)) {
    shortenLife(Math.round(info.pen * 0.5));
    return info.lose + ' 伤势比预想的更重，你又折损了一些寿元。';
  }
  return info.lose;
}

function subBreakChance() {
  return clamp(0.62 + S.wits * 0.008 + S.mood / 800 + (S.trait && S.trait.id === 'calm' ? 0.05 : 0) -
    (S.diff === 2 ? 0.05 : S.diff === 0 ? -0.03 : 0), 0.2, 0.96);
}

function subBreakEvent() {
  const next = subName(S.realm, (S.sub || 0) + 1);
  const pct = Math.round(subBreakChance() * 10);
  const extra = S.realm === 1 ? '丹田里的灵气又厚了一层，只差最后一步就能再进一层。' :
    '这一境的火候已经到了，再往前半步，便是' + next + '。';
  return {
    id: 'sub' + S.realm + '_' + (S.sub || 0),
    realm: S.realm,
    title: '冲关 · ' + next,
    sub: true,
    text: extra + '\n\n以你如今的状态，约有 ' + pct + ' 成把握。',
    opts: [
      ['静心行功，水到渠成', '稳', () => {
        if (chance(subBreakChance())) {
          S.sub = (S.sub || 0) + 1;
          S.progress = 0;
          S.pending = false;
          S.hp = maxHp();
          S.mp = maxMp();
          addMood(3);
          return '气机一转，你稳稳踏入了「' + subName(S.realm, S.sub) + '」。';
        }
        S.pending = false;
        S.progress = Math.round(subProgressNeed() * 0.62);
        addMood(-4);
        S.hp = Math.max(1, S.hp - Math.round(maxHp() * 0.08));
        return '行功到一半，气机忽然散了。你压下翻涌的气血，只得从头再来。';
      }],
      ['服下一枚破障丹', '耗', () => {
        addItem('break', -1);
        if (chance(clamp(subBreakChance() + 0.15, 0.2, 0.98))) {
          S.sub = (S.sub || 0) + 1;
          S.progress = 0;
          S.pending = false;
          S.hp = maxHp();
          S.mp = maxMp();
          addMood(3);
          return '药力化开，气机如决堤之水。你踏入「' + subName(S.realm, S.sub) + '」。';
        }
        S.pending = false;
        S.progress = Math.round(subProgressNeed() * 0.55);
        addMood(-3);
        return '丹药没能把气机推过去，反倒烧得你经脉发疼。';
      }, () => itemCount('break') > 0],
      ['压下气机，缓一缓', '稳', () => {
        S.pending = false;
        S.progress = Math.round(subProgressNeed() * 0.8);
        addMood(4);
        return '你把那股冲劲缓缓压回丹田。修为退了一点，人却稳了。';
      }],
    ],
  };
}

function breakEvent() {
  const r = S.realm;
  const info = BREAK_INFO[r];
  const isHua = r === 4;
  const pct = Math.round(breakChance() * 10);
  const body = info.text + '\n\n以你如今的状态，约有 ' + pct + ' 成把握。';
  return {
    id: 'brk' + r, realm: r, title: info.title, text: body, brk: true,
    opts: [
      [isHua ? '硬抗天劫，以己身渡之' : '静心冲关，以己身之力破境', '险', () => attemptBreak(0)],
      [isHua ? '服下化神丹，借药力护体' : '服下一枚丹药，借药力冲关', '耗',
        () => { addItem('break', -1); return attemptBreak(0.16); },
        () => itemCount('break') > 0],
      [isHua ? '散去三成修为，避开此劫' : '散去部分修为，另寻时机', '稳', () => {
        S.progress = Math.round(REALMS[r].need * (isHua ? 0.6 : 0.8));
        S.pending = false;
        addMood(isHua ? -5 : 6);
        return isHua
          ? '你咬破舌尖，强行散去三成修为。劫云失去了目标，在天上盘桓了半日，终于散了。你保住了命，也离化神更远了一步。'
          : '你缓缓收功，把那股冲劲化去。修为退回了一截，但人还活着——活着就还有机会。';
      }],
    ],
  };
}

/* =============================================================
   功法传承链
   得一门功法要连过三关：寻迹 → 破禁 → 参悟。
   每一关都要判定，任何一关失手，线索即断，这一趟便白跑。
   ============================================================= */
function techLore(id) {
  const t = TECHS[id] || {};
  return TECH_LORE[id] || TYPE_LORE[t.type] || TYPE_LORE['法'];
}
function startManualChain(id) {
  const t = TECHS[id];
  if (!t || !S) return false;
  if (hasManual(id) || hasTech(id)) return false;
  if (S.chain) return false;
  S.chain = { tech: id, stage: 1 };
  return true;
}
function chainAdvance() {
  if (!S.chain) return;
  S.chain.stage += 1;
  if (S.chain.stage > 3) S.chain = null;
}
function chainLost(text) {
  S.chain = null;
  addMood(-4);
  return '<span class="warn">' + text + '</span>';
}
function chainDone(id, text) {
  S.chain = null;
  const got = grantManual(id);
  gainPct(0.15);
  addMood(6);
  const t = TECHS[id];
  return text + (got
    ? '\n\n你把这门《' + t.name + '》的秘籍收进储物袋。<span class="em">回到储物袋或人物面板，便可静心修炼。</span>'
    : '\n\n这门功法你早已记下，此番只是又印证了一遍。');
}

function chainEvent() {
  if (!S.chain) return idleEvent();
  const id = S.chain.tech;
  const t = TECHS[id] || { name: '无名功法', tier: 1, type: '法' };
  const lore = techLore(id);
  const stage = S.chain.stage;
  const buyCost = 12 + S.realm * 15;

  if (stage === 1) {
    return {
      id: 'chain1', realm: -1, chain: true, title: '传承 · 寻迹',
      text: '酒肆角落里，一个喝多了的散修压着嗓子说：' + lore.place + '里，似乎还留着' + lore.relic +
        '。他说话时眼睛一直往门口瞟。\n\n那条路不好走——' + lore.ward + '。',
      opts: [
        ['循着那句话找过去', '机', () => {
          if (chk(0.45 + attr('spirit') * 0.02 + attr('wits') * 0.01)) {
            chainAdvance();
            return '你顺着他话里的地名一路找去，走了很久，终于看见了' + lore.place + '。';
          }
          return chainLost('你在山里绕了半个月，连那处地方的影子都没见着。消息是假的，或者他说的是别处。');
        }],
        ['花灵石买一份详图', '耗', () => {
          if (S.stones < buyCost) {
            return chainLost('你翻遍储物袋，也凑不出' + buyCost + '枚灵石。那散修嗤笑一声，起身走了。');
          }
          addStones(-buyCost);
          chainAdvance();
          return '你数出' + buyCost + '枚灵石推过去。他把图摊在桌上，指给你看：“就这儿。别说是我说的。”';
        }, () => S.stones >= buyCost],
        ['太虚了，不去', '稳', () => {
          S.chain = null;
          addMood(2);
          return '你把这件事记在心里，转身回了洞府。修仙界里这种没头没尾的消息，十有八九是坑。';
        }],
      ],
    };
  }

  if (stage === 2) {
    return {
      id: 'chain2', realm: -1, chain: true, title: '传承 · 破禁',
      text: '你确实找到了' + lore.relic + '。可' + lore.ward + '，要取它，先得过这一关。',
      opts: [
        ['硬闯，以肉身破禁', '险', () => {
          if (chk(0.40 + attr('body') * 0.03)) {
            chainAdvance();
            return '你硬生生撞开那道禁制，衣袖被绞得粉碎，人却站住了。' + lore.relic + '就在眼前。';
          }
          loseHp(0.28);
          return chainLost('禁制反噬，你被震得倒飞出去。爬起来时，那处地方已经塌了一半，东西也没了。');
        }],
        ['以神识一寸寸消磨', '机', () => {
          if (chk(0.55 + attr('spirit') * 0.02 + attr('wits') * 0.01)) {
            chainAdvance();
            return '你并不硬来，只以神识沿着禁制的纹路一点点磨。三日之后，禁制自己散了。';
          }
          addMood(-6);
          return chainLost('禁制比你想的复杂得多，你的神识耗尽，眼前一黑，醒来时天已亮了三天。');
        }],
        ['见势不对，退回去', '稳', () => {
          S.chain = null;
          return '你在禁制外站了很久，终究没有伸手。有些东西，不是这个境界能拿的。';
        }],
      ],
    };
  }

  return {
    id: 'chain3', realm: -1, chain: true, title: '传承 · 参悟',
    text: '秘籍到手了。' + lore.trial + '。\n\n能不能真正把它记进识海，就看这一坐。',
    opts: [
      ['闭关参悟，徐徐图之', '稳', () => {
        if (chk(0.45 + attr('wits') * 0.04 + attr('mind') * 0.01)) {
          return chainDone(id, '你在蒲团上坐了许久，一字一句地把' + lore.relic + '推演过去。某处忽然通了，前后文义豁然开朗。');
        }
        return chainLost('你参到一半，字句在识海里散成一团乱麻。再睁眼时，那卷秘籍上写的已经全是看不懂的东西。');
      }],
      ['以精血强行记下', '险', () => {
        loseHp(0.20);
        if (chk(0.34 + attr('body') * 0.03 + attr('mind') * 0.01)) {
          return chainDone(id, '你咬破舌尖，以精血为引，硬生生把这篇功法烙进识海。代价不小，但记住了。');
        }
        return chainLost('精血耗尽，你昏死过去。醒来时秘籍已经化成了灰，脑子里只剩前几行没头没尾的字。');
      }],
      ['只抄开篇，量力而行', '稳', () => {
        if (chk(0.72)) {
          return chainDone(id, '你没有贪多，只把开篇那一段完整抄了下来。字不多，却是整篇的根。');
        }
        addStones(8);
        gainPct(0.10);
        return '你抄到一半，纸上的墨迹忽然自己散了。你只记住了几处零散的句子，倒是顺手摸走了旁边一小袋灵石。';
      }],
    ],
  };
}

/* =============================================================
   事件抽取与结算
   ============================================================= */
function eventText(e) {
  if (typeof e.text === 'function') return e.text();
  if (e.texts && e.texts.length) return pick(e.texts);
  return e.text || '';
}
function eventEligible(e) {
  if (e.originOnly) return false;
  if (e.maxRealm !== undefined && S.realm > e.maxRealm) return false;
  if (e.realm === -1) {
    if (e.minRealm && S.realm < e.minRealm) return false;
  } else if (e.realm !== S.realm) return false;
  if (e.when && !e.when()) return false;
  return true;
}
function drawEvent() {
  if (S.pending) return breakEvent();
  if (S.chain) return chainEvent();
  const wd = worldInfo();
  const battleP = 0.13 + (wd.battle || 0) + (S.diff === 2 ? 0.05 : 0);
  if (S.turn > 1 && !S.battle && chance(clamp(battleP, 0.02, 0.5))) return encounterEvent();
  if (S.turn > 2 && metNpcs().length && chance(0.12)) {
    const ne = npcEvent();
    if (ne) return ne;
  }

  let pool = EVENTS.filter((e) => eventEligible(e) && !e.repeat && !S.used[e.id]);
  if (!pool.length) pool = EVENTS.filter((e) => eventEligible(e) && e.repeat);
  if (!pool.length) pool = EVENTS.filter((e) => e.realm === -1 && !S.used[e.id]);
  if (!pool.length) pool = EVENTS.filter((e) => e.realm === -1 && e.repeat);
  if (!pool.length) pool = EVENTS.filter((e) => e.realm === S.realm && e.repeat);
  if (!pool.length) return idleEvent();

  // 回避最近出现的
  const fresh = pool.filter((e) => !S.recent.includes(e.id));
  const use = fresh.length ? fresh : pool;

  let total = use.reduce((a, e) => a + (e.w || 1), 0);
  let x = Math.random() * total;
  let chosen = use[use.length - 1];
  for (const e of use) {
    x -= (e.w || 1);
    if (x <= 0) { chosen = e; break; }
  }
  if (!chosen.repeat) S.used[chosen.id] = 1;
  S.recent.push(chosen.id);
  if (S.recent.length > 6) S.recent.shift();
  return chosen;
}

/* 池子空了时的保底事件 */
function idleEvent() {
  return {
    id: 'idle' + S.turn, realm: S.realm, title: '山中无岁月',
    text: '没有人来找你，也没有什么事发生。洞府外的云聚了又散，石壁上的刻痕又多了一道。',
    opts: [
      ['闭关苦修', '稳', () => { gainPct(0.12); return '你把心思收回丹田，日复一日。'; }],
      ['出关走走', '稳', () => { addMood(4); gainPct(0.03); return '你在山道上走了走，看见一株野桃开了花。'; }],
      ['研习功法', '机', () => { addWits(1); gainPct(0.06); return '你把功法从头到尾又推演了一遍，忽然想通了从前忽略的一处。'; }],
    ],
  };
}

function snapshot() {
  return {
    realm: S.realm, sub: S.sub || 0, progress: S.progress, stones: S.stones,
    items: Object.assign({}, S.items), mood: S.mood, life: S.life,
    hp: S.hp, mp: S.mp, arts: S.artifacts.slice(), techs: S.techs.slice(),
    manuals: (S.manuals || []).slice(), age: S.age,
  };
}

function diffOf(before) {
  const out = [];
  if (S.realm !== before.realm) {
    out.push({ t: 'gold', v: '境界突破 · ' + realmLabel() });
  } else if ((S.sub || 0) !== (before.sub || 0)) {
    out.push({ t: 'gold', v: '境界精进 · ' + realmLabel() });
  } else if (Math.abs(S.progress - before.progress) >= 1) {
    const d = Math.round(S.progress - before.progress);
    out.push({ t: d > 0 ? 'up' : 'down', v: '修为 ' + (d > 0 ? '+' : '') + d });
  }
  const dAge = S.age - before.age;
  if (dAge) out.push({ t: 'plain', v: '光阴 -' + dAge + ' 年' });
  const ds = S.stones - before.stones;
  if (ds) out.push({ t: ds > 0 ? 'up' : 'down', v: '灵石 ' + (ds > 0 ? '+' : '') + ds });
  const dh = Math.round(S.hp - before.hp);
  if (dh) out.push({ t: dh > 0 ? 'up' : 'down', v: '气血 ' + (dh > 0 ? '+' : '') + dh });
  const dmp = Math.round(S.mp - before.mp);
  if (dmp) out.push({ t: dmp > 0 ? 'up' : 'down', v: '法力 ' + (dmp > 0 ? '+' : '') + dmp });
  Object.keys(ITEMS).forEach((id) => {
    const d = (S.items[id] || 0) - (before.items[id] || 0);
    if (d) out.push({ t: d > 0 ? 'up' : 'down', v: ITEMS[id].name + ' ' + (d > 0 ? '+' : '') + d });
  });
  const dm = Math.round(S.mood - before.mood);
  if (dm) out.push({ t: dm > 0 ? 'up' : 'down', v: '心境 ' + (dm > 0 ? '+' : '') + dm });
  const dl = S.life - before.life;
  if (dl) out.push({ t: dl > 0 ? 'up' : 'down', v: '寿元 ' + (dl > 0 ? '+' : '') + dl });
  (S.artifacts || []).forEach((name) => {
    if (!before.arts.includes(name)) out.push({ t: 'gold', v: '法宝「' + name + '」' });
  });
  (S.techs || []).forEach((id) => {
    if (!before.techs.includes(id)) out.push({ t: 'gold', v: '功法《' + TECHS[id].name + '》' });
  });
  (S.manuals || []).forEach((id) => {
    if (!(before.manuals || []).includes(id)) out.push({ t: 'gold', v: '秘籍《' + TECHS[id].name + '》' });
  });
  return out;
}

/* 选项耗年数：显式指定优先；否则按境界基准，再按抉择性质浮动
   稳妥之路耗时更久，凶险之举往往速决 */
function optYears(opt) {
  if (opt[4] != null) return opt[4];
  const base = YEAR_COST[S.realm] || 1;
  const tag = opt[1];
  let mult = 1;
  if (tag === '稳') mult = 1.15;
  else if (tag === '险') mult = 0.85;
  else if (tag === '机') mult = 0.9;
  return Math.max(1, Math.round(base * mult));
}

/* 面板内耗时（修炼、参悟等）：不走事件流程，只推进岁月 */
function passTime(years) {
  if (!years || years <= 0) return;
  S.age += years;
  if (!S.over) tickNpcs(years);
  if (!S.over && S.age >= S.life) die('old');
  if (!S.over) {
    const hpFrac = clamp(0.02 + 0.022 * years, 0.03, 0.6);
    const mpFrac = clamp(0.06 + 0.05 * years, 0.08, 0.9);
    S.hp = clamp(S.hp + Math.round(maxHp() * hpFrac), 0, maxHp());
    S.mp = clamp(S.mp + Math.round(maxMp() * mpFrac), 0, maxMp());
  }
}

function applyOption(opt) {
  const before = snapshot();
  const years = optYears(opt);
  let text = '';
  try {
    text = opt[2]() || '';
  } catch (err) {
    console.error('event error', err);
    text = '……';
  }
  S.age += years;
  S.turn += 1;
  if (!S.over) tickNpcs(years);
  if (!S.over && S.age >= S.life) die('old');
  if (!S.over && S.mood <= 0) die('demon');
  if (!S.over) {
    // 静养恢复随流逝的年数增长：闭关几十载，自然养得回来
    const hpFrac = clamp(0.02 + 0.022 * years, 0.03, 0.6);
    const mpFrac = clamp(0.06 + 0.05 * years, 0.08, 0.9);
    S.hp = clamp(S.hp + Math.round(maxHp() * hpFrac), 0, maxHp());
    S.mp = clamp(S.mp + Math.round(maxMp() * mpFrac), 0, maxMp());
    const am = artStats().mood;
    if (am) addMood(am);
  }
  if (!S.over && S.flags.curse) {
    addMood(-1);
    if (!S.over) S.progress = Math.max(0, S.progress - subNeed() * 0.008 * subCount(S.realm));
  }
  const need = subNeed();
  if (!S.over && !S.pending && need && S.progress >= need - 0.001 &&
    (S.sub || 0) >= subCount(S.realm) - 1) S.pending = true;
  return { text: text, deltas: diffOf(before) };
}

/* =============================================================
   界面
   ============================================================= */
const UI_IDS = ['hud-realm', 'hud-phase', 'hud-age', 'hud-lifespan', 'hud-life-bar',
  'hud-life-bar-wrap', 'hud-prog-text', 'hud-prog-bar', 'hud-stones', 'hud-pills',
  'hud-mood', 'hud-year', 'hud-tech', 'hud-diff', 'hud-world',
  'artifact-line', 'artifact-list', 'scene-title', 'scene-text',
  'scene-options', 'scene-result', 'result-text', 'result-deltas', 'btn-next',
  'screen-title', 'screen-game', 'screen-end', 'end-inner', 'end-kicker', 'end-title',
  'end-text', 'end-stats', 'btn-restart', 'input-name', 'btn-roll', 'btn-continue',
  'title-start', 'root-panel', 'root-name', 'root-stars', 'root-desc', 'btn-reroll',
  'btn-enter', 'battle', 'battle-turn', 'enemy-name', 'enemy-art', 'enemy-hp-bar',
  'enemy-hp-text', 'enemy-atk', 'enemy-status', 'battle-log', 'battle-hp-bar',
  'battle-hp-text', 'battle-mp-bar', 'battle-mp-text', 'battle-status',
  'skill-panel', 'battle-hint', 'bag-modal', 'bag-items', 'bag-arts', 'bag-techs',
  'bag-art-count', 'toast'];

function toParas(t) {
  return String(t || '').split('\n').map((s) => s.trim()).filter(Boolean)
    .map((s) => '<p>' + s + '</p>').join('');
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function phaseText() {
  if (S.realm === 0) return '红尘';
  if (S.realm >= 5) return '神游太虚';
  if (S.realm === 1) return cn((S.sub || 0) + 1) + '层';
  return SUB_PHASES[Math.min(S.sub || 0, 3)];
}

function renderHUD() {
  const r = REALMS[S.realm];
  $('hud-realm').textContent = S.realm === 0 ? '凡人' : r.name;
  $('hud-phase').textContent = phaseText() + ' · ' + S.root.name;
  $('hud-age').textContent = cn(S.age) + '岁';
  const remain = Math.max(0, S.life - S.age);
  $('hud-lifespan').textContent = '寿元 ' + remain + ' / ' + S.life;
  const lp = clamp((remain / Math.max(1, S.life)) * 100, 0, 100);
  $('hud-life-bar').style.width = lp + '%';
  $('hud-life-bar-wrap').classList.toggle('low', lp < 22);
  const need = subNeed() || 1;
  $('hud-prog-text').textContent = Math.floor(S.progress) + ' / ' + Math.round(need);
  $('hud-prog-bar').style.width = clamp((S.progress / need) * 100, 0, 100) + '%';
  $('hud-stones').textContent = S.stones;
  const pillTotal = ['heal', 'mana', 'break', 'revive', 'marrow', 'calm']
    .reduce((a, id) => a + (S.items[id] || 0), 0);
  $('hud-pills').textContent = pillTotal;
  $('hud-mood').textContent = Math.round(S.mood);
  $('hud-year').textContent = '第' + cn(S.turn) + '幕 · 历' + cn(S.age - 16) + '载';
  const mh = maxHp(), mm = maxMp();
  const hp = clamp(S.hp, 0, mh), mp = clamp(S.mp, 0, mm);
  $('hud-hp-text').textContent = Math.round(hp) + ' / ' + mh;
  $('hud-hp-bar').style.width = clamp((hp / mh) * 100, 0, 100) + '%';
  $('hud-mp-text').textContent = Math.round(mp) + ' / ' + mm;
  $('hud-mp-bar').style.width = clamp((mp / mm) * 100, 0, 100) + '%';
  if ($('hud-tech')) {
    $('hud-tech').textContent = S.mainTech
      ? TECHS[S.mainTech].name + ' · ' + (TECH_TYPES[TECHS[S.mainTech].type] || {}).name
      : '尚未修习功法';
  }
  if ($('hud-diff')) $('hud-diff').textContent = diffInfo().name;
  if ($('hud-world')) $('hud-world').textContent = worldInfo().name;
  if (S.artifacts.length) {
    $('artifact-line').hidden = false;
    $('artifact-list').textContent = S.artifacts.join(' · ');
  } else {
    $('artifact-line').hidden = true;
  }
}

/* ---------------- 战斗界面 ---------------- */
let panelMode = null;

function statusChips(st) {
  const names = {
    atk: '攻', def: '防', shield: '盾', poison: '毒', stun: '缚', evade: '闪',
    crit: '暴', dmgReduce: '减', thorns: '反', spellPower: '术', sund: '破',
  };
  const agg = {};
  (st || []).forEach((x) => {
    if (!agg[x.k]) agg[x.k] = { v: 0, t: 0 };
    agg[x.k].v += x.v; agg[x.k].t = Math.max(agg[x.k].t, x.turns);
  });
  return Object.keys(agg).map((k) => {
    const a = agg[k];
    let v = '';
    if (k === 'evade' || k === 'crit' || k === 'dmgReduce' || k === 'thorns' || k === 'spellPower' || k === 'sund') {
      v = Math.round(a.v * 100) + '%';
    } else if (k === 'poison') {
      v = Math.round(a.v * 100) + '%';
    } else {
      v = Math.round(a.v * 100) + '%';
    }
    return '<span class="st st-' + k + '">' + (names[k] || k) + v + '<i>' + a.t + '</i></span>';
  }).join('');
}

function renderBattle() {
  if (!S.battle) { $('battle').hidden = true; return; }
  const b = S.battle, e = b.enemy;
  $('battle').hidden = false;
  $('enemy-name').textContent = e.name;
  $('enemy-art').textContent = (e.tags || []).join('·') + (e.elite ? ' · 强敌' : '');
  const ehp = clamp(e.hp, 0, e.maxHp);
  $('enemy-hp-bar').style.width = clamp((ehp / e.maxHp) * 100, 0, 100) + '%';
  $('enemy-hp-text').textContent = '气血 ' + Math.round(ehp) + ' / ' + e.maxHp;
  $('enemy-atk').textContent = '攻击 ' + e.atk + (b.e.shield > 0 ? ' · 护体 ' + b.e.shield : '');
  $('enemy-status').innerHTML = statusChips(b.e.st);
  $('battle-turn').textContent = '第' + cn(b.turn) + '回合';
  const mh = maxHp(), mm = maxMp();
  $('battle-hp-text').textContent = Math.round(S.hp) + ' / ' + mh;
  $('battle-hp-bar').style.width = clamp((S.hp / mh) * 100, 0, 100) + '%';
  $('battle-mp-text').textContent = Math.round(S.mp) + ' / ' + mm;
  $('battle-mp-bar').style.width = clamp((S.mp / mm) * 100, 0, 100) + '%';
  $('battle-status').innerHTML =
    (b.p.shield > 0 ? '<span class="st st-shield">盾' + b.p.shield + '</span>' : '') +
    statusChips(b.p.st) +
    (b.extraTurn ? '<span class="st st-extra">再动</span>' : '');
  const log = $('battle-log');
  log.innerHTML = b.log.map((t) => '<p>' + t + '</p>').join('');
  log.scrollTop = log.scrollHeight;
  renderBattleActions();
  renderSkillPanel();
  renderHUD();
  save();
}

function renderBattleActions() {
  const b = S.battle;
  if (!b) return;
  document.querySelectorAll('#battle-actions button').forEach((btn) => {
    const act = btn.dataset.act;
    if (act === 'spell') {
      btn.disabled = !canCast() || knownSpells().length === 0;
      btn.classList.toggle('on', panelMode === 'spell');
    }
    if (act === 'art') {
      btn.disabled = S.artifacts.length === 0;
      btn.classList.toggle('on', panelMode === 'art');
    }
    if (act === 'item') {
      btn.disabled = !['heal', 'mana', 'escape', 'calm'].some((id) => itemCount(id) > 0);
    }
  });
  const fp = Math.round(clamp(0.38 + pFlee() + (S.flags.deer ? 0.05 : 0) -
    (b.enemy.elite ? 0.12 : 0), 0.10, 0.85) * 100);
  const hints = [];
  hints.push('遁走 ' + fp + '%');
  if (!canCast()) hints.push('凡人经脉未开 · 需引气入体方能施法');
  else if (panelMode === 'spell') hints.push('选择要施展的法术');
  if (panelMode === 'art') hints.push('选择要祭出的法宝');
  if (b.extraTurn) hints.push('分神未散，可再动一次');
  $('battle-hint').textContent = hints.join(' · ');
}

function renderSkillPanel() {
  const el = $('skill-panel');
  if (!el) return;
  if (!panelMode || !S.battle) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  let html = '';
  if (panelMode === 'spell' && !canCast()) {
    html = '<div class="sk-empty">凡人经脉未开，施展不出法术。<br>需先引气入体，踏入炼气期。</div>';
  } else if (panelMode === 'spell') {
    const list = knownSpells();
    if (!list.length) {
      html = '<div class="sk-empty">尚未修习任何功法，无法术可用。</div>';
    } else {
      list.forEach((id) => {
        const sp = SPELLS[id];
        const ready = spellReady(id);
        const cost = spellCost(sp);
        const cd = (S.battle.cd[id] || 0);
        html += '<button class="sk" data-spell="' + id + '"' + (ready.ok ? '' : ' disabled') + '>' +
          '<span class="sk-name">' + sp.name + '</span>' +
          '<span class="sk-cost">' + cost + ' 法力</span>' +
          '<span class="sk-cd">' + (cd > 0 ? '冷却 ' + cd : (sp.cd ? '冷却 ' + sp.cd : '无冷却')) + '</span>' +
          '<span class="sk-desc">' + sp.desc + '</span>' +
          (ready.ok ? '' : '<span class="sk-no">' + ready.reason + '</span>') +
          '</button>';
      });
    }
  } else {
    const acts = artifactActives();
    if (!S.artifacts.length) {
      html = '<div class="sk-empty">尚无法宝。</div>';
    } else {
      acts.forEach((x) => {
        const sp = SPELLS[x.spell];
        const cost = spellCost(sp);
        const cd = (S.battle.artCd[x.spell] || 0);
        const ok = canCast() && S.mp >= cost && cd <= 0;
        html += '<button class="sk" data-artspell="' + x.spell + '"' + (ok ? '' : ' disabled') + '>' +
          '<span class="sk-name">' + sp.name + '</span>' +
          '<span class="sk-cost">' + cost + ' 法力</span>' +
          '<span class="sk-cd">' + (cd > 0 ? '冷却 ' + cd : '冷却 ' + (sp.cd || 0)) + '</span>' +
          '<span class="sk-desc">' + sp.desc + '</span>' +
          '<span class="sk-owner">' + x.art + '</span>' +
          (ok ? '' : '<span class="sk-no">' + (canCast() ? '法力不足' : '未引气入体') + '</span>') +
          '</button>';
      });
      const hasAtk = S.artifacts.some((n) => ARTS[n] && ARTS[n].atk);
      if (hasAtk) {
        html += '<button class="sk sk-plain" data-plainart="1">' +
          '<span class="sk-name">祭出法宝</span><span class="sk-cost">不耗法力</span>' +
          '<span class="sk-cd">普通攻击</span>' +
          '<span class="sk-desc">以攻击最高的法宝硬生生砸过去。</span></button>';
      }
    }
  }
  el.innerHTML = html;
}

function afterBattle() {
  $('battle').hidden = true;
  panelMode = null;
  closeBag();
  renderHUD();
  if (S.phase === 'result') {
    $('scene-options').hidden = true;
    $('scene-result').hidden = false;
    renderResult();
    save();
  }
}

function battleActionUI(act, id) {
  if (!S.battle) return;
  if (act === 'item') { openBag(true); return; }
  if (act === 'spell' || act === 'art') {
    panelMode = panelMode === act ? null : act;
    renderBattle();
    return;
  }
  if (act === 'spell-cast') {
    battleAct('spell', id);
    panelMode = null;
    if (!S.battle) afterBattle(); else renderBattle();
    return;
  }
  if (act === 'art-cast') {
    battleAct('art', id);
    panelMode = null;
    if (!S.battle) afterBattle(); else renderBattle();
    return;
  }
  if (act === 'art-plain') {
    battleAct('art', null);
    panelMode = null;
    if (!S.battle) afterBattle(); else renderBattle();
    return;
  }
  battleAct(act, id);
  if (!S.battle) afterBattle();
  else renderBattle();
}

/* ---------------- 储物袋 ---------------- */
let bagInBattle = false;
function openBag(inBattle) {
  bagInBattle = !!inBattle;
  $('bag-modal').hidden = false;
  renderBag();
}
function closeBag() {
  const el = $('bag-modal');
  if (el) el.hidden = true;
  bagInBattle = false;
}
function canUse(id) {
  if (id === 'heal') return itemCount('heal') > 0 && S.hp < maxHp();
  if (id === 'mana') return itemCount('mana') > 0 && S.mp < maxMp();
  if (id === 'calm') return itemCount('calm') > 0;
  if (id === 'escape') return S.phase === 'battle';
  if (id === 'marrow') return ROOTS.findIndex((r) => r.name === S.root.name) > 0;
  return false;
}

function renderBag() {
  const wrap = $('bag-items');
  wrap.innerHTML = '';
  const ids = ['heal', 'mana', 'calm', 'break', 'escape', 'revive', 'marrow'];
  let any = false;
  ids.forEach((id) => {
    const n = itemCount(id);
    if (!n) return;
    any = true;
    const row = document.createElement('div');
    row.className = 'bag-item';
    row.innerHTML = '<span class="bi-name">' + ITEMS[id].name + '</span>' +
      '<span class="bi-desc">' + ITEMS[id].desc + '</span>' +
      '<span class="bi-count">×' + n + '</span>';
    const btn = document.createElement('button');
    btn.className = 'bi-use';
    btn.textContent = id === 'break' ? '冲关用' : id === 'revive' ? '自动' :
      id === 'escape' && S.phase !== 'battle' ? '战斗用' : '使用';
    btn.disabled = !canUse(id) && S.phase !== 'battle';
    btn.addEventListener('click', () => useBagItem(id));
    row.appendChild(btn);
    wrap.appendChild(row);
  });
  if (!any) wrap.innerHTML = '<div class="bag-empty">囊中空空。</div>';

  const arts = $('bag-arts');
  arts.innerHTML = '';
  $('bag-art-count').textContent = S.artifacts.length ? '· ' + S.artifacts.length + ' 件' : '';
  if (!S.artifacts.length) {
    arts.innerHTML = '<div class="bag-empty">尚无法宝。斩妖、探秘、奇遇皆有可能得到。</div>';
  } else {
    S.artifacts.forEach((n) => {
      const a = ARTS[n];
      if (!a) return;
      const d = document.createElement('div');
      d.className = 'bag-art';
      d.innerHTML = '<b>' + n + '</b><span>' + a.desc + '</span>';
      arts.appendChild(d);
    });
  }

  const techs = $('bag-techs');
  if (techs) {
    const owned = (S.manuals || []).filter((id) => TECHS[id]);
    if ($('bag-tech-count')) {
      $('bag-tech-count').textContent = owned.length ? '· ' + owned.length + ' 门' : '';
    }
    if (!owned.length) {
      techs.innerHTML = '<div class="bag-empty">尚未得任何功法秘籍。<br>功法只能在奇遇、洞府、传承中寻得，且要连过三关才拿到手。</div>';
    } else {
      let h = '';
      if (!S.mainTech) h += '<div class="bag-empty">已有秘籍，尚未修炼。挑一门静心参悟吧。</div>';
      h += owned.map(bagTechHtml).join('');
      techs.innerHTML = h;
    }
  }
}

/* 储物袋里的一条功法 */
function bagTechHtml(id) {
  const t = TECHS[id];
  if (!t) return '';
  const isMain = S.mainTech === id;
  const met = meetsTechReq(id);
  const years = techLearnYears(id);
  const pct = Math.round(techMasterChance(id) * 100);
  const sp = (t.spells || []).map((sid) => (SPELLS[sid] ? SPELLS[sid].name : '')).filter(Boolean).join(' · ');
  const btn = isMain
    ? '<span class="tech-badge">主 修</span>'
    : '<button class="tech-btn" data-tech-practice="' + id + '"' + (met ? '' : ' disabled') + '>' +
      (met ? (S.mainTech ? '改修（' + years + '年 · ' + pct + '%）' : '修炼（' + years + '年 · ' + pct + '%）') : '属性未达') +
      '</button>';
  return '<div class="bag-art bag-tech' + (isMain ? ' is-main' : '') + '">' +
    '<div class="bt-head"><b>' + t.name + '</b>' +
    '<span class="tech-type">' + ((TECH_TYPES[t.type] || {}).name || '') + '</span>' + btn + '</div>' +
    '<span>' + t.desc + '</span>' +
    (sp ? '<em>法术：' + sp + '</em>' : '') +
    '</div>';
}

function useBagItem(id) {
  if (S.phase === 'battle' && S.battle) {
    if (id === 'heal' || id === 'mana' || id === 'escape' || id === 'calm') {
      battleAct('item', id);
      closeBag();
      if (!S.battle) afterBattle();
      else renderBattle();
    }
    return;
  }
  if (id === 'heal') {
    if (!canUse(id)) return;
    addItem('heal', -1); healHp(0.42 * (S.trait && S.trait.id === 'herb' ? 1.3 : 1));
    showToast('服下回春丹，气血恢复。');
  } else if (id === 'mana') {
    if (!canUse(id)) return;
    addItem('mana', -1); healMp(0.42);
    showToast('服下聚灵丹，法力恢复。');
  } else if (id === 'calm') {
    if (!canUse(id)) return;
    addItem('calm', -1); addMood(8);
    showToast('服下凝神丹，心魔稍退。');
  } else if (id === 'marrow') {
    if (!canUse(id)) return;
    addItem('marrow', -1);
    upgradeRoot();
    showToast('洗髓易骨，灵根化为「' + S.root.name + '」。');
  } else {
    return;
  }
  renderHUD();
  renderBag();
  save();
}

let toastTimer = null;
function showToast(t) {
  const el = $('toast');
  if (!el) return;
  el.textContent = t;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1900);
}

function renderResult() {
  $('result-text').innerHTML = toParas(S.result || '');
  const d = $('result-deltas');
  d.innerHTML = '';
  (S.deltas || []).forEach((x) => {
    const s = document.createElement('span');
    s.className = 'chip ' + x.t;
    s.textContent = x.v;
    d.appendChild(s);
  });
  $('btn-next').textContent = S.over ? '此 生 已 尽' : '又 是 一 载';
}

function renderEvent(e, withResult) {
  $('battle').hidden = true;
  panelMode = null;
  closeBag();
  S.eventId = e.id;
  S.phase = withResult ? 'result' : 'event';
  $('scene-title').textContent = e.title;
  $('scene-text').innerHTML = toParas(eventText(e));
  $('scene-text').classList.toggle('dim', !!withResult);
  const optsEl = $('scene-options');
  const resEl = $('scene-result');
  if (withResult) {
    optsEl.innerHTML = '';
    optsEl.hidden = true;
    resEl.hidden = false;
    renderResult();
  } else {
    optsEl.hidden = false;
    resEl.hidden = true;
    optsEl.innerHTML = '';
    e.opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.style.animationDelay = (i * 55) + 'ms';
      const disabled = o[3] && !o[3]();
      const yrs = optYears(o);
      b.innerHTML = '<span class="num">' + (NUM_CN[i] || (i + 1)) + '</span><span class="label">' +
        o[0] + '<span class="tag tag-' + o[1] + '">' + o[1] + '</span></span>' +
        '<span class="cost">' + yrs + ' 年</span>';
      if (disabled) {
        b.disabled = true;
        b.title = o[1] === '耗' ? '条件不足' : '条件不足';
        const cost = b.querySelector('.cost');
        if (cost) cost.textContent = '不可选';
      }
      b.addEventListener('click', () => chooseOption(e, o));
      optsEl.appendChild(b);
    });
  }
  renderHUD();
  save();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let busy = false;
function chooseOption(e, o) {
  if (busy || S.phase !== 'event') return;
  busy = true;
  const res = applyOption(o);
  S.result = res.text;
  S.deltas = res.deltas;
  S.phase = S.battle ? 'battle' : 'result';
  renderHUD();
  if (S.battle) {
    $('scene-options').hidden = true;
    $('scene-result').hidden = true;
    renderBattle();
  } else {
    $('scene-options').hidden = true;
    $('scene-result').hidden = false;
    renderResult();
  }
  save();
  busy = false;
}

function nextScene() {
  if (S.over) { showEnding(); return; }
  const e = drawEvent();
  renderEvent(e, false);
}

/* ---------------- 结局 ---------------- */
const ENDINGS = {
  ascend: {
    kicker: '飞 升 · 通 关', title: '灵界之门', cls: 'win',
    text: '你踏出最后一步。天穹裂开一道金色的缝隙，灵气如瀑，倾泻而下。\n你回头看了一眼这片山河——青牛镇的炊烟、七玄门的石阶、乱星海的风浪，都小得像一粒尘埃。\n然后你一步踏入灵界，再没有回头。',
  },
  old: {
    kicker: '寿 元 耗 尽', title: '坐 化', cls: 'dark',
    text: () => '你坐在洞府深处，数着石壁上的刻痕。第' + cn(S.age) + '道刻痕落下时，手已经抬不起来了。\n此生修行' + cn(S.age - 16) + '年，止步于' + REALMS[S.realm].name + '。\n山外的桃花开了又谢，再没有人记得你的名字。',
  },
  dead: {
    kicker: '身 死 道 消', title: '陨 落', cls: 'dark',
    text: () => S.overText || '你死在一场没有名字的争斗里。修仙界每天都有这样的人死去，连一块碑都不会留下。',
  },
  demon: {
    kicker: '走 火 入 魔', title: '道 消', cls: 'dark',
    text: '心魔自内而外，把你的神识啃得干干净净。\n最后那一刻，你听见很多人在笑——有你的仇人，有你的故人，也有你自己。',
  },
};

function showEnding() {
  const kind = S.over || 'dead';
  const info = ENDINGS[kind] || ENDINGS.dead;
  if ($('battle')) $('battle').hidden = true;
  closeBag();
  const inner = $('end-inner');
  inner.className = 'end-inner ' + (info.cls || '');
  $('end-kicker').textContent = info.kicker;
  $('end-title').textContent = info.title;
  const txt = typeof info.text === 'function' ? info.text() : info.text;
  $('end-text').textContent = txt;
  const cells = [
    [S.name, '道号'],
    [REALMS[S.realm].name, '境界'],
    [S.age + '岁', '享年'],
    [S.root.name, '灵根'],
    [(S.manuals || []).length ? (S.manuals || []).length + ' 门' : '无', '功法'],
    [S.artifacts.length ? S.artifacts.length + ' 件' : '无', '法宝'],
  ];
  $('end-stats').innerHTML = cells.map((c) =>
    '<div><b>' + esc(c[0]) + '</b><span>' + c[1] + '</span></div>').join('');
  clearSave();
  showScreen('end');
  window.scrollTo(0, 0);
}

/* ---------------- 屏幕与存档 ---------------- */
function showScreen(name) {
  ['title', 'game', 'end'].forEach((k) => { $('screen-' + k).hidden = (k !== name); });
  if (name !== 'title') $('screen-title').classList.remove('choosing');
  closeBag();
  ['char-modal', 'npc-modal'].forEach((id) => { if ($(id)) $(id).hidden = true; });
  if (name !== 'game' && $('battle')) $('battle').hidden = true;
  window.scrollTo(0, 0);
}

let suppressSave = false;
function save() {
  if (suppressSave || !S) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 4, S: S })); } catch (e) { /* 忽略 */ }
}
function clearSave() {
  if (suppressSave) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 忽略 */ }
}
function normalizeState(s) {
  s.techs = s.techs || [];
  s.recent = s.recent || [];
  s.items = Object.assign({ heal: 0, mana: 0, break: 0, escape: 0, revive: 0, marrow: 0, calm: 0 }, s.items || {});
  s.diff = typeof s.diff === 'number' ? s.diff : 1;
  s.world = s.world || WORLD_MOODS[0].id;
  if (!s.breakAges) s.breakAges = {};
  s.sub = typeof s.sub === 'number' ? s.sub : 0;
  s.attrs = Object.assign({ wits: s.wits || 5, body: 5, str: 5, agi: 5, spirit: 5, mind: 5 }, s.attrs || {});
  s.wits = s.attrs.wits || s.wits || 5;
  s.mainTech = s.mainTech || (s.techs && s.techs[0]) || null;
  if (s.mainTech && !TECHS[s.mainTech]) s.mainTech = null;
  if (s.mainTech) s.techs = [s.mainTech];
  // 秘籍：旧档没有 manuals，把已修的那门补进去，避免改版后无法改修
  if (!Array.isArray(s.manuals)) s.manuals = [];
  s.manuals = s.manuals.filter((id) => TECHS[id]);
  if (s.mainTech && !s.manuals.includes(s.mainTech)) s.manuals.push(s.mainTech);
  if (s.chain && (!TECHS[s.chain.tech] || !(s.chain.stage >= 1 && s.chain.stage <= 3))) s.chain = null;
  if (s.chain === undefined) s.chain = null;
  s.npcs = s.npcs || {};
  s.npcOrder = s.npcOrder || Object.keys(s.npcs);
  s.trait = s.trait || null;
  s.origin = s.origin || null;
  if (s.phase === 'battle' && !s.battle) s.phase = 'event';
  return s;
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.S || obj.S.realm > 5) return null;
    const s = normalizeState(obj.S);
    if (s.over) return null;
    return s;
  } catch (e) { return null; }
}

function findEvent(id) {
  if (!id) return null;
  if (id.indexOf('brk') === 0) return breakEvent();
  return EVENTS.find((e) => e.id === id) || null;
}

/* ---------------- 存档导出 / 导入 ---------------- */
function b64enc(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64dec(str) { return decodeURIComponent(escape(atob(str))); }

function exportSave() {
  if (!S) return { ok: false, msg: '还没有开始游戏' };
  const code = b64enc(JSON.stringify({ v: 4, S: S }));
  return { ok: true, code: code, msg: '存档码已生成（共 ' + code.length + ' 字）' };
}

function importSave(code) {
  try {
    const obj = JSON.parse(b64dec(String(code || '').trim()));
    if (!obj || !obj.S) return { ok: false, msg: '存档码无效' };
    S = normalizeState(obj.S);
    S.battle = null;
    if (S.phase === 'battle') S.phase = 'event';
    if (!S.npcOrder || !S.npcOrder.length) initNpcs();
    showScreen('game');
    renderHUD();
    const e = findEvent(S.eventId);
    if (e) renderEvent(e, S.phase === 'result');
    else nextScene();
    save();
    return { ok: true, msg: '存档已导入' };
  } catch (err) {
    return { ok: false, msg: '存档码无效' };
  }
}

function openImportDialog() {
  const code = window.prompt('粘贴存档码：');
  if (!code) return;
  const r = importSave(code);
  showToast(r.msg);
}

/* ---------------- 开局 ---------------- */
let pendingName = '';
let pendingRoot = null;
let pendingOrigin = null;
let rerolled = false;

function rollRoot() {
  const total = ROOTS.reduce((a, r) => a + r.weight, 0);
  let x = Math.random() * total;
  for (const r of ROOTS) { x -= r.weight; if (x <= 0) return r; }
  return ROOTS[3];
}
function showRootPanel() {
  $('title-start').hidden = true;
  $('root-panel').hidden = false;
  $('root-name').textContent = pendingRoot.name;
  $('root-stars').textContent = '★'.repeat(pendingRoot.stars) + '☆'.repeat(5 - pendingRoot.stars);
  $('root-desc').textContent = pendingRoot.desc;
  $('btn-reroll').disabled = rerolled;
  $('btn-reroll').style.opacity = rerolled ? 0.35 : 1;
}
function applyOrigin(origin) {
  if (!origin) return;
  S.origin = origin.id;
  S.trait = origin.trait;
  Object.keys(origin.attrs || {}).forEach((k) => {
    if (k === 'wits') {
      S.wits = origin.attrs.wits;
      S.attrs.wits = S.wits;
    } else {
      S.attrs[k] = origin.attrs[k];
    }
  });
  Object.keys(origin.items || {}).forEach((id) => addItem(id, origin.items[id]));
  addStones(origin.stones || 0);
  if (origin.artifact) addArtifact(origin.artifact);
  if (origin.tech) {
    grantManual(origin.tech);      // 出身自带秘籍
    forceLearnTech(origin.tech);   // 且已修成
  }
  if (origin.trait && origin.trait.id === 'calm') S.mood = clamp(S.mood + 10, 0, 100);
  S.hp = maxHp();
  S.mp = maxMp();
}

function showOriginPanel() {
  $('title-start').hidden = true;
  $('root-panel').hidden = true;
  $('origin-panel').hidden = false;
  $('screen-title').classList.add('choosing');
  const list = $('origin-list');
  list.innerHTML = '';
  ORIGINS.forEach((o) => {
    const card = document.createElement('button');
    card.className = 'origin-card';
    const tech = o.tech ? TECHS[o.tech] : null;
    const trait = o.trait || {};
    card.innerHTML =
      '<div class="oc-head"><span class="oc-name">' + o.name + '</span>' +
      '<span class="oc-stars">' + '★'.repeat(o.stars) + '☆'.repeat(5 - o.stars) + '</span></div>' +
      '<div class="oc-tag">' + o.tag + '</div>' +
      '<div class="oc-desc">' + o.desc + '</div>' +
      '<div class="oc-line"><b>天赋</b>「' + trait.name + '」' + trait.desc + '</div>' +
      '<div class="oc-line"><b>主修</b>' + (tech ? tech.name + '（' + (TECH_TYPES[tech.type] || {}).name + '）' : '无（凡人）') + '</div>' +
      '<div class="oc-line"><b>初始</b>' + Object.keys(o.items || {}).map((id) => ITEMS[id].name + '×' + o.items[id]).join('、') +
      (o.artifact ? '、' + o.artifact : '') + '、灵石×' + (o.stones || 0) + '</div>' +
      '<div class="oc-go">以此身入道 →</div>';
    card.addEventListener('click', () => {
      pendingOrigin = o;
      startGame(pendingName, pendingRoot, o);
    });
    list.appendChild(card);
  });
}

function startGame(name, root, origin) {
  S = freshState(name, root, currentDiff);
  applyOrigin(origin);
  initNpcs();
  showScreen('game');
  renderHUD();
  const opening = origin ? findEvent(origin.opening) : null;
  if (opening) {
    S.used[opening.id] = 1;
    renderEvent(opening, false);
  } else {
    nextScene();
  }
  save();
}

/* ---------------- 人脉 ---------------- */
function npcRealm(n) { return subName(n.realm, n.sub || 0); }

function initNpcs() {
  S.npcs = {};
  S.npcOrder = [];
  const used = new Set();
  for (let i = 0; i < 6; i++) {
    let name;
    do {
      name = pick(NPC_SURNAMES) + pick(NPC_GIVEN);
    } while (used.has(name));
    used.add(name);
    const id = 'n' + i;
    S.npcs[id] = {
      id: id,
      name: name,
      identity: pick(NPC_IDENTITIES),
      realm: chance(0.22) ? 1 : 0,
      sub: 0,
      relation: 0,
      alive: true,
      met: i < 2,
      potential: rnd(0.18, 0.95),
      fate: [],
      last: '',
    };
    S.npcOrder.push(id);
  }
  // 出身带来的一位旧识
  const first = S.npcs[S.npcOrder[0]];
  if (first) {
    first.met = true;
    first.relation = 25;
    first.identity = S.origin === 'yaotu' ? '墨府旧仆' :
      S.origin === 'fumie' ? '同门幸存者' :
      S.origin === 'hehuan' ? '合欢宗旧识' :
      S.origin === 'jiazhu' ? '家族旁支' : '七玄门旧识';
    first.last = '与你有一面之缘。';
  }
}

function metNpcs() {
  return (S.npcOrder || []).map((id) => S.npcs[id]).filter((n) => n && n.met);
}

function relationName(v) {
  if (v >= 70) return '生死之交';
  if (v >= 40) return '挚友';
  if (v >= 15) return '好友';
  if (v > -15) return '相识';
  if (v > -40) return '有隙';
  if (v > -70) return '仇敌';
  return '宿敌';
}
function relationClass(v) {
  if (v >= 40) return 'rel-ally';
  if (v >= 15) return 'rel-friend';
  if (v > -15) return 'rel-known';
  return 'rel-enemy';
}

function npcFate(n, text) {
  n.last = text;
  n.fate.push(text);
  if (n.fate.length > 6) n.fate.shift();
}

function tickNpcs(years) {
  if (!S.npcs) return;
  (S.npcOrder || []).forEach((id) => {
    const n = S.npcs[id];
    if (!n || !n.alive) return;
    for (let y = 0; y < years; y++) {
      if (chance(n.potential * 0.09)) {
        const maxSub = subCount(n.realm);
        if (n.sub < maxSub - 1) {
          n.sub += 1;
          if (n.sub === 1) npcFate(n, '修为精进，踏入' + npcRealm(n) + '。');
        } else if (n.realm < 5) {
          if (chance(0.3 + n.potential * 0.45)) {
            n.realm += 1;
            n.sub = 0;
            npcFate(n, '破境成功，已是' + npcRealm(n) + '。');
          } else {
            npcFate(n, '冲关失败，元气大伤。');
          }
        }
      }
      if (n.realm >= 2 && chance(0.0025 + (1 - n.potential) * 0.004)) {
        n.alive = false;
        n.relation = 0;
        npcFate(n, '陨落于' + npcRealm(n) + '，死讯传到坊市时，已经过去很久了。');
        break;
      }
    }
  });
  // 在漫长的岁月里结识新的人
  const unmet = (S.npcOrder || []).filter((id) => S.npcs[id] && !S.npcs[id].met);
  if (unmet.length && chance(clamp(0.02 * years, 0.01, 0.3))) {
    const n = S.npcs[pick(unmet)];
    n.met = true;
    n.relation = 5;
    npcFate(n, '在一次坊市偶遇中与你相识。');
  }
}

function npcEvent() {
  const list = metNpcs().filter((n) => n.alive);
  if (!list.length) return null;
  const fresh = list.filter((n) => n.id !== S.lastNpc);
  const n = pick(fresh.length ? fresh : list);
  S.lastNpc = n.id;
  const rel = n.relation;
  const who = n.name + '（' + n.identity + '，' + npcRealm(n) + '）';
  const kind = rel <= -25 ? 'enemy' : (rel >= 30 ? 'friend' : (chance(0.5) ? 'help' : 'meet'));

  if (kind === 'enemy') {
    return {
      id: 'npc_e_' + n.id, realm: S.realm, title: '故怨 · ' + n.name, npc: n.id,
      text: who + '在半道上拦住了你。旧怨未消，他的眼神比从前更冷。',
      opts: [
        ['试着化解旧怨', '机', () => {
          if (chk(0.5)) { n.relation = clamp(n.relation + 25, -100, 100); addMood(4); return '你们在山道上说了很久。最后他收起了法宝，说：这一回算了。'; }
          n.relation = clamp(n.relation - 10, -100, 100); loseHp(0.15);
          return '话不投机。他出手试探了一记，你挡下了，旧怨却更深了。';
        }],
        ['既然遇上了，就分个高下', '险', () => battleWith(1.05, n.name, '你们同时祭出了法宝。')],
        ['退一步，绕道走', '稳', () => { n.relation = clamp(n.relation - 5, -100, 100); addMood(-4); return '你退了。他在身后冷笑，没有追。'; }],
      ],
    };
  }

  if (kind === 'friend') {
    return {
      id: 'npc_f_' + n.id, realm: S.realm, title: '故人 · ' + n.name, npc: n.id,
      text: who + '找上门来，带了一壶酒。他说最近得了一样东西，想分你一半。',
      opts: [
        ['与他同饮，收下东西', '稳', () => {
          n.relation = clamp(n.relation + 10, -100, 100);
          addItem(chance(0.5) ? 'heal' : 'mana', 1);
          addMood(6);
          return '你们喝到半夜。临走时他把一只玉瓶塞给你，说：别死太早。';
        }],
        ['问他最近在做什么', '机', () => {
          n.relation = clamp(n.relation + 6, -100, 100);
          gainPct(0.08); addWits(1);
          return '他说起一处新发现的灵脉，顺手把地图给了你一份。';
        }],
        ['推说有事，改日再叙', '稳', () => { n.relation = clamp(n.relation - 5, -100, 100); return '他愣了一下，把酒留下，自己走了。'; }],
      ],
    };
  }

  if (kind === 'help') {
    return {
      id: 'npc_h_' + n.id, realm: S.realm, title: '求助 · ' + n.name, npc: n.id,
      text: who + '带伤找到你，说被人追杀了三日，只求一枚疗伤丹，或者一处藏身的地方。',
      opts: [
        ['赠他一枚疗伤丹', '耗', () => {
          if (itemCount('heal') <= 0) return '你摸遍袖中，一枚疗伤丹也没有。他苦笑了一下，转身走了。';
          addItem('heal', -1);
          n.relation = clamp(n.relation + 18, -100, 100);
          addMood(5);
          return '他吞下丹药，脸色好了些。临走时他说：这份情，我记下了。';
        }, () => itemCount('heal') > 0],
        ['替他引开追兵', '险', () => {
          if (chk(0.55)) {
            n.relation = clamp(n.relation + 30, -100, 100);
            addStones(8); addMood(6);
            return '你把追兵引向另一条路，绕了半日才回来。他已经走了，留下八枚灵石和一句话。';
          }
          loseHp(0.25);
          n.relation = clamp(n.relation + 15, -100, 100);
          return '追兵比你想的难缠。你带着伤甩脱他们，回来时他已经不见了。';
        }],
        ['劝他另寻他处', '稳', () => {
          n.relation = clamp(n.relation - 12, -100, 100);
          return '你给他指了个方向，没有留他。他看了你一眼，什么也没说。';
        }],
      ],
    };
  }

  return {
    id: 'npc_m_' + n.id, realm: S.realm, title: '重逢 · ' + n.name, npc: n.id,
    text: who + '在坊市里认出了你。' + (n.last || '你们已经很久没见了。'),
    opts: [
      ['请他一顿酒，叙叙旧', '稳', () => {
        n.relation = clamp(n.relation + 8, -100, 100);
        addMood(5);
        return '你们在酒肆里坐了一个下午，说的都是这些年各自遇上的人和事。';
      }],
      ['问他愿不愿结伴同行', '机', () => {
        if (chk(0.55)) {
          n.relation = clamp(n.relation + 20, -100, 100);
          gainPct(0.1); addStones(5);
          return '他答应了。你们同行了一段路，路上遇到的事，两个人应付起来轻松得多。';
        }
        n.relation = clamp(n.relation - 3, -100, 100);
        return '他摇了摇头，说自己还有事。你们在路口分开。';
      }],
      ['点头致意，各走各路', '稳', () => { n.relation = clamp(n.relation - 3, -100, 100); return '你点了点头。他也点了点头。人群把你们隔开了。'; }],
    ],
  };
}

function renderNpcModal() {
  const met = metNpcs();
  const list = $('npc-list');
  if (!list) return;
  if (!met.length) {
    list.innerHTML = '<div class="bag-empty">你还没有结识什么人。</div>';
    return;
  }
  list.innerHTML = met.map((n) => {
    const rel = Math.round(n.relation);
    return '<div class="npc-row">' +
      '<div class="npc-main"><span class="npc-name">' + n.name + '</span>' +
      '<span class="npc-id">' + n.identity + '</span>' +
      '<span class="npc-realm">' + (n.alive ? npcRealm(n) : '已陨落') + '</span></div>' +
      '<div class="npc-side">' + (n.alive
        ? '<span class="npc-rel ' + relationClass(rel) + '">' + relationName(rel) + ' ' + (rel > 0 ? '+' : '') + rel + '</span>'
        : '<span class="npc-rel">已故</span>') + '</div>' +
      '<div class="npc-last">' + (n.last || '尚无近况。') + '</div>' +
      '</div>';
  }).join('');
}

function openNpcModal() {
  $('npc-modal').hidden = false;
  renderNpcModal();
}

/* 已得但未修的功法：一行一个，带「修炼 / 改修」按钮 */
function techListHtml() {
  const owned = (S.manuals || []).filter((id) => TECHS[id] && id !== S.mainTech);
  if (!owned.length) {
    return '<div class="bag-empty">尚未得到任何功法秘籍。<br>功法只能在奇遇、洞府、传承中寻得，且要连过三关才拿到手。</div>';
  }
  return owned.map((id) => {
    const t = TECHS[id];
    const met = meetsTechReq(id);
    const reqs = techReqMetList(id).map((r) =>
      '<span class="' + (r.ok ? 'ok' : 'bad') + '">' + r.name + ' ' + r.have + '/' + r.need + '</span>'
    ).join(' · ') || '无门槛';
    const years = techLearnYears(id);
    const pct = Math.round(techMasterChance(id) * 100);
    const tip = met
      ? '耗 ' + years + ' 年，成算约 ' + pct + '%'
      : '属性未达：' + techReqText(id);
    return '<div class="tech-row">' +
      '<span class="tech-name">' + t.name + '</span>' +
      '<span class="tech-type">' + ((TECH_TYPES[t.type] || {}).name || '') + '</span>' +
      '<span class="tech-req">' + reqs + '</span>' +
      '<button class="tech-btn" data-tech-practice="' + id + '" data-tip="' + esc(tip) + '"' +
        (met ? '' : ' disabled') + '>' + (met ? (S.mainTech ? '改修' : '修炼') : '未达') + '</button>' +
      '</div>';
  }).join('');
}

/* 从面板里修炼 / 改修 */
function doPracticeTech(id) {
  const r = practiceTech(id);
  showToast(r.msg);
  renderHUD();
  save();
  if (!$('bag-modal').hidden) renderBag();
  if ($('char-modal') && !$('char-modal').hidden) renderCharModal();
  if (S.over) showEnding();
}

function switchTech(id) { doPracticeTech(id); }

function renderCharModal() {
  const origin = ORIGINS.find((o) => o.id === S.origin);
  const tech = S.mainTech ? TECHS[S.mainTech] : null;
  const typeName = tech ? (TECH_TYPES[tech.type] || {}).name : '凡人';
  const attrs = ATTRS.map((a) => {
    const v = attr(a.key);
    return '<div class="attr-row"><span class="attr-name">' + a.name + '</span>' +
      '<div class="attr-bar"><i style="width:' + clamp(v / 30 * 100, 4, 100) + '%"></i></div>' +
      '<b>' + v + '</b></div>';
  }).join('');
  const rels = metNpcs().map((n) => n.name + '（' + relationName(Math.round(n.relation)) + '）').join('、');
  $('char-body').innerHTML =
    '<div class="char-head"><b>' + esc(S.name) + '</b><span>' + (origin ? origin.name : '散修') + '</span></div>' +
    '<div class="char-realm">' + realmLabel() + ' · ' + S.root.name + ' · ' + typeName + '</div>' +
    '<div class="char-trait"><b>天赋</b>' + (S.trait ? '「' + S.trait.name + '」' + S.trait.desc : '无') + '</div>' +
    '<div class="char-sec"><div class="char-title">属性</div>' + attrs + '</div>' +
    '<div class="char-sec"><div class="char-title">主修功法</div>' +
      (tech ? '<div class="char-tech"><b>' + tech.name + '</b><span>' + (TECH_TYPES[tech.type] || {}).name + ' · ' + tech.role + '</span>' +
        '<em>要求：' + techReqText(S.mainTech) + '</em><p>' + tech.desc + '</p></div>' : '<div class="bag-empty">尚未修习任何功法。</div>') +
    '</div>' +
    '<div class="char-sec"><div class="char-title">已 得 功 法（' + (S.manuals || []).length + ' 门）</div>' +
      '<div class="tech-list">' + techListHtml() + '</div></div>' +
    '<div class="char-sec"><div class="char-title">道途</div>' +
      '<div class="char-line">寿元：' + Math.max(0, S.life - S.age) + ' / ' + S.life + '　心境：' + Math.round(S.mood) + '</div>' +
      '<div class="char-line">气血：' + Math.round(S.hp) + ' / ' + maxHp() + '　法力：' + Math.round(S.mp) + ' / ' + maxMp() + '</div>' +
      '<div class="char-line">人脉：' + (rels || '尚无') + '</div>' +
    '</div>';
}

function openCharModal() {
  $('char-modal').hidden = false;
  renderCharModal();
}
function resetToTitle() {
  clearSave();
  S = null;
  pendingRoot = null;
  pendingOrigin = null;
  rerolled = false;
  $('title-start').hidden = false;
  $('root-panel').hidden = true;
  if ($('origin-panel')) $('origin-panel').hidden = true;
  $('screen-title').classList.remove('choosing');
  $('btn-continue').hidden = !loadSave();
  showScreen('title');
}

let currentDiff = 1;

/* ---------------- 绑定 ---------------- */
function bindUI() {
  $('btn-roll').addEventListener('click', () => {
    pendingName = $('input-name').value.trim().slice(0, 8);
    pendingRoot = rollRoot();
    rerolled = false;
    showRootPanel();
  });
  $('input-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btn-roll').click();
  });
  $('btn-reroll').addEventListener('click', () => {
    if (rerolled) return;
    rerolled = true;
    pendingRoot = rollRoot();
    showRootPanel();
  });
  $('btn-enter').addEventListener('click', () => {
    if (!pendingRoot) pendingRoot = rollRoot();
    showOriginPanel();
  });
  $('btn-origin-back').addEventListener('click', () => {
    $('origin-panel').hidden = true;
    $('root-panel').hidden = false;
    $('screen-title').classList.remove('choosing');
  });
  $('btn-continue').addEventListener('click', () => {
    const data = loadSave();
    if (!data) return;
    S = data;
    currentDiff = S.diff || 1;
    if (!S.npcOrder || !S.npcOrder.length) initNpcs();
    showScreen('game');
    renderHUD();
    if (S.phase === 'battle' && S.battle) { renderBattle(); return; }
    const e = findEvent(S.eventId);
    if (e) renderEvent(e, S.phase === 'result');
    else nextScene();
  });
  $('btn-next').addEventListener('click', () => {
    if (!S) return;
    if (S.over) showEnding();
    else nextScene();
  });
  $('btn-restart').addEventListener('click', resetToTitle);

  // 难度选择
  document.querySelectorAll('[data-diff]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentDiff = parseInt(btn.dataset.diff, 10) || 0;
      document.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('on', b === btn));
      const tip = $('diff-tip');
      if (tip) tip.textContent = DIFFS[currentDiff].desc;
    });
  });

  $('btn-bag').addEventListener('click', () => { openBag(); });
  $('btn-bag-close').addEventListener('click', closeBag);
  $('btn-char').addEventListener('click', openCharModal);
  $('btn-npc').addEventListener('click', openNpcModal);
  $('btn-char-close').addEventListener('click', () => { $('char-modal').hidden = true; });
  $('btn-npc-close').addEventListener('click', () => { $('npc-modal').hidden = true; });
  $('char-modal').addEventListener('click', (e) => { if (e.target === $('char-modal')) $('char-modal').hidden = true; });
  $('char-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tech-practice]');
    if (b && !b.disabled) doPracticeTech(b.dataset.techPractice);
  });
  // 储物袋里的「修炼 / 改修」
  if ($('bag-techs')) {
    $('bag-techs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tech-practice]');
      if (b && !b.disabled) doPracticeTech(b.dataset.techPractice);
    });
  }
  $('npc-modal').addEventListener('click', (e) => { if (e.target === $('npc-modal')) $('npc-modal').hidden = true; });
  $('btn-export').addEventListener('click', async () => {
    const r = exportSave();
    if (!r.ok) { showToast(r.msg); return; }
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(r.code);
        copied = true;
      }
    } catch (err) { copied = false; }
    if (!copied) window.prompt('复制下面的存档码，粘贴到新设备：', r.code);
    showToast(copied ? '存档码已复制到剪贴板' : r.msg);
  });
  $('btn-import').addEventListener('click', openImportDialog);
  $('bag-modal').addEventListener('click', (e) => {
    if (e.target === $('bag-modal')) closeBag();
  });

  document.querySelectorAll('#battle-actions button').forEach((btn) => {
    btn.addEventListener('click', () => battleActionUI(btn.dataset.act));
  });

  // 技能面板委托
  $('skill-panel').addEventListener('click', (ev2) => {
    const t = ev2.target.closest('button');
    if (!t || t.disabled) return;
    if (t.dataset.spell) { battleActionUI('spell-cast', t.dataset.spell); return; }
    if (t.dataset.artspell) { battleActionUI('art-cast', t.dataset.artspell); return; }
    if (t.dataset.plainart) { battleActionUI('art-plain'); return; }
  });

  document.addEventListener('keydown', (e) => {
    if (!S || $('screen-game').hidden) return;
    if (e.key === 'Escape') {
      closeBag();
      if ($('char-modal')) $('char-modal').hidden = true;
      if ($('npc-modal')) $('npc-modal').hidden = true;
      panelMode = null;
      if (S.battle) renderBattle();
      return;
    }
    if (e.key === 'c' || e.key === 'C') { openCharModal(); return; }
    if (e.key === 'n' || e.key === 'N') { openNpcModal(); return; }
    if (e.key === 'b' || e.key === 'B') {
      if (!$('bag-modal').hidden) closeBag();
      else openBag();
      return;
    }
    if (!$('bag-modal').hidden) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      const r = exportSave();
      showToast(r.msg);
      if (r.ok) window.prompt('存档码（复制到新设备导入）：', r.code);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
      e.preventDefault();
      openImportDialog();
      return;
    }
    if (S.phase === 'battle' && S.battle) {
      const n = parseInt(e.key, 10);
      const acts = ['attack', 'spell', 'art', 'item', 'flee'];
      if (n >= 1 && n <= 5) battleActionUI(acts[n - 1]);
      return;
    }
    if (S.phase === 'event') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) {
        const btns = document.querySelectorAll('#scene-options .opt');
        const b = btns[n - 1];
        if (b && !b.disabled) b.click();
      }
    }
    if (S.phase === 'result' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      $('btn-next').click();
    }
  });
}

/* 扩展 battleActionUI 处理具体施法（已内联于 battleActionUI） */

/* =============================================================
   模拟（调试用）
   ============================================================= */
function simulate(games, mode, rootIdx, diff) {
  const res = { ascend: 0, old: 0, dead: 0, demon: 0, timeout: 0, err: 0, turns: [], ages: [], realms: [], breakAges: {} };
  for (let i = 0; i < games; i++) {
    try {
      S = freshState('试', ROOTS[typeof rootIdx === 'number' ? rootIdx : 4], diff);
      let guard = 0;
      while (!S.over && guard++ < 1200) {
        const e = drawEvent();
        const opts = e.opts.filter((o) => !o[3] || o[3]());
        if (!opts.length) break;
        let o;
        if (e.brk) {
          // 遇到冲关：谨慎策略也会尝试，有丹药就用药
          o = opts.find((x) => x[1] === '耗') || opts[0];
        } else if (mode === 'greedy') {
          const order = ['险', '机', '稳', '耗'];
          o = opts.slice().sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]))[0];
        } else if (mode === 'safe') {
          const order = ['稳', '机', '耗', '险'];
          o = opts.slice().sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]))[0];
        } else {
          o = opts[Math.floor(Math.random() * opts.length)];
        }
        applyOption(o);
        // 有秘籍就找机会修炼/改修（真实玩家也会这么做）
        if (!S.over && S.manuals && S.manuals.length) {
          const cand = S.manuals.filter((id) => !hasTech(id) && meetsTechReq(id));
          if (cand.length && (!S.mainTech || chance(0.3))) practiceTech(pick(cand));
        }
        let bg = 0;
        while (S.battle && !S.over && bg++ < 120) {
          const acts = ['attack'];
          const spells = knownSpells().filter((id) => spellReady(id).ok);
          if (spells.length && chance(0.6)) acts.push('spell');
          if (S.hp < maxHp() * 0.4 && itemCount('heal') > 0) acts.push('item');
          const act = pick(acts);
          if (act === 'item') battleAct('item', 'heal');
          else if (act === 'spell') battleAct('spell', pick(spells));
          else battleAct('attack');
        }
        if (S.battle) endBattle('战斗拖延过久。');
      }
      if (!S.over) S.over = 'timeout';
      res[S.over] = (res[S.over] || 0) + 1;
      res.turns.push(S.turn);
      res.ages.push(S.age);
      res.realms.push(S.realm);
      Object.keys(S.breakAges || {}).forEach((k) => {
        const a = S.breakAges[k];
        if (typeof a !== 'number') return;
        if (!res.breakAges[k]) res.breakAges[k] = { sum: 0, n: 0 };
        res.breakAges[k].sum += a;
        res.breakAges[k].n += 1;
      });
    } catch (err) {
      res.err += 1;
      if (res.err === 1) console.error(err);
    }
  }
  return res;
}
function avg(a) { return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0; }

function runSim(n) {
  let out = '模拟 ' + n + ' 局（四灵根 / 随机·激进·保守 · 寻常难度）\n';
  ['random', 'greedy', 'safe'].forEach((mode) => {
    const r = simulate(n, mode, 4, 1);
    out += '\n[' + mode + '] 飞升 ' + (r.ascend || 0) + ' / 老死 ' + (r.old || 0) + ' / 身死 ' + (r.dead || 0) +
      ' / 入魔 ' + (r.demon || 0) + ' / 超时 ' + (r.timeout || 0) + ' / 异常 ' + r.err +
      ' | 平均幕数 ' + avg(r.turns) + ' | 平均寿数 ' + avg(r.ages) +
      ' | 平均境界 ' + avg(r.realms) + '\n';
    const ba = [];
    [1, 2, 3, 4, 5].forEach((k) => {
      const v = r.breakAges[k];
      if (v && v.n) ba.push(REALMS[k].name + ' ' + Math.round(v.sum / v.n) + '岁(' + v.n + '人)');
    });
    if (ba.length) out += '    首次突破年龄：' + ba.join(' / ') + '\n';
  });
  const pre = document.createElement('pre');
  pre.id = 'simout';
  pre.textContent = out;
  document.body.innerHTML = '';
  document.body.appendChild(pre);
}

/* ---------------- 启动 ---------------- */
function init() {
  bindUI();
  const params = new URLSearchParams(location.search);
  if (params.has('static')) {
    const st = document.createElement('style');
    st.textContent = '*{animation:none!important;transition:none!important}';
    document.head.appendChild(st);
  }
  if (params.has('sim')) {
    runSim(clamp(parseInt(params.get('sim'), 10) || 100, 1, 2000));
    return;
  }
  const saved = loadSave();
  $('btn-continue').hidden = !saved;
  if (params.has('demo')) {
    S = freshState('无名', ROOTS[3], 1);
    S.techs = ['lingjian'];
    S.mainTech = 'lingjian';
    S.manuals = ['lingjian', 'qingyuan', 'xuanyin', 'dayan'];
    S.attrs = { wits: 9, body: 6, str: 6, agi: 7, spirit: 8, mind: 6 };
    S.origin = 'fumie';
    S.trait = ORIGINS[1].trait;
    S.artifacts = ['青元剑', '定海珠', '紫电锥'];
    S.realm = 2;
    S.sub = 1;
    S.life = REALMS[2].life;
    S.hp = maxHp();
    S.mp = maxMp();
    S.age = 46;
    S.progress = 120;
    initNpcs();
    showScreen('game');
    renderHUD();
    if (params.get('demo') === 'battle') {
      startBattle(makeEnemy(1.2, null, {}), '妖风自林间卷出。');
      renderBattle();
    } else if (params.get('demo') === 'play') {
      pendingName = '沈青';
      pendingRoot = ROOTS[2];
      startGame('沈青', ROOTS[2], ORIGINS[0]);
    } else if (params.get('demo') === 'skills') {
      startBattle(makeEnemy(1.2, null, {}), '妖风自林间卷出。');
      panelMode = 'spell';
      renderBattle();
    } else if (params.get('demo') === 'art') {
      startBattle(makeEnemy(1.4, null, {}), '强敌拦路。');
      panelMode = 'art';
      renderBattle();
    } else if (params.get('demo') === 'fanren') {
      // 凡人阶段：练过长春功，但经脉未开，法术不可用
      S.realm = 0; S.sub = 0; S.life = REALMS[0].life; S.age = 17; S.progress = 20;
      S.mainTech = 'changchun'; S.techs = ['changchun']; S.manuals = ['changchun'];
      S.hp = maxHp(); S.mp = maxMp();
      renderHUD();
      startBattle(makeEnemy(1.0, null, {}), '一个悍匪拦住了去路。');
      panelMode = 'spell';
      renderBattle();
    } else if (params.get('demo') === 'chain') {
      S.realm = 2; S.sub = 1; S.life = REALMS[2].life; S.age = 47; S.stones = 80;
      S.attrs = { wits: 8, body: 7, str: 6, agi: 6, spirit: 8, mind: 7 }; S.wits = 8;
      S.manuals = ['lingjian'];
      S.hp = maxHp(); S.mp = maxMp();
      startManualChain('xuanyin');
      renderEvent(chainEvent(), false);
    } else if (params.get('demo') === 'bag') {
      openBag();
      renderHUD();
    } else if (params.get('demo') === 'char') {
      openCharModal();
    } else if (params.get('demo') === 'npc') {
      S.npcs[S.npcOrder[0]].relation = 62;
      S.npcs[S.npcOrder[1]].relation = -38;
      S.npcs[S.npcOrder[1]].alive = false;
      openNpcModal();
    } else if (params.get('demo') === 'origin') {
      pendingRoot = ROOTS[2];
      pendingName = '沈青';
      showScreen('title');
      showOriginPanel();
    } else if (params.get('demo') === 'title') {
      pendingRoot = ROOTS[2];
      showScreen('title');
      showRootPanel();
    } else {
      nextScene();
    }
    return;
  }
}

init();
