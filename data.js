'use strict';
/* =============================================================
   凡人修仙传 · 寿元 —— 数据层
   境界 / 灵根 / 难度 / 功法 / 法术 / 法宝 / 妖魔 / 冲关
   ============================================================= */

/* ---------------- 基础工具 ---------------- */
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function cn(n) {
  if (n < 0) return '负' + cn(-n);
  if (n < 10) return CN[n];
  if (n < 20) return '十' + (n % 10 ? CN[n % 10] : '');
  if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  if (n < 1000) {
    const h = Math.floor(n / 100), r = n % 100;
    if (!r) return CN[h] + '百';
    return CN[h] + '百' + (r < 10 ? '零' + CN[r] : cn(r));
  }
  if (n < 10000) {
    const t = Math.floor(n / 1000), r = n % 1000;
    if (!r) return CN[t] + '千';
    return CN[t] + '千' + (r < 10 ? '零' + CN[r] : r < 100 ? '零' + cn(r) : cn(r));
  }
  return String(n);
}
const NUM_CN = ['一', '二', '三', '四'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const chance = (p) => Math.random() < p;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = r[i]; r[i] = r[j]; r[j] = t;
  }
  return r;
}

/* ---------------- 境界 ---------------- */
/* life 为该境界的寿元上限；need 为突破所需修为；gain 为每年基础打坐所得占比 */
const REALMS = [
  { name: '凡人',   phase: '红尘',     life: 90,   need: 70,   hp: 90,    mp: 14,    atk: 14,   def: 2,   bb: 0.62 },
  { name: '炼气期', phase: '引气入体', life: 120,  need: 150,  hp: 260,   mp: 90,    atk: 42,   def: 8,   bb: 0.50 },
  { name: '筑基期', phase: '筑就道基', life: 200,  need: 260,  hp: 760,   mp: 360,   atk: 116,  def: 26,  bb: 0.40 },
  { name: '金丹期', phase: '结成金丹', life: 500,  need: 420,  hp: 2100,  mp: 1200,  atk: 300,  def: 70,  bb: 0.32 },
  { name: '元婴期', phase: '元婴出窍', life: 1000, need: 640,  hp: 5200,  mp: 3200,  atk: 760,  def: 180, bb: 0.20 },
  { name: '化神期', phase: '神游太虚', life: 2000, need: 900,  hp: 13000, mp: 8600,  atk: 1900, def: 460, bb: 0.30 },
];

/* 每个境界中，一次普通抉择默认耗去的年数（真实寿元节奏） */
const YEAR_COST = [1, 2, 7, 20, 55];

/* ---------------- 灵根 ---------------- */
const ROOTS = [
  { name: '天灵根', stars: 5, mult: 1.00, elem: '天', bb: 0.10, wits: 3, mood: 0, weight: 1, cost: 0.90,
    desc: '单一属性，万中无一。灵气入体如百川归海，旁人苦修一日，抵不过你一个时辰。诸般功法一学便会。' },
  { name: '变异雷灵根', stars: 5, mult: 0.82, elem: '雷', bb: 0.08, wits: 2, mood: 0, weight: 4, cost: 0.82,
    desc: '雷光缠身，攻伐无双。雷系法术损耗大减。天资绝顶，却也为正道所忌，世人既羡且惧。' },
  { name: '双灵根', stars: 4, mult: 0.55, elem: null, bb: 0.06, wits: 1, mood: 0, weight: 12, cost: 0.95,
    desc: '两系相济，资质上佳，足以叩开大宗门墙。放在任何一处，都是要被人抢的弟子。' },
  { name: '三灵根', stars: 3, mult: 0.35, elem: null, bb: 0.03, wits: 0, mood: 0, weight: 30, cost: 1.00,
    desc: '资质平平。可修仙一途，心性有时比灵根更重要——这话你听人说过很多次。' },
  { name: '四灵根', stars: 2, mult: 0.20, elem: null, bb: 0.00, wits: 0, mood: 6, weight: 34, cost: 1.05,
    desc: '杂而不纯，世人称之为伪灵根。你从小就听惯了这句话，也从小就不服。' },
  { name: '五灵根', stars: 1, mult: 0.10, elem: null, bb: 0.00, wits: 0, mood: 12, weight: 20, cost: 1.12,
    desc: '五行俱全，修行奇慢，所得修为仅天灵根十分之一。可五行俱全，也意味着什么都能学。' },
];

/* ---------------- 难度 ---------------- */
const DIFFS = [
  { name: '顺遂', desc: '天意眷顾。判定易成，妖魔气弱，另赐一枚还魂丹。', check: -0.14, enemy: 0.75, el: 0.07 },
  { name: '寻常', desc: '修仙本艰。成算与凶险皆如常理。', check: 0.00, enemy: 1.00, el: 0.16 },
  { name: '艰险', desc: '步步杀机。判定艰难，妖魔强悍，稍有不慎即身死道消。', check: 0.11, enemy: 1.20, el: 0.22 },
];

/* ---------------- 物品 ---------------- */
const ITEMS = {
  heal:   { name: '回春丹', desc: '恢复四成气血', short: '回春' },
  mana:   { name: '聚灵丹', desc: '恢复四成法力', short: '聚灵' },
  break:  { name: '破障丹', desc: '冲关时服下，成功率 +16%', short: '破障' },
  escape: { name: '遁地符', desc: '战斗中必定脱身', short: '遁地' },
  revive: { name: '还魂丹', desc: '战败时自动保命，恢复三成气血', short: '还魂' },
  marrow: { name: '洗髓丹', desc: '洗炼灵根，提升一阶（最高天灵根）', short: '洗髓' },
  calm:   { name: '凝神丹', desc: '争斗中驱散心魔侵扰，心境 +8', short: '凝神' },
};

