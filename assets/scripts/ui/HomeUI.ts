import { Node, Vec2, Vec3, tween, Label, UIOpacity, Graphics } from 'cc';
import { Ui } from '../core/Ui';
import { C, hex } from '../core/Const';
import { Router } from '../core/Router';
import { SAVE, addCoins, onCoins, countdownToMidnight, setTimer } from '../core/Save';
import { Modal } from './ModalUI';

/** 主界面 */
export function buildHome(root: Node) {
    const W = Ui.W(), H = Ui.H();
    Ui.background(root, [C.cream1, C.cream2], ['#B9E48A', '#9AD367']);

    /* 装饰：云 + 闪烁星星 */
    Ui.cloud(root, H * 0.36, 1, 26);
    Ui.cloud(root, H * 0.18, 0.7, 38, 6);
    Ui.cloud(root, H * 0.43, 0.85, 32, 12);
    const stars: Array<[string, number, number]> = [
        ['✨', 0.22, 0.30], ['⭐', 0.75, 0.22], ['✨', 0.28, 0.10], ['🌟', 0.80, 0.06],
    ];
    stars.forEach(([ch, fx, fy], i) => {
        const s = Ui.emoji(root, ch, 40, (fx - 0.5) * W, (fy - 0.5) * H);
        Ui.twinkle(s, i * 0.7);
    });

    /* 顶栏 */
    const top = Ui.node(root, W, 110, 0, H / 2 - 85);
    const coinPill = Ui.pill(top, 210, 66, { x: -W / 2 + 145, bg: C.panel, edge: C.panelDark });
    const coinIc = Ui.emoji(coinPill, '🪙', 36, -70, 3);
    Ui.bob(coinIc, 4, 2.2);
    const coinLabel = Ui.label(coinPill, String(SAVE.data.coins), { size: 30, x: 20, y: 3 });
    onCoins(coinLabel.node, (v: number) => {
        coinLabel.string = String(v);
        const n: Node = coinLabel.node;
        n.setScale(1.4, 1.4, 1);
        tween(n).to(0.35, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    });
    Ui.circleBtn(top, 84, '⚙️', { x: W / 2 - 80, onClick: openSettings });

    /* Logo 区 */
    const logoBox = Ui.node(root, W, 420, 0, H * 0.16);
    const badge = Ui.pill(logoBox, 260, 56, { y: 150, bg: C.purple, edge: C.purpleD });
    badge.angle = -2;
    Ui.label(badge, 'PUZZLE LAND', { size: 24, color: '#FFFFFF', y: 3 });
    const title = Ui.label(logoBox, '谜题星旅', { size: 110, color: C.gold, stroke: '#A96B00', strokeWidth: 7, y: 55 });
    title.enableShadow = true;
    title.shadowColor = hex('#C98A0090');
    title.shadowOffset = new Vec2(0, -8);
    const titleNode = title.node;
    titleNode.setScale(0, 0, 1);
    tween(titleNode).to(0.55, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    Ui.bob(titleNode, 10, 3.2, 0.6);
    const sub = Ui.pill(logoBox, 500, 58, { y: -35, bg: '#FFFFFFC8', edge: C.panelDark });
    Ui.label(sub, '数独 · 星之战 · 数方 · 杀手数独 · 扫雷', { size: 23, color: C.inkSoft, y: 3 });
    Ui.popIn(sub, 0.25);

    /* 吉祥物：旋转虚线环 + 金色徽章 + 拼图脸 */
    const mascot = Ui.node(root, 260, 260, 0, -H * 0.10);
    const ring = Ui.node(mascot, 260, 260);
    for (let i = 0; i < 14; i++) {
        const a = (Math.PI * 2 / 14) * i;
        const dash = Ui.gnode(ring, 26, 12, Math.cos(a) * 118, Math.sin(a) * 118);
        dash.g.fillColor = hex('#FFC93CBF');
        dash.g.roundRect(-13, -6, 26, 12, 6);
        dash.g.fill();
        dash.node.angle = (a * 180) / Math.PI;
    }
    tween(ring).repeatForever(tween(ring).by(14, { angle: 360 })).start();

    const core = Ui.gnode(mascot, 214, 214);
    core.g.roundRect(-107, -107, 214, 214, 58);
    core.g.fillColor = hex('#FFB84D');
    core.g.fill();
    core.g.strokeColor = hex('#FFFFFF');
    core.g.lineWidth = 8;
    core.g.roundRect(-103, -103, 206, 206, 54);
    core.g.stroke();
    Ui.emoji(mascot, '🧩', 116);
    Ui.popIn(mascot, 0.2);
    Ui.bob(mascot, 16, 2.8, 0.7);

    /* 底部操作区 */
    const actions = Ui.node(root, W, 400, 0, -H / 2 + 260);
    const play = Ui.candyBtn(actions, W * 0.78, 120, '开 始 闯 关',
        [C.greenH, C.green, C.greenD], {
        y: 110, fontSize: 44, delay: 0.35, onClick: () => Router.go('chapters'),
    });
    Ui.breathe(play, 0.03, 1.4, 0.9);
    Ui.emoji(play, '▶', 36, -210, 0);

    const quick = Ui.node(actions, 540, 160, 0, -25);
    const qdefs: Array<[string, string, string, string, () => void]> = [
        ['⚔️', '挑战', C.purple, C.purpleD, () => Router.go('challenge')],
        ['🏆', '成就', C.gold, C.goldD, () => Router.go('achv')],
        ['🛍️', '商城', C.pink, C.pinkD, () => Router.go('shop')],
    ];
    qdefs.forEach(([icon, name, color, dark, cb], i) => {
        const bx = (i - 1) * 185;
        const holder = Ui.node(quick, 165, 160, bx, 0);
        const btn = Ui.node(holder, 130, 130);
        const g = Ui.gnode(btn, 130, 130);
        Ui.rr(g.g, 130, 130, 65, dark);
        const m = Ui.gnode(btn, 130, 122);
        m.node.setPosition(0, 4);
        Ui.rr(m.g, 130, 122, 61, color);
        const hl = Ui.gnode(btn, 108, 42);
        hl.node.setPosition(0, 32);
        Ui.rr(hl.g, 108, 42, 21, hex('#FFFFFF85'));
        Ui.emoji(btn, icon, 58);
        if (i === 0) { // 挑战入口红点
            const dot = Ui.gnode(btn, 30, 30, 46, 46);
            dot.g.fillColor = hex('#FF4D4D');
            dot.g.circle(0, 0, 14);
            dot.g.fill();
            dot.g.strokeColor = hex('#FFFFFF');
            dot.g.lineWidth = 4;
            dot.g.stroke();
            Ui.breathe(dot.node, 0.15, 0.9);
        }
        Ui.label(holder, name, { size: 26, y: -68, color: C.ink });
        Ui.bindTap(holder, cb);
        Ui.popIn(holder, 0.5 + i * 0.1);
    });

    const tip = Ui.pill(actions, 580, 64, { y: -145, bg: '#FFFFFFBB', edge: C.panelDark });
    const tipLb = Ui.label(tip, '', { size: 24, color: C.inkSoft, y: 3 });
    const updateTip = () => { tipLb.string = '📅 每日挑战已刷新 · 剩余 ' + countdownToMidnight(); };
    updateTip();
    setTimer(updateTip, 1000, true);
    Ui.popIn(tip, 0.7);
}

/** 设置弹窗 */
function openSettings() {
    Modal.open(box => {
        const p = Ui.panel(box, 600, 640);
        Ui.label(p, '⚙️ 设置', { size: 44, y: 240 });
        const rows: Array<[string]> = [['🎵 背景音乐'], ['🔊 游戏音效'], ['📳 打击震动']];
        rows.forEach(([txt], i) => {
            const row = Ui.panel(p, 500, 88, { y: 110 - i * 110, bg: '#FFF7E2', r: 18 });
            Ui.label(row, txt, { size: 28, x: -140 });
            const tg = Ui.gnode(row, 100, 54, 150, 0);
            drawToggle(tg.g, true);
            (tg.node as any)._on = true;
            Ui.bindTap(tg.node, () => {
                (tg.node as any)._on = !(tg.node as any)._on;
                drawToggle(tg.g, (tg.node as any)._on);
            });
        });
        Ui.candyBtn(p, 240, 88, '好的', [C.greenH, C.green, C.greenD], { y: -240, onClick: () => Modal.close() });
        Ui.label(p, '占位开关 · 正式版接入音频/震动系统', { size: 20, color: C.inkSoft, y: -305 });
    });
}

function drawToggle(g: Graphics, on: boolean) {
    g.clear();
    g.fillColor = hex(on ? C.green : '#D8CBA8');
    g.roundRect(-50, -27, 100, 54, 27);
    g.fill();
    g.fillColor = hex('#FFFFFF');
    g.circle(on ? 23 : -23, 0, 21);
    g.fill();
}
