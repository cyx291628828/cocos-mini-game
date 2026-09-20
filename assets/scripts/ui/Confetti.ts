import { Vec3, tween } from 'cc';
import { Ui } from '../core/Ui';
import { hex } from '../core/Const';

/** 彩带粒子（结算 / 成就庆祝） */
export function confetti(n = 70) {
    const layer = Ui.layerModal;
    const W = Ui.W(), H = Ui.H();
    const colors = ['#FF7FB2', '#FFC93C', '#72CC55', '#57ABEF', '#A06FF2', '#FF8A5C'];
    for (let i = 0; i < n; i++) {
        const w = 10 + Math.random() * 10, h = 13 + Math.random() * 12;
        const p = Ui.gnode(layer, w, h,
            -W / 2 + Math.random() * W,
            H / 2 + 40 + Math.random() * H * 0.35);
        p.g.fillColor = hex(colors[i % colors.length]);
        p.g.rect(-w / 2, -h / 2, w, h);
        p.g.fill();
        p.node.angle = Math.random() * 360;
        const dur = 2 + Math.random() * 1.4;
        tween(p.node)
            .delay(Math.random() * 0.9)
            .by(dur, { position: new Vec3((Math.random() - 0.5) * 240, -(H + 320 + Math.random() * 300), 0) }, { easing: 'quadIn' })
            .call(() => p.node.destroy())
            .start();
        tween(p.node).by(dur, { angle: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 400) }).start();
    }
}