/* ---------------- 法宝 ----------------
   atk/def/hp/mp/cult/crit/lifesteal/flee/mood 为数值
   fx 为特殊效果：
     shieldStart 开局护盾（占上限比例）
     dmgReduce   受到伤害减免
     spellPower  法术伤害加成
     healOnKill  斩杀后回血比例
     execute     敌方气血低于此比例时伤害翻倍
     manaRegen   每回合回复法力（占上限比例）
     thorns      反弹伤害比例
     firstStrike 开战先手一击
     synergy     与某功法同修时额外加成
     active      可主动祭出的法术 id
------------------------------------------------ */
const ARTS = {
  '青元剑':   { atk: 26, fx: { synergy: 'qingyuan', synergyAtk: 0.18 }, desc: '攻击 +26。修成青元剑诀者，剑上更添三分剑芒。' },
  '雷击木剑': { atk: 34, crit: 0.10, fx: { spellPower: 0.10 }, desc: '攻击 +34，暴击 +10%，法术伤害 +10%。' },
  '白玉簪':   { cult: 0.08, mp: 40, desc: '修炼所得 +8%，法力 +40。掩月宗的信物。' },
  '玄铁令牌': { def: 12, hp: 90, fx: { dmgReduce: 0.05 }, desc: '防御 +12，气血 +90，受伤减免 5%。' },
  '定海珠':   { hp: 180, mp: 80, fx: { shieldStart: 0.18 }, desc: '气血 +180，法力 +80。开战时自动凝成护罩。' },
  '虚天鼎影': { atk: 38, cult: 0.12, fx: { dmgReduce: 0.10 }, desc: '攻击 +38，修炼 +12%，受伤减免 10%。重得像一座山。' },
  '老怪遗宝': { atk: 46, crit: 0.08, fx: { execute: 0.22 }, desc: '攻击 +46，暴击 +8%。敌人气血低于两成时伤害翻倍。' },
  '界外残片': { mp: 150, cult: 0.15, fx: { spellPower: 0.18 }, desc: '法力 +150，修炼 +15%，法术伤害 +18%。' },
  '上古兽骨': { hp: 110, def: 8, fx: { thorns: 0.10 }, desc: '气血 +110，防御 +8。受击时反弹一成伤害。' },
  '赤蛟鳞':   { def: 16, hp: 120, fx: { dmgReduce: 0.07 }, desc: '防御 +16，气血 +120，受伤减免 7%。' },
  '噬魂幡':   { atk: 28, lifesteal: 0.14, fx: { healOnKill: 0.20, active: 'shihun' }, desc: '攻击 +28，吸血 14%，斩杀后回血两成。可祭出幡中阴魂。' },
  '紫电锥':   { atk: 42, crit: 0.08, fx: { active: 'zidianzhui' }, desc: '攻击 +42，暴击 +8%。可祭出紫电一击。' },
  '护心镜':   { hp: 200, def: 10, fx: { active: 'huxin' }, desc: '气血 +200，防御 +10。危急时可凝一面护心光镜。' },
  '聚灵珠':   { mp: 120, cult: 0.06, fx: { manaRegen: 0.05 }, desc: '法力 +120，修炼 +6%，每回合回复 5% 法力。' },
  '遁光梭':   { flee: 0.18, fx: { firstStrike: 0.8 }, desc: '遁走 +18%。开战先发一击。' },
  '养魂木':   { mood: 2, hp: 60, fx: { calm: true }, desc: '每年心境 +2，气血 +60。心魔难侵。' },
  '幽冥鬼火': { atk: 30, mp: 60, fx: { active: 'guihuo', spellPower: 0.12 }, desc: '攻击 +30，法术 +12%。可祭出鬼火灼魂。' },
  '太乙玉简': { cult: 0.10, wits: 1, fx: { active: 'wudao' }, desc: '修炼 +10%，悟性 +1。可借玉简参悟，短暂通明。' },
};
let ART_KEYS = Object.keys(ARTS);

/* ---------------- 功法 ----------------
   passive: 常驻加成（cult 为比例，其余为数值）
   spells : 可修习的法术
------------------------------------------------ */
const TECHS = {
  changchun: {
    name: '长春功', tier: 1, elem: '木',
    desc: '木属性养生功法。不求攻伐，只求活得久一些。墨大夫压箱底的残卷。',
    passive: { cult: 0.06, life: 0 },
    spells: ['huichun', 'muling'],
  },
  lingjian: {
    name: '灵剑诀', tier: 1, elem: '剑',
    desc: '剑修入门。以气御剑，一剑既出，先声夺人。',
    passive: { atk: 8, crit: 0.03 },
    spells: ['jianqi', 'yujian'],
  },
  luoyan: {
    name: '罗烟步', tier: 1, elem: '身法',
    desc: '轻身功夫。身如罗烟，来去无痕，最擅保命。',
    passive: { flee: 0.12, def: 4 },
    spells: ['luoyanshen', 'jifeng'],
  },
  yuling: {
    name: '御灵术', tier: 1, elem: '御兽',
    desc: '驱虫驭兽之法。灵虫虽小，噬人骨髓；灵兽虽愚，可挡一刀。',
    passive: { mp: 30, cult: 0.04 },
    spells: ['lingchong', 'yishou'],
  },
  qingyuan: {
    name: '青元剑诀', tier: 2, elem: '剑',
    desc: '上乘剑诀。练至深处，剑光可分化万千，一剑破万法。',
    passive: { atk: 22, crit: 0.06 },
    spells: ['qingmang', 'jianguang', 'wanjian'],
  },
  xuanyin: {
    name: '玄阴经', tier: 2, elem: '魔',
    desc: '玄骨上人所留魔功。阴气蚀骨，血光缠身，伤人亦伤己。',
    passive: { atk: 18, lifesteal: 0.10 },
    spells: ['yinmo', 'xuemodun', 'xuanyinzhua'],
  },
  dayan: {
    name: '大衍诀', tier: 2, elem: '神识',
    desc: '大衍神君的神识功法。修的是神魂，非肉身。神念一动，千里可察。',
    passive: { mp: 110, wits: 1, cult: 0.10 },
    spells: ['jingshen', 'fenshen', 'dayanguang'],
  },
  wulei: {
    name: '五雷正法', tier: 3, elem: '雷',
    desc: '正一道雷法。五雷齐落，专克妖魔鬼祟。',
    passive: { atk: 38, crit: 0.05 },
    spells: ['bixie', 'zidian', 'tianlei'],
  },
  yuanci: {
    name: '元磁神光', tier: 3, elem: '磁',
    desc: '极北神通。借元磁之力束人、护己、反震来敌。',
    passive: { def: 20, dmgReduce: 0.05 },
    spells: ['ciguang', 'yuancishu'],
  },
  tuotian: {
    name: '托天魔功', tier: 3, elem: '魔',
    desc: '魔道炼体功法。以魔气淬骨，皮糙肉厚，悍不畏死。',
    passive: { hp: 380, atk: 26 },
    spells: ['mohua', 'tianmojieti'],
  },
  jingang: {
    name: '金刚诀', tier: 3, elem: '佛',
    desc: '佛门护法之功。金刚不坏，明王镇魔。',
    passive: { def: 28, hp: 320 },
    spells: ['jingangbuhuai', 'mingwang'],
  },
  huaxue: {
    name: '化血神光', tier: 4, elem: '血',
    desc: '血道秘术。以血为引，以命换命。修此功者，多半不得善终。',
    passive: { mp: 180, lifesteal: 0.15 },
    spells: ['xuedun', 'huaxue'],
  },
};

