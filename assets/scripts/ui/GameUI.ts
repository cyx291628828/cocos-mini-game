import { Node, Vec3, tween, Graphics, UIOpacity, Label } from 'cc';
import { Ui } from '../core/Ui';
import { C, hex } from '../core/Const';
import { Router } from '../core/Router';
import { SAVE, addCoins, setTimer, fmtTime } from '../core/Save';
import {
    GAMES, CHAPTERS, LEVELS_PER_CH, skinOf, mulberry32,
    STAR_ZONES, STAR_POS, SHIKAKU_CLUES, SHIKAKU_RECTS, CH_PERIODS, GameCtx,
} from '../core/Data';
import { Config, SudokuCfg } from '../core/Config';
import { Modal } from './ModalUI';
import { confetti } from './Confetti';
import { checkAchievements } from './Achievement';

const MINE_N = 9, MINE_COUNT = 10;
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
    if (ctx.from === 'level') {
        const lv = Config.getLevel(ctx.ci!, ctx.li!);
        ctx.gid = lv.game;
        if (ctx.gid === 'sudoku') cfg = lv.cfgId ? Config.getSudoku(lv.cfgId) : null;
    } else if (ctx.gid === 'sudoku') {
        cfg = Config.getSudoku(Config.getChallengeSudokuId(ctx.challengeKey || 'daily'));
    }
    if (ctx.gid === 'sudoku' && !cfg) cfg = Config.getFallbackSudoku();

    const W = Ui.W(), H = Ui.H();
    const g = GAMES[ctx.gid];
    Ui.background(root, [C.cream1, C.cream2], null);

    const st = { sec: 0, paused: false, sel: -1, finished: false };

    // 数独状态（failGame/超时回调共享）
    const su = {
        board: [] as number[],
        given: [] as boolean[],
        conflict: new Set<number>(),
        errors: 0,
        stars: 3,
    };
    // 数独侧注册的"计时变化"回调（tick 触发，处理阶梯超时扣星）
    let onTickStarCheck: (() => void) | null = null;

    /* 顶栏 */
    const top = Ui.node(root, W, 110, 0, H / 2 - 85);
    Ui.circleBtn(top, 84, '⏸', { x: -W / 2 + 80, emojiSize: 40, onClick: openPause });
    const info = Ui.panel(top, 360, 92, { x: 40, r: 24 });
    Ui.label(info, ctx.from === 'level'
        ? `${CHAPTERS[ctx.ci!].name} · 第 ${ctx.li! + 1} 关`
        : `挑战模式 · ${CH_PERIODS.find(p => p.key === ctx!.challengeKey)?.tag ?? ''}`,
        { size: 26, y: 14 });
    Ui.label(info, cfg ? `${g.icon} ${g.name} · ${cfg.difficulty}` : `${g.icon} ${g.name}`,
        { size: 22, color: C.inkSoft, y: -22 });
    const timerPill = Ui.pill(top, 210, 72, { x: W / 2 - 135, bg: C.blue, edge: C.blueD });
    const timerLb = Ui.label(timerPill, '⏱ 00:00', { size: 28, color: '#FFFFFF', y: 3 });

    /* 计时（数独：阶梯超时扣星在此判定） */
    setTimer(() => {
        if (st.paused || st.finished) return;
        st.sec++;
        timerLb.string = '⏱ ' + fmtTime(st.sec);
        if (cfg && onTickStarCheck) onTickStarCheck();
    }, 1000, true);

    /* 棋盘 */
    const boardSize = Math.min(W - 90, ctx.gid === 'sudoku' ? 600 : 640);
    const boardY = ctx.gid === 'sudoku' ? 10 : 50;
    const sk = skinOf(SAVE.data.skin);
    const board = Ui.node(root, boardSize + 36, boardSize + 36, 0, boardY);
    const bg = Ui.gnode(board, boardSize + 36, boardSize + 36);
    bg.g.fillColor = hex(sk.frame);
    bg.g.roundRect(-(boardSize + 36) / 2, -(boardSize + 36) / 2, boardSize + 36, boardSize + 36, 26);
    bg.g.fill();
    bg.g.strokeColor = hex('#FFFFFF8C'); bg.g.lineWidth = 7;
    bg.g.roundRect(-(boardSize + 30) / 2, -(boardSize + 30) / 2, boardSize + 30, boardSize + 30, 23);
    bg.g.stroke();
    board.setScale(0.7, 0.7, 1);
    tween(board).delay(0.08).to(0.42, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();

    const cells: Node[] = [];
    const cellLabels: Array<Label | null> = [];
    const cellGraphs: Graphics[] = [];

    if (ctx.gid === 'sudoku' && cfg) buildSudoku(cfg);
    else if (ctx.gid === 'mine') drawMine();
    else if (ctx.gid === 'star') drawStar();
    else if (ctx.gid === 'shikaku') drawShikaku();
    else drawKillerLike();

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

        // 挖空
        const idx = [...Array(N * N).keys()];
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        const holesSet = new Set(idx.slice(0, Math.min(cfg.holes, N * N - N)));

        su.board = sol.map((v, i) => holesSet.has(i) ? 0 : v);
        su.given = [...Array(N * N)].map((_, i) => !holesSet.has(i));

        /* 星行（棋盘上方）：阶梯扣星实时变暗 */
        const starRow = Ui.node(root, 300, 52, 0, boardY + boardSize / 2 + 52);
        const starNodes: Node[] = [];
        for (let i = 0; i < 3; i++) starNodes.push(Ui.emoji(starRow, '⭐', 44, (i - 1) * 58, 0));
        const errLb = Ui.label(starRow, '', { size: 22, color: C.redD, x: 150 });
        const timeoutLb = Ui.label(starRow, '', { size: 22, color: C.blueD, x: -150 });

        /** 按阶梯数组重算剩余星：达到数组中各阈值各扣 1 星（超时 + 错误），扣光返回 0 */
        const updateStars = (): number => {
            const timeoutDed = cfg!.timeCostStar.filter(t => st.sec >= t).length;
            const errorDed = cfg!.errorCostStar.filter(e => su.errors >= e).length;
            su.stars = Math.max(0, 3 - timeoutDed - errorDed);
            starNodes.forEach((n, i) => {
                const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
                op.opacity = i < su.stars ? 255 : 70;
                n.setScale(i < su.stars ? 1 : 0.82, i < su.stars ? 1 : 0.82, 1);
            });
            errLb.string = su.errors > 0 ? `错误 ${su.errors}` : '';
            timeoutLb.string = timeoutDed > 0 ? '已超时' : '';
            return su.stars;
        };
        // 计时每秒回调：超时阶梯扣星（可能触发失败）
        onTickStarCheck = () => {
            const s = updateStars();
            if (s <= 0) failGame('超时后星数耗尽');
        };
        updateStars();

        /* 格子绘制 */
        const cs = boardSize / N;
        const redrawAll = () => { for (let i = 0; i < N * N; i++) redrawCell(i); };
        const redrawCell = (i: number) => {
            const cg = cellGraphs[i];
            const r = Math.floor(i / N), c = i % N;
            cg.clear();
            const sz = cs - 6;
            const alt = (Math.floor(r / boxR) + Math.floor(c / boxC)) % 2;
            let fillC = alt ? sk.cellAlt : sk.cell;
            if (su.conflict.has(i)) fillC = '#FFB3B3';
            else if (st.sel >= 0 && (i === st.sel || peersAt[st.sel].includes(i))) fillC = sk.hi;
            Ui.rr(cg, sz, sz, 8, fillC);
            if (i === st.sel) {
                cg.strokeColor = hex('#FF9F1C');
                cg.lineWidth = 4;
                cg.roundRect(-sz / 2 + 2, -sz / 2 + 2, sz - 4, sz - 4, 7);
                cg.stroke();
            }
            const lb = cellLabels[i]!;
            const v = su.board[i];
            lb.string = v ? String(v) : '';
            lb.color = hex(su.given[i] ? sk.given : (su.conflict.has(i) ? '#C03030' : sk.user));
        };

        eachCell(N, (i, x, y) => {
            const holder = Ui.node(board, cs - 6, cs - 6, x, y);
            const cg = Ui.gnode(holder, cs - 6, cs - 6);
            cells.push(holder);
            cellGraphs.push(cg.g);
            cellLabels.push(Ui.label(holder, '', { size: cs * 0.55, color: sk.user }));
            if (holesSet.has(i)) {
                Ui.bindTap(holder, () => { if (!st.finished) { st.sel = i; redrawAll(); } });
            }
        });
        redrawAll();

        /* 数字键盘（N 个键 + 剩余计数） */
        const padY = boardY - boardSize / 2 - 84;
        const pad = Ui.node(root, W - 60, 128, 0, padY);
        const slot = (W - 100) / N;
        const keys: Array<{ g: Graphics; cntLb: Label }> = [];
        const paintKey = (k: { g: Graphics; cntLb: Label }, v: number) => {
            const kw = Math.min(slot - 8, 120);
            k.g.clear();
            Ui.rr(k.g, kw, 124, 18, C.panelDark);
            Ui.rr(k.g, kw - 4, 116, 16, C.panel);
            k.g.strokeColor = hex(C.panelLine); k.g.lineWidth = 3;
            k.g.roundRect(-(kw - 2) / 2 + 1, -56, kw - 6, 113, 15);
            k.g.stroke();
            const used = su.board.filter(x => x === v).length;
            k.cntLb.string = '剩 ' + Math.max(0, N - used);
            k.cntLb.color = hex(N - used <= 0 ? '#B9AE96' : C.inkSoft);
        };
        for (let v = 1; v <= N; v++) {
            const kx = (v - 1 - (N - 1) / 2) * slot;
            const key = Ui.node(pad, slot - 8, 128, kx, 0);
            const kg = Ui.gnode(key, slot - 8, 128);
            Ui.label(key, String(v), { size: Math.min(48, slot * 0.5), y: 12 });
            const cntLb = Ui.label(key, '剩 ' + N, { size: 18, color: C.inkSoft, y: -34 });
            keys.push({ g: kg.g, cntLb });
            const vv = v;
            Ui.bindTap(key, () => fill(vv));
            paintKey(keys[v - 1], v);
        }
        const repaintKeys = () => { for (let v = 1; v <= N; v++) paintKey(keys[v - 1], v); };

        /* 工具行（提示 / 擦除 / 认输） */
        const toolsY = padY - 104;
        const tools = Ui.node(root, W, 100, 0, toolsY);
        let hints = 3;
        const hintBtn = Ui.candyBtn(tools, 214, 88, '💡 提示 ×3', [C.goldH, C.gold, C.goldD], {
            x: -230, fontSize: 26,
            onClick: () => {
                if (st.finished) return;
                if (hints <= 0) { Modal.toast('提示已用完，相信自己！💪'); return; }
                const empties = su.board.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
                if (!empties.length) return;
                hints--;
                const lb = findBtnLabel(hintBtn);
                if (lb) lb.string = `💡 提示 ×${hints}`;
                const i = empties[Math.floor(Math.random() * empties.length)];
                su.board[i] = sol[i];
                st.sel = -1;
                afterFill(i);
            },
        });
        Ui.candyBtn(tools, 214, 88, '🧽 擦 除', ['#FFFFFF', '#F3E3BB', C.panelDark], {
            x: 0, fontSize: 26,
            onClick: () => {
                if (st.finished || st.sel < 0) { if (st.sel < 0 && !st.finished) Modal.toast('先选择一个空格子'); return; }
                if (su.given[st.sel]) return;
                su.board[st.sel] = 0;
                st.sel = -1;
                recomputeConflicts();
                redrawAll();
                repaintKeys();
            },
        });
        Ui.candyBtn(tools, 214, 88, '🏳️ 认 输', ['#E8E0CE', '#CFC8B8', '#948C7C'], {
            x: 230, fontSize: 26,
            onClick: () => failGame('主动认输'),
        });

        /* 填入 / 冲突 / 胜负 */
        function fill(v: number) {
            if (st.finished || st.sel < 0) { if (st.sel < 0 && !st.finished) Modal.toast('先选择一个空格子'); return; }
            const i = st.sel;
            if (su.given[i] || su.board[i] === v) return;
            su.board[i] = v;
            afterFill(i);
        }
        function afterFill(changed: number) {
            recomputeConflicts();
            redrawAll();
            repaintKeys();
            if (su.conflict.has(changed)) {
                // 本次填入与同行/列/宫重复 → 计错误 + 明确提示
                su.errors++;
                Ui.shake(cells[changed]);
                Modal.toast(`冲突！${su.board[changed]} 在行/列/宫中重复`);
                const stars = updateStars();
                if (stars <= 0) { failGame('错误次数过多，星数耗尽'); return; }
            } else if (su.board.every(x => x > 0)) {
                // 填满：必须全盘无冲突才算通关
                if (su.conflict.size > 0) {
                    Modal.toast('已填满，但红色格子仍有冲突，改正后即可通关');
                } else {
                    const stars = updateStars();
                    console.log('[Sudoku] 盘面完成 ✓ 星 =', stars);
                    winGame(Math.max(1, stars));
                }
            }
        }
        function recomputeConflicts() {
            su.conflict.clear();
            for (let i = 0; i < N * N; i++) {
                const v = su.board[i];
                if (!v) continue;
                for (const j of peersAt[i]) {
                    if (su.board[j] === v) { su.conflict.add(i); su.conflict.add(j); }
                }
            }
        }
        function winGame(stars: number) {
            if (st.finished) return;
            st.paused = true;
            finish(stars, cfg!.rewardCoins);   // st.finished 由 finish 内部置位
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

    function drawMine() {
        const rng = mulberry32(9527);
        const mines = new Set<number>();
        while (mines.size < MINE_COUNT) mines.add(Math.floor(rng() * MINE_N * MINE_N));
        const around = (i: number, fn: (j: number) => void) => {
            const r = Math.floor(i / MINE_N), c = i % MINE_N;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                if (!dr && !dc) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < MINE_N && nc >= 0 && nc < MINE_N) fn(nr * MINE_N + nc);
            }
        };
        const count = (i: number) => { let n = 0; around(i, j => { if (mines.has(j)) n++; }); return n; };
        const cs = boardSize / MINE_N;
        eachCell(MINE_N, (i, x, y) => {
            const holder = Ui.node(board, cs - 8, cs - 8, x, y);
            const cg = Ui.gnode(holder, cs - 8, cs - 8);
            drawMineCell(cg.g, false);
            cells.push(holder);
            cellGraphs.push(cg.g);
            cellLabels.push(null);
            Ui.bindTap(holder, () => {
                if (st.finished || (holder as any)._open) return;
                (holder as any)._open = true;
                const gg = holder.children[0].getComponent(Graphics)!;
                drawMineCell(gg, true);
                const n = count(i);
                const size = cs - 8;
                if (mines.has(i)) Ui.label(holder, '💥', { size: size * 0.6 });
                else if (n) Ui.label(holder, String(n), { size: size * 0.58, color: NUM_COLORS[n - 1] });
                holder.setScale(0.6, 0.6, 1);
                tween(holder).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            });
        });
    }

    function drawMineCell(g: Graphics, opened: boolean) {
        const cs = boardSize / MINE_N - 8;
        g.clear();
        if (opened) {
            Ui.rr(g, cs, cs, 6, sk.cell);
        } else {
            Ui.rr(g, cs, cs, 6, '#00000028');
            g.strokeColor = hex('#FFFFFF66'); g.lineWidth = 3;
            g.roundRect(-cs / 2 + 3, -cs / 2 + 3, cs - 6, cs - 6, 5);
            g.stroke();
            g.fillColor = hex('#FFFFFF30');
            g.roundRect(-cs / 2 + 4, cs * 0.1, cs - 8, cs * 0.24, 4);
            g.fill();
        }
    }

    function drawStar() {
        const cs = boardSize / 7;
        const zoneColors = ['rgba(140,200,120,0.5)', 'rgba(120,180,235,0.5)', 'rgba(250,180,120,0.5)', 'rgba(230,140,180,0.5)', 'rgba(180,150,235,0.5)', 'rgba(250,220,120,0.5)', 'rgba(120,210,200,0.5)'];
        eachCell(7, (i, x, y) => {
            const r = Math.floor(i / 7), c = i % 7;
            const holder = Ui.node(board, cs - 6, cs - 6, x, y);
            const cg = Ui.gnode(holder, cs - 6, cs - 6);
            Ui.rr(cg.g, cs - 6, cs - 6, 10, zoneColors[STAR_ZONES[r].charCodeAt(c) - 65]);
            if (STAR_POS.includes(i)) Ui.emoji(holder, '⭐', cs * 0.6);
            cells.push(holder);
            cellGraphs.push(cg.g);
            cellLabels.push(null);
            Ui.bindTap(holder, () => {
                holder.setScale(0.9, 0.9, 1);
                tween(holder).to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            });
        });
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
                        Router.go('game', {
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

    /** 失败结算：星数耗尽 / 主动认输 */
    function failGame(reason: string) {
        if (st.finished) return;
        st.finished = true;
        st.paused = true;
        Modal.open(box => {
            const p = Ui.panel(box, 560, 560);
            const ic = Ui.emoji(p, '💥', 96, 0, 165);
            Ui.bob(ic, 8, 2.4);
            Ui.label(p, ctx!.from === 'level' ? '闯关失败' : '挑战失败', { size: 44, y: 70 });
            Ui.label(p, reason, { size: 24, color: C.inkSoft, y: 15 });
            if (cfg) Ui.label(p, `错误 ${su.errors} 次 · 用时 ${fmtTime(st.sec)}`, { size: 22, color: C.inkSoft, y: -30 });
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
