/* 换肤棋盘视图：背景板 + 格子贴片 + 棋子 + 图内数值位/热区（按玩法数据驱动） */
import { Node, Color, Sprite, UITransform, Vec3, tween, Label, Prefab, instantiate, resources } from 'cc'
import * as meta from '../core/Meta'
import type { TrackNode } from '../core/Config'
import { ART_BOARDS, type ArtBoard } from '../core/BoardArt'
import { HudBox } from './HudBox'
import { node, roundRect, label, loadSF, sprite, sleep, clearG } from './UiKit'

export const GAME_EMOJI: Record<string, string> = { '数独': '🔢', '扫雷': '💣', '数方': '🟩', '星之战': '⭐', '杀手数独': '🎯' }
const TYPE_ICON: Record<string, string> = { '起点格': '🏁', '金币格': '💰', '骰子格': '🎲', '事件格': '❓' }

const S = 720 / 864           // 设计稿→设计分辨率缩放（864×1536 → 720×1280）
const cx = (xPx: number): number => -360 + xPx * S
const cy = (yPx: number): number => 640 - yPx * S

export interface BoardDeps {
    onDice: () => void
    onHotspot: (action: string) => void
    toast: (msg: string) => void
}

let layer: Node | null = null
let token: Node | null = null
let valueEls: { bind: string; lbl: Label }[] = []
let hudBoxes: { bind: string; box: HudBox }[] = []

function tileIcon(nd: TrackNode): string {
    if (nd.type === '玩法格' && nd.game) return GAME_EMOJI[nd.game] ?? '🎮'
    return TYPE_ICON[nd.type] ?? '🎮'
}