/* =============================================================
   v5 扩展：属性、功法流派与学习要求、出身、NPC
   ============================================================= */

/* ---------------- 属性 ---------------- */
const ATTRS = [
  { key: 'wits',   name: '悟性', desc: '参悟功法、突破瓶颈。决定修炼速度与功法门槛。' },
  { key: 'body',   name: '根骨', desc: '气血厚薄与肉身强度。体修的根本。' },
  { key: 'str',    name: '力量', desc: '出剑与肉搏的伤害。剑修、体修所重。' },
  { key: 'agi',    name: '身法', desc: '闪避、遁走与出手先后。' },
  { key: 'spirit', name: '神识', desc: '法力深浅与法术威力。法修、魔修所重。' },
  { key: 'mind',   name: '心性', desc: '心境稳固，抗心魔，冲关时不易失手。' },
];
const ATTR_KEYS = ATTRS.map((a) => a.key);
function attrName(k) { const a = ATTRS.find((x) => x.key === k); return a ? a.name : k; }

/* ---------------- 功法流派 ---------------- */
const TECH_TYPES = {
  '剑': { name: '剑修', desc: '以剑入道，攻伐凌厉，身法轻捷。' },
  '体': { name: '体修', desc: '炼皮锻骨，气血如炉，近身无敌。' },
  '法': { name: '法修', desc: '吞吐天地灵气，法术恢弘，变化万端。' },
  '魔': { name: '魔修', desc: '以杀伐、血煞、神魂入道，进境极快，反噬亦重。' },
  '妖': { name: '妖修', desc: '驭兽、化形、吞月炼体，寿元绵长。' },
  '佛': { name: '佛修', desc: '金刚护体，明王镇魔，最克阴邪。' },
};

/* 流派战斗风格：数值为比例加成 */
const TYPE_STYLE = {
  '剑': { crit: 0.06, first: 0.25, name: '剑修', desc: '剑走轻灵，先手更利，暴击更高。' },
  '体': { hp: 0.12, def: 0.10, dmgReduce: 0.04, name: '体修', desc: '皮糙肉厚，气血与防御更高。' },
  '法': { spellCost: 0.85, spellPower: 0.12, name: '法修', desc: '法术消耗更低，威力更高。' },
  '魔': { lifesteal: 0.08, atk: 0.05, name: '魔修', desc: '攻击吸血，但每战心境略损。' },
  '妖': { poison: 0.05, flee: 0.05, name: '妖修', desc: '攻击附带毒伤，身法更灵活。' },
  '佛': { dmgReduce: 0.06, heal: 0.10, name: '佛修', desc: '受伤减免，疗伤效果更好。' },
};
const TECH_META = {
  changchun: { type: '法', req: {}, role: '养生续航' },
  lingjian:  { type: '剑', req: { wits: 5 }, role: '入门剑修' },
  luoyan:    { type: '体', req: { agi: 6 }, role: '身法保命' },
  yuling:    { type: '妖', req: { spirit: 5 }, role: '驱虫驭兽' },
  qingyuan:  { type: '剑', req: { wits: 7, str: 6 }, role: '上乘剑诀' },
  xuanyin:   { type: '魔', req: { spirit: 6, mind: 4 }, role: '阴煞魔功' },
  dayan:     { type: '法', req: { spirit: 8, wits: 8 }, role: '神识法门' },
  wulei:     { type: '法', req: { spirit: 10, wits: 9 }, role: '雷法正宗' },
  yuanci:    { type: '法', req: { body: 8, spirit: 8 }, role: '元磁神通' },
  tuotian:   { type: '体', req: { body: 10, str: 10 }, role: '魔道炼体' },
  jingang:   { type: '体', req: { body: 9, mind: 8 }, role: '佛门护法' },
  huaxue:    { type: '魔', req: { body: 7, spirit: 7 }, role: '血道秘术' },
};
Object.keys(TECH_META).forEach((id) => {
  if (TECHS[id]) Object.assign(TECHS[id], TECH_META[id]);
});

/* 新增功法：每个流派两到三门，修习后自带对应法术 */
Object.assign(TECHS, {
  hanxin: {
    name: '寒玉心法', tier: 2, elem: '冰', type: '法', req: { wits: 6, spirit: 6 },
    role: '寒系法修',
    desc: '小家族传下的残缺寒系心法。运功时心口如抱一块寒玉，最适合心性稳的人。',
    passive: { mp: 90, cult: 0.08, dmgReduce: 0.04 },
    spells: ['muling', 'huichun'],
  },
  wuxiang: {
    name: '无相剑典', tier: 3, elem: '剑', type: '剑', req: { wits: 9, agi: 9 },
    role: '快剑',
    desc: '无相无我，剑出无痕。修此剑者，先要学会忘掉自己的手。',
    passive: { atk: 34, crit: 0.10, flee: 0.05 },
    spells: ['jianqi', 'yujian', 'qingmang'],
  },
  wanjianjue: {
    name: '万剑诀', tier: 4, elem: '剑', type: '剑', req: { wits: 12, str: 10, agi: 10 },
    role: '剑道宗师',
    desc: '一剑化万剑，万剑归一元。越国剑修梦寐以求的绝学。',
    passive: { atk: 58, crit: 0.08 },
    spells: ['qingmang', 'wanjian', 'jianguang'],
  },
  manhuang: {
    name: '蛮荒炼体诀', tier: 4, elem: '体', type: '体', req: { body: 12, str: 12 },
    role: '肉身成圣',
    desc: '以蛮荒妖兽之血淬体，皮肉如铁，筋骨如钢。不靠法宝，只靠一双拳头。',
    passive: { hp: 900, atk: 40, def: 30 },
    spells: ['jingangbuhuai', 'mingwang'],
  },
  taishang: {
    name: '太上玄门功', tier: 4, elem: '法', type: '法', req: { wits: 10, spirit: 12 },
    role: '玄门正宗',
    desc: '玄门正传。以神识御法，法力浑厚，最擅久战。',
    passive: { mp: 300, cult: 0.15, spellPower: 0.15 },
    spells: ['dayanguang', 'jingshen', 'tianlei'],
  },
  tianmoce: {
    name: '天魔策', tier: 4, elem: '魔', type: '魔', req: { spirit: 10, mind: 6 },
    role: '魔道巨擘',
    desc: '魔道至高心法之一。修的是心魔，喂的是杀孽。',
    passive: { atk: 50, lifesteal: 0.12, spellPower: 0.10 },
    spells: ['yinmo', 'mohua', 'xuanyinzhua'],
  },
  wanyao: {
    name: '万妖化形诀', tier: 4, elem: '妖', type: '妖', req: { body: 10, spirit: 8 },
    role: '化形妖修',
    desc: '观万妖之形，炼自身之骨。修到深处，人身亦可化妖。',
    passive: { hp: 500, atk: 35, flee: 0.08 },
    spells: ['yishou', 'lingchong'],
  },
  tunyue: {
    name: '吞月妖典', tier: 3, elem: '妖', type: '妖', req: { body: 8, spirit: 8 },
    role: '吞月炼体',
    desc: '月圆之夜吞吐月华，以妖力洗髓。寿元绵长，进境缓慢。',
    passive: { hp: 400, cult: 0.08, mood: 2 },
    spells: ['lingchong', 'yishou'],
  },
  wuxing: {
    name: '五行混沌诀', tier: 5, elem: '五行', type: '法', req: { wits: 10, body: 9, spirit: 10 },
    role: '五灵根专属',
    desc: '五灵根者以五行俱全之身，逆行五行、混沌归一。旁人练一门便够，你五门同修，五气朝元。',
    passive: { hp: 320, mp: 320, atk: 44, cult: 0.22, spellPower: 0.25, dmgReduce: 0.06 },
    spells: ['dayanguang', 'tianlei', 'wanjian'],
  },
});

