/* 面板层：Toast / 难度选择 / 结算 / 广告占位 / 事件 / 章节过场 / 设置（M1 精简版） */
import { Node, Color, UITransform, Vec3, Label, tween } from 'cc'
import * as meta from '../core/Meta'
import { DIFFS, type RewardRow } from '../core/Config'
import { resetSave } from '../core/Save'
import { node, roundRect, label } from './UiKit'

const PANEL_W = 620

function blocker(root: Node, h = 400): { box: Node; close: () => void } {
    const ov = node('overlay', root, 0, 0, 2000, 3000)
    roundRect(ov, 2000, 3000, new Color(15, 7, 35, 170), 0)
    const box = node('box', ov, 0, 0, PANEL_W, h)
    return {
        box,
        close: () => { ov.destroy() },
    }
}

export function toast(root: Node, msg: string): void {
    const t = node('toast', root, 0, 380, 640, 70)
    roundRect(t, 640, 70, new Color(20, 10, 40, 220), 34)
    label(t, msg, 26)
    t.setScale(0.9, 0.9)
    tween(t).to(0.15, { scale: new Vec3(1, 1, 1) }).delay(1.6)
        .call(() => { t.destroy() }).start()
}

/* ---------- 难度选择 ---------- */

const DIFF_COLOR: Record<string, Color> = {
    '简单': new Color(76, 217, 123), '中等': new Color(85, 165, 255),
    '困难': new Color(255, 150, 64), '专家': new Color(198, 92, 255),
}

export function openDifficulty(root: Node, opts: { game: string; free?: boolean; onPick: (diff: string) => void }): void {
    const { box, close } = blocker(root, 660)
    roundRect(box, PANEL_W, 660, new Color(255, 247, 236), 28)
    label(box, `${opts.game}`, 40, new Color(74, 44, 0)).node.setPosition(0, 280)
    label(box, '选择难度 · 奖励不同', 22, new Color(155, 132, 104)).node.setPosition(0, 230)
    DIFFS.forEach((diff, i) => {
        const row: RewardRow | undefined = meta.getConfig().rewards.get(`${opts.game}|${diff}`)
        if (!row) return
        const y = 150 - i * 118
        const card = node(`d_${diff}`, box, 0, y, PANEL_W - 60, 104)
        roundRect(card, PANEL_W - 60, 104, DIFF_COLOR[diff], 20)
        label(card, diff, 32).node.setPosition(-150, 16)
        label(card, row.spec, 18, new Color(255, 255, 255, 230)).node.setPosition(-150, -22)
        label(card, `🪙 +${row.coins}${row.firstClearCoins ? `(首通+${row.firstClearCoins})` : ''}`, 18)
            .node.setPosition(150, 22)
        const extra = opts.free ? '' : row.pieces > 0 ? `🧩必得${row.pieces}片` : `🧩掉率${row.pieceChance}%`
        label(card, `${row.dice ? `🎲+${row.dice} ` : ''}${extra} · 失败补偿🪙${row.failCoins}`, 15, new Color(255, 255, 255, 220))
            .node.setPosition(150, -20)
        card.on(Node.EventType.TOUCH_END, () => { close(); opts.onPick(diff) })
    })
}

/* ---------- 结算 ---------- */

