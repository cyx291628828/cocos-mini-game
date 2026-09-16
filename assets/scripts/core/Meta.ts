/* MetaEngine：章节状态机、移动与边界反弹、难度奖励结算、碎片账本与保底（自 Web 版移植） */
import type { GameConfig, RewardRow, TrackNode } from './Config'
import { loadSave, persist, type SaveData } from './Save'

let cfg!: GameConfig
let save!: SaveData

export function initMeta(config: GameConfig, s: SaveData): void { cfg = config; save = s }
export function getSave(): SaveData { return save }
export function getConfig(): GameConfig { return cfg }

const P = (k: string, d: number): number => cfg.params[k] ?? d
export const PIECE_TO_COINS = 20

export function chapterCount(): number { return P('首发章节数', 3) }
export function trackNodes(ch = save.chapter): TrackNode[] { return cfg.tracks.get(ch) ?? [] }
export function trackLength(ch = save.chapter): number { return trackNodes(ch).length }
export function todayStr(): string { return new Date().toISOString().slice(0, 10) }

const CH_NAMES = ['椰风岛', '雪松岭', '星海号']
export function chapterName(ch = save.chapter): string {
    const base = CH_NAMES[(ch - 1) % CH_NAMES.length]
    const suffix = ch > CH_NAMES.length ? `·${Math.ceil(ch / CH_NAMES.length)}` : ''
    return `第${ch}章 ${base}${suffix}`
}

export function gateFor(ch = save.chapter): { picId: string; need: number } {
    const target = ch + 1
    return { picId: `pic${target}`, need: P(`章节${target}拼图片数`, [9, 12, 16][ch - 1] ?? 9) }
}
export function piecesOf(picId: string): number[] { return save.pieces[picId] ?? [] }
export function gateComplete(ch = save.chapter): boolean {
    const g = gateFor(ch)
    return piecesOf(g.picId).length >= g.need
}
export function unlockedGames(ch = save.chapter): string[] {
    const list = ['数独', '扫雷']
    if (ch >= 2) list.push('数方')
    if (ch >= 3) list.push('星之战')
    if (ch >= 4 || save.finished) list.push('杀手数独')
    return list
}

/* ---------- 移动与边界 ---------- */

export interface MoveResult { path: number[]; bounces: number[]; crossedEnd: boolean; supplies: number }

function step(n: number): MoveResult {
    const N = trackLength()
    const res: MoveResult = { path: [], bounces: [], crossedEnd: false, supplies: 0 }
    const twoEnds = P('锁定态两端反弹', 1) === 1
    let pos = save.pos
    let dir = save.dir
    for (let s = 0; s < n; s++) {
        let next = pos + dir
        if (next > N) {
            if (save.locked) {
                dir = dir === 1 ? -1 : 1
                if (res.bounces.indexOf(pos) === -1) res.bounces.push(pos)
                next = pos + dir
            } else { res.crossedEnd = true; break }
        } else if (next < 1) {
            if (!twoEnds) break
            dir = 1
            if (res.bounces.indexOf(pos) === -1) res.bounces.push(pos)
            next = pos + dir
        }
        pos = next
        res.path.push(pos)
        if (pos === 1 && (res.path.length > 1 || save.pos !== 1)) {
            save.coins += P('起点经过补给', 10)
            res.supplies++
        }
    }
    save.pos = pos
    save.dir = dir as 1 | -1
    return res
}

export function roll(n: number): MoveResult { save.stats.rolls++; return step(n) }
export function teleport(delta: number): MoveResult {
    const prev = save.dir
    if (delta < 0) save.dir = -1
    else if (delta > 0) save.dir = 1
    const res = step(Math.abs(delta))
    save.dir = prev
    return res
}

/* ---------- 结算 ---------- */

let doubleNext = false
export function setDoubleNext(): void { doubleNext = true }
export function consumeDoubleFlag(): boolean { const v = doubleNext; doubleNext = false; return v }
function consumeDouble(): boolean { const v = doubleNext; doubleNext = false; return v }

export interface SettleResult {
    win: true
    game: string; diff: string
    coinsGain: number; firstLit: boolean; doubled: boolean
    piecesGained: number[]; convCoins: number; pityUsed: boolean
    diceGain: number
    gateOpened: boolean; gateWasOpen: boolean
}

