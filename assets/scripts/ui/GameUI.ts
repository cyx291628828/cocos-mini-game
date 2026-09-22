import { Node, Vec3, tween, Graphics, UIOpacity, Label, Color, UITransform } from 'cc';
import { Ui } from '../core/Ui';
import { C, hex } from '../core/Const';
import { Router } from '../core/Router';
import { SAVE, addCoins, setTimer, fmtTime } from '../core/Save';
import {
    GAMES, CHAPTERS, LEVELS_PER_CH, skinOf, mulberry32,
    SHIKAKU_CLUES, SHIKAKU_RECTS, CH_PERIODS, GameCtx,
} from '../core/Data';
import { Config, SudokuCfg, MineCfg, StarCfg } from '../core/Config';
import { genStarPuzzle } from '../core/StarGen';
import { Modal } from './ModalUI';
import { confetti } from './Confetti';
import { checkAchievements } from './Achievement';

const NUM_COLORS = ['#2F7FC0', '#48A030', '#E04E4E', '#7744C9', '#C96A00', '#0FA3A3', '#B03030', '#666666', '#555555'];

/**
 * 玩法界面：进入时按关卡表/挑战规则取配置行。
 * 数独：配置驱动（4/6/9 宫格、挖空数、超时扣星、错误扣星、奖励），真实规则可玩。
 * 其余玩法：展示棋盘 + 演示结算（规则后续接入）。
 */
