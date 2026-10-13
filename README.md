<p align="center">
    <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=61DAFB" alt="React">
    <img src="https://img.shields.io/badge/Vite-5.0+-646cff?style=flat-square&logo=vite" alt="Vite">
    <img src="https://img.shields.io/badge/React_Router-7.13-CA4245?style=flat-square&logo=reactrouter" alt="React Router">
    <img src="https://img.shields.io/badge/JavaScript-ES2022+-F7DF1E?style=flat-square&logo=javascript" alt="JavaScript">
</p>

> **指尖弈局** —— 一个现代化在线纸笔游戏平台。把黑白棋、井字棋、五子棋、数独、超级井字棋等经典对弈搬到浏览器里，**无需登录、无需后端**，打开即玩。每一项游戏都配备了智能 AI、引擎提示、棋谱复盘、战绩统计与结算复盘，让「纸笔游戏」也能拥有精致的对局体验。

## ✨ 项目亮点

### 🎮 经典游戏阵容

- 八款经典纸笔游戏：黑白棋、井字棋、五子棋、数独、数字华容道、扫雷、曼卡拉、超级井字棋
- 对弈类支持「人机对战」与「双人同屏」两种模式，单人益智类提供多档难度
- 每款游戏都有独立首页入口、专用棋盘与规则说明页

### 🧠 智能引擎

- 三档难度（简单 / 中等 / 困难），从随机贪心到带剪枝的深度搜索逐级递进
- 落子类游戏采用 Minimax + Alpha-Beta 剪枝 / 棋型评分 / 启发式评估
- 数独保证唯一解、扫雷首点必定安全、华容道从完成态逆向打乱保证可解

### 🎯 统一对局体验

- 每一步都有的对局计时器，落子或重开自动归零
- 引擎提示：点击后以**金色虚线框**标出推荐落点
- 悔棋、棋谱、重开一键操作，棋谱逐手记录所在棋盘与坐标
- 可编辑玩家名、持久化战绩（胜 / 负 / 平 / 胜率）、带胜方标注的结算弹窗
- Web Audio 合成音效（落子 / 翻转 / 胜负），支持一键静音并记忆偏好

### 🎨 现代设计系统

- 深色「曜石」风格：紫色 → 青色渐变、玻璃拟态卡片、统一的圆角与阴影令牌
- Inter + Noto Sans SC 字体，全站视觉一致
- 全设备响应式，棋盘按视口自动缩放，支持触屏，无横向溢出

### 🏗️ 清晰的工程架构

- 纯前端 SPA，零后端依赖，数据全部基于 `localStorage` 本地持久化
- 每款游戏按 `组件 / 逻辑 / AI / 样式` 分层，职责清晰、易于扩展
- 通用组件（导航、返回、结算弹窗、手风琴、更多游戏）跨页面复用

## 🎮 游戏阵容

| 游戏 | 英文 | 类型 | 对局 | 定位 | 一句话简介 |
| --- | --- | --- | --- | --- | --- |
| 黑白棋 | Reversi | 对弈 | 2 人 · 5–10 分钟 | 策略 | 落子夹击，翻转对手棋子，终局棋子多者胜 |
| 井字棋 | Tic-Tac-Toe | 对弈 | 2 人 · 1 分钟 | 休闲 | 三子连线即获胜，最经典的入门对弈 |
| 五子棋 | Gomoku | 对弈 | 2 人 · 10 分钟 | 进阶 | 纵横连成五子，攻防转换考验全局眼光 |
| 数独 | Sudoku | 单人 | 1 人 · 10 分钟 | 逻辑 | 用 1–9 填满九宫格，行列宫不重复 |
| 数字华容道 | Sliding Puzzle | 单人 | 1 人 · 5 分钟 | 益智 | 滑动方块，把数字还原成有序排列 |
| 扫雷 | Minesweeper | 单人 | 1 人 · 5 分钟 | 逻辑 | 依据数字推导地雷，避开雷区清空棋盘 |
| 曼卡拉 | Mancala | 对弈 | 2 人 · 10 分钟 | 策略 | 古老播种式棋类，把棋子一粒粒送进宝库 |
| 超级井字棋 | Ultimate TTT | 对弈 | 2 人 · 15 分钟 | 烧脑 | 九个井字棋嵌套，落点决定对手下一步战场 |

## 🚀 功能特性

### P1 - 核心对局能力

