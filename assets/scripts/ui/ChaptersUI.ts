import { Node, Vec3, tween, UITransform, UIOpacity } from 'cc';
import { Ui } from '../core/Ui';
import { C, hex } from '../core/Const';
import { Router } from '../core/Router';
import { SAVE, setTimer } from '../core/Save';
import { CHAPTERS, LEVELS_PER_CH, unlockStarsNeeded, levelGameOf, GAMES, GameCtx } from '../core/Data';
import { Modal } from './ModalUI';

const ROW_H = 210;
const TOP_PAD = 60;
const XS = [0.10, 0.367, 0.634, 0.90];   // 每行 4 个节点的横向百分比

/** 闯关模式 · 章节地图 */
export function buildChapters(root: Node) {
    const W = Ui.W(), H = Ui.H();

    const bgNode = Ui.node(root, 0, 0);
    const top = Ui.node(root, W, 110, 0, H / 2 - 85);
    const banner = Ui.node(root, W, 190, 0, H / 2 - 215);

    // 顶栏
    Ui.circleBtn(top, 84, '‹', { x: -W / 2 + 80, emojiSize: 52, onClick: () => Router.back() });
    Ui.label(top, '闯关模式', { size: 40, x: -10, y: 3 });
    const starPill = Ui.pill(top, 200, 64, { x: W / 2 - 130, bg: C.panel, edge: C.panelDark });
    Ui.emoji(starPill, '⭐', 32, -62, 3);
    const starLb = Ui.label(starPill, String(SAVE.totalStars()), { size: 30, x: 22, y: 3 });
    void starLb;

    // 地图视口
    const mapTop = H / 2 - 330;
    const mapH = mapTop + H / 2;
    const viewport = Ui.node(root, W, mapH, 0, mapTop - mapH / 2);
    const content = Ui.node(viewport, W, 100);

    drawChapter(bgNode, banner, viewport, content, Math.min(SAVE.data.curChapter, CHAPTERS.length - 1));
}