export interface ResultPayload {
    win: boolean
    game: string; diff: string
    coinsGain: number; firstLit: boolean; doubled: boolean
    piecesGained: number[]; pityUsed: boolean
    free?: boolean
}
export function showResult(root: Node, br: ResultPayload, cb: { onContinue: () => void; onDouble?: () => void; onRetry?: () => void }): void {
    const { box, close } = blocker(root, 620)
    roundRect(box, PANEL_W, 620, new Color(255, 247, 236), 28)
    label(box, br.win ? '🎉 挑战成功！' : '😵 挑战失败', 44, new Color(74, 44, 0)).node.setPosition(0, 210)
    label(box, `${br.game} · ${br.diff}${br.free ? ' · 练习' : ''}`, 22, new Color(155, 132, 104)).node.setPosition(0, 150)
    if (br.win) {
        label(box, `🪙 +${br.coinsGain}`, 40, new Color(255, 138, 61)).node.setPosition(0, 70)
        if (br.piecesGained.length) label(box, `🧩 +${br.piecesGained.length} 片碎片`, 28).node.setPosition(0, 10)
        if (br.firstLit) label(box, '✨ 首通点亮', 20, new Color(255, 185, 55)).node.setPosition(-140, -40)
        if (br.pityUsed) label(box, '🎁 碎片保底', 20, new Color(63, 140, 255)).node.setPosition(0, -40)
        if (br.doubled) label(box, '✖️ 双倍奖励', 20, new Color(160, 92, 255)).node.setPosition(140, -40)
    } else {
        label(box, `安慰奖 🪙 +${br.coinsGain}`, 28, new Color(155, 132, 104)).node.setPosition(0, 60)
    }
    let by = br.win ? -110 : -160
    if (br.win && cb.onDouble && !br.free) {
        const db = node('btn2', box, 0, by, 480, 86)
        roundRect(db, 480, 86, new Color(255, 197, 61), 20)
        label(db, '📺 看广告 · 金币×2', 28, new Color(91, 45, 0)).node.setPosition(0, 0)
        db.on(Node.EventType.TOUCH_END, () => { close(); showAd(root, '本局金币奖励 ×2', cb.onDouble!) })
        by -= 104
    }
    if (!br.win && cb.onRetry) {
        const rb = node('btnr', box, 0, by, 480, 86)
        roundRect(rb, 480, 86, new Color(255, 197, 61), 20)
        label(rb, '📺 看广告 · 原地重试', 28, new Color(91, 45, 0)).node.setPosition(0, 0)
        rb.on(Node.EventType.TOUCH_END, () => { close(); showAd(root, '原地重试本关', cb.onRetry!) })
        by -= 104
    }
    const cont = node('btnc', box, 0, by, 480, 86)
    roundRect(cont, 480, 86, new Color(255, 138, 61), 20)
    label(cont, br.win ? '继续' : '返回棋盘', 30).node.setPosition(0, 0)
    cont.on(Node.EventType.TOUCH_END, () => { close(); cb.onContinue() })
}

/* ---------- 广告占位 ---------- */

export function showAd(root: Node, rewardText: string, onReward: () => void): void {
    const { box, close } = blocker(root, 560)
    roundRect(box, PANEL_W, 560, new Color(255, 247, 236), 28)
    label(box, '激励视频 · 广告位占位', 20, new Color(155, 132, 104)).node.setPosition(0, 230)
    const screen = node('screen', box, 0, 40, 520, 260)
    roundRect(screen, 520, 260, new Color(42, 20, 80), 20)
    label(screen, `▶ ${rewardText}`, 28).node.setPosition(0, 0)
    let left = 3
    const cd = label(box, `3`, 24, new Color(155, 132, 104))
    cd.node.setPosition(0, -110)
    const btn = node('btn', box, 0, -190, 480, 88)
    roundRect(btn, 480, 88, new Color(120, 100, 80, 140), 20)
    const bl = label(btn, '请稍候…', 28)
    const timer = setInterval(() => {
        left--
        if (left > 0) { cd.string = String(left); return }
        clearInterval(timer)
        cd.node.active = false
        roundRect(btn, 480, 88, new Color(255, 138, 61), 20)
        bl.string = '领取奖励 ✓'
        bl.color = new Color(255, 255, 255)
        btn.on(Node.EventType.TOUCH_END, () => { close(); onReward() })
    }, 1000)
}

/* ---------- 事件（M1 精简：转盘为直接抽签） ---------- */

export function wheelDraw(root: Node, onDone: (prize: string, apply: () => void) => void): void {
    const prizes = ['🪙+30', '🎲+1', '🪙+60', '🧩碎片', '✨双倍', '🪙+15']
    const pick = prizes[Math.floor(Math.random() * prizes.length)]
    const { box, close } = blocker(root, 460)
    roundRect(box, PANEL_W, 460, new Color(255, 247, 236), 28)
    label(box, '🎡 幸运事件', 40, new Color(74, 44, 0)).node.setPosition(0, 140)
    label(box, `恭喜获得`, 24, new Color(155, 132, 104)).node.setPosition(0, 50)
    label(box, pick, 64, new Color(255, 138, 61)).node.setPosition(0, -40)
    const btn = node('btn', box, 0, -150, 480, 88)
    roundRect(btn, 480, 88, new Color(255, 138, 61), 20)
    label(btn, '收下', 30).node.setPosition(0, 0)
    btn.on(Node.EventType.TOUCH_END, () => {
        close()
        const apply = (): void => {
            if (pick === '🪙+30') meta.addCoins(30)
            else if (pick === '🪙+60') meta.addCoins(60)
            else if (pick === '🪙+15') meta.addCoins(15)
            else if (pick === '🎲+1') meta.addDice(1)
            else if (pick === '🧩碎片') meta.grantExtraPiece(false)
            else meta.setDoubleNext()
        }
        onDone(pick, apply)
    })
}

