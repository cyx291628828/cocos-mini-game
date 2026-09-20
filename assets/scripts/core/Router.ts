import { Node, UIOpacity, Vec3, tween } from 'cc';
import { Ui } from './Ui';
import { clearTimers } from './Save';

export type ScreenBuilder = (root: Node, param?: any) => void;

/**
 * 界面路由：单场景内的屏幕栈（push / pop / replace）。
 * 每次切换销毁重建界面层（Ui.uiLayer），弹窗层与提示层常驻。
 */
export class Router {
    static stack: string[] = [];
    static builders = new Map<string, ScreenBuilder>();
    /** 界面切换钩子（弹窗清理等，模块加载时注册） */
    static hooks: Array<() => void> = [];

    static init() {
        this.stack = [];
        this.builders.clear();
    }

    static register(name: string, builder: ScreenBuilder) {
        this.builders.set(name, builder);
    }

    private static build(name: string, param?: any) {
        const b = this.builders.get(name);
        if (!b) { console.error('[Router] 未注册的界面: ' + name); return; }
        try {
            clearTimers();
            this.hooks.forEach(h => h());
            Ui.uiLayer.destroyAllChildren();
            const holder = Ui.node(Ui.uiLayer, 0, 0);
            // 入场转场
            const op = holder.addComponent(UIOpacity);
            op.opacity = 0;
            holder.setScale(0.94, 0.94, 1);
            tween(op).to(0.22, { opacity: 255 }).start();
            tween(holder).to(0.32, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            b(holder, param);
        } catch (e) {
            console.error('[Router] 构建 ' + name + ' 界面出错:', e);
        }
    }

    /** 前进（可携带参数，如玩法上下文） */
    static go(name: string, param?: any) {
        this.stack.push(name);
        this.build(name, param);
    }

    /** 替换当前屏（如重新开始本关） */
    static replace(name: string, param?: any) {
        if (this.stack.length) this.stack[this.stack.length - 1] = name;
        else this.stack.push(name);
        this.build(name, param);
    }

    /** 返回上一屏 */
    static back() {
        if (this.stack.length > 1) this.stack.pop();
        const top = this.stack[this.stack.length - 1] || 'home';
        this.build(top);
    }

    /** 回到指定屏（重置栈底） */
    static resetTo(name: string, param?: any) {
        this.stack = [name];
        this.build(name, param);
    }

    /** 回退到栈中已有的指定屏（保留栈底，返回键仍可用） */
    static backTo(name: string, param?: any) {
        const i = this.stack.indexOf(name);
        if (i > 0) this.stack = this.stack.slice(0, i + 1);
        else if (i === 0) this.stack = [name];
        else this.stack = ['home', name];
        this.build(name, param);
    }
}
