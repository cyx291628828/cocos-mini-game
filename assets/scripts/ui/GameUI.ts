import { Node, Vec3, tween, Graphics, UIOpacity, Label } from 'cc';
import { Ui } from '../core/Ui';
import { C, hex } from '../core/Const';
import { Router } from '../core/Router';
import { SAVE, addCoins, setTimer, fmtTime } from '../core/Save';
import {
    GAMES, CHAPTERS, LEVELS_PER_CH, levelGameOf, skinOf, mulberry32,
    SUDOKU_SOLUTION, STAR_ZONES, STAR_POS, SHIKAKU_CLUES, SHIKAKU_RECTS, CH_PERIODS, GameCtx,
} from '../core/Data';
import { Modal } from './ModalUI';
import { confetti } from './Confetti';
import { checkAchievements } from './Achievement';

const MINE_N = 9, MINE_COUNT = 10;
const NUM_COLORS = ['#2F7FC0', '#48A030', '#E04E4E', '#7744C9', '#C96A00', '#0FA3A3', '#B03030', '#666666', '#555555'];

/**
 * 玩法界面：顶栏 + 棋盘展示（轻交互）+ 演示结算。
 * 玩法规则后续实现；本阶段保证 进入 → 结算 → 存档 → 成就 → 下一关/返回 全流程正确。
 */