/* ---------------- 功法来历（传承链事件用） ----------------
   place 传承之地，relic 秘籍形态，ward 拦路的东西，trial 参悟时的难关
------------------------------------------------ */
const TECH_LORE = {
  changchun: { place: '墨府后山的旧药庐', relic: '一册被药汁浸透的残卷', ward: '药炉余烬里埋着半道禁制', trial: '药气与灵气纠缠，一不留神便会走岔' },
  lingjian:  { place: '后山剑冢', relic: '一块刻着剑诀的断碑', ward: '碑下压着几柄生锈的断剑', trial: '剑意太锐，参悟时如有利刃刮骨' },
  luoyan:    { place: '雨巷尽头的破庙', relic: '一片写满小字的油布', ward: '庙檐下系着一串无风自响的铜铃', trial: '口诀极简，难的是把身子放轻' },
  yuling:    { place: '灵虫谷深处的虫巢', relic: '一只白玉虫篓', ward: '巢口垂着黏腻的丝', trial: '灵虫在耳边嗡嗡作响，心神难定' },
  qingyuan:  { place: '无名山谷的青元剑冢', relic: '石壁上的一篇剑诀', ward: '冢中剑气未散', trial: '剑诀分九层，越往后越像在自伤' },
  xuanyin:   { place: '山腹深处的玄阴洞', relic: '刻满扭曲经文的黑冰壁', ward: '黑冰上结着终年不化的霜', trial: '阴气逆行，稍有不慎便冻成一具冰尸' },
  dayan:     { place: '藏经阁顶层', relic: '一卷没有封皮的手札', ward: '阁楼里只有一盏不灭的灯', trial: '神识推演如坠迷宫，越算越乱' },
  wulei:     { place: '被雷劈开的古观', relic: '焦柱上以剑刻的雷法', ward: '梁柱间还残留着雷意', trial: '雷意入体，经脉如被火烧' },
  yuanci:    { place: '极北的元磁石林', relic: '一块天然成纹的磁石', ward: '神光如河，自天而降', trial: '元磁之力撕扯血肉，站都站不稳' },
  tuotian:   { place: '老魔盘踞的山洞', relic: '石壁上以血画的炼体图', ward: '洞口堆着妖兽的白骨', trial: '要挨得住那种把骨头敲碎重接的痛' },
  jingang:   { place: '荒山里的金刚寺', relic: '佛像掌心的一卷经文', ward: '檐角铜铃无风自响', trial: '佛号入耳，心里的杀念全被翻了出来' },
  huaxue:    { place: '上古血海秘窟', relic: '血玉台上的一篇血书', ward: '血海没膝，腥气冲天', trial: '以血为引，稍过一分就再也收不回来' },
  hanxin:    { place: '家族祠堂的暗格', relic: '一块刻着冰纹的寒玉牌', ward: '牌上封着一层薄霜', trial: '寒气入心，需以心性压住' },
  wuxiang:   { place: '无相剑派的废墟', relic: '半截无锋的剑身', ward: '废墟里没有一具尸体', trial: '要忘掉自己的手，才握得住这柄剑' },
  wanjianjue: { place: '越国剑修的埋剑之地', relic: '万剑碑上的总诀', ward: '万剑朝天，杀气冲霄', trial: '万道剑意同时入体，识海几乎被撕开' },
  manhuang:  { place: '蛮荒深处的兽骨祭坛', relic: '兽骨上刻的炼体法', ward: '祭坛四周堆满巨兽头骨', trial: '要以妖兽之血洗髓，痛不欲生' },
  taishang:  { place: '玄门旧址的藏经殿', relic: '一方紫檀玉匣', ward: '殿中香火早断，禁制犹存', trial: '法门太正太全，反而不知从何入手' },
  tianmoce:  { place: '魔道血殿的地宫', relic: '一面刻满魔纹的石壁', ward: '地宫里供着无数牌位', trial: '修的是心魔，喂的是杀孽' },
  wanyao:    { place: '万妖岭的化形洞', relic: '一张妖皮上的化形图', ward: '洞里回荡着兽的低吼', trial: '人形与妖形在体内争夺主导' },
  tunyue:    { place: '月崖上的观月台', relic: '台上刻着的吞月纹', ward: '崖下是万丈深渊', trial: '月华入体，须熬过整夜寒凉' },
  wuxing:    { place: '五行汇聚的混沌谷', relic: '五色石上流转的混沌纹', ward: '谷中五行之力互相撕扯', trial: '五气同时入体，稍偏一分便是经脉尽断' },
};
/* 未单独写明来历的功法，按流派兜底 */
const TYPE_LORE = {
  '剑': { place: '一处荒废的剑庐', relic: '半卷剑谱', ward: '庐外插着几柄断剑', trial: '剑意凌厉，参悟时如临大敌' },
  '体': { place: '一处妖兽盘踞的山谷', relic: '兽皮上画的炼体图', ward: '谷中白骨累累', trial: '要以血肉之躯硬扛药力' },
  '法': { place: '一座半塌的洞府', relic: '一方蒙尘玉简', ward: '洞府禁制尚未散尽', trial: '法门繁复，越参越觉得门户万千' },
  '魔': { place: '一处阴气森森的地窟', relic: '刻在石壁上的魔纹', ward: '窟中阴风不散', trial: '心魔趁机而入，须以心性相抗' },
  '妖': { place: '深山中的古兽巢穴', relic: '兽骨上刻的妖文', ward: '巢穴深处有兽息起伏', trial: '妖力冲撞血脉，人身几乎守不住' },
  '佛': { place: '一座荒寺的石窟', relic: '石壁上凿出的经文', ward: '窟中佛像面目模糊', trial: '佛音洗心，过往杀孽一一浮现' },
};

