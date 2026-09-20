import {
    Node, Graphics, Label, UITransform, UIOpacity, Color, Vec2, Vec3, tween, Tween, Mask,
} from 'cc';
import { C, hex, DW, DH } from './Const';

/**
 * UI 控件工厂：纯代码构建糖果风控件（无图片依赖）。
 * init() 创建三个全局层：uiLayer（界面）/ layerModal（弹窗）/ layerToast（提示）。
 * 坐标系：父容器中心为原点，x∈[-W/2,W/2]，y∈[-H/2,H/2]。
 */
export class Ui {
    static root: Node = null!;
    static uiLayer: Node = null!;
    static layerModal: Node = null!;
    static layerToast: Node = null!;

    static init(root: Node) {
        this.root = root;
        this.uiLayer = this.node(root, 0, 0);
        this.layerModal = this.node(root, 0, 0);
        this.layerToast = this.node(root, 0, 0);
    }

    static W() { return this.root ? this.root.getComponent(UITransform)!.width : DW; }
    static H() { return this.root ? this.root.getComponent(UITransform)!.height : DH; }
    static topY() { return this.H() / 2; }
    static botY() { return -this.H() / 2; }

    /* ---------------- 基础节点 ---------------- */

    /** 空 UI 节点（带尺寸） */
    static node(parent: Node, w = 0, h = 0, x = 0, y = 0): Node {
        const n = new Node();
        const ut = n.addComponent(UITransform);
        ut.setContentSize(w, h);
        n.setPosition(x, y);
        if (parent) parent.addChild(n);
        return n;
    }

    /** 挂 Graphics 的节点 */
    static gnode(parent: Node, w: number, h: number, x = 0, y = 0): { node: Node; g: Graphics } {
        const n = this.node(parent, w, h, x, y);
        const g = n.addComponent(Graphics);
        return { node: n, g };
    }

    /** 圆角矩形填充 */
    static rr(g: Graphics, w: number, h: number, r: number, color: Color | string) {
        g.fillColor = typeof color === 'string' ? hex(color) : color;
        const rad = Math.min(r, w / 2, h / 2);
        g.roundRect(-w / 2, -h / 2, w, h, rad);
        g.fill();
    }

    /** 文本（系统字体，支持中文/emoji） */
    static label(parent: Node, text: string, opt: {
        size?: number; color?: string | Color; bold?: boolean; x?: number; y?: number;
        stroke?: string; strokeWidth?: number; align?: 'left' | 'center' | 'right';
    } = {}): Label {
        const size = opt.size || 28;
        const n = this.node(parent, Math.max(text.length * size, size), size * 1.4, opt.x || 0, opt.y || 0);
        const lb = n.addComponent(Label);
        lb.string = text;
        lb.fontSize = size;
        lb.lineHeight = size * 1.25;
        lb.isBold = opt.bold !== false;
        lb.color = typeof opt.color === 'string' ? hex(opt.color) : (opt.color || hex(C.ink));
        lb.useSystemFont = true;
        if (opt.stroke) {
            lb.enableOutline = true;
            lb.outlineColor = hex(opt.stroke);
            lb.outlineWidth = opt.strokeWidth ?? Math.max(2, Math.floor(size / 9));
        }
        return lb;
    }

    /** emoji 图标 */
    static emoji(parent: Node, char: string, size: number, x = 0, y = 0): Node {
        return this.label(parent, char, { size, x, y, bold: false }).node;
    }

    /* ---------------- 复合控件 ---------------- */

    /** 糖果风圆角面板（厚底边 + 白底 + 描边） */
    static panel(parent: Node, w: number, h: number, opt: {
        x?: number; y?: number; bg?: string; line?: string; edge?: string; r?: number;
    } = {}): Node {
        const r = opt.r ?? 24;
        const holder = this.node(parent, w, h, opt.x || 0, opt.y || 0);
        const edge = this.gnode(holder, w, h);
        this.rr(edge.g, w, h, r, opt.edge || C.panelDark);
        const main = this.gnode(holder, w, h - 6);
        main.node.setPosition(0, 3);
        this.rr(main.g, w, h - 6, r, opt.bg || C.panel);
        main.g.strokeColor = hex(opt.line || C.panelLine);
        main.g.lineWidth = 4;
        main.g.roundRect(-w / 2 + 2, -(h - 6) / 2 + 2, w - 4, h - 10, Math.max(4, r - 2));
        main.g.stroke();
        return holder;
    }