export function buildGame(root: Node, ctx?: GameCtx) {
    if (!ctx) ctx = { from: 'challenge', gid: 'sudoku', challengeKey: 'daily' };
    const W = Ui.W(), H = Ui.H();
    const g = GAMES[ctx.gid];
    Ui.background(root, [C.cream1, C.cream2], null);

    const st = { sec: 0, paused: false, sel: -1, finished: false };

    /* 顶栏 */
    const top = Ui.node(root, W, 110, 0, H / 2 - 85);
    Ui.circleBtn(top, 84, '⏸', { x: -W / 2 + 80, emojiSize: 40, onClick: openPause });
    const info = Ui.panel(top, 340, 92, { x: 30, r: 24 });
    Ui.label(info, ctx.from === 'level'
        ? `${CHAPTERS[ctx.ci!].name} · 第 ${ctx.li! + 1} 关`
        : `挑战模式 · ${CH_PERIODS.find(p => p.key === ctx!.challengeKey)?.tag ?? ''}`,
        { size: 28, y: 14 });
    Ui.label(info, `${g.icon} ${g.name}`, { size: 22, color: C.inkSoft, y: -22 });
    const timerPill = Ui.pill(top, 210, 72, { x: W / 2 - 135, bg: C.blue, edge: C.blueD });
    const timerLb = Ui.label(timerPill, '⏱ 00:00', { size: 28, color: '#FFFFFF', y: 3 });
    setTimer(() => {
        if (st.paused || st.finished) return;
        st.sec++;
        timerLb.string = '⏱ ' + fmtTime(st.sec);
    }, 1000, true);

    /* 棋盘 */
    const boardSize = Math.min(W - 90, 640);
    const sk = skinOf(SAVE.data.skin);
    const board = Ui.node(root, boardSize + 36, boardSize + 36, 0, 60);
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

    if (ctx.gid === 'sudoku' || ctx.gid === 'killer') drawSudokuLike();
    else if (ctx.gid === 'mine') drawMine();
    else if (ctx.gid === 'star') drawStar();
    else drawShikaku();

    /* ---------- 棋盘绘制 ---------- */

    function eachCell(grid: number, cb: (i: number, x: number, y: number, cs: number) => void) {
        const cs = boardSize / grid;
        for (let i = 0; i < grid * grid; i++) {
            const r = Math.floor(i / grid), c = i % grid;
            cb(i, -boardSize / 2 + cs / 2 + c * cs, boardSize / 2 - cs / 2 - r * cs, cs);
        }
    }

    function drawSudokuLike() {
        const seed = ctx!.from === 'level' ? ctx!.ci! * 100 + ctx!.li! : 20260918;
        const rng = mulberry32(seed * 7919 + 13);
        const idx = [...Array(81).keys()];
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        const holes = ctx!.gid === 'killer' ? 30 : 40;
        const holesSet = new Set<number>(idx.slice(0, holes));

        const cageSums = ['15', '8', '12', '21', '17', '5', '14', '9', '13', '19', '10', '16', '7', '24', '6', '11', '4', '18', '23', '14'];
        const cs = boardSize / 9;
        eachCell(9, (i, x, y) => {
            const r = Math.floor(i / 9), c = i % 9;
            const holder = Ui.node(board, cs - 6, cs - 6, x, y);
            const cg = Ui.gnode(holder, cs - 6, cs - 6);
            const alt = (Math.floor(r / 3) + Math.floor(c / 3)) % 2;
            Ui.rr(cg.g, cs - 6, cs - 6, 8, alt ? sk.cellAlt : sk.cell);
            cells.push(holder);
            const v = holesSet.has(i) ? 0 : SUDOKU_SOLUTION[i];
            const lb = Ui.label(holder, v ? String(v) : '', { size: cs * 0.55, color: v ? sk.given : sk.user });
            cellLabels.push(lb);
            if (!v) {
                Ui.bindTap(holder, () => { if (!st.finished) selectCell(i); });
            }
        });
        // 杀手数独：装饰性笼子和数
        if (ctx!.gid === 'killer') {
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
    }

    function selectCell(i: number) {
        st.sel = i;
        const r = Math.floor(i / 9), c = i % 9;
        const cs = boardSize / 9 - 6;
        cells.forEach((holder, j) => {
            const rr = Math.floor(j / 9), cc = j % 9;
            const peer = j !== i && (rr === r || cc === c || (Math.floor(rr / 3) === Math.floor(r / 3) && Math.floor(cc / 3) === Math.floor(c / 3)));
            const cg = holder.children[0].getComponent(Graphics)!;
            cg.clear();
            const alt = (Math.floor(rr / 3) + Math.floor(cc / 3)) % 2;
            let fillC = alt ? sk.cellAlt : sk.cell;
            if (j === i || peer) fillC = sk.hi;
            Ui.rr(cg, cs, cs, 8, fillC);
            if (j === i) {
                cg.strokeColor = hex('#FF9F1C');
                cg.lineWidth = 4;
                cg.roundRect(-cs / 2 + 2, -cs / 2 + 2, cs - 4, cs - 4, 7);
                cg.stroke();
            }
        });
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
            cellLabels.push(null);
            Ui.bindTap(holder, () => {
                holder.setScale(0.9, 0.9, 1);
                tween(holder).to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            });
        });
    }

    /* ---------- 底部工具条 ---------- */
    const toolbar = Ui.node(root, W, 260, 0, -H / 2 + 180);

    const demoBtnW = (ctx.gid === 'sudoku' || ctx.gid === 'killer') ? 300 : 460;
    const demoBtnX = (ctx.gid === 'sudoku' || ctx.gid === 'killer') ? 170 : 0;
    Ui.candyBtn(toolbar, demoBtnW, 104, '▶ 演示通关结算', [C.greenH, C.green, C.greenD], {
        x: demoBtnX, y: 0, fontSize: 32, delay: 0.3,
        onClick: () => finish(3),
    });
    if (ctx.gid !== 'sudoku' && ctx.gid !== 'killer') {
        Ui.label(toolbar, '玩法规则第 6 步后实现 · 现为展示棋盘', { size: 20, color: C.inkSoft, y: -90 });
    }

    /* ---------- 暂停 ---------- */
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

    /* ---------- 结算 ---------- */
    function finish(stars: number) {
        if (st.finished) return;
        st.finished = true;
        confetti(120);

        let title = '关卡完成！';
        let reward: number;
        if (ctx!.from === 'level') {
            reward = 30 + stars * 10;
            const key = ctx!.ci + '-' + ctx!.li!;
            const prev = SAVE.data.progress[key] || 0;
            if (stars > prev) SAVE.data.progress[key] = stars;
            SAVE.data.curChapter = ctx!.ci!;
        } else {
            title = '挑战完成！';
            reward = CH_PERIODS.find(p => p.key === ctx!.challengeKey)?.reward ?? 80;
            const rec = SAVE.chRec(ctx!.gid, ctx!.challengeKey!);
            rec.done = true;
            const t = fmtTime(st.sec);
            if (!rec.best || t < rec.best) rec.best = t;
        }
        SAVE.save();

        Modal.open(box => {
            const p = Ui.panel(box, 620, 860);
            Ui.label(p, title, { size: 48, y: 360 });

            // 三颗星：达成的逐个弹出，未达成灰色
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

            // 金币滚动
            const coinPill = Ui.pill(p, 280, 76, { y: 90, bg: '#FFF3C9', edge: '#D9B955' });
            const coinLb = Ui.label(coinPill, '🪙 +0', { size: 34, color: C.goldD, y: 3 });
            let shown = 0;
            const step = Math.max(1, Math.ceil(reward / 24));
            const roll = () => {
                if (shown >= reward) { coinLb.string = '🪙 +' + reward; return; }
                shown = Math.min(reward, shown + step);
                coinLb.string = '🪙 +' + shown;
                setTimer(roll, 40);
            };
            setTimer(roll, 500);

            // 返回
            Ui.candyBtn(p, 250, 96, '返回', ['#FFFFFF', '#F3E3BB', C.panelDark], {
                x: -135, y: -120, fontSize: 32,
                onClick: () => {
                    Modal.close();
                    if (ctx!.from === 'level') Router.backTo('chapters');
                    else Router.backTo('challenge');
                },
            });
            // 下一关（还有下一关时）
            const hasNext = ctx!.from === 'level' && (ctx!.li! + 1) < LEVELS_PER_CH;
            Ui.candyBtn(p, 250, 96, hasNext ? '下一关 ▶' : '完 成', [C.greenH, C.green, C.greenD], {
                x: 135, y: -120, fontSize: 32,
                onClick: () => {
                    Modal.close();
                    if (hasNext) {
                        Router.go('game', {
                            from: 'level', ci: ctx!.ci, li: ctx!.li! + 1,
                            gid: levelGameOf(ctx!.ci!, ctx!.li! + 1),
                        } as GameCtx);
                    } else {
                        Router.backTo('chapters');
                    }
                },
            });
            addCoins(reward);
        });

        // 成就检查（弹窗排队，不打断结算）
        setTimer(checkAchievements, 1600);
    }
}