/* ---------------- 出身附带的法宝 ---------------- */
Object.assign(ARTS, {
  '下品法剑': { atk: 12, desc: '攻击 +12。宗门制式法剑，胜在趁手。' },
  '无名黑木片': { hp: 60, cult: 0.05, desc: '气血 +60，修炼 +5%。摸起来冰凉，不知是什么木头。' },
  '黑面罩':   { flee: 0.12, desc: '遁走 +12%。遮蔽气息，适合见不得光的人。' },
  '护身玉佩': { hp: 100, def: 6, desc: '气血 +100，防御 +6。家族长辈留下的最后一件东西。' },
});
ART_KEYS = Object.keys(ARTS);

/* ---------------- 出身 ---------------- */
const ORIGINS = [
  {
    id: 'yaotu', name: '墨门药徒', stars: 2, tag: '苟道 · 药理',
    desc: '墨大夫手下的药童，与韩立同在墨府。常年泡在药圃、丹房，辨药、炮制、看火，都熟。',
    trait: { id: 'herb', name: '药感', desc: '回春丹效果 +30%，草药类事件收益更高，能闻出丹药里的异毒。' },
    attrs: { wits: 6, body: 5, str: 4, agi: 5, spirit: 5, mind: 6 },
    items: { heal: 2, break: 1 }, stones: 2,
    tech: 'changchun', opening: 'o_yaotu',
  },
  {
    id: 'fumie', name: '覆灭宗门的幸存弟子', stars: 3, tag: '功法 · 逃亡',
    desc: '南方小宗门的弟子。宗门被魔道突袭覆灭，你带着伤逃进越国边境的荒山，身后还有魔道探子。',
    trait: { id: 'sense', name: '气感敏锐', desc: '遁走 +8%，更容易提前察觉埋伏与危险。' },
    attrs: { wits: 6, body: 5, str: 5, agi: 7, spirit: 6, mind: 5 },
    items: { mana: 2, escape: 1 }, stones: 4,
    tech: 'luoyan', artifact: '下品法剑', opening: 'o_fumie',
  },
  {
    id: 'zayi', name: '七玄门杂役', stars: 5, tag: '凡人 · 肉身',
    desc: '七玄门最底层的杂役。没碰过吐纳法门，只练过几手外门拳脚，是彻头彻尾的凡人。',
    trait: { id: 'tough', name: '凡躯耐苦', desc: '气血上限 +15%，毒瘴伤害减半，伤口愈合更快。' },
    attrs: { wits: 4, body: 8, str: 7, agi: 6, spirit: 3, mind: 7 },
    items: { heal: 1 }, stones: 3,
    tech: null, artifact: '无名黑木片', opening: 'o_zayi',
  },
  {
    id: 'hehuan', name: '合欢宗叛逃者', stars: 4, tag: '邪道 · 追杀',
    desc: '合欢宗外门弟子。修了多年采补法门，却不愿再按宗门的规矩活，于是叛逃。追杀令已经下了。',
    trait: { id: 'evil', name: '察恶', desc: '暴击 +6%，能隐约捕捉他人心中的杀意，识破暗算。' },
    attrs: { wits: 7, body: 5, str: 5, agi: 8, spirit: 7, mind: 4 },
    items: { escape: 1, heal: 1 }, stones: 5,
    tech: 'xuanyin', artifact: '黑面罩', opening: 'o_hehuan',
  },
  {
    id: 'jiazhu', name: '修仙小家族子弟', stars: 3, tag: '家族 · 博弈',
    desc: '越国小家族的子弟。全族只有两位筑基撑着，正魔大战将至，家族把最后的希望押在你身上。',
    trait: { id: 'calm', name: '控气稳定', desc: '冲关成功率 +5%，心境上限 +10，不易走火入魔。' },
    attrs: { wits: 7, body: 6, str: 5, agi: 5, spirit: 7, mind: 7 },
    items: { heal: 1, break: 1 }, stones: 10,
    tech: 'hanxin', artifact: '护身玉佩', opening: 'o_jiazhu',
  },
];

/* ---------------- 宗门 ---------------- */
const SECTS = {
  qixuan: {
    name: '七玄门', kind: '武林宗门',
    ranks: ['杂役', '外门弟子', '内门弟子', '执事', '长老'],
    stipend: [1, 2, 4, 8, 15], promote: [20, 60, 150, 400], realmReq: [0, 0, 1, 2, 3],
    desc: '青牛镇外的武林宗门，主修外功拳脚，也藏着一鳞半爪的吐纳法。门中重辈分，也重拳头。',
  },
  huangfeng: {
    name: '黄枫谷', kind: '越国七派',
    ranks: ['记名弟子', '外门弟子', '内门弟子', '真传弟子', '长老'],
    stipend: [3, 6, 12, 25, 50], promote: [30, 90, 220, 600], realmReq: [0, 1, 2, 3, 4],
    desc: '越国七派之一，剑修与丹道并重。门规森严，但灵石、丹药与功法远胜散修。',
  },
  sanxiu: {
    name: '散修', kind: '无门无派',
    ranks: ['散修'], stipend: [0], promote: [], realmReq: [],
    desc: '无门无派，自由，也无人可依。',
  },
};

