import { Node, UITransform } from 'cc';
import { Ui } from '../core/Ui';
import { C, hex } from '../core/Const';
import { Router } from '../core/Router';
import { SAVE, addCoins, onCoins } from '../core/Save';
import { SKINS, skinOf } from '../core/Data';
import { Modal } from './ModalUI';
import { confetti } from './Confetti';
import { checkAchievements } from './Achievement';

/** 皮肤商城 */
export function buildShop(root: Node) {
    const W = Ui.W(), H = Ui.H();
    Ui.background(root, [C.cream1, C.cream2], null);

    /* 顶栏 */
    const top = Ui.node(root, W, 110, 0, H / 2 - 85);
    Ui.circleBtn(top, 84, '‹', { x: -W / 2 + 80, emojiSize: 52, onClick: () => Router.back() });
    Ui.label(top, '皮肤商城', { size: 40, x: -10, y: 3 });
    const coinPill = Ui.pill(top, 220, 64, { x: W / 2 - 140, bg: C.panel, edge: C.panelDark });
    Ui.emoji(coinPill, '🪙', 32, -70, 3);
    const coinLb = Ui.label(coinPill, String(SAVE.data.coins), { size: 28, x: 25, y: 3 });
    onCoins(coinLb.node, (v: number) => { coinLb.string = String(v); });

    /* 皮肤网格（2 列，可拖拽滚动） */
    const vpTop = H / 2 - 190, vpH = vpTop + H / 2 - 40;
    const viewport = Ui.node(root, W, vpH, 0, vpTop - vpH / 2);
    const cardW = (W - 70 - 30) / 2;
    const cardH = 430;
    const rows = Math.ceil(SKINS.length / 2);
    const content = Ui.node(viewport, W, rows * (cardH + 26) + 40);
    const contentH = content.getComponent(UITransform)!.height;

    SKINS.forEach((sk, i) => {
        const row = Math.floor(i / 2), col = i % 2;
        // 两列：左右边距 35，列间隙 30 → 列中心 ∓(W/2 - 35 - cardW/2)
        const colX = W / 2 - 35 - cardW / 2;
        const x = col === 0 ? -colX : colX;
        const y = contentH / 2 - 40 - row * (cardH + 26) - cardH / 2;
        const card = Ui.panel(content, cardW, cardH, { x, y });
        const owned = SAVE.data.owned.includes(sk.id);
        const using = SAVE.data.skin === sk.id;

        // 使用中角标
        if (using) {
            const mark = Ui.pill(card, 150, 50, { x: cardW / 2 - 58, y: cardH / 2 - 18, bg: C.green, edge: C.greenD });
            mark.angle = 6;
            Ui.label(mark, '使用中 ✓', { size: 22, color: '#FFFFFF', y: 2 });
        }

        // 迷你棋盘预览（6x6）
        const pvW = cardW - 60;
        const cell = pvW / 6;
        const pv = Ui.gnode(card, pvW + 8, pvW + 8, 0, 55);
        pv.g.fillColor = hex(sk.frame);
        pv.g.roundRect(-(pvW + 8) / 2, -(pvW + 8) / 2, pvW + 8, pvW + 8, 14);
        pv.g.fill();
        const demoNums = [4, 0, 1, 0, 3, 6, 0, 2, 0, 5, 0, 0, 7, 0, 0, 1, 0, 2, 0, 6, 3, 0, 0, 8, 1, 0, 0, 4, 0, 0, 0, 5, 0, 2, 7, 0];
        const userIdx = new Set([0, 2, 5, 7, 9, 12, 15, 17, 19, 22, 24, 27, 31, 33]);
        for (let r = 0; r < 6; r++) {
            for (let c2 = 0; c2 < 6; c2++) {
                const idx = r * 6 + c2;
                const alt = (Math.floor(r / 2) + Math.floor(c2 / 2)) % 2;
                const cx = -pvW / 2 + cell / 2 + c2 * cell;
                const cy = pvW / 2 - cell / 2 - r * cell + 55;
                const cg = Ui.gnode(card, cell - 6, cell - 6, cx, cy);
                Ui.rr(cg.g, cell - 6, cell - 6, 8, alt ? sk.cellAlt : sk.cell);
                const num = demoNums[idx];
                if (num) {
                    Ui.label(card, String(num), {
                        size: cell * 0.52,
                        color: userIdx.has(idx) ? sk.user : sk.given,
                        x: cx, y: cy,
                    });
                }
            }
        }

        Ui.label(card, sk.name, { size: 30, y: -100 });
        Ui.label(card, sk.desc, { size: 21, color: C.inkSoft, y: -140 });

        // 按钮：使用中 / 装备 / 购买
        const btnColors: [string, string, string] = using
            ? ['#E8E0CE', '#CFC8B8', '#948C7C']
            : owned ? [C.blueH, C.blue, C.blueD] : [C.greenH, C.green, C.greenD];
        const btnText = using ? '默认装备' : owned ? '装 备' : `🪙 ${sk.price}`;
        Ui.candyBtn(card, cardW - 50, 84, btnText, btnColors, {
            y: -195, fontSize: 28, sheen: !using,
            onClick: () => onSkinAct(sk.id),
        });

        Ui.popIn(card, 0.06 + i * 0.06);
    });

    Ui.dragScroll(viewport, content);
}

/** 购买 / 装备逻辑 */
function onSkinAct(id: string) {
    const sk = skinOf(id);
    const owned = SAVE.data.owned.includes(id);
    const using = SAVE.data.skin === id;
    if (using) return;
    if (owned) {
        SAVE.data.skin = id;
        SAVE.save();
        Router.replace('shop');
        Modal.toast(`已装备「${sk.name}」🎯`);
        checkAchievements();
        return;
    }
    if (SAVE.data.coins < sk.price) {
        Modal.toast('金币不足，去闯关赚金币吧！💪');
        return;
    }
    // 购买确认弹窗
    Modal.open(box => {
        const p = Ui.panel(box, 560, 560);
        const icon = Ui.emoji(p, '🛍️', 96, 0, 175);
        Ui.bob(icon, 8, 2.4);
        Ui.label(p, '购买皮肤', { size: 42, y: 85 });
        Ui.label(p, `确认花费 🪙 ${sk.price} 购买「${sk.name}」吗？`, { size: 28, color: C.inkSoft, y: 25 });
        Ui.candyBtn(p, 220, 90, '再想想', ['#FFFFFF', '#F3E3BB', C.panelDark], { x: -125, y: -175, fontSize: 30, onClick: () => Modal.close() });
        Ui.candyBtn(p, 220, 90, '买！', [C.pinkH, C.pink, C.pinkD], {
            x: 125, y: -175, fontSize: 30,
            onClick: () => {
                Modal.close();
                addCoins(-sk.price);
                SAVE.data.owned.push(id);
                SAVE.data.skin = id;
                SAVE.save();
                confetti(60);
                Router.replace('shop');
                Modal.toast(`获得新皮肤「${sk.name}」！🎉`);
                checkAchievements();
            },
        });
    });
}
