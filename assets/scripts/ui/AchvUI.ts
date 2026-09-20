import { Node, UITransform } from 'cc';
import { Ui } from '../core/Ui';
import { C, hex } from '../core/Const';
import { Router } from '../core/Router';
import { SAVE, onCoins } from '../core/Save';
import { ACHV_DEF } from '../core/Data';

/** 成就殿堂 */
export function buildAchv(root: Node) {
    const W = Ui.W(), H = Ui.H();
    Ui.background(root, [C.cream1, C.cream2], null);

    /* 顶栏 */
    const top = Ui.node(root, W, 110, 0, H / 2 - 85);
    Ui.circleBtn(top, 84, '‹', { x: -W / 2 + 80, emojiSize: 52, onClick: () => Router.back() });
    Ui.label(top, '成就', { size: 40, x: -10, y: 3 });
    const coinPill = Ui.pill(top, 205, 64, { x: W / 2 - 135, bg: C.panel, edge: C.panelDark });
    Ui.emoji(coinPill, '🪙', 32, -64, 3);
    const coinLb = Ui.label(coinPill, String(SAVE.data.coins), { size: 28, x: 22, y: 3 });
    onCoins(coinLb.node, (v: number) => { coinLb.string = String(v); });

    /* 顶部殿堂卡 */
    const unlocked = SAVE.data.achvUnlocked.length;
    const total = ACHV_DEF.length;
    const hero = Ui.node(root, W - 70, 230, 0, H / 2 - 300);
    const hg = Ui.gnode(hero, W - 70, 230);
    hg.g.roundRect(-(W - 70) / 2, -115, W - 70, 230, 32);
    hg.g.fillColor = hex(C.goldD);
    hg.g.fill();
    const hm = Ui.gnode(hero, W - 70, 220);
    hm.node.setPosition(0, 5);
    hm.g.roundRect(-(W - 70) / 2, -110, W - 70, 220, 30);
    hm.g.fillColor = hex(C.gold);
    hm.g.fill();
    hm.g.strokeColor = hex('#FFFFFF'); hm.g.lineWidth = 6;
    hm.g.roundRect(-(W - 70) / 2 + 3, -107, W - 76, 214, 27);
    hm.g.stroke();

    // 环形进度
    const R = 78;
    const ring = Ui.gnode(hero, 200, 200, -(W - 70) / 2 + 120, 0);
    ring.g.lineWidth = 16;
    ring.g.strokeColor = hex('#7A520055');
    ring.g.circle(0, 0, R); ring.g.stroke();
    ring.g.strokeColor = hex('#FFFFFF');
    const frac = total ? unlocked / total : 0;
    ring.g.moveTo(0, R);
    const segs = 64;
    for (let i = 1; i <= Math.floor(segs * frac); i++) {
        const a = (Math.PI * 2 * i) / segs;
        ring.g.lineTo(Math.sin(a) * R, Math.cos(a) * R);
    }
    ring.g.stroke();
    Ui.label(hero, `${unlocked}/${total}`, { size: 36, x: -(W - 70) / 2 + 120, color: '#7A5200' });

    const trophy = Ui.emoji(hero, '🏆', 90, -20, 0);
    Ui.bob(trophy, 10, 3);
    Ui.label(hero, '成就殿堂', { size: 40, color: '#7A5200', x: 105, y: 35 });
    Ui.label(hero, unlocked === total ? '全成就达成！你就是谜题之神！🌟' : '完成成就收集星星，点亮荣誉之路',
        { size: 23, color: '#7A5200', x: 90, y: -30 });
    Ui.popIn(hero, 0.05);

    /* 成就列表（拖拽滚动，Mask 裁剪） */
    const vpTop = H / 2 - 450, vpH = vpTop + H / 2 - 60;
    const viewport = Ui.node(root, W, vpH, 0, vpTop - vpH / 2);
    const itemH = 150;
    const content = Ui.node(viewport, W, ACHV_DEF.length * (itemH + 22) + 40);
    const contentH = content.getComponent(UITransform)!.height;

    ACHV_DEF.forEach((a, i) => {
        const cur = SAVE.achvProgress(a.id);
        const isUn = SAVE.data.achvUnlocked.includes(a.id);
        const y = contentH / 2 - 40 - i * (itemH + 22) - itemH / 2;
        const item = Ui.panel(content, W - 70, itemH, { y });

        // 图标块（解锁金色发光 / 未解锁灰色）
        const ic = Ui.gnode(item, 104, 104, -(W - 70) / 2 + 82, 0);
        Ui.rr(ic.g, 104, 104, 28, isUn ? C.goldD : '#B0A68C');
        const icm = Ui.gnode(item, 104, 98);
        icm.node.setPosition(-(W - 70) / 2 + 82, 3);
        Ui.rr(icm.g, 104, 98, 26, isUn ? C.gold : '#CFC5AC');
        Ui.emoji(item, a.icon, 50, -(W - 70) / 2 + 82, 3);

        // 文本 + 进度
        const tx = -(W - 70) / 2 + 165;
        Ui.label(item, a.name + (isUn ? '  ✓' : ''), { size: 30, x: tx + 110, y: 44, color: isUn ? C.goldD : C.ink });
        Ui.label(item, a.desc, { size: 23, color: C.inkSoft, x: tx + 185, y: 8 });
        Ui.progressBar(item, 340, 20, cur / a.target, { x: tx + 170, y: -32, from: isUn ? C.gold : C.green });
        Ui.label(item, `${isUn ? '已解锁' : '进度'} ${cur}/${a.target}`, { size: 20, color: C.inkSoft, x: tx + 330, y: -32 });

        Ui.popIn(item, 0.08 + i * 0.05);
    });
    Ui.dragScroll(viewport, content);
}
