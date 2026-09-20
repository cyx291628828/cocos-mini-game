import { Node, Graphics, Label, Vec3, tween } from 'cc';
import { Ui } from '../core/Ui';
import { C, hex } from '../core/Const';
import { Router } from '../core/Router';
import { SAVE, onCoins, countdownToMidnight, countdownToWeekEnd, countdownToMonthEnd, setTimer } from '../core/Save';
import { GAMES, GAME_ORDER, CH_PERIODS, GameCtx } from '../core/Data';

let curTab = 'sudoku';

/** 挑战中心：玩法 Tab（横向可拖）× 每日/每周/每月挑战卡 */
export function buildChallenge(root: Node) {
    const W = Ui.W(), H = Ui.H();
    Ui.background(root, [C.cream1, C.cream2], null);

    /* 顶栏 */
    const top = Ui.node(root, W, 110, 0, H / 2 - 85);
    Ui.circleBtn(top, 84, '‹', { x: -W / 2 + 80, emojiSize: 52, onClick: () => Router.back() });
    Ui.label(top, '挑战中心', { size: 40, x: -10, y: 3 });
    const coinPill = Ui.pill(top, 205, 64, { x: W / 2 - 135, bg: C.panel, edge: C.panelDark });
    Ui.emoji(coinPill, '🪙', 32, -64, 3);
    const coinLb = Ui.label(coinPill, String(SAVE.data.coins), { size: 28, x: 22, y: 3 });
    onCoins(coinLb.node, (v: number) => { coinLb.string = String(v); });

    /* 玩法 Tab 条（横向可拖，兼容新增玩法） */
    const n = GAME_ORDER.length, TAB_W = 132, TAB_GAP = 142;
    const tabCtW = n * TAB_GAP + 40;
    const tabVp = Ui.node(root, W, 150, 0, H / 2 - 235);
    const tabCt = Ui.node(tabVp, tabCtW, 150);
    Ui.dragScrollH(tabVp, tabCt);

    interface TabRef { gid: string; bodyG: Graphics; mG: Graphics; nameLb: Label; node: Node; }
    const tabRefs: TabRef[] = [];
    GAME_ORDER.forEach((gid, i) => {
        const g = GAMES[gid];
        const tx = -(n - 1) / 2 * TAB_GAP + i * TAB_GAP;
        const t = Ui.node(tabCt, TAB_W, 132, tx, 0);
        const body = Ui.gnode(t, TAB_W, TAB_W);
        const m = Ui.gnode(t, TAB_W, TAB_W - 6);
        m.node.setPosition(0, 3);
        Ui.emoji(t, g.icon, 52, 0, 16);
        const nameLb = Ui.label(t, g.name, { size: 24, y: -42 });
        Ui.bindTap(t, () => {
            if (curTab === gid) return;
            curTab = gid;
            paintTabs();
            fillList();
        });
        t.setScale(0, 0, 1);
        tween(t).delay(i * 0.06).to(0.4, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        tabRefs.push({ gid, bodyG: body.g, mG: m.g, nameLb, node: t });
    });

    /** 重绘 Tab 选中态（不重建节点） */
    const paintTabs = () => {
        tabRefs.forEach(r => {
            const on = r.gid === curTab;
            const colors: [string, string, string] = on ? [C.purpleH, C.purple, C.purpleD] : ['#FFFFFF', C.panel, C.panelDark];
            r.bodyG.clear();
            Ui.rr(r.bodyG, TAB_W, TAB_W, 26, colors[2]);
            r.mG.clear();
            Ui.rr(r.mG, TAB_W, TAB_W - 6, 24, colors[1]);
            r.mG.strokeColor = hex(colors[0]); r.mG.lineWidth = 3;
            r.mG.roundRect(-(TAB_W / 2 - 2), -(TAB_W / 2 - 6) + 3, TAB_W - 4, TAB_W - 12, 22);
            r.mG.stroke();
            r.nameLb.color = hex(on ? '#FFFFFF' : C.ink);
        });
    };
    paintTabs();

    /* 挑战卡列表（视口顶紧贴 Tab 底，超出可拖拽滚动） */
    const CARD_H = 272, CARD_GAP = 26;
    const vpTop = H / 2 - 330;
    const vpH = vpTop + H / 2 - 40;
    const listVp = Ui.node(root, W, vpH, 0, vpTop - vpH / 2);
    const contentH = CH_PERIODS.length * (CARD_H + CARD_GAP) + 40;
    const listCt = Ui.node(listVp, W, contentH);
    const scroller = Ui.dragScroll(listVp, listCt);

    const cdLabels: Label[] = [];
    /** 只重建卡片内容（Tab 切换不整页刷新） */
    const fillList = () => {
        listCt.destroyAllChildren();
        cdLabels.length = 0;
        const g = GAMES[curTab];
        CH_PERIODS.forEach((p, i) => {
            const rec = SAVE.chRec(curTab, p.key);
            const y = contentH / 2 - 40 - i * (CARD_H + CARD_GAP) - CARD_H / 2;
            const card = Ui.panel(listCt, W - 70, CARD_H, { y });
            const cardColors: Record<string, [string, string, string]> = {
                daily: [C.greenH, C.green, C.greenD],
                weekly: [C.blueH, C.blue, C.blueD],
                monthly: [C.goldH, C.gold, C.goldD],
            };
            const [hc, bc, dc] = cardColors[p.key];

            // 图标块
            const ic = Ui.gnode(card, 118, 118, -(W - 70) / 2 + 98, 0);
            Ui.rr(ic.g, 118, 118, 34, dc);
            const icm = Ui.gnode(card, 118, 112);
            icm.node.setPosition(-(W - 70) / 2 + 98, 3);
            Ui.rr(icm.g, 118, 112, 32, bc);
            Ui.emoji(card, p.icon, 56, -(W - 70) / 2 + 98, 3);
            if (rec.done) Ui.emoji(card, '✓', 42, -(W - 70) / 2 + 158, 44);

            // 信息区
            const ix = -(W - 70) / 2 + 185;
            Ui.label(card, `${p.name} · ${g.name}`, { size: 32, x: ix + 150, y: 78 });
            const tag = Ui.pill(card, 118, 44, { x: ix + 335, y: 78, bg: dc, edge: dc });
            Ui.label(tag, p.tag, { size: 22, color: '#FFFFFF', y: 2 });
            const cdLb = Ui.label(card, '', { size: 26, color: C.blueD, x: ix + 210, y: 26 });
            cdLabels.push(cdLb);
            Ui.label(card, rec.best ? '🏅 最佳记录 ' + rec.best : '🏟 尚无挑战记录', { size: 23, color: C.inkSoft, x: ix + 215, y: -20 });
            Ui.label(card, `🪙 ${p.reward}`, { size: 26, color: C.goldD, x: ix + 85, y: -66 });

            // 挑战按钮
            Ui.candyBtn(card, 190, 92, rec.done ? '重 玩' : '挑 战',
                rec.done ? ['#E8E0CE', '#CFC8B8', '#948C7C'] : [hc, bc, dc], {
                x: (W - 70) / 2 - 145, y: 0, fontSize: 32,
                onClick: () => Router.go('game', { from: 'challenge', gid: curTab, challengeKey: p.key } as GameCtx),
            });

            Ui.popIn(card, 0.06 + i * 0.08);
        });
        scroller.snapTop();
    };
    fillList();

    // 倒计时每秒刷新
    const refresh = () => {
        const cds = [countdownToMidnight(), countdownToWeekEnd(), countdownToMonthEnd()];
        cdLabels.forEach((lb, i) => { lb.string = '⏳ 距刷新 ' + cds[i]; });
    };
    refresh();
    setTimer(refresh, 1000, true);
}