/* ---------------- NPC ---------------- */
const NPC_SURNAMES = ['林', '沈', '顾', '苏', '陆', '谢', '裴', '温', '江', '柳', '楚', '燕'];
const NPC_GIVEN = ['清和', '照野', '青崖', '长风', '未晚', '知寒', '白露', '怀瑾', '听雪', '无咎', '望舒', '扶光'];
const NPC_IDENTITIES = [
  '散修', '黄枫谷外门弟子', '坊市丹师', '游方剑客', '宗门执事',
  '魔道散人', '商会少东家', '小家族嫡女', '猎妖人', '落魄书生',
];
const NPC_FATES = [
  '在坊市摆摊，勉强糊口。',
  '得了一门残功，闭关三年。',
  '被仇家追杀，逃入乱星海。',
  '拜入黄枫谷，做了外门弟子。',
  '结丹失败，元气大伤。',
  '在一处秘境里失踪了。',
  '成了附近有名的散修。',
  '与魔道做了交易，行踪不定。',
];



/* ---------------- 法术 ----------------
   cost: 占法力上限比例；cd: 冷却回合；power: 倍率
   fx: 附加效果
------------------------------------------------ */
const SPELLS = {
  huichun:      { name: '回春术', tech: 'changchun', elem: '木', cost: 0.20, cd: 3, kind: 'heal',
                  power: 0.35, desc: '恢复三成五气血，并驱散中毒。' },
  muling:       { name: '木灵护体', tech: 'changchun', elem: '木', cost: 0.16, cd: 3, kind: 'shield',
                  power: 0.30, fx: { turns: 3 }, desc: '凝木灵护盾，可挡三成气血之伤，持续三回合。' },

  jianqi:       { name: '剑气斩', tech: 'lingjian', elem: '剑', cost: 0.14, cd: 0, kind: 'attack',
                  power: 1.35, desc: '一剑化气，造成 135% 伤害。' },
  yujian:       { name: '御剑术', tech: 'lingjian', elem: '剑', cost: 0.20, cd: 2, kind: 'attack',
                  power: 1.05, hits: 2, desc: '御剑连击两段，无视一成防御。', fx: { ignoreDef: 0.1 } },

  luoyanshen:   { name: '罗烟身法', tech: 'luoyan', elem: '身法', cost: 0.12, cd: 4, kind: 'buff',
                  desc: '身化罗烟，三回合内闪避 +35%。', fx: { evade: 0.35, turns: 3 } },
  jifeng:       { name: '疾风步', tech: 'luoyan', elem: '身法', cost: 0.10, cd: 3, kind: 'buff',
                  desc: '抢得先机，三回合内暴击 +25%。', fx: { crit: 0.25, turns: 3 } },

  lingchong:    { name: '灵虫噬', tech: 'yuling', elem: '御兽', cost: 0.16, cd: 3, kind: 'attack',
                  power: 0.70, fx: { poison: 0.055, turns: 4 }, desc: '放出灵虫，造成伤害并使敌中毒四回合。' },
  yishou:       { name: '役兽', tech: 'yuling', elem: '御兽', cost: 0.24, cd: 4, kind: 'attack',
                  power: 1.55, fx: { ignoreDef: 0.5 }, desc: '灵兽扑击，无视半数防御。' },

  qingmang:     { name: '青元剑芒', tech: 'qingyuan', elem: '剑', cost: 0.26, cd: 2, kind: 'attack',
                  power: 2.00, desc: '剑芒贯体，造成 200% 伤害。' },
  jianguang:    { name: '剑光分化', tech: 'qingyuan', elem: '剑', cost: 0.22, cd: 3, kind: 'attack',
                  power: 0.85, hits: 3, desc: '剑光三分，连斩三下。' },
  wanjian:      { name: '万剑归一', tech: 'qingyuan', elem: '剑', cost: 0.40, cd: 5, kind: 'attack',
                  power: 3.00, fx: { execute: 0.25 }, desc: '倾力一剑。敌残血时伤害翻倍。' },

  yinmo:        { name: '阴魔斩', tech: 'xuanyin', elem: '魔', cost: 0.24, cd: 1, kind: 'attack',
                  power: 1.70, fx: { lifesteal: 0.35 }, desc: '阴魔之气凝刃，造成 170% 伤害并吸血三成五。' },
  xuemodun:     { name: '血魔遁', tech: 'xuanyin', elem: '魔', cost: 0.00, cd: 4, kind: 'special',
                  hpCost: 0.08, power: 1.90, fx: { evade: 0.30, turns: 2 },
                  desc: '耗八成气血化血光遁形，重击并闪避两回合。' },
  xuanyinzhua:  { name: '玄阴爪', tech: 'xuanyin', elem: '魔', cost: 0.18, cd: 2, kind: 'attack',
                  power: 1.20, fx: { lifesteal: 0.50, poison: 0.05, turns: 3 }, desc: '阴爪噬血，吸血五成并使敌中毒。' },

  jingshen:     { name: '惊神刺', tech: 'dayan', elem: '神识', cost: 0.20, cd: 2, kind: 'attack',
                  power: 1.50, fx: { ignoreDef: 1.0, mpDamage: 0.06 }, desc: '直刺神魂，无视防御，并削敌法力。' },
  fenshen:      { name: '分神术', tech: 'dayan', elem: '神识', cost: 0.30, cd: 5, kind: 'special',
                  fx: { extraTurn: true }, desc: '分神代劳，本回合可再行动一次。' },
  dayanguang:   { name: '大衍神光', tech: 'dayan', elem: '神识', cost: 0.35, cd: 4, kind: 'attack',
                  power: 1.90, fx: { ignoreDef: 0.4 }, desc: '神光扫荡，无视四成防御。' },

  bixie:        { name: '辟邪神雷', tech: 'wulei', elem: '雷', cost: 0.26, cd: 2, kind: 'attack',
                  power: 1.80, fx: { bonusVs: ['魔', '鬼', '妖'], bonus: 0.70 }, desc: '雷光诛邪，对妖魔鬼怪额外七成伤害。' },
  zidian:       { name: '紫电缠身', tech: 'wulei', elem: '雷', cost: 0.30, cd: 4, kind: 'attack',
                  power: 1.40, fx: { stun: 1 }, desc: '紫电缚敌，令其停滞一回合。' },
  tianlei:      { name: '天雷破', tech: 'wulei', elem: '雷', cost: 0.42, cd: 5, kind: 'attack',
                  power: 2.70, desc: '引落一道天雷，造成 270% 伤害。' },

  ciguang:      { name: '磁光罩', tech: 'yuanci', elem: '磁', cost: 0.22, cd: 4, kind: 'shield',
                  power: 0.40, fx: { thorns: 0.20, turns: 3 }, desc: '元磁护罩，挡四成气血之伤并反弹两成。' },
  yuancishu:    { name: '元磁束缚', tech: 'yuanci', elem: '磁', cost: 0.28, cd: 5, kind: 'special',
                  fx: { stun: 2, sund: 0.25, turns: 3 }, desc: '以元磁束敌两回合，并削其防御两成五。' },

  mohua:        { name: '魔化', tech: 'tuotian', elem: '魔', cost: 0.24, cd: 5, kind: 'buff',
                  hpCost: 0.10, fx: { atk: 0.55, turns: 4 }, desc: '燃血魔化，四回合内攻击 +55%。' },
  tianmojieti:  { name: '天魔解体', tech: 'tuotian', elem: '魔', cost: 0.00, cd: 6, kind: 'special',
                  hpCost: 0.35, power: 4.00, desc: '燃尽三成五气血，造成 400% 伤害。' },

  jingangbuhuai:{ name: '金刚不坏', tech: 'jingang', elem: '佛', cost: 0.18, cd: 4, kind: 'buff',
                  fx: { def: 0.60, dmgReduce: 0.25, turns: 3 }, desc: '三回合内防御 +60%，减伤 25%。' },
  mingwang:     { name: '明王法相', tech: 'jingang', elem: '佛', cost: 0.32, cd: 5, kind: 'special',
                  power: 1.60, fx: { heal: 0.20 }, desc: '佛光加身，伤敌并回复两成气血。' },

  xuedun:       { name: '血遁', tech: 'huaxue', elem: '血', cost: 0.00, cd: 3, kind: 'special',
                  hpCost: 0.12, fx: { mpGain: 0.25, evade: 0.40, turns: 2 }, desc: '燃血化遁，换取法力与两回合闪避。' },
  huaxue:       { name: '化血神光', tech: 'huaxue', elem: '血', cost: 0.30, cd: 3, kind: 'attack',
                  power: 1.60, fx: { lifesteal: 0.60, poison: 0.04, turns: 3 }, desc: '血光噬敌，吸血六成。' },

  /* ---- 法宝祭出（由法宝 active 提供，不需功法） ---- */
  shihun:       { name: '幡中阴魂', tech: null, elem: '鬼', cost: 0.18, cd: 3, kind: 'attack',
                  power: 1.40, fx: { lifesteal: 0.45 }, desc: '放出幡中阴魂噬敌，吸血四成五。', art: '噬魂幡' },
  zidianzhui:   { name: '紫电一击', tech: null, elem: '雷', cost: 0.22, cd: 3, kind: 'attack',
                  power: 2.20, desc: '紫电锥破空一击，造成 220% 伤害。', art: '紫电锥' },
  huxin:        { name: '护心光镜', tech: null, elem: '佛', cost: 0.14, cd: 4, kind: 'shield',
                  power: 0.35, fx: { turns: 3 }, desc: '凝一面光镜，可挡三成五气血之伤。', art: '护心镜' },
  guihuo:       { name: '幽冥鬼火', tech: null, elem: '鬼', cost: 0.20, cd: 3, kind: 'attack',
                  power: 1.50, fx: { poison: 0.06, turns: 3 }, desc: '鬼火附骨，灼烧并中毒三回合。', art: '幽冥鬼火' },
  wudao:        { name: '参悟玉简', tech: null, elem: '神识', cost: 0.10, cd: 5, kind: 'buff',
                  fx: { crit: 0.30, spellPower: 0.30, turns: 3 }, desc: '三回合内暴击与法术威力大增。', art: '太乙玉简' },
};