| 功能模块 | 描述 |
| --- | --- |
| 🎯 双模式对局 | 人机对战（三档难度）与双人同屏对战，随时切换 |
| 🧠 智能 AI | 简单随机贪心 / 中等启发式评估 / 困难深度搜索，含思考态反馈 |
| ⏱️ 对局计时 | 每步计时，落子或重开自动归零，把握思考节奏 |
| ↩️ 悔棋 | 逐步回退；人机模式下自动回退到玩家回合 |
| 📜 棋谱记录 | 逐手记录所在棋盘与坐标，关键手（如拿下子棋盘）特别标注 |

### P2 - 体验增强

| 功能模块 | 描述 |
| --- | --- |
| 💡 引擎提示 | 一键获取推荐落点，以金色虚线框直观呈现 |
| 🔊 合成音效 | 落子 / 翻转 / 胜利 / 失败音效，支持静音并本地记忆 |
| 🏷️ 可编辑名字 | 比分板上的玩家名可直接修改，双人模式自动配对为「玩家 1 / 玩家 2」 |
| 📊 战绩统计 | 人机对战的胜 / 负 / 平与胜率持久化，见证进步 |
| 🗂️ 结算弹窗 | 对局结束弹出结果，明确标注获胜方（黑棋 / 白棋、X / O 或具体玩家名） |

### P3 - 内容与运营

| 功能模块 | 描述 |
| --- | --- |
| 📖 规则说明 | 每款游戏都有「玩法规则」与「制胜策略」图文区块 |
| ❓ 常见问题 | 手风琴式 FAQ，覆盖上手与进阶疑问 |
| 🧭 页内导航 | 顶部锚点直达规则、策略、FAQ，左上角一键返回首页 |
| 🎁 更多游戏 | 页面底部推荐尚未体验的其他游戏，形成站内循环 |
| 📱 全端适配 | 手机 / 平板 / 桌面自适应，棋盘按视口缩放 |

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
| --- | --- | --- |
| React | 19.2.0 | 现代 UI 框架，函数式组件 + Hooks |
| React DOM | 19.2.0 | React 渲染器 |
| React Router | 7.13.2 | 前端路由（首页与各游戏页） |
| Vite | 7.3.1 | 极速构建与热重载 |
| @vitejs/plugin-react | 5.1.1 | React 快速刷新插件 |
| ESLint | 9.39.1 | 代码规范检查 |
| eslint-plugin-react-hooks | 7.0.1 | Hooks 规则校验 |
| eslint-plugin-react-refresh | 0.4.24 | 热更新规则校验 |

> 全站为**纯前端应用**，无后端与数据库依赖；状态与战绩数据均保存在浏览器 `localStorage` 中。

## 📁 项目结构

```
Paper-Pencil-Games/
├── index.html                     # HTML 入口（站点标题 / 字体 / SEO）
├── vite.config.js                 # Vite 配置
├── eslint.config.js               # ESLint 配置
├── package.json
├── README.md
└── src/
    ├── main.jsx                   # React 挂载点
    ├── App.jsx                    # 路由配置（/home 及 8 个游戏页）
    ├── data/
    │   └── games.js               # 游戏目录（首页卡片墙与「更多游戏」共用）
    ├── Home/
    │   ├── Home.jsx               # 首页：卡片墙 / 亮点 / 特色 / FAQ
    │   └── Home.css
    ├── components/                # 通用组件
    │   ├── GameNav.jsx            # 游戏页顶部导航（含页内锚点）
    │   ├── BackBar.jsx            # 左上角返回条
    │   ├── MoreGames.jsx          # 底部「更多游戏」推荐
    │   ├── GameOverModal.jsx      # 结算弹窗（支持 棋子 / 井字棋 两种样式）
    │   ├── Accordion.jsx          # 手风琴（FAQ）
    │   └── ScrollToTop.jsx        # 路由切换回到顶部
    ├── styles/
    │   ├── theme.css              # 全局设计系统（配色 / 圆角 / 阴影 / 字体令牌）
    │   └── game-page.css          # 游戏页通用样式（gp-* 系列）
    ├── utils/
    │   └── sound.js               # Web Audio 合成音效
    ├── Reversi/                   # 黑白棋
    ├── Tic-Tac-Toe/               # 井字棋
    ├── Gomoku/                    # 五子棋
    ├── Sudoku/                    # 数独
    ├── Huarongdao/                # 数字华容道
    ├── Minesweeper/               # 扫雷
    ├── Mancala/                   # 曼卡拉
    └── SuperTicTacToe/            # 超级井字棋
```

每个游戏目录内部保持统一分层（以 `SuperTicTacToe` 为例）：

```
SuperTicTacToe/
├── SuperTicTacToeGame.jsx         # 页面：状态管理 / 交互 / 内容区块
├── SuperTicTacToe.css             # 页面样式
├── components/
│   └── Board.jsx / Board.css      # 棋盘：渲染、坐标、动画、提示高亮
└── utils/
    ├── gameLogic.js               # 纯逻辑：规则、合法走法、胜负判定
    └── ai.js                      # 电脑对手：难度与搜索策略
```