function rewardRow(game: string, diff: string): RewardRow {
    return cfg.rewards.get(`${game}|${diff}`) ?? {
        game, diff, spec: '', coins: 20, pieces: 0, pieceChance: 0, dice: 0, firstClearCoins: 0, failCoins: 5,
    }
}

function missingPieces(ch = save.chapter): number[] {
    const gate = gateFor(ch)
    const have = piecesOf(gate.picId)
    return Array.from({ length: gate.need }, (_, i) => i).filter(i => have.indexOf(i) === -1)
}

function takeMissingPiece(missing: number[], gained: number[]): number {
    if (!missing.length) return -1
    const k = Math.floor(Math.random() * missing.length)
    const idx = missing[k]
    missing.splice(k, 1)
    gained.push(idx)
    return idx
}

export function settleWin(game: string, diff: string, free: boolean): SettleResult {
    const row = rewardRow(game, diff)
    const firstLit = !free && !save.lit[`${save.chapter}:${save.pos}`]
    let base = row.coins + (firstLit ? row.firstClearCoins : 0)
    const doubled = consumeDouble()
    if (doubled) base *= 2
    save.coins += base

    const piecesGained: number[] = []
    let convCoins = 0
    let pityUsed = false
    if (!free) {
        const missing = missingPieces()
        const addPiece = (): void => {
            if (takeMissingPiece(missing, piecesGained) === -1) convCoins += PIECE_TO_COINS
        }
        for (let i = 0; i < row.pieces; i++) addPiece()
        if (row.pieceChance > 0 && Math.random() * 100 < row.pieceChance) addPiece()
        if (firstLit) addPiece()
        if (piecesGained.length === 0) {
            save.pity++
            if (save.pity >= P('碎片保底阈值', 3)) { addPiece(); pityUsed = true; save.pity = 0 }
        } else save.pity = 0
        const gate = gateFor()
        save.pieces[gate.picId] = [...piecesOf(gate.picId), ...piecesGained]
    }
    save.coins += convCoins
    const diceGain = row.dice
    save.dice += diceGain
    save.stats.wins++
    if (diff === '专家') save.stats.expertWins++
    if (firstLit) save.lit[`${save.chapter}:${save.pos}`] = 1

    const gateWasOpen = !save.locked
    const gateOpened = !free && !gateWasOpen && gateComplete()
    if (gateOpened) save.locked = false
    persist(save)
    return { win: true, game, diff, coinsGain: base, firstLit, doubled, piecesGained, convCoins, pityUsed, diceGain, gateOpened, gateWasOpen }
}

export function settleFail(game: string, diff: string): number {
    const c = rewardRow(game, diff).failCoins
    save.coins += c
    save.stats.fails++
    persist(save)
    return c
}

export function addCoins(n: number): void { save.coins += n; persist(save) }
export function addDice(n: number): void { save.dice += n; persist(save) }

/* ---------- 章节 ---------- */

export function enterNextChapter(): { finished: boolean } {
    if (save.chapter >= chapterCount()) { save.finished = true; persist(save); return { finished: true } }
    save.chapter++
    save.pos = 1
    save.dir = 1
    save.locked = true
    save.chapterEntered = false
    persist(save)
    return { finished: false }
}
export function markChapterEntered(): void { save.chapterEntered = true; persist(save) }

/* ---------- 每日与广告增益 ---------- */

export function dailyCheck(): number {
    const today = todayStr()
    if (save.daily.day === today) return 0
    save.daily = { day: today, diceAds: 0, pieceAds: 0 }
    const g = P('每日免费骰子', 5)
    save.dice += g
    persist(save)
    return g
}
export function canDiceAd(): boolean { return save.daily.diceAds < P('视频补骰子每日上限', 5) }
export function grantDiceAd(): void {
    save.dice += P('视频补骰子数量', 3)
    save.daily.diceAds++
    persist(save)
}
export function canPieceAd(): boolean { return save.daily.pieceAds < P('碎片视频加速每日次数', 2) }

export function grantExtraPiece(countDaily: boolean): number {
    const gate = gateFor()
    const gained: number[] = []
    const got = takeMissingPiece(missingPieces(), gained)
    if (got === -1) return -1
    save.pieces[gate.picId] = [...piecesOf(gate.picId), ...gained]
    if (countDaily) save.daily.pieceAds++
    if (gateComplete()) save.locked = false
    persist(save)
    return got
}
