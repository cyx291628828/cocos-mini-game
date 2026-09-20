import { Node, Vec3, tween, UIOpacity } from 'cc';
import { Ui } from '../core/Ui';
import { Router } from '../core/Router';
import { hex } from '../core/Const';
import { setTimer } from '../core/Save';

/**
 * 弹窗系统：遮罩 + 弹出盒子，支持排队（成就等弹出不打断当前弹窗）。
 * buildFn(box) 负责往盒子里放内容；调用方自行绑定关闭按钮 → Modal.close()。
 */
export class Modal {
    private static queue: Array<() => void> = [];
    private static boxHolder: Node | null = null;

    static get isOpen() { return this.boxHolder != null; }

    /** 打开弹窗（若已有弹窗则入队等待） */
    static open(buildFn: (box: Node) => void, w = 600) {
        if (this.boxHolder) { this.queue.push(() => this.open(buildFn, w)); return; }
        const layer = Ui.layerModal;
        // 遮罩（拦截穿透点击）
        const mask = Ui.gnode(layer, Ui.W() * 2, Ui.H() * 2);
        mask.g.fillColor = hex('#2D200E', 115);
        mask.g.rect(-Ui.W(), -Ui.H(), Ui.W() * 2, Ui.H() * 2);
        mask.g.fill();
        const mop = mask.node.addComponent(UIOpacity);
        mop.opacity = 0;
        tween(mop).to(0.2, { opacity: 255 }).start();
        mask.node.on(Node.EventType.TOUCH_END, () => { /* 吃掉事件防穿透 */ });
        // 弹窗盒
        const holder = Ui.node(layer, w, 0);
        holder.addComponent(UIOpacity);
        holder.setScale(0.5, 0.5, 1);
        (holder as any)._mask = mask.node;
        tween(holder).to(0.38, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        buildFn(holder);
        this.boxHolder = holder;
    }

    /** 关闭当前弹窗；队列中还有则接着弹 */
    static close() {
        const holder = this.boxHolder;
        if (!holder) return;
        this.boxHolder = null;
        const mask = (holder as any)._mask as Node | undefined;
        const op = holder.getComponent(UIOpacity)!;
        tween(holder).to(0.18, { scale: new Vec3(0.8, 0.8, 1) }).start();
        tween(op).to(0.18, { opacity: 0 }).call(() => {
            holder.destroy();
            mask?.destroy();
        }).start();
        if (this.queue.length) {
            const next = this.queue.shift()!;
            setTimer(() => next(), 360);
        }
    }

    /** 界面切换时清空所有弹窗与队列（Router.hooks 注册） */
    static reset() {
        this.queue.length = 0;
        this.boxHolder = null;
        Ui.layerModal.destroyAllChildren();
    }

    /** Toast 轻提示 */
    static toast(msg: string) {
        const layer = Ui.layerToast;
        const tw = Math.max(260, msg.length * 27 + 100);
        const t = Ui.node(layer, tw, 78, 0, Ui.botY() + 260);
        const edge = Ui.gnode(t, tw, 78);
        Ui.rr(edge.g, tw, 78, 39, '#241A0C');
        const main = Ui.gnode(t, tw, 72);
        main.node.setPosition(0, 3);
        Ui.rr(main.g, tw, 72, 36, '#3C2C18');
        Ui.label(t, msg, { size: 26, color: '#FFE9BE' });
        const op = t.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.25, { opacity: 255 }).start();
        tween(t).to(0.25, { position: new Vec3(0, Ui.botY() + 300, 0) }, { easing: 'backOut' }).start();
        setTimer(() => {
            tween(op).to(0.3, { opacity: 0 }).call(() => t.destroy()).start();
        }, 1900);
    }
}

/** Router 切换界面时自动清弹窗 */
Router.hooks.push(() => Modal.reset());