    /** 糖果按钮：厚底边 + 主色 + 高光 + 文字 + 按压动画 + 流光；c: [高光, 主色, 深边] */
    static candyBtn(parent: Node, w: number, h: number, text: string, c: [string, string, string], opt: {
        x?: number; y?: number; r?: number; fontSize?: number; onClick?: () => void;
        delay?: number; sheen?: boolean;
    } = {}): Node {
        const r = opt.r ?? Math.min(30, h / 2);
        const holder = this.node(parent, w, h, opt.x || 0, opt.y || 0);

        const body = this.gnode(holder, w, h);
        this.rr(body.g, w, h, r, c[2]);
        const mainG = this.gnode(holder, w, h - 8);
        mainG.node.setPosition(0, 4);
        this.rr(mainG.g, w, h - 8, r, c[1]);
        const hl = this.gnode(holder, w * 0.82, h * 0.3);
        hl.node.setPosition(0, h * 0.16);
        this.rr(hl.g, w * 0.82, h * 0.3, h * 0.15, hex('#FFFFFF88'));

        const fs = opt.fontSize || h * 0.4;
        const lb = this.label(holder, text, { size: fs, color: '#FFFFFF' });
        lb.enableOutline = true;
        lb.outlineColor = hex(c[2]);
        lb.outlineWidth = 2;

        this.bindTap(holder, opt.onClick);
        if (opt.delay != null) this.popIn(holder, opt.delay);
        if (opt.sheen !== false) this.sheen(holder, w, h);
        return holder;
    }

    /** 圆角方形图标按钮 */
    static circleBtn(parent: Node, size: number, icon: string, opt: {
        x?: number; y?: number; onClick?: () => void; emojiSize?: number;
    } = {}): Node {
        const holder = this.node(parent, size, size, opt.x || 0, opt.y || 0);
        const g = this.gnode(holder, size, size);
        this.rr(g.g, size, size, size * 0.42, C.panelDark);
        const m = this.gnode(holder, size, size - 6);
        m.node.setPosition(0, 3);
        this.rr(m.g, size, size - 6, (size - 6) * 0.42, C.panel);
        m.g.strokeColor = hex(C.panelLine); m.g.lineWidth = 3;
        m.g.roundRect(-size / 2 + 1.5, -(size - 6) / 2 + 1.5, size - 3, size - 9, (size - 6) * 0.42);
        m.g.stroke();
        this.emoji(holder, icon, opt.emojiSize || size * 0.48);
        this.bindTap(holder, opt.onClick);
        return holder;
    }

    /** 胶囊容器 */
    static pill(parent: Node, w: number, h: number, opt: {
        x?: number; y?: number; bg?: string; edge?: string; line?: string;
    } = {}): Node {
        const holder = this.node(parent, w, h, opt.x || 0, opt.y || 0);
        const g = this.gnode(holder, w, h);
        this.rr(g.g, w, h, h / 2, opt.edge || C.panelDark);
        const m = this.gnode(holder, w, h - 6);
        m.node.setPosition(0, 3);
        this.rr(m.g, w, h - 6, (h - 6) / 2, opt.bg || C.panel);
        if (opt.line) {
            m.g.strokeColor = hex(opt.line); m.g.lineWidth = 3;
            m.g.roundRect(-w / 2 + 1.5, -(h - 6) / 2 + 1.5, w - 3, h - 9, (h - 6) / 2);
            m.g.stroke();
        }
        return holder;
    }

