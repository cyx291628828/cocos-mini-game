/* 存档：sys.localStorage，带默认值合并 */
import { sys } from 'cc'

export interface SaveData {
    v: number
    chapter: number
    pos: number
    dir: 1 | -1
    locked: boolean
    lit: Record<string, 1>
    pieces: Record<string, number[]>
    picsDone: string[]
    coins: number
    dice: number
    pity: number
    stats: { wins: number; fails: number; expertWins: number; hints: number; rolls: number }
    daily: { day: string; diceAds: number; pieceAds: number }
    settings: { sound: boolean; reduceMotion: boolean }
    chapterEntered: boolean
    finished: boolean
}

const KEY = 'puzzleMonopoly.v1'

export function defaultSave(): SaveData {
    return {
        v: 1,
        chapter: 1, pos: 1, dir: 1, locked: true,
        lit: {}, pieces: {}, picsDone: [],
        coins: 50, dice: 5,
        pity: 0,
        stats: { wins: 0, fails: 0, expertWins: 0, hints: 0, rolls: 0 },
        daily: { day: '', diceAds: 0, pieceAds: 0 },
        settings: { sound: true, reduceMotion: false },
        chapterEntered: false,
        finished: false,
    }
}

export function loadSave(): SaveData {
    try {
        const raw = sys.localStorage.getItem(KEY)
        if (!raw) return defaultSave()
        const data = JSON.parse(raw) as Partial<SaveData>
        const base = defaultSave()
        return {
            ...base, ...data,
            stats: { ...base.stats, ...(data.stats ?? {}) },
            daily: { ...base.daily, ...(data.daily ?? {}) },
            settings: { ...base.settings, ...(data.settings ?? {}) },
        }
    } catch {
        return defaultSave()
    }
}

export function persist(save: SaveData): void {
    try { sys.localStorage.setItem(KEY, JSON.stringify(save)) } catch { /* 存储满忽略 */ }
}

export function resetSave(): SaveData {
    sys.localStorage.removeItem(KEY)
    return defaultSave()
}
