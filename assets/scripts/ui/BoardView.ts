/* 换肤棋盘视图：背景板 + 格子贴片 + 棋子 + 图内数值位/热区（按玩法数据驱动） */
import { Node, Color, Sprite, UITransform, Vec3, tween, Label } from 'cc'
import * as meta from '../core/Meta'
import type { TrackNode } from '../core/Config'
import { ART_BOARDS, type ArtBoard } from '../core/BoardArt'
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

function tileIcon(nd: TrackNode): string {
    if (nd.type === '玩法格' && nd.game) return GAME_EMOJI[nd.game] ?? '🎮'
    return TYPE_ICON[nd.type] ?? '🎮'
}

export async function build(parent: Node, deps: BoardDeps): Promise<void> {
    const art: ArtBoard = ART_BOARDS[meta.getSave().chapter]
    layer = node('BoardRoot', parent)

    // 背景板
    await sprite(layer, art.bg, 720, 1280)

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

    // 数值位（补丁 + 动态文本）
    valueEls = []
    for (const t of art.texts) {
        const p = node('val_' + t.bind, layer, cx(t.rect.x + t.rect.w / 2), cy(t.rect.y + t.rect.h / 2), t.rect.w * S, t.rect.h * S)
        roundRect(p, t.rect.w * S, t.rect.h * S, new Color().fromHEX(t.patch), 12 * S)
        const l = label(p, '', Math.round(t.rect.h * S * 0.62))
        valueEls.push({ bind: t.bind, lbl: l })
    }

    // 骰子按钮热区（图上的投掷基座）
    const diceHot = node('diceHot', layer, cx(art.dice.x + art.dice.w / 2), cy(art.dice.y + art.dice.h / 2), art.dice.w * S, art.dice.h * S)
    diceHot.on(Node.EventType.TOUCH_END, () => deps.onDice())

    // 功能热区
    for (const h of art.hotspots) {
        const b = node('hot_' + h.action, layer, cx(h.rect.x + h.rect.w / 2), cy(h.rect.y + h.rect.h / 2), h.rect.w * S, h.rect.h * S)
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
    for (const v of valueEls) {
        if (v.bind === 'coins') v.lbl.string = String(save.coins)
        else if (v.bind === 'dice') v.lbl.string = String(save.dice)
        else if (v.bind === 'pieces') {
            const g = meta.gateFor()
            v.lbl.string = save.finished ? '' : `🧩 ${meta.piecesOf(g.picId).length}/${g.need}`
        }
    }
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
