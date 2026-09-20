import {
    _decorator, Component, UITransform, Widget, view, ResolutionPolicy, Camera,
} from 'cc';
import { Ui } from './core/Ui';
import { Router } from './core/Router';
import { SAVE } from './core/Save';
import { Config } from './core/Config';
import { buildHome } from './ui/HomeUI';
import { buildChapters } from './ui/ChaptersUI';
import { buildGame } from './ui/GameUI';
import { buildChallenge } from './ui/ChallengeUI';
import { buildAchv } from './ui/AchvUI';
import { buildShop } from './ui/ShopUI';
import './ui/ModalUI'; // 注册弹窗清理钩子

const { ccclass } = _decorator;

/**
 * 游戏入口：挂在 GameRoot 节点上（本场景唯一组件脚本）。
 * 所有界面、控件、动画均由代码构建，无需美术资源。
 */
@ccclass('Game')
export class Game extends Component {
    start() {
        console.log('[Game] 启动：入口组件已挂载 ✓');

        // ---- 相机兜底：visibility 全层渲染 ----
        const canvas = this.node.parent;
        const camNode = canvas ? canvas.getChildByName('Camera') : null;
        const cam = camNode ? camNode.getComponent(Camera) : null;
        if (cam) {
            cam.visibility = 0xffffffff;
        } else {
            console.warn('[Game] 未找到 Canvas/Camera，请检查场景结构');
        }

        // ---- 设计分辨率 + 全屏拉伸 ----
        view.setDesignResolutionSize(750, 1620, ResolutionPolicy.FIXED_WIDTH);
        const ut = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(750, 1620);
        let w = this.node.getComponent(Widget);
        if (!w) w = this.node.addComponent(Widget);
        w.isAlignLeft = w.isAlignRight = w.isAlignTop = w.isAlignBottom = true;
        w.left = w.right = w.top = w.bottom = 0;
        w.updateAlignment();

        // ---- 初始化存档 / UI 层 / 路由 / 配置表 ----
        SAVE.load();
        Ui.init(this.node);
        Router.init();
        Router.register('home', buildHome);
        Router.register('chapters', buildChapters);
        Router.register('game', buildGame);
        Router.register('challenge', buildChallenge);
        Router.register('achv', buildAchv);
        Router.register('shop', buildShop);
        // 配置表（数独表/关卡表）加载完成后再进主界面
        Config.load(() => {
            Router.go('home');
            console.log('[Game] 配置表就绪，主界面构建完成 ✓');
        });
    }
}