/* ---------- 章节过场 ---------- */

export function chapterIntro(root: Node, ch: number, newGames: string[], onGo: () => void): void {
    const { box } = blocker(root, 720)
    roundRect(box, PANEL_W, 720, new Color(255, 247, 236), 28)
    label(box, `${meta.chapterName(ch)}`, 48, new Color(74, 44, 0)).node.setPosition(0, 220)
    if (newGames.length) label(box, `🔓 解锁新玩法：${newGames.join('、')}`, 24, new Color(138, 91, 0)).node.setPosition(0, 120)
    const btn = node('btn', box, 0, -180, 480, 92)
    roundRect(btn, 480, 92, new Color(255, 138, 61), 22)
    label(btn, '开始冒险 →', 32).node.setPosition(0, 0)
    btn.on(Node.EventType.TOUCH_END, () => { meta.markChapterEntered(); box.parent?.destroy(); onGo() })
}

export function gateCeremony(root: Node, ch: number, bonus: number, onDone: () => void): void {
    const { box } = blocker(root, 640)
    roundRect(box, PANEL_W, 640, new Color(255, 247, 236), 28)
    label(box, `🎉 第${ch}章 完成！`, 46, new Color(74, 44, 0)).node.setPosition(0, 200)
    label(box, '拼图之门 · 碎片拼合', 24, new Color(155, 132, 104)).node.setPosition(0, 130)
    label(box, '（拼合动画后续接入美术贴图）', 18, new Color(176, 156, 124)).node.setPosition(0, 80)
    label(box, `章节奖励 🪙 +${bonus}`, 32, new Color(255, 106, 47)).node.setPosition(0, -10)
    const btn = node('btn', box, 0, -170, 480, 92)
    roundRect(btn, 480, 92, new Color(255, 138, 61), 22)
    label(btn, '继续', 32).node.setPosition(0, 0)
    btn.on(Node.EventType.TOUCH_END, () => { box.parent?.destroy(); onDone() })
}

export function endingScreen(root: Node): void {
    const { box } = blocker(root, 560)
    roundRect(box, PANEL_W, 560, new Color(255, 247, 236), 28)
    label(box, '🏆 全部章节通关！', 44, new Color(74, 44, 0)).node.setPosition(0, 160)
    label(box, '更多章节可在 config/ 轨道表中扩展', 22, new Color(155, 132, 104)).node.setPosition(0, 60)
    const btn = node('btn', box, 0, -120, 480, 88)
    roundRect(btn, 480, 88, new Color(255, 138, 61), 20)
    label(btn, '返回', 30).node.setPosition(0, 0)
    btn.on(Node.EventType.TOUCH_END, () => box.parent?.destroy())
}

/* ---------- 设置（M1 精简） ---------- */

export function settingsPanel(root: Node): void {
    const { box } = blocker(root, 560)
    roundRect(box, PANEL_W, 560, new Color(255, 247, 236), 28)
    label(box, '⚙️ 设置', 40, new Color(74, 44, 0)).node.setPosition(0, 210)
    label(box, `进度：第${meta.getSave().chapter}章 · 金币 ${meta.getSave().coins} · 骰子 ${meta.getSave().dice}`, 22).node.setPosition(0, 110)
    label(box, '音效/成就/多语言为后续版本内容', 18, new Color(155, 132, 104)).node.setPosition(0, 40)
    const reset = node('reset', box, 0, -80, 480, 86)
    roundRect(reset, 480, 86, new Color(255, 84, 112), 20)
    const rl = label(reset, '🗑 重置全部进度（双击确认）', 24)
    let armed = false
    reset.on(Node.EventType.TOUCH_END, () => {
        if (!armed) { armed = true; rl.string = '⚠️ 再点一次确认重置'; return }
        resetSave()
        box.parent?.destroy()
        location.reload()
    })
    const close = node('close', box, 0, -200, 480, 70)
    label(close, '返回', 24, new Color(107, 84, 58)).node.setPosition(0, 0)
    close.on(Node.EventType.TOUCH_END, () => box.parent?.destroy())
}

export function fitBox(box: Node, w: number, h: number): void {
    box.getComponent(UITransform)!.setContentSize(w, h)
}
