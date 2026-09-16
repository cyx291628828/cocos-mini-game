/* 配置加载：读取 resources/configs 下的 CSV（由 sync-config 脚本从需求仓库 config/ 同步） */
import { TextAsset, resources } from 'cc'

export interface RewardRow {
    game: string; diff: string; spec: string
    coins: number; pieces: number; pieceChance: number; dice: number
    firstClearCoins: number; failCoins: number
}
export interface TrackNode { idx: number; type: string; game: string; param: string }
export interface GameConfig {
    params: Record<string, number>
    rewards: Map<string, RewardRow>
    tracks: Map<number, TrackNode[]>
}

export const DIFFS = ['简单', '中等', '困难', '专家']
export const GAMES = ['数独', '扫雷', '数方', '星之战', '杀手数独']

function loadText(name: string): Promise<string> {
    return new Promise((resolve, reject) => {
        resources.load(`configs/${name}`, TextAsset, (err, asset) => {
            if (err || !asset) reject(err ?? new Error('load fail ' + name))
            else resolve((asset as TextAsset).text)
        })
    })
}

function parseCSV(text: string): string[][] {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    return text.split(/\r?\n/).map(l => l.split(',').map(s => s.trim())).filter(r => r.some(c => c !== ''))
}

function toObjects(rows: string[][]): Record<string, string>[] {
    const head = rows[0]
    return rows.slice(1).map(r => {
        const o: Record<string, string> = {}
        head.forEach((h, i) => { o[h] = r[i] ?? '' })
        return o
    })
}

const num = (s: string | undefined, d = 0): number => {
    const v = parseInt((s ?? '').replace(/[^0-9-]/g, ''), 10)
    return Number.isFinite(v) ? v : d
}

export async function loadConfig(): Promise<GameConfig> {
    const params: Record<string, number> = {}
    const pRows = parseCSV(await loadText('params'))
    for (const o of toObjects(pRows)) params[o['参数名']] = num(o['值'])

    const rewards = new Map<string, RewardRow>()
    const rRows = parseCSV(await loadText('rewards'))
    for (const o of toObjects(rRows)) {
        const row: RewardRow = {
            game: o['玩法类型'], diff: o['难度'], spec: o['规格说明'],
            coins: num(o['金币']), pieces: num(o['拼图碎片必得']),
            pieceChance: num(o['额外碎片掉率%']), dice: num(o['骰子']),
            firstClearCoins: num(o['首通加成金币']), failCoins: num(o['失败安慰金币']),
        }
        rewards.set(`${row.game}|${row.diff}`, row)
    }

    const tracks = new Map<number, TrackNode[]>()
    for (let ch = 1; ch <= 20; ch++) {
        try {
            const rows = parseCSV(await loadText(`track${ch}`))
            const nodes: TrackNode[] = toObjects(rows).map(o => ({
                idx: num(o['节点序号']), type: o['格子类型'], game: o['玩法类型'] ?? '', param: o['参数/事件'] ?? '',
            })).filter(n => n.idx > 0).sort((a, b) => a.idx - b.idx)
            tracks.set(ch, nodes)
        } catch { break }
    }

    return { params, rewards, tracks }
}