## 🏃 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd Paper-Pencil-Games
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务

```bash
npm run dev
```

默认访问 `http://localhost:5173/`。

### 4. 构建与预览

```bash
npm run build    # 生产构建
npm run preview  # 本地预览构建产物
npm run lint     # 代码规范检查
```

## 🔍 核心实现原理

### 1. 全局设计系统（Design Tokens）

以 CSS 变量集中定义「曜石」主题的配色、圆角、阴影与字体，保证八款游戏视觉一致：

```css
/* src/styles/theme.css */
:root {
    /* 品牌色：紫 → 青渐变 */
    --brand: #7c5cff;
    --brand-2: #22d3ee;
    --brand-grad: linear-gradient(135deg, #7c5cff 0%, #22d3ee 100%);

    /* 玻璃拟态表面 */
    --surface-1: rgba(255, 255, 255, 0.04);
    --stroke-1: rgba(255, 255, 255, 0.08);

    /* 功能色（金色用于引擎提示与胜方标注） */
    --gold: #f5c451;
    --ok: #34d399;

    /* 圆角 / 阴影 / 字体 */
    --r-md: 18px;
    --shadow-md: 0 14px 38px rgba(0, 0, 0, 0.42);
    --font-sans: 'Inter', 'Noto Sans SC', -apple-system, sans-serif;
}
```

### 2. Web Audio 合成音效（零资源文件）

不依赖任何音频文件，用振荡器实时合成落子、翻转与胜负音效，可全局开启 / 静音：

```javascript
// src/utils/sound.js
function tone({ freq, duration, type, gain, delay, slideTo }) {
    if (!enabled) return;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const start = ctx.currentTime + (delay || 0);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);

    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
}

export const sound = {
    place() { tone({ freq: 320, slideTo: 180, duration: 0.14, type: 'triangle', gain: 0.07 }); },
    flip(count = 1) { /* 逐枚翻转音，最多 6 枚 */ },
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, delay: i * 0.11 })); }
};
```

### 3. 游戏 AI：从启发式到深度搜索

不同游戏按各自特点选用算法，统一暴露 `getAIMove(board, player, difficulty)` 接口：

**黑白棋 —— Minimax + Alpha-Beta 剪枝 + 位置权重**

```javascript
// src/Reversi/utils/ai.js
const CORNER_WEIGHT = 100;          // 角位价值最高
const EDGE_WEIGHT = 10;             // 边次之
const CORNER_ADJACENT_WEIGHT = -50; // 角邻位是陷阱

function minimax(board, depth, isMaximizing, player, alpha, beta) {
    const validMoves = getValidMoves(board, isMaximizing ? player : opponent);
    if (depth === 0 || validMoves.length === 0) return evaluateBoard(board, player);
    for (const move of validMoves) {
        const score = minimax(makeMove(board, move, ...), depth - 1, !isMaximizing, player, alpha, beta);
        // 剪枝：beta <= alpha 时提前退出
    }
}
```

**五子棋 —— 棋型评分 + 一层预判**

```javascript
// src/Gomoku/utils/ai.js
const WIN_SCORE = 1000000;

// 分别计算「进攻分」与「防守分」，优先取胜、其次封堵
const winMove = scored.find((m) => m.attack >= WIN_SCORE);    // 自己能成五
const blockMove = scored.find((m) => m.defense >= WIN_SCORE); // 对手要成五
// 困难档：在候选点内额外评估对手最佳反击，规避强反扑
```

**井字棋 —— 全盘 Minimax 穷举**；**曼卡拉 / 超级井字棋 —— 带走法排序的 Alpha-Beta**，超级井字棋困难档进一步采用迭代加深并对节点与耗时设上限，保证不卡顿。

### 4. 数独：回溯生成 + 唯一解校验

```javascript
// src/Sudoku/utils/gameLogic.js
/* 回溯填满整张棋盘（生成完整解） */
function fillGrid(grid) { /* ...递归填数... */ }

/* 生成一局：完整解 + 保证唯一解的题面 */
function generatePuzzle(holes) {
    // 随机挖空，每挖一格都用 countSolutions 校验，出现多解则恢复
    if (countSolutions(grid, 2) !== 1) restore();
}
```

### 5. 扫雷：首点必定安全