function drawChapter(bgNode: Node, banner: Node, viewport: Node, content: Node, ci: number) {
    const W = Ui.W(), H = Ui.H();
    const ch = CHAPTERS[ci];
    const unlocked = SAVE.chUnlocked(ci);
    const cur = unlocked ? SAVE.firstUnfinished(ci) : -1;

    /* 背景 */
    bgNode.destroyAllChildren();
    Ui.background(bgNode, ch.bg, null);

    /* 章节横幅 */
    banner.destroyAllChildren();
    Ui.circleBtn(banner, 72, '‹', {
        x: -W / 2 + 66, emojiSize: 46,
        onClick: () => {
            if (ci > 0) { SAVE.data.curChapter = ci - 1; SAVE.save(); drawChapter(bgNode, banner, viewport, content, ci - 1); }
        },
    });
    Ui.circleBtn(banner, 72, '›', {
        x: W / 2 - 66, emojiSize: 46,
        onClick: () => {
            if (ci < CHAPTERS.length - 1) {
                const next = ci + 1;
                if (!SAVE.chUnlocked(next)) { Modal.toast(`再收集 ${unlockStarsNeeded(next) - SAVE.totalStars()} 颗星星即可解锁`); return; }
                SAVE.data.curChapter = next; SAVE.save();
                drawChapter(bgNode, banner, viewport, content, next);
            }
        },
    });

    // 主题横幅卡
    const card = Ui.node(banner, W - 200, 170);
    const cg = Ui.gnode(card, W - 200, 170);
    cg.g.fillColor = hex(ch.banner[2]);
    cg.g.roundRect(-(W - 200) / 2, -85, W - 200, 170, 28); cg.g.fill();
    const cm = Ui.gnode(card, W - 200, 160);
    cm.node.setPosition(0, 5);
    cm.g.fillColor = hex(unlocked ? ch.banner[0] : '#B8B0A0');
    cm.g.roundRect(-(W - 200) / 2, -80, W - 200, 160, 26); cm.g.fill();
    cm.g.fillColor = hex(unlocked ? ch.banner[1] : '#948C7C', 200);
    cm.g.roundRect(-(W - 200) / 2, -80, W - 200, 80, 26); cm.g.fill();
    cm.g.strokeColor = hex('#FFFFFFE8'); cm.g.lineWidth = 6;
    cm.g.roundRect(-(W - 200) / 2 + 3, -77, W - 206, 154, 23); cm.g.stroke();
    card.setScale(0.6, 0.5, 1);
    tween(card).to(0.36, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();

    const cardEmoji = Ui.emoji(card, unlocked ? ch.emoji : '🔒', 82, -(W - 200) / 2 + 90, 0);
    Ui.bob(cardEmoji, 8, 3);
    Ui.label(card, `第 ${ci + 1} 章 · ${ch.name}`, { size: 40, color: '#FFFFFF', x: 55, y: 28, stroke: '#00000040', strokeWidth: 2 });
    Ui.label(card, unlocked
        ? `${ch.sub} · ⭐ ${SAVE.chStars(ci)}/${LEVELS_PER_CH * 3}`
        : `🔒 需累计 ⭐${unlockStarsNeeded(ci)} 解锁（当前 ${SAVE.totalStars()}）`,
        { size: 22, color: '#FFFFFFE8', x: 55, y: -24 });

    /* 地图内容 */
    content.destroyAllChildren();
    const rows = Math.ceil(LEVELS_PER_CH / 4);
    const mapH = TOP_PAD + rows * ROW_H + 80;
    content.getComponent(UITransform)!.setContentSize(W, mapH);

    // 主题漂浮装饰
    ch.deco.forEach((d, i) => {
        const m = Ui.emoji(content, d, 130, (i % 2 ? 0.78 : 0.10) * W - W / 2 + 30, TOP_PAD + ((i * ROW_H * 1.6) % (mapH - 240)));
        const uop = m.getComponent(UIOpacity) || m.addComponent(UIOpacity);
        uop.opacity = 40;
        Ui.bob(m, 26, 6 + i, i * 0.8);
    });

    // 节点位置（蛇形：偶数行左→右，奇数行右→左）
    const pos: Array<[number, number]> = [];
    for (let i = 0; i < LEVELS_PER_CH; i++) {
        const row = Math.floor(i / 4), col = i % 4;
        pos.push([(XS[row % 2 ? 3 - col : col] - 0.5) * W, mapH / 2 - TOP_PAD - row * ROW_H - ROW_H / 2]);
    }

    // 路径虚点（贝塞尔弯曲）
    const pathG = Ui.gnode(content, W, mapH);
    pathG.g.fillColor = hex('#FFFFFFD9');
    pos.forEach(([x, y], i) => {
        if (i === 0) return;
        const [px, py] = pos[i - 1];
        const n = 5;
        for (let k = 1; k < n; k++) {
            const t = k / n;
            const cx = (px + x) / 2, cy = Math.min(py, y) - 46;
            const bx = (1 - t) * (1 - t) * px + 2 * (1 - t) * t * cx + t * t * x;
            const by = (1 - t) * (1 - t) * py + 2 * (1 - t) * t * cy + t * t * y;
            pathG.g.circle(bx, by, 7);
            pathG.g.fill();
        }
    });

    // 关卡节点
    pos.forEach(([x, y], i) => {
        const stars = SAVE.data.progress[ci + '-' + i] || 0;
        const isBoss = i === LEVELS_PER_CH - 1;
        const locked = !unlocked || i > cur;
        const state = locked ? 'locked' : (stars > 0 || i < cur ? 'done' : 'current');
        const size = isBoss ? 140 : 116;

        const holder = Ui.node(content, size, size + 44, x, y);
        const btn = Ui.node(holder, size, size);
        const colors: Record<string, [string, string, string]> = {
            done: [C.greenH, C.green, C.greenD],
            current: [C.goldH, C.gold, C.goldD],
            locked: ['#D8D2C4', '#C4BCAC', '#948C7C'],
        };
        const [, bc, dc] = colors[state];
        const g = Ui.gnode(btn, size, size);
        Ui.rr(g.g, size, size, size / 2, dc);
        const m = Ui.gnode(btn, size, size - 12);
        m.node.setPosition(0, 6);
        Ui.rr(m.g, size, size - 12, (size - 12) / 2, bc);
        const hl = Ui.gnode(btn, size * 0.78, size * 0.26);
        hl.node.setPosition(0, size * 0.14);
        Ui.rr(hl.g, size * 0.78, size * 0.26, size * 0.13, hex('#FFFFFF80'));
        m.g.strokeColor = hex('#FFFFFF'); m.g.lineWidth = 5;
        m.g.roundRect(-size / 2 + 2.5, -(size - 12) / 2 + 2.5, size - 5, size - 17, (size - 12) / 2 - 2);
        m.g.stroke();

        if (isBoss) {
            Ui.emoji(btn, '👑', 64);
        } else if (state === 'locked') {
            Ui.emoji(btn, '🔒', 46, 0, 2);
        } else {
            Ui.label(btn, String(i + 1), { size: 44, y: 8, color: '#FFFFFF', stroke: '#00000035', strokeWidth: 2 });
        }

        // 底部星级
        if (state !== 'locked' && !isBoss) {
            const st = Ui.label(holder, '★'.repeat(stars) + '☆'.repeat(3 - stars), { size: 30, y: -size / 2 - 18 });
            st.color = hex(stars > 0 ? '#FFD24D' : '#B9AE96');
        }

        // 当前节点：脉冲光环
        if (state === 'current') {
            const ring = Ui.gnode(holder, size + 40, size + 40, 0, 2);
            ring.g.strokeColor = hex(C.gold, 200);
            ring.g.lineWidth = 7;
            ring.g.circle(0, 0, size / 2 + 12);
            ring.g.stroke();
            const pulse = () => tween(ring.node)
                .to(0.7, { scale: new Vec3(1.28, 1.28, 1) }, { easing: 'sineOut' })
                .call(() => ring.node.setScale(1, 1, 1))
                .call(() => pulse())
                .start();
            pulse();
        }

        Ui.bindTap(holder, () => {
            if (state === 'locked') {
                Modal.toast(cur >= 0 ? '先通过前面的关卡吧～' : '章节未解锁');
                return;
            }
            openLevelIntro(ci, i);
        });

        // 入场：从下方依次弹入
        holder.setScale(0, 0, 1);
        holder.setPosition(x, y + 26, 0);
        tween(holder).delay(0.05 + i * 0.045)
            .to(0.4, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        tween(holder).delay(0.05 + i * 0.045)
            .to(0.4, { position: new Vec3(x, y, 0) }, { easing: 'backOut' }).start();
    });

    // 拖拽 + 自动滚到当前节点（节点对齐视口中心偏上）
    const scroller = Ui.dragScroll(viewport, content);
    if (cur > 3) {
        setTimer(() => scroller.scrollToY(-pos[Math.min(cur, LEVELS_PER_CH - 1)][1] - 150), 620);
    }
}

/** 关卡介绍弹窗 */
function openLevelIntro(ci: number, li: number) {
    const gid = levelGameOf(ci, li);
    const g = GAMES[gid];
    const diffIdx = (ci + Math.floor(li / 4)) % 3;
    const diff = ['简单', '普通', '困难'][diffIdx];
    const diffStars = '⭐'.repeat(diffIdx + 1);
    Modal.open(box => {
        const p = Ui.panel(box, 600, 720);
        const icon = Ui.emoji(p, g.icon, 100, 0, 250);
        Ui.bob(icon, 8, 2.4);
        Ui.label(p, `${CHAPTERS[ci].name} · 第 ${li + 1} 关`, { size: 40, y: 155 });
        const rows: Array<[string, string]> = [
            ['玩法', `${g.icon} ${g.name}`],
            ['难度', `${diffStars} ${diff}`],
            ['通关奖励', '🪙 30 + 星级 ×10'],
        ];
        rows.forEach(([k, v], i) => {
            const row = Ui.panel(p, 500, 84, { y: 70 - i * 104, bg: '#FFF7E2', r: 18 });
            Ui.label(row, k, { size: 26, color: C.inkSoft, x: -160 });
            Ui.label(row, v, { size: 28, x: 90 });
        });
        Ui.candyBtn(p, 210, 86, '返回', ['#FFFFFF', '#F3E3BB', C.panelDark], { x: -125, y: -260, fontSize: 30, onClick: () => Modal.close() });
        Ui.candyBtn(p, 210, 86, '开 始', [C.greenH, C.green, C.greenD], {
            x: 125, y: -260, fontSize: 30,
            onClick: () => {
                Modal.close();
                const ctx: GameCtx = { from: 'level', ci, li, gid };
                Router.go('game', ctx);
            },
        });
    });
}