export function buildGame(root: Node, ctx?: GameCtx) {
    if (!ctx) ctx = { from: 'challenge', gid: 'sudoku', challengeKey: 'daily' };

    // ---- 解析玩法与配置行：关卡表优先，挑战按周期映射，兜底默认 ----
    let cfg: SudokuCfg | null = null;
    let mineCfg: MineCfg | null = null;
    let starCfg: StarCfg | null = null;
    if (ctx.from === 'level') {
        const lv = Config.getLevel(ctx.ci!, ctx.li!);
        ctx.gid = lv.game;
        if (ctx.gid === 'sudoku') cfg = lv.cfgId ? Config.getSudoku(lv.cfgId) : null;
        if (ctx.gid === 'mine') mineCfg = lv.cfgId ? Config.getMine(lv.cfgId) : null;
        if (ctx.gid === 'star') starCfg = lv.cfgId ? Config.getStar(lv.cfgId) : null;
    } else if (ctx.gid === 'sudoku') {
        cfg = Config.getSudoku(Config.getChallengeSudokuId(ctx.challengeKey || 'daily'));
    } else if (ctx.gid === 'mine') {
        mineCfg = Config.getMine(Config.getChallengeMineId(ctx.challengeKey || 'daily'));
    } else if (ctx.gid === 'star') {
        starCfg = Config.getStar(Config.getChallengeStarId(ctx.challengeKey || 'daily'));
    }
    if (ctx.gid === 'sudoku' && !cfg) cfg = Config.getFallbackSudoku();
    if (ctx.gid === 'mine' && !mineCfg) mineCfg = Config.getFallbackMine();
    if (ctx.gid === 'star' && !starCfg) starCfg = Config.getFallbackStar();

    const W = Ui.W(), H = Ui.H();
    const g = GAMES[ctx.gid];
    Ui.background(root, [C.cream1, C.cream2], null);

    const st = { sec: 0, paused: false, sel: -1, finished: false };

    // 数独状态（failGame/结算共享；星数不在局内维护，结算时按错误次数+用时计算）
    const su = {
        board: [] as number[],
        given: [] as boolean[],
        wrong: new Set<number>(),          // 填错的格（与唯一解不符）
        notes: [] as Array<Set<number>>,   // 候选笔记：每格一个数字集合
        lives: 3,                          // ❤️ 血量（buildSudoku 里按配置初始化）
        errors: 0,
    };

    /* 顶栏（数独/扫雷/星之战使用参考图专属布局，见各自 build 函数） */
    let timerLb: Label | null = null;
    if (ctx.gid !== 'sudoku' && ctx.gid !== 'mine' && ctx.gid !== 'star') {
        const top = Ui.node(root, W, 110, 0, H / 2 - 85);
        Ui.circleBtn(top, 84, '⏸', { x: -W / 2 + 80, emojiSize: 40, onClick: openPause });
        const info = Ui.panel(top, 380, 92, { x: 50, r: 24 });
        Ui.label(info, ctx.from === 'level'
            ? `${CHAPTERS[ctx.ci!].name} · 第 ${ctx.li! + 1} 关`
            : `挑战模式 · ${CH_PERIODS.find(p => p.key === ctx!.challengeKey)?.tag ?? ''}`,
            { size: 26, y: 14 });
        Ui.label(info, `${g.icon} ${g.name}`, { size: 22, color: C.inkSoft, y: -22 });
        const timerPill = Ui.pill(top, 210, 72, { x: W / 2 - 140, bg: C.blue, edge: C.blueD });
        Ui.emoji(timerPill, '⏱', 30, -68, 3);
        timerLb = Ui.label(timerPill, '00:00', { size: 28, color: '#FFFFFF', x: 18, y: 3 });
    }

    /* 统一顶栏卡（数独/扫雷/星之战）：⏸（左） + 计时器（中） + 章节关卡竖卡（右） */
    function buildTopCard(topY: number) {
        const topPanel = Ui.panel(root, W - 60, 150, { x: 0, y: topY, r: 26 });
        const pw = (W - 60) / 2;
        Ui.circleBtn(topPanel, 64, '⏸', { x: -pw + 52, emojiSize: 28, onClick: openPause });
        timerLb = Ui.label(topPanel, '00:00', { size: 54, color: C.ink, x: -86, y: 20 });
        Ui.label(topPanel, '计时器', { size: 20, color: C.inkSoft, x: -86, y: -30 });
        const row1 = ctx!.from === 'level' ? `第${ctx!.ci! + 1}章` : '挑战模式';
        const row2 = ctx!.from === 'level' ? CHAPTERS[ctx!.ci!].name : GAMES[ctx!.gid].name;
        const row3 = ctx!.from === 'level'
            ? `第${ctx!.li! + 1}关`
            : `${CH_PERIODS.find(p => p.key === ctx!.challengeKey)?.tag ?? '每日'}挑战`;
        const infoCard = Ui.panel(topPanel, 190, 130, { x: pw - 112, y: 0, r: 18 });
        Ui.label(infoCard, row1, { size: 20, color: C.inkSoft, y: 42 });
        Ui.label(infoCard, row2, { size: 26, color: C.ink, y: 6 });
        Ui.label(infoCard, row3, { size: 20, color: C.inkSoft, y: -40 });
        const sep = Ui.gnode(topPanel, 3, 110, -pw + 118, 0);
        sep.g.fillColor = hex('#EBD9AE');
        sep.g.rect(-1.5, -55, 3, 110);
        sep.g.fill();
    }

    /* 计时（超时扣星为被动计算：结算时按用时重算，不会提前结算） */
    setTimer(() => {
        if (st.paused || st.finished) return;
        st.sec++;
        if (timerLb) timerLb.string = fmtTime(st.sec);
    }, 1000, true);

    const cells: Node[] = [];
    const cellLabels: Array<Label | null> = [];
    const cellGraphs: Graphics[] = [];
    const notesBoxes: Node[] = [];
    const sk = skinOf(SAVE.data.skin);
    let boardSize = 600;
    let board: Node = null!;

    if (ctx.gid === 'sudoku' && cfg) {
        buildSudoku(cfg);
    } else if (ctx.gid === 'mine' && mineCfg) {
        buildMine(mineCfg);
    } else if (ctx.gid === 'star' && starCfg) {
        buildStarBattle(starCfg);
    } else {
        /* 其他玩法：棋盘 + 演示结算（规则后续接入） */
        /* 非数独：棋盘 + 演示结算（规则后续接入） */
        boardSize = Math.min(W - 90, 640);
        const boardY = 50;
        board = Ui.node(root, boardSize + 36, boardSize + 36, 0, boardY);
        const bg = Ui.gnode(board, boardSize + 36, boardSize + 36);
        bg.g.fillColor = hex(sk.frame);
        bg.g.roundRect(-(boardSize + 36) / 2, -(boardSize + 36) / 2, boardSize + 36, boardSize + 36, 26);
        bg.g.fill();
        bg.g.strokeColor = hex('#FFFFFF8C'); bg.g.lineWidth = 7;
        bg.g.roundRect(-(boardSize + 30) / 2, -(boardSize + 30) / 2, boardSize + 30, boardSize + 30, 23);
        bg.g.stroke();
        board.setScale(0.7, 0.7, 1);
        tween(board).delay(0.08).to(0.42, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();

        if (ctx.gid === 'shikaku') drawShikaku();
        else drawKillerLike();

        const toolbar = Ui.node(root, W, 120, 0, -H / 2 + 90);
        Ui.candyBtn(toolbar, 460, 104, '▶ 演示通关结算', [C.greenH, C.green, C.greenD], {
            y: 0, fontSize: 32, delay: 0.3,
            onClick: () => finish(3, 30 + 3 * 10),
        });
        Ui.label(toolbar, '玩法规则后续接入 · 现为展示棋盘', { size: 20, color: C.inkSoft, y: -80 });
    }

    /* ================= 数独（真实规则，配置驱动） ================= */

    function buildSudoku(cfg: SudokuCfg) {
        const N = cfg.type;
        const boxR = N === 6 ? 2 : Math.round(Math.sqrt(N));   // 宫高
        const boxC = N === 6 ? 3 : Math.round(Math.sqrt(N));   // 宫宽
        const seed = ctx!.from === 'level'
            ? ctx!.ci! * 100 + ctx!.li!
            : (ctx!.challengeKey === 'weekly' ? 71 : ctx!.challengeKey === 'monthly' ? 131 : 7);
        const rng = mulberry32(seed * 7919 + N * 13 + 5);

        // 邻格索引（同行/列/宫）
        const peersAt: number[][] = [];
        for (let i = 0; i < N * N; i++) {
            const r = Math.floor(i / N), c = i % N;
            const set = new Set<number>();
            for (let k = 0; k < N; k++) { set.add(r * N + k); set.add(k * N + c); }
            const br = Math.floor(r / boxR) * boxR, bc = Math.floor(c / boxC) * boxC;
            for (let dr = 0; dr < boxR; dr++) for (let dc = 0; dc < boxC; dc++) set.add((br + dr) * N + bc + dc);
            set.delete(i);
            peersAt[i] = [...set];
        }

        // 回溯生成终盘（固定种子 → 同关同题）
        const sol = new Array(N * N).fill(0);
        const solve = (pos: number): boolean => {
            if (pos >= N * N) return true;
            const order: number[] = [];
            for (let v = 1; v <= N; v++) order.push(v);
            for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
            for (const v of order) {
                let ok = true;
                for (const j of peersAt[pos]) if (sol[j] === v) { ok = false; break; }
                if (ok) { sol[pos] = v; if (solve(pos + 1)) return true; sol[pos] = 0; }
            }
            return false;
        };
        solve(0);

        // 挖空（唯一解保证）：按随机顺序逐格试探挖空，每挖一格用求解器验证解仍唯一，
        // 多解则回填该格；固定种子 → 同关同题。实际挖空数 holesCount 可能略少于 cfg.holes。
        const target = Math.min(cfg.holes, N * N - N);
        const order = [...Array(N * N).keys()];
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        const puzzle = sol.slice();
        let holesCount = 0;
        // 数独求解器：数解的个数，数到 2 个即提前退出（limit 剪枝）
        const countSolutions = (grid: number[], from: number): number => {
            let pos = -1;
            for (let i = from; i < N * N; i++) if (grid[i] === 0) { pos = i; break; }
            if (pos < 0) return 1;
            let count = 0;
            for (let v = 1; v <= N; v++) {
                let ok = true;
                for (const j of peersAt[pos]) if (grid[j] === v) { ok = false; break; }
                if (ok) {
                    grid[pos] = v;
                    count += countSolutions(grid, pos + 1);
                    grid[pos] = 0;
                    if (count >= 2) return count;
                }
            }
            return count;
        };
        for (const i of order) {
            if (holesCount >= target) break;
            const keep = puzzle[i];
            puzzle[i] = 0;
            if (countSolutions(puzzle, 0) === 1) holesCount++;
            else puzzle[i] = keep;
        }
        const holesSet = new Set(puzzle.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0));

        su.board = puzzle.map((v, i) => holesSet.has(i) ? 0 : v);
        su.given = [...Array(N * N)].map((_, i) => !holesSet.has(i));
        su.notes = [...Array(N * N)].map(() => new Set<number>());
        su.lives = cfg.lives;

        /* ---------- 参考图布局：统一顶栏 / 统计卡 / 格线棋盘 / 工具 / 胶囊键盘 ---------- */

        // 布局（自底向上）：数字键盘 → 工具行 → 棋盘
        const padY = -H / 2 + 100;
        const toolsY = padY + 134;
        const topY = H / 2 - 105;
        const statsY = topY - 137;
        const boardTop = statsY - 70;
        const boardBottom = toolsY + 58;
        boardSize = Math.min(W - 70, 640, boardTop - boardBottom - 36);
        const boardY = (boardTop + boardBottom) / 2;
        const cs = boardSize / N;

        /* 统一顶栏：⏸（左） + 计时器（中） + 章节关卡卡（右） */
        buildTopCard(topY);

        /* 统计卡 4 张（右→左：最佳时间 / 难度 / 剩余空数 / ❤️血量） */
        const cw = (W - 108) / 4;
        const cardX = (pos: number) => (pos - 1.5) * (cw + 12);
        // 最右：最佳时间
        const cardBest = Ui.panel(root, cw, 104, { x: cardX(3), y: statsY, r: 18 });
        Ui.label(cardBest, '最佳时间', { size: 19, color: C.inkSoft, y: 28 });
        const bestSec = (SAVE.data.best || {})[cfg.id];
        Ui.label(cardBest, bestSec ? fmtTime(bestSec) : '--:--', { size: 26, color: '#C89B3C', y: -16 });
        // 右二：难度（数独·九宫 / 困难）
        const typeName = N === 4 ? '四宫' : N === 6 ? '六宫' : '九宫';
        const cardDiff = Ui.panel(root, cw, 104, { x: cardX(2), y: statsY, r: 18 });
        Ui.label(cardDiff, `数独·${typeName}`, { size: 19, color: C.inkSoft, y: 28 });
        Ui.label(cardDiff, cfg.difficulty, { size: 26, color: C.ink, y: -16 });
        // 右三：剩余空数
        const cardBlank = Ui.panel(root, cw, 104, { x: cardX(1), y: statsY, r: 18 });
        Ui.label(cardBlank, '剩余空数', { size: 19, color: C.inkSoft, y: 28 });
        const blankLb = Ui.label(cardBlank, '', { size: 26, color: C.ink, y: -16 });
        // 最左：❤️ 血量
        const cardLife = Ui.panel(root, cw, 104, { x: cardX(0), y: statsY, r: 18 });
        Ui.label(cardLife, '血量', { size: 19, color: C.inkSoft, y: 28 });
        const heartNodes: Node[] = [];
        for (let i = 0; i < cfg.lives; i++) {
            heartNodes.push(Ui.emoji(cardLife, '❤️', 30, (i - (cfg.lives - 1) / 2) * 38, -16));
        }
        const updateHearts = () => {
            heartNodes.forEach((n, i) => {
                const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
                op.opacity = i < su.lives ? 255 : 55;
            });
        };

        /** 星级仅在结算时计算：3 − 超时达到阈值数 − 错误达到阈值数（最低 0） */
        const calcStars = (): number => {
            const timeoutDed = cfg!.timeCostStar.filter(t => st.sec >= t).length;
            const errorDed = cfg!.errorCostStar.filter(e => su.errors >= e).length;
            return Math.max(0, 3 - timeoutDed - errorDed);
        };
        // 剩余空数（分母为实际挖空数）
        const updateBlank = () => {
            let left = 0;
            for (let i = 0; i < N * N; i++) if (!su.given[i] && su.board[i] === 0) left++;
            blankLb.string = `${left}/${holesCount}`;
        };
        updateBlank();
        updateHearts();

        /* 棋盘：白金外框 + 米黄盘面 + 格线（宫粗线），数字位于格线之下层 */
        board = Ui.node(root, boardSize + 30, boardSize + 30, 0, boardY);
        const frame = Ui.gnode(board, boardSize + 30, boardSize + 30);
        Ui.rr(frame.g, boardSize + 30, boardSize + 30, 20, '#C8A058');
        const frameIn = Ui.gnode(board, boardSize + 22, boardSize + 22);
        Ui.rr(frameIn.g, boardSize + 22, boardSize + 22, 16, sk.frame);
        const face = Ui.gnode(board, boardSize + 12, boardSize + 12);
        Ui.rr(face.g, boardSize + 12, boardSize + 12, 12, sk.cell);

        // 格线层（先建 → 位于格子节点之下）
        const lines = Ui.gnode(board, boardSize, boardSize);
        const half = boardSize / 2;
        lines.g.strokeColor = hex('#D8C49E');
        lines.g.lineWidth = 2;
        for (let k = 1; k < N; k++) {
            if (k % boxR !== 0) { lines.g.moveTo(-half, half - k * cs); lines.g.lineTo(half, half - k * cs); }
            if (k % boxC !== 0) { lines.g.moveTo(-half + k * cs, half); lines.g.lineTo(-half + k * cs, -half); }
        }
        lines.g.stroke();
        lines.g.strokeColor = hex(sk.given, 230);
        lines.g.lineWidth = 5;
        for (let k = 1; k < N; k++) {
            if (k % boxR === 0) { lines.g.moveTo(-half, half - k * cs); lines.g.lineTo(half, half - k * cs); }
            if (k % boxC === 0) { lines.g.moveTo(-half + k * cs, half); lines.g.lineTo(-half + k * cs, -half); }
        }
        lines.g.stroke();
        lines.g.strokeColor = hex(sk.given);
        lines.g.lineWidth = 6;
        lines.g.roundRect(-half, -half, boardSize, boardSize, 6);
        lines.g.stroke();

        /* 格子（透明命中区 + 高亮底色），参考图风格：平时无底色 */
        const redrawAll = () => { for (let i = 0; i < N * N; i++) redrawCell(i); };
        const redrawCell = (i: number) => {
            const cg = cellGraphs[i];
            cg.clear();
            const sz = cs - 6;
            const wrong = su.wrong.has(i);
            let fillC: string | Color | null = wrong ? '#FFC2C2' : null;
            if (!wrong && st.sel === i) fillC = '#FFE9A8';
            else if (!wrong && st.sel >= 0 && peersAt[st.sel].includes(i)) fillC = hex(sk.hi, 90);
            if (fillC) {
                Ui.rr(cg, sz, sz, 8, fillC);
                if (st.sel === i) {
                    cg.strokeColor = hex('#F0A83C');
                    cg.lineWidth = 3;
                    cg.roundRect(-sz / 2 + 2, -sz / 2 + 2, sz - 4, sz - 4, 7);
                    cg.stroke();
                }
            }
            const lb = cellLabels[i]!;
            const v = su.board[i];
            if (v) {
                lb.string = String(v);
                lb.color = hex(su.given[i] ? sk.given : (wrong ? '#D04848' : sk.user));
            } else {
                lb.string = '';
            }

            // 候选笔记：空格时按宫格布局渲染小数字
            const box = notesBoxes[i];
            box.destroyAllChildren();
            if (v === 0 && su.notes[i] && su.notes[i].size) {
                const arr = [...su.notes[i]].sort((a, b) => a - b);
                arr.forEach(nv => {
                    const row = Math.floor((nv - 1) / boxC), col = (nv - 1) % boxC;
                    const lx = (col - (boxC - 1) / 2) * cs * 0.3;
                    const ly = ((boxR - 1) / 2 - row) * cs * 0.3;
                    Ui.label(box, String(nv), { size: cs * 0.24, color: '#8A7A5E', x: lx, y: ly, bold: false });
                });
            }
        };

        eachCell(N, (i, x, y) => {
            const holder = Ui.node(board, cs, cs, x, y);
            const cg = Ui.gnode(holder, cs, cs);
            cells.push(holder);
            cellGraphs.push(cg.g);
            cellLabels.push(Ui.label(holder, '', { size: cs * 0.52, color: sk.user }));
            notesBoxes.push(Ui.node(holder, cs, cs));   // 候选笔记层（数字之上）
            if (holesSet.has(i)) {
                Ui.bindTap(holder, () => {
                    if (st.finished) return;
                    st.sel = i; redrawAll(); repaintKeys();
                });
            }
        });
        redrawAll();

        /* 数字键盘：胶囊键 + 右下剩余小数字（选中格时同行/列/宫已有数字自动置灰） */
        const pad = Ui.node(root, W - 80, 110, 0, padY);
        const slot = (W - 96) / N;
        const keys: Array<{ g: Graphics; numLb: Label; cntLb: Label }> = [];
        const paintKey = (k: { g: Graphics; numLb: Label; cntLb: Label }, v: number, blocked: boolean) => {
            const kw = Math.min(slot - 8, 110);
            const used = su.board.filter(x => x === v).length;
            const left = Math.max(0, N - used);
            const done = left <= 0;
            const dim = done || blocked;
            k.g.clear();
            Ui.rr(k.g, kw, 104, 28, '#E2D4B0');
            Ui.rr(k.g, kw - 6, 98, 25, dim ? '#EDE6D4' : C.panel);
            k.g.strokeColor = hex(done || blocked ? '#D8CDB4' : C.panelLine);
            k.g.lineWidth = 2.5;
            k.g.roundRect(-(kw - 6) / 2 + 1, -48, kw - 8, 95, 23);
            k.g.stroke();
            k.numLb.color = hex(dim ? '#C9BFA8' : C.ink);
            k.cntLb.string = String(left);
            k.cntLb.color = hex(done ? '#C9BFA8' : '#C89B3C');
        };
        for (let v = 1; v <= N; v++) {
            const kx = (v - 1 - (N - 1) / 2) * slot;
            const key = Ui.node(pad, slot - 8, 110, kx, 0);
            const kg = Ui.gnode(key, slot - 8, 110);
            const numLb = Ui.label(key, String(v), { size: Math.min(46, slot * 0.46), y: 4 });
            const kw2 = Math.min(slot - 8, 110);
            const cntLb = Ui.label(key, String(N), { size: 20, color: '#C89B3C', x: kw2 / 2 - 20, y: -30 });
            keys.push({ g: kg.g, numLb, cntLb });
            const vv = v;
            Ui.bindTap(key, () => fill(vv));
            paintKey(keys[v - 1], v, false);
        }
        const repaintKeys = () => {
            // 选中格时：同行/列/宫已填的数字置灰
            const blockedNums = new Set<number>();
            if (st.sel >= 0) {
                for (const j of peersAt[st.sel]) {
                    const v = su.board[j];
                    if (v) blockedNums.add(v);
                }
            }
            for (let v = 1; v <= N; v++) paintKey(keys[v - 1], v, blockedNums.has(v));
        };

        /* 工具行：候选 / 提示 / 擦除 */
        const tools = Ui.node(root, W, 96, 0, toolsY);
        const bw = (W - 128) / 3;
        let hints = 3;
        let noteMode = false;
        const noteBtn = Ui.candyBtn(tools, bw, 96, '✏ 候选', [C.greenH, C.green, C.greenD], {
            x: -(bw + 14), fontSize: 30,
            onClick: () => {
                noteMode = !noteMode;
                paintNoteBtn();
                Modal.toast(noteMode ? '✏️ 候选模式：点数字记录笔记' : '已退出候选模式');
            },
        });
        const paintNoteBtn = () => {
            const c: [string, string, string] = noteMode ? [C.blueH, C.blue, C.blueD] : [C.greenH, C.green, C.greenD];
            const bodyG = noteBtn.children[0].getComponent(Graphics)!;
            bodyG.clear();
            Ui.rr(bodyG, bw, 96, 30, c[2]);
            const mainG = noteBtn.children[1].getComponent(Graphics)!;
            mainG.clear();
            Ui.rr(mainG, bw, 88, 30, c[1]);
            const lb = findBtnLabel(noteBtn);
            if (lb) lb.string = noteMode ? '✏ 候选中' : '✏ 候选';
        };
        const hintBtn = Ui.candyBtn(tools, bw, 96, '💡 提示', [C.goldH, C.gold, C.goldD], {
            x: 0, fontSize: 30,
            onClick: () => {
                if (st.finished) return;
                if (hints <= 0) { Modal.toast('提示已用完，相信自己！💪'); return; }
                const empties = su.board.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
                if (!empties.length) return;
                hints--;
                const lb = findBtnLabel(hintBtn);
                if (lb) lb.string = `💡 提示`;
                const i = empties[Math.floor(Math.random() * empties.length)];
                su.board[i] = sol[i];
                st.sel = -1;
                afterFill(i);
            },
        });
        Ui.candyBtn(tools, bw, 96, '🧽 擦除', [C.pinkH, C.pink, C.pinkD], {
            x: bw + 14, fontSize: 30,
            onClick: () => {
                if (st.finished || st.sel < 0) { if (st.sel < 0 && !st.finished) Modal.toast('先选择一个空格子'); return; }
                if (su.given[st.sel]) return;
                su.board[st.sel] = 0;
                su.notes[st.sel].clear();
                st.sel = -1;
                redrawAll();
                repaintKeys();
                updateBlank();
            },
        });

        /* 填入 / 候选笔记 / 冲突 / 胜负 */
        function fill(v: number) {
            if (st.finished || st.sel < 0) { if (st.sel < 0 && !st.finished) Modal.toast('先选择一个空格子'); return; }
            const i = st.sel;
            if (su.given[i]) return;
            // 候选模式：在空格上记/删笔记，不影响正式填写
            if (noteMode) {
                if (su.board[i] > 0) { Modal.toast('该格已填数字，擦除后才能记候选'); return; }
                if (su.notes[i].has(v)) su.notes[i].delete(v); else su.notes[i].add(v);
                redrawCell(i);
                return;
            }
            if (su.board[i] === v) return;
            su.board[i] = v;
            afterFill(i);
        }
        function afterFill(changed: number) {
            // 清本格笔记与标记，并移除同行/列/宫相关格的该数字笔记
            su.notes[changed].clear();
            for (const j of peersAt[changed]) su.notes[j].delete(su.board[changed]);
            redrawAll();
            repaintKeys();
            updateBlank();
            if (su.board[changed] !== sol[changed]) {
                // 答案比对模式：填入的数字与唯一解不符 → 扣一颗 ❤️，血量扣完直接失败结算
                su.errors++;
                su.lives--;
                su.wrong.add(changed);
                updateHearts();
                Ui.shake(cells[changed]);
                Modal.toast(`填错啦！${su.board[changed]} 不在这个格子`);
                if (su.lives <= 0) { failGame('血量耗尽', su.errors); return; }
            } else {
                su.wrong.delete(changed);
                redrawAll();
                if (su.board.every(x => x > 0)) {
                    // 全部按唯一解填对 → 通关（星级此时才计算，可能 0 星）
                    console.log('[Sudoku] 盘面完成 ✓ 星 =', calcStars());
                    winGame();
                }
            }
        }
        function winGame() {
            if (st.finished) return;
            st.paused = true;
            // 记录最佳时间（按数独配置 id）
            const best = SAVE.data.best || (SAVE.data.best = {});
            if (!best[cfg.id] || st.sec < best[cfg.id]) best[cfg.id] = st.sec;
            finish(calcStars(), cfg!.rewardCoins);   // st.finished 由 finish 内部置位
        }
    }

    function findBtnLabel(btn: Node): Label | null {
        for (const ch of btn.children) {
            const lb = ch.getComponent(Label);
            if (lb) return lb;
        }
        return null;
    }

    /* ================= 展示型棋盘（扫雷/星之战/数方/杀手） ================= */

    function eachCell(grid: number, cb: (i: number, x: number, y: number, cs: number) => void) {
        const cs = boardSize / grid;
        for (let i = 0; i < grid * grid; i++) {
            const r = Math.floor(i / grid), c = i % grid;
            cb(i, -boardSize / 2 + cs / 2 + c * cs, boardSize / 2 - cs / 2 - r * cs, cs);
        }
    }

    function drawKillerLike() {
        // 杀手数独：数独盘面为底的笼子和数装饰（规则后续接入）
        const N = 9;
        const cs = boardSize / N;
        const seed = ctx!.from === 'level' ? ctx!.ci! * 100 + ctx!.li! : 20260918;
        const rng = mulberry32(seed * 7919 + 13);
        const idx = [...Array(81).keys()];
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        const holesSet = new Set(idx.slice(0, 30));
        const cageSums = ['15', '8', '12', '21', '17', '5', '14', '9', '13'];
        eachCell(N, (i, x, y) => {
            const r = Math.floor(i / N), c = i % N;
            const holder = Ui.node(board, cs - 6, cs - 6, x, y);
            const cg = Ui.gnode(holder, cs - 6, cs - 6);
            const alt = (Math.floor(r / 3) + Math.floor(c / 3)) % 2;
            Ui.rr(cg.g, cs - 6, cs - 6, 8, alt ? sk.cellAlt : sk.cell);
            cells.push(holder);
            cellGraphs.push(cg.g);
            const v = holesSet.has(i) ? 0 : (i * 7 + 3) % 9 + 1;
            cellLabels.push(Ui.label(holder, String(v), { size: cs * 0.55, color: sk.given }));
            Ui.bindTap(holder, () => {
                holder.setScale(0.9, 0.9, 1);
                tween(holder).to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            });
        });
        const krng = mulberry32(seed + 7);
        for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
            const rr = br * 3 + Math.floor(krng() * 3), cc = bc * 3 + Math.floor(krng() * 3);
            Ui.label(board, cageSums[(br * 3 + bc) % cageSums.length], {
                size: cs * 0.28, color: sk.user,
                x: -boardSize / 2 + cs / 2 + cc * cs - cs * 0.32,
                y: boardSize / 2 - cs / 2 - rr * cs + cs * 0.28,
            });
        }
    }

    /* ================= 扫雷（真实规则，配置驱动） ================= */

    function buildMine(cfg: MineCfg) {
        const N = cfg.board;

        /* 布局（与数独同款参考图结构） */
        const padY = -H / 2 + 100;
        const toolsY = padY + 122;
        const topY = H / 2 - 105;
        const statsY = topY - 137;
        const boardTop = statsY - 70;
        const boardBottom = toolsY + 58;
        boardSize = Math.min(W - 70, 640, boardTop - boardBottom - 36);
        const boardY = (boardTop + boardBottom) / 2;
        const cs = boardSize / N;

        /* 统一顶栏：⏸（左） + 计时器（中） + 章节关卡卡（右） */
        buildTopCard(topY);

        /* 统计卡 3 张（右→左：最佳时间 / 难度 / 剩余雷数） */
        const cw = (W - 108) / 3;
        const cardX = (pos: number) => (pos - 1) * (cw + 12);
        // 最左：剩余雷数
        const cardMine = Ui.panel(root, cw, 104, { x: cardX(0), y: statsY, r: 18 });
        Ui.label(cardMine, '剩余雷数', { size: 20, color: C.inkSoft, y: 28 });
        const mineLb = Ui.label(cardMine, String(cfg.mines), { size: 32, color: C.ink, y: -16 });
        // 中间：难度（扫雷·N×N / 困难）
        const cardDiff = Ui.panel(root, cw, 104, { x: cardX(1), y: statsY, r: 18 });
        Ui.label(cardDiff, `扫雷·${cfg.board}×${cfg.board}`, { size: 19, color: C.inkSoft, y: 28 });
        Ui.label(cardDiff, cfg.difficulty, { size: 26, color: C.ink, y: -16 });
        // 最右：最佳时间
        const cardBest = Ui.panel(root, cw, 104, { x: cardX(2), y: statsY, r: 18 });
        Ui.label(cardBest, '最佳时间', { size: 20, color: C.inkSoft, y: 28 });
        const bestSec = (SAVE.data.best || {})[cfg.id];
        Ui.label(cardBest, bestSec ? fmtTime(bestSec) : '--:--', { size: 32, color: '#C89B3C', y: -16 });

        /** 星级在结算时计算：踩雷即失败（无错误维度），仅按超时阶梯扣星 */
        const calcStars = (): number => {
            const timeoutDed = cfg!.timeCostStar.filter(t => st.sec >= t).length;
            return Math.max(0, 3 - timeoutDed);
        };

        /* 状态 */
        const N2 = N * N;
        let mines = new Set<number>();
        const state = new Array(N2).fill(0);   // 0 未翻 / 1 翻开 / 2 插旗 / 3 踩过的雷
        let flags = 0, errors = 0, first = true, flagMode = false;
        let openedSafe = 0;

        const around = (i: number, fn: (j: number) => void) => {
            const r = Math.floor(i / N), c = i % N;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                if (!dr && !dc) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < N && nc >= 0 && nc < N) fn(nr * N + nc);
            }
        };

        /* 首点保护：雷避开首点及其周围（首点周围无雷，首击必有扩散） */
        const placeMines = (safe: number) => {
            const banned = new Set<number>([safe]);
            around(safe, j => banned.add(j));
            mines = new Set<number>();
            while (mines.size < Math.min(cfg.mines, N2 - banned.size)) {
                const i = Math.floor(Math.random() * N2);
                if (!banned.has(i)) mines.add(i);
            }
        };
        const countAt = (i: number) => { let n = 0; around(i, j => { if (mines.has(j)) n++; }); return n; };

        /* 棋盘 */
        board = Ui.node(root, boardSize + 30, boardSize + 30, 0, boardY);
        const frame = Ui.gnode(board, boardSize + 30, boardSize + 30);
        Ui.rr(frame.g, boardSize + 30, boardSize + 30, 20, '#C8A058');
        const frameIn = Ui.gnode(board, boardSize + 22, boardSize + 22);
        Ui.rr(frameIn.g, boardSize + 22, boardSize + 22, 16, sk.frame);
        const face = Ui.gnode(board, boardSize + 12, boardSize + 12);
        Ui.rr(face.g, boardSize + 12, boardSize + 12, 12, sk.cellAlt);

        const sz = cs - 6;
        const drawCell = (i: number) => {
            const cg = cellGraphs[i];
            cg.clear();
            const s = state[i];
            const lb = cellLabels[i]!;
            if (s === 1 || s === 3) {
                // 翻开 / 踩过的雷：平坦
                Ui.rr(cg, sz, sz, 6, s === 3 ? '#FFC2C2' : sk.cell);
                if (s === 3) { lb.string = '💣'; lb.fontSize = sz * 0.5; lb.color = hex('#333333'); }
            } else {
                // 未翻 / 插旗：凸起
                Ui.rr(cg, sz, sz, 6, '#00000030');
                Ui.rr(cg, sz - 5, sz - 5, 5, sk.cellAlt);
                cg.fillColor = hex('#FFFFFF45');
                cg.roundRect(-(sz - 5) / 2 + 3, (sz - 5) * 0.12, sz - 11, (sz - 5) * 0.26, 4);
                cg.fill();
                lb.string = s === 2 ? '🚩' : '';
                lb.fontSize = sz * 0.5;
            }
        };
        const setLabel = (i: number, text: string, color: string) => {
            const lb = cellLabels[i]!;
            lb.string = text;
            lb.color = hex(color);
            lb.fontSize = text.length > 1 ? sz * 0.5 : sz * 0.55;
        };

        eachCell(N, (i, x, y) => {
            const holder = Ui.node(board, cs - 6, cs - 6, x, y);
            const cg = Ui.gnode(holder, cs - 6, cs - 6);
            cells.push(holder);
            cellGraphs.push(cg.g);
            cellLabels.push(Ui.label(holder, '', { size: sz * 0.55 }));
            Ui.bindTap(holder, () => tapCell(i));
        });
        for (let i = 0; i < N2; i++) drawCell(i);

        /* 翻格（含扩散） */
        const openCell = (i: number) => {
            if (state[i] !== 0) return;
            state[i] = 1;
            openedSafe++;
            const n = countAt(i);
            drawCell(i);
            if (mines.has(i)) return;   // 理论不可达（雷在外层处理）
            if (n > 0) setLabel(i, String(n), NUM_COLORS[n - 1]);
            else around(i, j => { if (state[j] === 0) openCell(j); });
        };

        const tapCell = (i: number) => {
            if (st.finished) return;
            const s = state[i];
            if (flagMode) {
                // 插旗 / 拔旗（仅未翻格）
                if (s === 2) { state[i] = 0; flags--; }
                else if (s === 0) { state[i] = 2; flags++; }
                else return;
                mineLb.string = String(Math.max(0, cfg.mines - flags));
                drawCell(i);
                return;
            }
            if (s === 2) return;                 // 旗格不能挖
            if (first) { placeMines(i); first = false; }
            if (mines.has(i)) {
                // 踩雷：立即失败结算（先看 0.6 秒爆炸再弹面板）
                errors++;
                state[i] = 3;
                drawCell(i);
                setLabel(i, '💥', '#333333');
                Ui.shake(cells[i]);
                setTimer(() => failGame('踩到雷！', errors), 600);
                return;
            }
            openCell(i);
            checkWin();
        };

        const checkWin = () => {
            if (st.finished || first) return;
            if (openedSafe >= N2 - cfg.mines) {
                st.paused = true;
                console.log('[Mine] 扫雷完成 ✓ 星 =', calcStars());
                winGame();
            }
        };

        function winGame() {
            if (st.finished) return;
            st.paused = true;
            // 记录最佳时间（按扫雷配置 id）
            const best = SAVE.data.best || (SAVE.data.best = {});
            if (!best[cfg.id] || st.sec < best[cfg.id]) best[cfg.id] = st.sec;
            finish(calcStars(), cfg!.rewardCoins);   // st.finished 由 finish 内部置位
        }

        /* 工具行：插旗模式（剩余雷数见上方统计卡） */
        const tools = Ui.node(root, W, 96, 0, toolsY);
        const flagBtn = Ui.candyBtn(tools, 300, 96, '🚩 挖掘模式', [C.blueH, C.blue, C.blueD], {
            x: 0, fontSize: 30,
            onClick: () => {
                flagMode = !flagMode;
                const lb = findBtnLabel(flagBtn);
                if (lb) lb.string = flagMode ? '🚩 插旗模式' : '🚩 挖掘模式';
                paintFlagBtn();
                Modal.toast(flagMode ? '🚩 插旗模式：点格子插旗' : '⛏️ 挖掘模式：点格子翻开');
            },
        });
        const paintFlagBtn = () => {
            const c: [string, string, string] = flagMode ? [C.goldH, C.gold, C.goldD] : [C.blueH, C.blue, C.blueD];
            const bodyG = flagBtn.children[0].getComponent(Graphics)!;
            bodyG.clear();
            Ui.rr(bodyG, 300, 96, 30, c[2]);
            const mainG = flagBtn.children[1].getComponent(Graphics)!;
            mainG.clear();
            Ui.rr(mainG, 300, 88, 30, c[1]);
            const lb = findBtnLabel(flagBtn);
            if (lb) lb.string = flagMode ? '🚩 插旗模式' : '🚩 挖掘模式';
        };
    }

    /* ================= 星之战（真实规则，配置驱动） ================= */

    function buildStarBattle(cfg: StarCfg) {
        const N = cfg.board, K = cfg.stars;
        const totalStarsNeed = N * K;

        // 出题（同步生成；固定种子 → 同关同题；失败换种子重试）
        let seed = ctx!.from === 'level'
            ? ctx!.ci! * 100 + ctx!.li!
            : (ctx!.challengeKey === 'weekly' ? 71 : ctx!.challengeKey === 'monthly' ? 131 : 7);
        let puzzle = genStarPuzzle(N, K, seed);
        for (let t = 1; t <= 4 && !puzzle; t++) puzzle = genStarPuzzle(N, K, seed + t * 977);
        if (!puzzle) {
            Modal.open(box => {
                const p = Ui.panel(box, 560, 420);
                Ui.label(p, '⚠️ 本关题目生成异常', { size: 36, y: 60 });
                Ui.label(p, '请退出后重试', { size: 24, color: C.inkSoft, y: 5 });
                Ui.candyBtn(p, 220, 90, '退 出', [C.pinkH, C.pink, C.pinkD], { y: -100, fontSize: 30, onClick: () => { Modal.close(); Router.back(); } });
            });
            return;
        }

        /* 布局（同数独/扫雷参考图结构） */
        const toolsY = -H / 2 + 222;
        const topY = H / 2 - 105;
        const statsY = topY - 137;
        const boardTop = statsY - 70;
        const boardBottom = toolsY + 58;
        boardSize = Math.min(W - 70, 640, boardTop - boardBottom - 36);
        const boardY = (boardTop + boardBottom) / 2;
        const cs = boardSize / N;

        /* 统一顶栏：⏸（左） + 计时器（中） + 章节关卡卡（右） */
        buildTopCard(topY);

        /* 统计卡 3 张（右→左：最佳时间 / 难度 / 已放星数） */
        const cw = (W - 108) / 3;
        const cardX = (pos: number) => (pos - 1) * (cw + 12);
        // 最左：已放星数
        const cardPut = Ui.panel(root, cw, 104, { x: cardX(0), y: statsY, r: 18 });
        Ui.label(cardPut, '已放星数', { size: 20, color: C.inkSoft, y: 28 });
        const putLb = Ui.label(cardPut, `0/${totalStarsNeed}`, { size: 32, color: C.ink, y: -16 });
        // 中间：难度（星之战·K星 / 困难）
        const cardDiff = Ui.panel(root, cw, 104, { x: cardX(1), y: statsY, r: 18 });
        Ui.label(cardDiff, `星之战·${K}星`, { size: 19, color: C.inkSoft, y: 28 });
        Ui.label(cardDiff, cfg.difficulty, { size: 26, color: C.ink, y: -16 });
        // 最右：最佳时间
        const cardBest = Ui.panel(root, cw, 104, { x: cardX(2), y: statsY, r: 18 });
        Ui.label(cardBest, '最佳时间', { size: 20, color: C.inkSoft, y: 28 });
        const bestSec = (SAVE.data.best || {})[cfg.id];
        Ui.label(cardBest, bestSec ? fmtTime(bestSec) : '--:--', { size: 32, color: '#C89B3C', y: -16 });

        /** 星级在结算时计算：星之战无失败路径，仅按超时阶梯扣星 */
        const calcStars = (): number => {
            const timeoutDed = cfg!.timeCostStar.filter(t => st.sec >= t).length;
            return Math.max(0, 3 - timeoutDed);
        };

        /* 玩法状态：0 空 / 1 星 / 2 X 排除标记，点击循环 */
        const cellState = new Array(N * N).fill(0);

        /* 棋盘：区域色块 + 区域粗界线 + 格线 */
        board = Ui.node(root, boardSize + 30, boardSize + 30, 0, boardY);
        const frame = Ui.gnode(board, boardSize + 30, boardSize + 30);
        Ui.rr(frame.g, boardSize + 30, boardSize + 30, 20, '#C8A058');
        const frameIn = Ui.gnode(board, boardSize + 22, boardSize + 22);
        Ui.rr(frameIn.g, boardSize + 22, boardSize + 22, 16, sk.frame);
        const face = Ui.gnode(board, boardSize + 12, boardSize + 12);
        Ui.rr(face.g, boardSize + 12, boardSize + 12, 12, sk.cell);

        // 区域色块（波前区域随索引取浅色）
        const regionTints = ['#F7E7C5', '#E8F0D8', '#F9E4D4', '#DDEBF7', '#F2E4F7', '#E4F2EF', '#F7EDD4', '#E7E9F7', '#F0E4E0', '#E2F0E2', '#F7E0EA', '#E0EDF0'];
        for (let i = 0; i < N * N; i++) {
            const r = Math.floor(i / N), c = i % N;
            const x = -boardSize / 2 + cs / 2 + c * cs;
            const y = boardSize / 2 - cs / 2 - r * cs;
            const tint = Ui.gnode(board, cs, cs, x, y);
            Ui.rr(tint.g, cs, cs, 0, regionTints[puzzle.regions[i] % regionTints.length] ?? sk.cell);
        }
        // 格线 + 区域粗界线
        const lines = Ui.gnode(board, boardSize, boardSize);
        const half = boardSize / 2;
        lines.g.strokeColor = hex('#D8C49E');
        lines.g.lineWidth = 2;
        for (let k = 1; k < N; k++) {
            lines.g.moveTo(-half, half - k * cs); lines.g.lineTo(half, half - k * cs);
            lines.g.moveTo(-half + k * cs, half); lines.g.lineTo(-half + k * cs, -half);
        }
        lines.g.stroke();
        lines.g.strokeColor = hex(sk.given);
        lines.g.lineWidth = 6;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
            const i = r * N + c;
            const x = -half + c * cs, y = half - r * cs - cs;
            if (r === 0 || puzzle.regions[i] !== puzzle.regions[i - N]) { lines.g.moveTo(x, y + cs); lines.g.lineTo(x + cs, y + cs); }
            if (r === N - 1 || puzzle.regions[i] !== puzzle.regions[i + N]) { lines.g.moveTo(x, y); lines.g.lineTo(x + cs, y); }
            if (c === 0 || puzzle.regions[i] !== puzzle.regions[i - 1]) { lines.g.moveTo(x, y); lines.g.lineTo(x, y + cs); }
            if (c === N - 1 || puzzle.regions[i] !== puzzle.regions[i + 1]) { lines.g.moveTo(x + cs, y); lines.g.lineTo(x + cs, y + cs); }
        }
        lines.g.stroke();

        /* 格子（透明命中 + 状态绘制：星/X/冲突红） */
        const sz = cs - 6;
        const conflicts = new Set<number>();
        const redrawAll = () => { for (let i = 0; i < N * N; i++) redrawCell(i); };
        const redrawCell = (i: number) => {
            const cg = cellGraphs[i];
            cg.clear();
            const lb = cellLabels[i]!;
            const s = cellState[i];
            if (s === 1) {
                const bad = conflicts.has(i);
                Ui.rr(cg, sz, sz, 8, bad ? '#FFC2C2' : '#FFE9A8');
                lb.string = '⭐';
                lb.fontSize = sz * 0.55;
                lb.color = hex(bad ? '#D04848' : '#E8940A');
            } else if (s === 2) {
                lb.string = '✕';
                lb.fontSize = sz * 0.5;
                lb.color = hex('#C9B896');
            } else {
                lb.string = '';
            }
        };
        const recount = () => {
            // 相邻冲突
            conflicts.clear();
            for (let i = 0; i < N * N; i++) {
                if (cellState[i] !== 1) continue;
                for (const j of neighborsOf(i, N)) if (cellState[j] === 1) { conflicts.add(i); conflicts.add(j); }
            }
            let placed = 0;
            for (let i = 0; i < N * N; i++) if (cellState[i] === 1) placed++;
            putLb.string = `${placed}/${totalStarsNeed}`;
            return placed;
        };
        const checkWin = () => {
            if (st.finished) return;
            let placed = 0;
            for (let i = 0; i < N * N; i++) if (cellState[i] === 1) placed++;
            if (placed !== totalStarsNeed || conflicts.size > 0) return;
            // 行/列/区域各恰 K 星
            const rowC = new Array(N).fill(0), colC = new Array(N).fill(0), regC = new Array(N).fill(0);
            for (let i = 0; i < N * N; i++) {
                if (cellState[i] !== 1) continue;
                rowC[Math.floor(i / N)]++; colC[i % N]++; regC[puzzle.regions[i]]++;
            }
            const ok = rowC.every(v => v === K) && colC.every(v => v === K) && regC.every(v => v === K);
            if (!ok) return;   // 不满足则继续（可辅助高亮，暂留给玩家自查）
            st.paused = true;
            console.log('[Star] 星之战完成 ✓ 星 =', calcStars());
            winGame();
        };
        function winGame() {
            if (st.finished) return;
            st.paused = true;
            const best = SAVE.data.best || (SAVE.data.best = {});
            if (!best[cfg.id] || st.sec < best[cfg.id]) best[cfg.id] = st.sec;
            finish(calcStars(), cfg!.rewardCoins);   // st.finished 由 finish 内部置位
        }

        eachCell(N, (i, x, y) => {
            const holder = Ui.node(board, cs, cs, x, y);
            const cg = Ui.gnode(holder, cs, cs);
            cells.push(holder);
            cellGraphs.push(cg.g);
            cellLabels.push(Ui.label(holder, '', { size: sz * 0.55 }));
            Ui.bindTap(holder, () => {
                if (st.finished) return;
                if (excludeMode) {
                    // 排除模式：点空格打/去 ✕（星格不受影响）
                    if (cellState[i] !== 1) cellState[i] = cellState[i] === 2 ? 0 : 2;
                    recount();
                    redrawAll();
                    return;
                }
                cellState[i] = (cellState[i] + 1) % 3;   // 空 → 星 → X → 空
                recount();
                redrawAll();
                checkWin();
            });
        });
        // 滑动批量排除：仅排除模式下生效——按住划过的空格统一标记为 ✕（放星格不受影响）
        board.on(Node.EventType.TOUCH_MOVE, (e: any) => {
            if (st.finished || !excludeMode) return;
            const ut = board.getComponent(UITransform)!;
            const loc = e.getUILocation();
            const local = ut.convertToNodeSpaceAR(loc);
            const c = Math.floor((local.x + boardSize / 2) / cs);
            const r = Math.floor((boardSize / 2 - local.y) / cs);
            if (r < 0 || r >= N || c < 0 || c >= N) return;
            const i = r * N + c;
            if (cellState[i] === 0) {
                cellState[i] = 2;
                recount();
                redrawAll();
            }
        });
        recount();
        redrawAll();

        /* 工具行：✕ 排除切换 / 🧹 清除全部 */
        const tools = Ui.node(root, W, 96, 0, toolsY);
        let excludeMode = false;
        const exBtn = Ui.candyBtn(tools, 300, 96, '✕ 排除', [C.blueH, C.blue, C.blueD], {
            x: -170, fontSize: 30,
            onClick: () => {
                excludeMode = !excludeMode;
                paintExBtn();
                Modal.toast(excludeMode ? '✕ 排除模式：点格子标记排除' : '已退出排除模式');
            },
        });
        const paintExBtn = () => {
            const c: [string, string, string] = excludeMode ? [C.goldH, C.gold, C.goldD] : [C.blueH, C.blue, C.blueD];
            const bodyG = exBtn.children[0].getComponent(Graphics)!;
            bodyG.clear();
            Ui.rr(bodyG, 300, 96, 30, c[2]);
            const mainG = exBtn.children[1].getComponent(Graphics)!;
            mainG.clear();
            Ui.rr(mainG, 300, 88, 30, c[1]);
            const lb = findBtnLabel(exBtn);
            if (lb) lb.string = excludeMode ? '✕ 排除中' : '✕ 排除';
        };
        Ui.candyBtn(tools, 300, 96, '🧹 清除全部', [C.pinkH, C.pink, C.pinkD], {
            x: 170, fontSize: 30,
            onClick: () => {
                if (st.finished) return;
                for (let i = 0; i < N * N; i++) cellState[i] = 0;
                recount();
                redrawAll();
            },
        });
        Ui.label(tools, `点击格子循环：放星 ⭐ → 标记 ✕ → 清空（每行/列/区域各 ${K} 星，星不相邻）`, { size: 19, color: C.inkSoft, y: -76 });
    }

    function neighborsOf(i: number, N: number): number[] {
        const out: number[] = [];
        const r = Math.floor(i / N), c = i % N;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
        }
        return out;
    }

    function drawShikaku() {
        const cs = boardSize / 10;
        const rectColors = ['rgba(127,199,255,0.55)', 'rgba(255,178,120,0.55)', 'rgba(178,235,140,0.55)', 'rgba(255,150,190,0.55)', 'rgba(200,160,255,0.55)', 'rgba(255,230,120,0.55)', 'rgba(140,230,220,0.55)'];
        const fills = new Array(100).fill(-1);
        SHIKAKU_RECTS.forEach(([r0, c0, h, w], ri) => {
            for (let k = 0; k < h * w; k++) {
                const rr = r0 + Math.floor(k / w), cc = c0 + (k % w);
                if (rr < 10 && cc < 10) fills[rr * 10 + cc] = ri;
            }
        });
        eachCell(10, (i, x, y) => {
            const r = Math.floor(i / 10), c = i % 10;
            const holder = Ui.node(board, cs - 4, cs - 4, x, y);
            const cg = Ui.gnode(holder, cs - 4, cs - 4);
            Ui.rr(cg.g, cs - 4, cs - 4, 6, (r + c) % 2 ? sk.cellAlt : sk.cell);
            const ri = fills[i];
            if (ri >= 0) {
                cg.g.fillColor = hex(rectColors[ri % rectColors.length]);
                cg.g.roundRect(-(cs - 4) / 2, -(cs - 4) / 2, cs - 4, cs - 4, 6);
                cg.g.fill();
            }
            const clue = SHIKAKU_CLUES[r + ',' + c];
            if (clue) Ui.label(holder, String(clue), { size: cs * 0.5, color: sk.given });
            cells.push(holder);
            cellGraphs.push(cg.g);
            cellLabels.push(null);
            Ui.bindTap(holder, () => {
                holder.setScale(0.9, 0.9, 1);
                tween(holder).to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            });
        });
    }

    /* ================= 工具条（非数独玩法：演示结算） ================= */

    const toolbar = Ui.node(root, W, 120, 0, -H / 2 + 90);
    if (ctx.gid !== 'sudoku') {
        Ui.candyBtn(toolbar, 460, 104, '▶ 演示通关结算', [C.greenH, C.green, C.greenD], {
            y: 0, fontSize: 32, delay: 0.3,
            onClick: () => finish(3, 30 + 3 * 10),
        });
        Ui.label(toolbar, '玩法规则后续接入 · 现为展示棋盘', { size: 20, color: C.inkSoft, y: -80 });
    }

    /* ================= 暂停 ================= */

    function openPause() {
        st.paused = true;
        Modal.open(box => {
            const p = Ui.panel(box, 600, 520);
            Ui.label(p, '⏸ 游戏暂停', { size: 44, y: 180 });
            Ui.label(p, '休息一下，谜题不会跑掉～', { size: 24, color: C.inkSoft, y: 120 });
            Ui.candyBtn(p, 500, 96, '继 续', [C.greenH, C.green, C.greenD], { y: 20, fontSize: 34, onClick: () => { st.paused = false; Modal.close(); } });
            Ui.candyBtn(p, 240, 88, '重来', ['#FFFFFF', '#F3E3BB', C.panelDark], { x: -130, y: -100, fontSize: 28, onClick: () => { Modal.close(); Router.replace('game', ctx); } });
            Ui.candyBtn(p, 240, 88, '退出', ['#FFFFFF', '#F3E3BB', C.panelDark], { x: 130, y: -100, fontSize: 28, onClick: () => { Modal.close(); Router.back(); } });
        });
    }

    /* ================= 结算（胜利 / 失败） ================= */

    function finish(stars: number, reward?: number) {
        if (st.finished) return;
        st.finished = true;
        confetti(120);
        const coins = reward ?? (30 + stars * 10);

        let title = '关卡完成！';
        if (ctx!.from === 'level') {
            const key = ctx!.ci + '-' + ctx!.li!;
            const prev = SAVE.data.progress[key] || 0;
            if (stars > prev) SAVE.data.progress[key] = stars;
            SAVE.data.curChapter = ctx!.ci!;
        } else {
            title = '挑战完成！';
            const rec = SAVE.chRec(ctx!.gid, ctx!.challengeKey!);
            rec.done = true;
            const t = fmtTime(st.sec);
            if (!rec.best || t < rec.best) rec.best = t;
        }
        SAVE.save();

        Modal.open(box => {
            const p = Ui.panel(box, 620, 860);
            Ui.label(p, title, { size: 48, y: 360 });

            const starRow = Ui.node(p, 400, 130, 0, 265);
            for (let i = 0; i < 3; i++) {
                const sx = (i - 1) * 130;
                const sNode = Ui.emoji(starRow, '⭐', 100, sx, 0);
                if (i < stars) {
                    sNode.setScale(0, 0, 1);
                    sNode.angle = -120;
                    tween(sNode)
                        .delay(0.2 + i * 0.25)
                        .to(0.5, { scale: new Vec3(1.25, 1.25, 1), angle: 8 }, { easing: 'backOut' })
                        .to(0.12, { scale: new Vec3(1, 1, 1), angle: 0 })
                        .start();
                } else {
                    sNode.setScale(0, 0, 1);
                    const op = sNode.getComponent(UIOpacity) || sNode.addComponent(UIOpacity);
                    op.opacity = 90;
                    tween(sNode).delay(0.4).to(0.35, { scale: new Vec3(0.9, 0.9, 1) }, { easing: 'backOut' }).start();
                }
            }

            Ui.label(p, `用时 ${fmtTime(st.sec)}`, { size: 28, color: C.inkSoft, y: 170 });

            const coinPill = Ui.pill(p, 280, 76, { y: 90, bg: '#FFF3C9', edge: '#D9B955' });
            const coinLb = Ui.label(coinPill, '🪙 +0', { size: 34, color: C.goldD, y: 3 });
            let shown = 0;
            const step = Math.max(1, Math.ceil(coins / 24));
            const roll = () => {
                if (shown >= coins) { coinLb.string = '🪙 +' + coins; return; }
                shown = Math.min(coins, shown + step);
                coinLb.string = '🪙 +' + shown;
                setTimer(roll, 40);
            };
            setTimer(roll, 500);

            Ui.candyBtn(p, 250, 96, '返回', ['#FFFFFF', '#F3E3BB', C.panelDark], {
                x: -135, y: -120, fontSize: 32,
                onClick: () => {
                    Modal.close();
                    if (ctx!.from === 'level') Router.backTo('chapters');
                    else Router.backTo('challenge');
                },
            });
            const hasNext = ctx!.from === 'level' && (ctx!.li! + 1) < LEVELS_PER_CH;
            Ui.candyBtn(p, 250, 96, hasNext ? '下一关 ▶' : '完 成', [C.greenH, C.green, C.greenD], {
                x: 135, y: -120, fontSize: 32,
                onClick: () => {
                    Modal.close();
                    if (hasNext) {
                        const nl = Config.getLevel(ctx!.ci!, ctx!.li! + 1);   // 下一关同样走关卡表
                        // 用 replace 而非 go：导航栈不累积 game 层，暂停退出直接回章节地图
                        Router.replace('game', {
                            from: 'level', ci: ctx!.ci, li: ctx!.li! + 1,
                            gid: nl.game,
                        } as GameCtx);
                    } else {
                        Router.backTo('chapters');
                    }
                },
            });
            addCoins(coins);
        });

        setTimer(checkAchievements, 1600);
    }

    /** 失败结算：踩雷（扫雷）/ 主动认输（数独） */
    function failGame(reason: string, errCount?: number) {
        if (st.finished) return;
        st.finished = true;
        st.paused = true;
        Modal.open(box => {
            const p = Ui.panel(box, 560, 560);
            const ic = Ui.emoji(p, '💥', 96, 0, 165);
            Ui.bob(ic, 8, 2.4);
            Ui.label(p, ctx!.from === 'level' ? '闯关失败' : '挑战失败', { size: 44, y: 70 });
            Ui.label(p, reason, { size: 24, color: C.inkSoft, y: 15 });
            const errText = errCount != null ? `错误 ${errCount} 次 · ` : '';
            Ui.label(p, `${errText}用时 ${fmtTime(st.sec)}`, { size: 22, color: C.inkSoft, y: -30 });
            Ui.candyBtn(p, 220, 90, '再 来 一 次', [C.greenH, C.green, C.greenD], {
                x: -125, y: -170, fontSize: 28,
                onClick: () => { Modal.close(); Router.replace('game', ctx); },
            });
            Ui.candyBtn(p, 220, 90, '退 出', ['#FFFFFF', '#F3E3BB', C.panelDark], {
                x: 125, y: -170, fontSize: 28,
                onClick: () => { Modal.close(); Router.back(); },
            });
        });
    }
}