```javascript
// src/Minesweeper/utils/gameLogic.js
/* 布雷：首点及其八邻域保持安全 —— 地雷在第一次点开之后才布置 */
function placeMines(rows, cols, mineCount, firstRow, firstCol) {
    // 从除首点及八邻域外的所有格子中 Fisher–Yates 洗牌后取前 mineCount 个
}
// 空白区洪水填充：翻开 0 雷格时自动展开相邻格
export const floodReveal = (reveal, flag, adj, mines, row, col, rows, cols) => { /* ... */ };
```

### 6. 数字华容道：保证可解的乱序

```javascript
// src/Huarongdao/utils/gameLogic.js
/* 从完成态出发做 N 次逆向移动，且不立即回退，从而保证一定可解 */
export const shuffleBoard = (size, steps) => {
    // 按难度使用不同打乱步数（20 / 60 / 120 / 200），并保证不会还原为完成态
};
```

### 7. 超级井字棋：落点决定战场的状态机

```javascript
// src/SuperTicTacToe/utils/gameLogic.js
/* 落点所在的格子决定对手下一步的目标子棋盘 */
function computeForcedSub(board, subWinners, row, col) {
    const target = row * BOARD_SIZE + col;
    // 目标子棋盘已分出胜负或已下满时返回 null → 对手获得「自由落子」权
    return isSubPlayable(board, subWinners, target) ? target : null;
}

/* 落子返回新状态（不可变更新），非法落子返回 null */
function applyMove(state, sub, row, col) {
    // 1) 子棋盘内三连 → 赢下该子棋盘
    // 2) 大棋盘上三个「赢下的子棋盘」连线 → 赢下整局
    // 3) 无任何合法落点 → 平局
}
```

### 8. 本地持久化

玩家名、音效偏好与胜负战绩均通过 `localStorage` 保存，刷新后依然保留；读写做了容错处理，避免隐私模式或异常数据导致崩溃：

```javascript
const safeGet = (key, fallback) => {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};
```

## 🧩 开发指南

### 新增一款游戏

1. 在 `src/data/games.js` 中新增游戏条目（`id / name / en / mark / color / description / path / playable / accent / meta`）。
2. 在 `src/<GameName>/` 下创建目录，保持统一分层：`<GameName>Game.jsx`、`<GameName>.css`、`components/Board.jsx`、`utils/gameLogic.js`、`utils/ai.js`。
3. 在 `src/Home/Home.jsx` 中为该 `id` 补充纯 CSS 绘制的预览组件。
4. 在 `src/App.jsx` 中注册路由 `/home/<path>`。

### 复用通用能力

- 顶部导航：`<GameNav />`（内置 `#rules` / `#tips` / `#faq` 锚点）
- 返回按钮：`<BackBar title="游戏名" />`
- 结算弹窗：`<GameOverModal ... variant="mark" />`（井字棋类用 `mark`，棋子类默认 `stone`）
- 底部推荐：`<MoreGames currentId="<game-id>" />`
- 音效：`import { sound } from '../utils/sound'`，调用 `sound.place()` / `sound.flip(n)` / `sound.win()`
- 样式：优先复用 `theme.css` 的 `ui-*` 与 `game-page.css` 的 `gp-*` 类

## 📦 依赖说明

### 生产依赖

- `react` & `react-dom`：UI 框架核心
- `react-router-dom`：前端路由管理

### 开发依赖

- `vite` & `@vitejs/plugin-react`：构建工具与 React 插件
- `eslint` & `@eslint/js` & `globals`：代码规范与全局变量
- `eslint-plugin-react-hooks`：Hooks 使用规范校验
- `eslint-plugin-react-refresh`：热更新边界校验
- `@types/react` & `@types/react-dom`：类型提示

## 🔄 兼容性

### 浏览器

- **推荐浏览器**：Chrome 90+、Edge 90+、Safari 14+、Firefox 90+
- 音效依赖 **Web Audio API**，主流现代浏览器均支持
- 响应式布局适配手机、平板与桌面，棋盘按视口自动缩放

### 功能降级

| 功能 | 依赖 | 降级方案 |
| --- | --- | --- |
| 音效播放 | Web Audio API | 不支持时静默，不影响对局 |
| 本地战绩 | localStorage | 不可用时仅当前会话有效 |
| 触摸操作 | Pointer / Touch 事件 | 自动回退到鼠标点击 |

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/YourFeature`
3. 提交更改：`git commit -m 'Add some YourFeature'`
4. 推送到分支：`git push origin feature/YourFeature`
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。

## 📞 联系方式

- GitHub Issues：欢迎提交问题与建议
- 邮箱：3367741939@qq.com

---

**如果这个项目对你有帮助，欢迎给一个 ⭐ Star！**

> 🎮 指尖弈局 —— 把经典纸笔游戏，搬到你的指尖