/* ---------------- 妖魔 ----------------
   相对本境界基准的比例；traits 决定战斗行为
------------------------------------------------ */
const ENEMY_POOL = {
  0: [
    { name: '青牛镇悍匪', tags: ['人'], hp: 0.80, atk: 0.090, def: 0.45, w: 3 },
    { name: '独眼山君',   tags: ['妖'], hp: 0.95, atk: 0.100, def: 0.50, w: 2, traits: ['enrage'] },
    { name: '黑风寨刀客', tags: ['人'], hp: 0.75, atk: 0.095, def: 0.40, w: 3, traits: ['bleed'] },
    { name: '饿极的狼群', tags: ['妖'], hp: 0.70, atk: 0.080, def: 0.25, w: 3, traits: ['fast'] },
    { name: '游方恶道',   tags: ['人', '鬼'], hp: 0.88, atk: 0.098, def: 0.42, w: 2, traits: ['caster'] },
  ],
  1: [
    { name: '铁背妖狼',   tags: ['妖'], hp: 0.90, atk: 0.098, def: 0.55, w: 3, traits: ['enrage'] },
    { name: '散修劫匪',   tags: ['人'], hp: 0.82, atk: 0.100, def: 0.50, w: 3, traits: ['caster'] },
    { name: '赤牙野猪',   tags: ['妖'], hp: 1.05, atk: 0.092, def: 0.40, w: 2, traits: ['physResist'] },
    { name: '噬灵蛛',     tags: ['妖'], hp: 0.78, atk: 0.086, def: 0.35, w: 3, traits: ['poison'] },
    { name: '邪修',       tags: ['人', '魔'], hp: 0.85, atk: 0.104, def: 0.45, w: 2, traits: ['drain'] },
  ],
  2: [
    { name: '血袍客',     tags: ['人', '魔'], hp: 0.92, atk: 0.104, def: 0.55, w: 3, traits: ['drain'] },
    { name: '傀儡甲士',   tags: ['傀儡'], hp: 1.08, atk: 0.096, def: 0.65, w: 3, traits: ['physResist', 'shieldStart'] },
    { name: '四阶妖蟒',   tags: ['妖'], hp: 1.02, atk: 0.100, def: 0.40, w: 2, traits: ['poison', 'enrage'] },
    { name: '双首妖禽',   tags: ['妖'], hp: 0.85, atk: 0.108, def: 0.32, w: 3, traits: ['fast'] },
    { name: '魔道执事',   tags: ['人', '魔'], hp: 0.95, atk: 0.102, def: 0.52, w: 2, traits: ['caster'] },
  ],
  3: [
    { name: '魔道长老',   tags: ['人', '魔'], hp: 0.95, atk: 0.104, def: 0.60, w: 3, traits: ['caster', 'drain'] },
    { name: '五阶妖禽',   tags: ['妖'], hp: 0.88, atk: 0.110, def: 0.38, w: 3, traits: ['fast'] },
    { name: '元婴散修',   tags: ['人'], hp: 1.02, atk: 0.100, def: 0.62, w: 2, traits: ['shieldStart'] },
    { name: '古尸',       tags: ['鬼'], hp: 1.12, atk: 0.096, def: 0.55, w: 2, traits: ['physResist', 'regen'] },
    { name: '妖兽王者',   tags: ['妖'], hp: 1.05, atk: 0.106, def: 0.45, w: 2, traits: ['enrage', 'physResist'] },
  ],
  4: [
    { name: '化神残魂',   tags: ['鬼'], hp: 0.98, atk: 0.108, def: 0.50, w: 3, traits: ['drain', 'caster'] },
    { name: '上古凶兽',   tags: ['妖'], hp: 1.15, atk: 0.104, def: 0.52, w: 2, traits: ['enrage', 'physResist'] },
    { name: '魔道巨枭',   tags: ['人', '魔'], hp: 1.02, atk: 0.106, def: 0.58, w: 3, traits: ['caster', 'shieldStart'] },
    { name: '天外邪物',   tags: ['魔'], hp: 1.08, atk: 0.110, def: 0.46, w: 2, traits: ['poison', 'regen'] },
    { name: '域外天魔',   tags: ['魔', '鬼'], hp: 1.00, atk: 0.108, def: 0.54, w: 2, traits: ['drain', 'caster'] },
  ],
};