export async function build(parent: Node, deps: BoardDeps): Promise<void> {
    const art: ArtBoard = ART_BOARDS[meta.getSave().chapter]
    layer = node('BoardRoot', parent)

    // 背景板
    await sprite(layer, art.bg, 720, 1280)

    // 底部装饰带（覆盖自动修补痕迹，同时作为按钮区的视觉底座）
    const footer = node('footer', layer, 0, cy(1454), 720, 200)
    roundRect(footer, 720, 210, new Color(64, 38, 14, 215), 0)

    // 轨道贴点（贴片 + 类型图标 + 状态圈）
    const tileLayer = node('tiles', layer)
    const nodes = meta.trackNodes()
    for (let k = 0; k < nodes.length; k++) {
        const nd = nodes[k]
        const t0 = art.tiles[k]
        if (!t0) break
        const w = t0.w * S, h = t0.h * S
        const t = node(`tile_${nd.idx}`, tileLayer, cx(t0.x), cy(t0.y), w, h)
        t['idx'] = nd.idx
        const sp = t.addComponent(Sprite)
        sp.sizeMode = Sprite.SizeMode.CUSTOM
        try { sp.spriteFrame = await loadSF(t0.sprite) } catch (e) { console.warn('slot 加载失败', e) }
        const ic = label(t, tileIcon(nd), Math.max(12, Math.round(h * 0.5)), new Color(255, 255, 255, 235))
        ic.node.setPosition(0, 0)
        const litFx = node('litFx', t, 0, 0, w, h)
        litFx.active = false
        const curFx = node('curFx', t, 0, 0, w, h)
        curFx.active = false
    }

    // 棋子
    token = node('token', layer, cx(122), cy(392), 66 * S, 66 * S)
    roundRect(token, 66 * S, 66 * S, new Color(255, 185, 55, 255), 33 * S)
    const face = label(token, '😀', Math.round(38 * S))
    face.node.setPosition(0, 0)
    positionToken(false)

    // 数值面板：金币框 = 编辑器 CoinBox 预制体（混合模式）；骰子/碎片 = 代码绘制（Session 2 再预制体化）
    valueEls = []
    hudBoxes = []
    const coinText = art.texts.find(t => t.bind === 'coins')
    if (coinText) {
        parent.getChildByName('CoinBox')?.destroy()
        let coinNode: Node | null = null
        try {
            const pref = await new Promise<Prefab | null>(res => resources.load('prefabs/CoinBox', Prefab, (e, p) => res(e || !p ? null : p)))
            if (pref) coinNode = instantiate(pref)
        } catch { /* 预制体缺失走兜底 */ }
        if (coinNode) {
            parent.addChild(coinNode)
            coinNode.setPosition(cx(coinText.rect.x + coinText.rect.w / 2), cy(coinText.rect.y + coinText.rect.h / 2), 0)
            const hb = coinNode.getComponentInChildren(HudBox)
            if (hb) {
                // 自愈：预制体未拖 Value Label 时自动补
                if (!hb.valueLabel) hb.valueLabel = coinNode.getComponentInChildren(Label)
                hudBoxes.push({ bind: 'coins', box: hb })
            }
        }
    }
    for (const t of art.texts) {
        if (t.bind === 'coins') continue
        const w = t.rect.w * S, h = t.rect.h * S
        const p = node('val_' + t.bind, layer, cx(t.rect.x + t.rect.w / 2), cy(t.rect.y + t.rect.h / 2), w, h)
        roundRect(p, w, h, new Color().fromHEX(t.patch), 16 * S)
        roundRect(p, w, h, new Color(255, 235, 200, 150), 16 * S, false, 2.5 * S)
        if (t.bind === 'dice') {
            const ic = await sprite(p, art.icons.dice, 34 * S, 34 * S)
            ic.setPosition(-w / 2 + 22 * S, 0)
        }
        const l = label(p, '', Math.round(h * S * 0.55))
        l.node.setPosition(t.prefix ? 6 * S : w * 0.1, 0)
        valueEls.push({ bind: t.bind, lbl: l })
    }

    // 章节信息条（左下，不透明——盖住背景板修补痕迹）
    const chip = node('chapterChip', layer, cx(160), cy(1445), 250 * S, 92 * S)
    roundRect(chip, 250 * S, 92 * S, new Color(60, 35, 10, 255), 20 * S)
    label(chip, meta.chapterName(), Math.round(32 * S)).node.setPosition(0, 0)

    // 骰子按钮（图上裁切的基座贴片 = 真实按钮）
    const diceHot = node('diceHot', layer, cx(art.dice.x + art.dice.w / 2), cy(art.dice.y + art.dice.h / 2), art.dice.w * S, art.dice.h * S)
    try {
        const diceSp = diceHot.addComponent(Sprite)
        diceSp.sizeMode = Sprite.SizeMode.CUSTOM
        diceSp.spriteFrame = await loadSF('textures/board/btn-dice/spriteFrame')
    } catch (e) { console.warn('骰子贴片加载失败', e) }
    diceHot.on(Node.EventType.TOUCH_START, () => { diceHot.setScale(0.94, 0.94, 1) })
    diceHot.on(Node.EventType.TOUCH_END, () => { diceHot.setScale(1, 1, 1); deps.onDice() })
    diceHot.on(Node.EventType.TOUCH_CANCEL, () => diceHot.setScale(1, 1, 1))

    // 功能按钮（图上按钮位，真控件：面板 + 图标 + 文字）
    const HOT_UI: Record<string, { icon: string; text: string }> = {
        free: { icon: '🛠', text: '练习' },
        gallery: { icon: '🖼', text: '拼图馆' },
        settings: { icon: '⚙', text: '设置' },
    }
    for (const h of art.hotspots) {
        const w = h.rect.w * S, h2 = h.rect.h * S
        const b = node('hot_' + h.action + h.rect.y, layer, cx(h.rect.x + h.rect.w / 2), cy(h.rect.y + h.rect.h / 2), w, h2)
        roundRect(b, w, h2, new Color(60, 35, 10, 165), 16 * S)
        const ui = HOT_UI[h.action]
        const small = h.rect.y < 150
        const ic = label(b, ui.icon, Math.round((small ? h2 * 0.6 : h2 * 0.42)))
        ic.node.setPosition(0, small ? 0 : h2 * 0.14)
        if (!small) {
            const tx = label(b, ui.text, Math.round(h2 * 0.2), new Color(255, 247, 236))
            tx.node.setPosition(0, -h2 * 0.28)
        }
        b.on(Node.EventType.TOUCH_END, () => deps.onHotspot(h.action))
    }

    refreshStates()
    syncValues()
}