    /** 进度条 */
    static progressBar(parent: Node, w: number, h: number, ratio: number, opt: {
        x?: number; y?: number; from?: string; to?: string;
    } = {}): { holder: Node; set: (r: number) => void } {
        const holder = this.node(parent, w, h, opt.x || 0, opt.y || 0);
        const track = this.gnode(holder, w, h);
        this.rr(track.g, w, h, h / 2, opt.to || '#EDE3C8');
        const fg = this.gnode(holder, w, h);
        const draw = (r: number) => {
            const rr = Math.max(0, Math.min(1, r));
            fg.g.clear();
            if (rr <= 0) return;
            const fw = Math.max(h, w * rr);
            fg.g.fillColor = hex(opt.from || C.green);
            fg.g.roundRect(-w / 2, -h / 2, fw, h, h / 2);
            fg.g.fill();
            fg.g.fillColor = hex('#FFFFFF50');
            fg.g.roundRect(-w / 2, h * 0.08, fw, h * 0.3, h * 0.15);
            fg.g.fill();
        };
        draw(ratio);
        return { holder, set: draw };
    }

    /** 点按绑定（按压缩放 + 松手回调；移动超过阈值视为拖拽，不触发点击） */
    static bindTap(node: Node, cb?: () => void) {
        if (!cb) return;
        let pressing = false;
        let sx = 0, sy = 0;
        node.on(Node.EventType.TOUCH_START, (e: any) => {
            pressing = true;
            sx = e.getUILocation().x; sy = e.getUILocation().y;
            tween(node).to(0.08, { scale: new Vec3(0.92, 0.92, 1) }).start();
        });
        node.on(Node.EventType.TOUCH_CANCEL, () => { pressing = false; tween(node).to(0.15, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start(); });
        node.on(Node.EventType.TOUCH_END, (e: any) => {
            tween(node).to(0.16, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            const moved = Math.abs(e.getUILocation().x - sx) + Math.abs(e.getUILocation().y - sy);
            if (pressing && moved < 14) cb();
            pressing = false;
        });
    }

    /* ---------------- 动画 ---------------- */

    /** 弹入 */
    static popIn(node: Node, delay = 0, scale = 1) {
        node.setScale(0, 0, 1);
        tween(node)
            .delay(delay)
            .to(0.42, { scale: new Vec3(scale, scale, 1) }, { easing: 'backOut' })
            .start();
    }

    /** 上下浮动 */
    static bob(node: Node, dy = 12, dur = 2.4, delay = 0) {
        const y0 = node.position.y;
        tween(node)
            .delay(delay)
            .repeatForever(
                tween(node)
                    .to(dur / 2, { position: new Vec3(node.position.x, y0 + dy, 0) }, { easing: 'sineInOut' })
                    .to(dur / 2, { position: new Vec3(node.position.x, y0, 0) }, { easing: 'sineInOut' })
            ).start();
    }

    /** 缩放呼吸 */
    static breathe(node: Node, ds = 0.035, dur = 1.3, delay = 0) {
        tween(node)
            .delay(delay)
            .repeatForever(
                tween(node)
                    .to(dur / 2, { scale: new Vec3(1 + ds, 1 + ds, 1) }, { easing: 'sineInOut' })
                    .to(dur / 2, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
            ).start();
    }

    /** 按钮流光 */
    static sheen(holder: Node, w: number, h: number) {
        const bar = this.gnode(holder, w * 0.28, h * 1.6);
        bar.g.fillColor = hex('#FFFFFF38');
        bar.g.rect(-w * 0.14, -h * 0.8, w * 0.28, h * 1.6);
        bar.g.fill();
        bar.node.angle = 18;
        bar.node.setPosition(-w * 0.9, 0);
        const dur = 2.6 + Math.random() * 1.2;
        tween(bar.node)
            .delay(Math.random() * 2)
            .repeatForever(
                tween(bar.node)
                    .delay(dur * 0.55)
                    .to(dur * 0.3, { position: new Vec3(w * 0.9, 0, 0) }, { easing: 'sineInOut' })
                    .call(() => bar.node.setPosition(-w * 0.9, 0, 0))
            ).start();
    }

    /** 闪烁 */
    static twinkle(node: Node, delay = 0) {
        const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        tween(node)
            .delay(delay)
            .repeatForever(
                tween(node)
                    .to(0.6, { scale: new Vec3(0.72, 0.72, 1) }, { easing: 'sineInOut' })
                    .to(0.6, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
            ).start();
        tween(op)
            .delay(delay)
            .repeatForever(
                tween(op)
                    .to(0.6, { opacity: 110 })
                    .to(0.6, { opacity: 235 })
            ).start();
    }

    /** 云朵（漂移循环） */
    static cloud(parent: Node, y: number, scale: number, dur: number, delay = 0) {
        const w = 190 * scale, h = 64 * scale;
        const holder = this.node(parent, w, h, -this.W() / 2 - w, y);
        const g = this.gnode(holder, w, h);
        g.g.fillColor = hex('#FFFFFFE0');
        g.g.circle(-w * 0.22, 0, h * 0.42); g.g.fill();
        g.g.circle(0, h * 0.1, h * 0.5); g.g.fill();
        g.g.circle(w * 0.24, 0, h * 0.38); g.g.fill();
        g.g.roundRect(-w * 0.42, -h * 0.4, w * 0.84, h * 0.55, h * 0.27); g.g.fill();
        tween(holder)
            .delay(delay)
            .repeatForever(
                tween(holder).to(dur, { position: new Vec3(this.W() / 2 + w, y, 0) }, { easing: 'linear' })
                    .call(() => holder.setPosition(-this.W() / 2 - w, y, 0))
            ).start();
        return holder;
    }

    /** 抖动 */
    static shake(node: Node) {
        const x0 = node.position.x;
        tween(node)
            .to(0.05, { position: new Vec3(x0 - 8, node.position.y, 0) })
            .to(0.05, { position: new Vec3(x0 + 8, node.position.y, 0) })
            .to(0.05, { position: new Vec3(x0 - 5, node.position.y, 0) })
            .to(0.04, { position: new Vec3(x0, node.position.y, 0) })
            .start();
    }

    /* ---------------- 通用背景 ---------------- */

    /** 主题背景：底色 + 下半叠色 + 顶部光斑 + 可选圆丘 */
    static background(parent: Node, bg: [string, string], hills: [string, string] | null = null) {
        const W = this.W(), H = this.H();
        const base = this.gnode(parent, W, H);
        base.g.fillColor = hex(bg[0]);
        base.g.rect(-W / 2, -H / 2, W, H); base.g.fill();
        base.g.fillColor = hex(bg[1], 170);
        base.g.rect(-W / 2, -H / 2, W, H * 0.5); base.g.fill();

        const glow = this.gnode(parent, W, 400, 0, H / 2 - 160);
        glow.g.fillColor = hex('#FFFFFF66');
        glow.g.ellipse(0, 0, W * 0.62, 200); glow.g.fill();

        if (hills) {
            const h1 = this.gnode(parent, W * 1.4, 340, -W * 0.1, -H / 2 - 90);
            h1.g.fillColor = hex(hills[0], 235);
            h1.g.ellipse(0, 0, W * 0.7, 170); h1.g.fill();
            const h2 = this.gnode(parent, W * 1.2, 300, W * 0.18, -H / 2 - 120);
            h2.g.fillColor = hex(hills[1], 235);
            h2.g.ellipse(0, 0, W * 0.6, 150); h2.g.fill();
        }
        return base;
    }

    /* ---------------- 竖向拖拽滚动 ---------------- */

    /**
     * 让 content 在 viewport 内竖向拖拽（带 Mask 裁剪 + 边界回弹）。
     * content 初始对齐 viewport 顶部；y 坐标范围 [-D, D]，D=(contentH-vh)/2。
     */
    static dragScroll(viewport: Node, content: Node): { scrollToY: (y: number) => void; snapTop: () => void } {
        const vh = viewport.getComponent(UITransform)!.height;
        // 遮罩：超出 viewport 的内容不渲染
        if (!viewport.getComponent(Graphics)) viewport.addComponent(Graphics);
        const mask = viewport.addComponent(Mask) as any;
        mask.type = 0;   // MaskType.GRAPHICS_RECT

        let D = 0;
        const measure = () => {
            const ch = content.getComponent(UITransform)!.height;
            D = Math.max(0, (ch - vh) / 2 + 20);
        };
        measure();
        // 初始：显示 content 顶部
        content.setPosition(content.position.x, -D, 0);

        let startY = 0, startContentY = 0;
        viewport.on(Node.EventType.TOUCH_START, (e: any) => {
            startY = e.getUILocation().y;
            startContentY = content.position.y;
            Tween.stopAllByTarget(content);
        });
        viewport.on(Node.EventType.TOUCH_MOVE, (e: any) => {
            const dy = e.getUILocation().y - startY;
            let ny = startContentY + dy;            // 内容跟随手指：下滑(dy<0)→内容下移露出顶部
            ny = Math.min(ny, D + 90);
            ny = Math.max(ny, -D - 90);
            content.setPosition(content.position.x, ny, 0);
        });
        viewport.on(Node.EventType.TOUCH_END, () => {
            const ny = Math.max(-D, Math.min(D, content.position.y));
            tween(content).to(0.3, { position: new Vec3(content.position.x, ny, 0) }, { easing: 'backOut' }).start();
        });
        return {
            scrollToY(y: number) {
                measure();
                const target = Math.max(-D, Math.min(D, y));
                tween(content).to(0.5, { position: new Vec3(content.position.x, target, 0) }, { easing: 'sineInOut' }).start();
            },
            /** 立即回到顶部（列表内容重建后调用） */
            snapTop() {
                measure();
                Tween.stopAllByTarget(content);
                content.setPosition(content.position.x, -D, 0);
            },
        };
    }

    /** 横向拖拽滚动（玩法 Tab 条等；内容宽超出 viewport 时生效） */
    static dragScrollH(viewport: Node, content: Node): { scrollX: (x: number) => void; snapLeft: () => void } {
        const vw = viewport.getComponent(UITransform)!.width;
        if (!viewport.getComponent(Graphics)) viewport.addComponent(Graphics);
        const mask = viewport.addComponent(Mask) as any;
        mask.type = 0;   // MaskType.GRAPHICS_RECT

        let D = 0;
        const measure = () => {
            const cw = content.getComponent(UITransform)!.width;
            D = Math.max(0, (cw - vw) / 2 + 20);
        };
        measure();
        content.setPosition(-D, content.position.y, 0);   // 初始显示左侧

        let startX = 0, startContentX = 0;
        viewport.on(Node.EventType.TOUCH_START, (e: any) => {
            startX = e.getUILocation().x;
            startContentX = content.position.x;
            Tween.stopAllByTarget(content);
        });
        viewport.on(Node.EventType.TOUCH_MOVE, (e: any) => {
            const dx = e.getUILocation().x - startX;
            let nx = startContentX + dx;              // 内容跟随手指
            nx = Math.min(nx, D + 90);
            nx = Math.max(nx, -D - 90);
            content.setPosition(nx, content.position.y, 0);
        });
        viewport.on(Node.EventType.TOUCH_END, () => {
            const nx = Math.max(-D, Math.min(D, content.position.x));
            tween(content).to(0.3, { position: new Vec3(nx, content.position.y, 0) }, { easing: 'backOut' }).start();
        });
        return {
            scrollX(x: number) {
                measure();
                const target = Math.max(-D, Math.min(D, x));
                tween(content).to(0.4, { position: new Vec3(target, content.position.y, 0) }, { easing: 'sineInOut' }).start();
            },
            snapLeft() {
                measure();
                Tween.stopAllByTarget(content);
                content.setPosition(-D, content.position.y, 0);
            },
        };
    }
}
