import { Ui } from '../core/Ui';
import { C } from '../core/Const';
import { SAVE, addCoins } from '../core/Save';
import { ACHV_DEF } from '../core/Data';
import { Modal } from './ModalUI';
import { confetti } from './Confetti';

/**
 * 成就检查：新达成的成就入队弹窗（Modal 排队，不打断结算弹窗）。
 * 在结算、购买皮肤等事件后调用。
 */
export function checkAchievements() {
    const newly = ACHV_DEF.filter(a =>
        !SAVE.data.achvUnlocked.includes(a.id) && SAVE.achvProgress(a.id) >= a.target);
    if (!newly.length) return;
    SAVE.data.achvUnlocked.push(...newly.map(a => a.id));
    SAVE.save();
    newly.forEach(a => {
        Modal.open(box => {
            const p = Ui.panel(box, 560, 560);
            const icon = Ui.emoji(p, a.icon, 100, 0, 165);
            Ui.bob(icon, 8, 2.4);
            Ui.label(p, '成就解锁！', { size: 44, y: 75 });
            Ui.label(p, a.name, { size: 34, color: C.goldD, y: 15 });
            Ui.label(p, a.desc, { size: 24, color: C.inkSoft, y: -30 });
            const coin = Ui.pill(p, 240, 70, { y: -105, bg: '#FFF3C9', edge: '#D9B955' });
            Ui.label(coin, '🪙 +100', { size: 32, color: C.goldD, y: 3 });
            Ui.candyBtn(p, 240, 90, '太棒了', [C.goldH, C.gold, C.goldD], {
                y: -205, fontSize: 32,
                onClick: () => Modal.close(),
            });
            confetti(50);
            addCoins(100);
        });
    });
}