export function refreshStates(): void {
    const tiles = layer?.getChildByName('tiles')
    if (!tiles) return
    const save = meta.getSave()
    tiles.children.forEach(t => {
        const idx = Number(t['idx'])
        const lit = !!save.lit[`${save.chapter}:${idx}`]
        const cur = save.pos === idx
        const litFx = t.getChildByName('litFx')
        const curFx = t.getChildByName('curFx')
        const ut = t.getComponent(UITransform)!
        if (litFx) {
            litFx.active = lit
            if (lit) {
                roundRect(litFx, ut.width, ut.height, new Color(105, 220, 130, 110), 14 * S)
                roundRect(litFx, ut.width, ut.height, new Color(60, 180, 90, 230), 14 * S, false, 4 * S)
                let ok = litFx.getChildByName('ok')
                if (!ok) ok = label(litFx, '✓', Math.round(26 * S), new Color(70, 255, 133)).node
                ok.setPosition(ut.width / 2 - 8 * S, ut.height / 2 - 8 * S)
            } else { litFx.removeAllChildren(); clearG(litFx) }
        }
        if (curFx) {
            curFx.active = cur
            if (cur) roundRect(curFx, ut.width + 8 * S, ut.height + 8 * S, new Color(255, 185, 55, 230), 16 * S, false, 5 * S)
            else clearG(curFx)
        }
    })
}

export function syncValues(): void {
    const save = meta.getSave()
    const textOf = (bind: string): string => {
        if (bind === 'coins') return String(save.coins)
        if (bind === 'dice') return String(save.dice)
        if (bind === 'pieces') return save.finished ? '' : `🧩 ${meta.piecesOf(meta.gateFor().picId).length}/${meta.gateFor().need}`
        return ''
    }
    for (const v of valueEls) v.lbl.string = textOf(v.bind)
    for (const h of hudBoxes) h.box.sync(textOf(h.bind))
}

function tileNode(idx: number): Node | null {
    return layer?.getChildByName('tiles')?.getChildByName(`tile_${idx}`) ?? null
}

export function positionToken(animate: boolean): void {
    if (!token) return
    const t = tileNode(meta.getSave().pos)
    if (!t) return
    const p = t.position
    if (!animate) token.setPosition(p.x, p.y, 0)
    else tween(token).to(0.15, { position: new Vec3(p.x, p.y, 0) }).start()}

export async function animatePath(res: meta.MoveResult, toast: (m: string) => void): Promise<void> {
    let supplies = res.supplies
    for (const pos of res.path) {
        meta.getSave().pos = pos
        positionToken(true)
        refreshStates()
        if (pos === 1 && supplies > 0) {
            supplies--
            toast('🏁 补给 +🪙')
        }
        await sleep(180)
        if (res.bounces.indexOf(pos) !== -1) {
            toast('🧩 拼图未集齐 · 回走！')
            await sleep(240)
        }
    }
}

/** 掷骰动效：骰子基座晃动 */
export async function diceShake(): Promise<void> {
    const diceHot = layer?.getChildByName('diceHot')
    if (!diceHot) { await sleep(400); return }
    await new Promise<void>(res => {
        tween(diceHot)
            .to(0.12, { angle: -6 }).to(0.12, { angle: 6 })
            .to(0.12, { angle: -4 }).to(0.12, { angle: 0 })
            .call(() => { res() }).start()
    })
}
