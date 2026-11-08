// 将 src/index.html 与其引用的脚本内联为单文件游戏
const fs = require('fs');
const path = require('path');

const dir = __dirname;
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

// 按出现顺序内联所有 <script src="x.js"></script>
const re = /<script src="([^"]+)"><\/script>/g;
const seen = [];
html = html.replace(re, (m, file) => {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) throw new Error('script not found: ' + file);
  seen.push(file);
  const js = fs.readFileSync(p, 'utf8');
  if (js.includes('</script')) throw new Error(file + ' contains </script>, cannot inline');
  return '<script>\n/* ---- ' + file + ' ---- */\n' + js + '\n</script>';
});
if (!seen.length) throw new Error('no script tags found in index.html');

const root = path.join(dir, '..');
function out(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

out('凡人修仙传.html', html);
out(path.join('web', 'index.html'), html);
out(path.join('github-pages-site', 'index.html'), html);
out(path.join('download', '凡人修仙传.html'), html);

/* ---- 便携包：双击 开始游戏.cmd 即可离线游玩 ---- */
out(path.join('便携版', 'Game.html'), html);
out(path.join('便携版', '开始游戏.cmd'), [
  '@echo off',
  'rem 凡人修仙传 · 寿元 —— 双击本文件用默认浏览器打开游戏，无需联网',
  'cd /d "%~dp0"',
  'start "" "%~dp0Game.html"',
  'exit',
].join('\r\n'));
out(path.join('便携版', '说明.txt'), [
  '凡人修仙传 · 寿元',
  '================',
  '',
  '怎么玩：',
  '  1. 双击「开始游戏.cmd」（或直接双击 Game.html）',
  '  2. 浏览器里选难度 → 道号 → 测灵根 → 踏入仙途',
  '',
  '特点：',
  '  - 单文件，不需要联网，也不需要安装任何东西',
  '  - 存档保存在浏览器本地（localStorage），换电脑不会自动带过去',
  '    想带走进度：游戏内按 Ctrl+Shift+E 导出存档码，到新电脑按 Ctrl+Shift+I 粘贴导入',
  '',
  '拷走方式：',
  '  - U 盘：把整个「便携版」文件夹复制进去',
  '  - 压缩：右键「便携版」→ 发送到 → 压缩文件夹，把 zip 发给自己',
  '  - 手机：把 Game.html 用聊天软件发给自己，在手机浏览器中打开也能玩',
  '',
  '手机浏览器打开本地 html 可能受限，更推荐把 index.html 传到任意静态托管',
  '（Netlify Drop / GitHub Pages / Vercel），得到公网链接后在任何设备上打开。',
].join('\r\n'));

/* ---- 源码包：带到别的电脑继续改 ---- */
const dev = path.join(root, '源码包');
fs.mkdirSync(path.join(dev, 'src'), { recursive: true });

out(path.join('源码包', 'README.md'), [
  '# 凡人修仙传 · 寿元 —— 源码包',
  '',
  '## 文件',
  '',
  '- `src/data.js`：数据层。境界、灵根、难度、功法（TECHS）、法术（SPELLS）、法宝特效（ARTS）、妖魔原型',
  '- `src/events.js`：事件层。全部剧情事件与选项（含耗年数、判定、功法传承）',
  '- `src/game.js`：引擎层。寿元与年龄、修炼、战斗（状态/技能/法宝）、界面、存档、模拟',
  '- `src/index.html`：页面结构、样式、HUD、战斗层、储物袋',
  '- `src/build.js`：把脚本内联进 html，生成单文件版',
  '- `dev-serve.js`：零依赖本地开发服务器（自动打开浏览器，改完刷新即可）',
  '- `build.ps1`：Windows 一键构建脚本',
  '- `凡人修仙传.html`：已构建好的单文件游戏',
  '',
  '## 运行',
  '',
  '需要 Node.js 18+（https://nodejs.org 下载 LTS 版即可）。',
  '',
  '```powershell',
  'node dev-serve.js      # 开发预览：浏览器自动打开，改 src/ 里的文件后刷新即可',
  'node src/build.js      # 构建单文件版 凡人修仙传.html',
  '.\\build.ps1            # 等价的一键构建（Windows）',
  '```',
  '',
  '## 调试参数（URL 后面加）',
  '',
  '- `?demo=1` 直接进入游戏；`?demo=battle` 直接进战斗；`?demo=bag` 储物袋',
  '- `?auto=5` 自动随机跑 5 局，用来检查报错',
  '- `?sim=200` 跑 200 局平衡模拟，输出胜率、平均境界与首次突破年龄',
  '- `?static=1` 关闭动画（截图用）',
  '',
  '## 改哪里',
  '',
  '- 加事件：在 `events.js` 里照现有格式写 `ev({...})`；`realm: 0..4` 限定境界，`-1` 通用，`minRealm` 设最低境界',
  '- 选项格式：`[文字, 标签, 函数, 可选条件, 耗年数]`。标签：稳/险/机/耗；不写耗年数则用 `YEAR_COST[境界]` 默认值',
  '- 风险判定一律用 `chk(概率)`，它会自动叠加难度、心境与悟性修正',
  '- 加功法：`data.js` 的 `TECHS` 加一条，`passive` 为常驻加成，`spells` 列出法术 id',
  '- 加法术：`data.js` 的 `SPELLS` 加一条（kind: attack/heal/shield/buff/special）',
  '- 加法宝：`data.js` 的 `ARTS` 加一条；`fx` 支持护盾、减伤、反伤、斩杀、法宝主动技等',
  '- 改寿元节奏：`data.js` 的 `YEAR_COST`（每个境界一次抉择默认耗年）与 `REALMS` 的 `life`/`need`',
  '- 改战斗数值：`REALMS` 的 hp/mp/atk/def，以及 `ENEMY_POOL` 里的比例与 `traits`',
  '',
  '## 难度',
  '',
  '开局可选顺遂 / 寻常 / 艰险。难度影响判定成功率、妖魔强度与精英出现率，见 `data.js` 的 `DIFFS`。',
  '',
  '## 存档',
  '',
  '游戏进度存在浏览器的 localStorage 里（键名 `fanren_shouyuan_v4`）；',
  '换电脑用游戏内 Ctrl+Shift+E 导出存档码、Ctrl+Shift+I 导入。',
].join('\r\n'));

['data.js', 'events.js', 'game.js', 'build.js', 'index.html'].forEach((f) => {
  out(path.join('源码包', 'src', f), fs.readFileSync(path.join(dir, f), 'utf8'));
});
['dev-serve.js', 'build.ps1'].forEach((f) => {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) out(path.join('源码包', f), fs.readFileSync(p, 'utf8'));
  else if (fs.existsSync(path.join(dir, '..', f))) {
    out(path.join('源码包', f), fs.readFileSync(path.join(dir, '..', f), 'utf8'));
  }
});
out(path.join('源码包', '凡人修仙传.html'), html);

console.log('built bytes', Buffer.byteLength(html, 'utf8'), '| inlined:', seen.join(', '));