/* 妖魔招式（power 相对自身攻击的倍率） */
const ENEMY_SKILLS = {
  heavy:   { name: '全力一击', power: 1.55, cd: 3, charge: true, log: '鼓足气力，狠狠砸下' },
  cast:    { name: '邪法', power: 1.35, cd: 2, charge: true, log: '掐诀念咒，祭出一道邪法' },
  drain:   { name: '吸血', power: 1.10, cd: 3, log: '扑上来撕咬，吸走你的气血', drain: 0.5 },
  poison:  { name: '毒雾', power: 0.85, cd: 3, log: '喷出一片腥臭毒雾', poison: 0.06 },
  breath:  { name: '吐息', power: 1.45, cd: 4, charge: true, log: '张口吐出一道灼热吐息' },
  wail:    { name: '厉啸', power: 1.20, cd: 4, charge: true, log: '发出一声穿魂厉啸', mpDamage: 0.15 },
};

/* ---------------- 冲关 ---------------- */
const BREAK_INFO = [
  { title: '引气入体',
    text: '丹田里那点凉气已经聚成一团。今夜若冲不过去，它就要散了。你关上门窗，在蒲团上坐下。',
    win: '你睁开眼时，窗纸已经泛白。丹田里那团气不再散了，它沉在深处，缓缓转动。你伸出手，指尖有一缕风。',
    lose: '气团散了。你吐出一口血，经脉像被火烧过。', pen: 2 },
  { title: '筑基',
    text: '灵气如潮，一遍遍拍打丹田。筑基，是把这团气压实成基。压不住，就散了。这一步，寻常人要熬上三十年。',
    win: '“轰”的一声，灵气压实成基。你听见自己骨头在响。从此寿元二百，凡俗的生死，再管不到你。',
    lose: '灵气冲关不成，反噬丹田。你在地上躺了三个月，连手指都抬不起来。', pen: 8 },
  { title: '结丹',
    text: '灵气在丹田中旋转、压缩，越来越快，像要在你体内结出一颗星。可这颗星一旦结歪，便是终身金丹无望。',
    win: '那颗星终于凝实，金光内敛。你吐出一口气，洞府外的山雀齐齐惊飞。',
    lose: '结丹失败，灵气炸开。你的丹田像一只漏了的袋子，修为散了大半。', pen: 25 },
  { title: '破丹成婴',
    text: '金丹裂开一道细纹。破丹成婴，九死一生。',
    win: '金丹碎裂，一个寸许高的婴孩盘坐其中，眉眼与你一模一样。你看着他，他也看着你。',
    lose: '破丹不成。金丹上多了一道裂纹，你的元婴缩在丹田角落，瑟瑟发抖。', pen: 70 },
  { title: '化神天劫',
    text: '天上聚起了劫云。紫色的雷光在云层里翻滚，像一条即将落下的龙。你走出洞府，站在山巅。',
    win: '最后一道天雷落下时，你没有躲。雷光穿体而过，元婴在雷火中化作一团金光。金光散开，你已站在云层之上。脚下是这片山河，头顶是另一片天地。',
    lose: '天劫落下，你的元婴几乎被劈散。你从山巅滚落，浑身焦黑，寿元折损了两百六十年。', pen: 260 },
  { title: '飞升天劫',
    text: '化神之后，天门在云层深处开了一线。守门的天将踏云而下，甲胄上流转着不属于此界的雷光。它说：此门只渡一人，先过我这关。',
    win: '天将的甲胄一片片碎裂，化作光尘。天门彻底打开，你踏着光尘走上去。身后的山河越来越小，最后只剩一粒尘埃。',
    lose: '天将的长戟贯穿了你的胸口。你从云层坠落，天门在头顶合拢。这一界的风，最后吹过你的脸。', pen: 800 },
];

/* =============================================================
   事件容器
   ============================================================= */
const EVENTS = [];
function ev(o) { EVENTS.push(o); return o; }

/* ---------------- 世界气运：每局随机 ---------------- */
const WORLD_MOODS = [
  { id: 'calm',   name: '太平年景', desc: '四方无事，山门清静。', battle: -0.05, cult: 1.06, el: -0.04 },
  { id: 'tide',   name: '灵潮涌动', desc: '天地灵气充盈，修炼事半功倍。', battle: 0, cult: 1.18, el: 0 },
  { id: 'chaos',  name: '魔道横行', desc: '黑云压境，处处有杀机。', battle: 0.12, cult: 0.98, el: 0.10 },
  { id: 'famine', name: '灵材枯竭', desc: '丹药难求，灵石价贵。', battle: 0.04, cult: 0.92, el: 0 },
  { id: 'star',   name: '星辰移位', desc: '星象紊乱，奇遇与灾祸皆多。', battle: 0.06, cult: 1.10, el: 0.06 },
];
