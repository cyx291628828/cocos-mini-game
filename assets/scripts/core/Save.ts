import { sys } from 'cc';
import { CHAPTERS, LEVELS_PER_CH, levelGameOf, ChKey } from './Data';

/** 挑战记录 */
export interface ChRec { done: boolean; best: string | null; }
export interface SaveData {
    coins: number;
    skin: string;
    owned: string[];
    progress: Record<string, number>;   // "ci-li" -> stars
    curChapter: number;
    achvUnlocked: string[];
    challenge: Record<string, Record<ChKey, ChRec>>;
    playDays: number;
}

const KEY = 'puzzlestar_v1';

const DEFAULT: SaveData = {
    coins: 500,
    skin: 'classic',
    owned: ['classic'],
    progress: {},
    curChapter: 0,
    achvUnlocked: [],
    challenge: {},
    playDays: 1,
};

export const SAVE = {
    data: null as unknown as SaveData,

    load() {
        try {
            const raw = sys.localStorage.getItem(KEY);
            this.data = raw ? { ...DEFAULT, ...JSON.parse(raw) } : JSON.parse(JSON.stringify(DEFAULT));
        } catch (e) {
            this.data = JSON.parse(JSON.stringify(DEFAULT));
        }
    },
    save() {
        try { sys.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 平台存储异常忽略 */ }
    },
    reset() {
        try { sys.localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
        this.data = JSON.parse(JSON.stringify(DEFAULT));
    },

    totalStars(): number {
        return (Object.values(this.data.progress) as number[]).reduce((a, b) => a + b, 0);
    },
    chStars(ci: number): number {
        let n = 0;
        for (let i = 0; i < LEVELS_PER_CH; i++) n += (this.data.progress[ci + '-' + i] || 0);
        return n;
    },
    chUnlocked(ci: number): boolean {
        return ci === 0 || this.totalStars() >= ci * 15;
    },
    /** 章节内第一个未通关的关序号 */
    firstUnfinished(ci: number): number {
        for (let i = 0; i < LEVELS_PER_CH; i++) if (!((ci + '-' + i) in this.data.progress)) return i;
        return LEVELS_PER_CH - 1;
    },
    levelClearCount(): number { return Object.keys(this.data.progress).length; },
    gameClearCount(gid: string): number {
        let n = 0;
        for (let ci = 0; ci < CHAPTERS.length; ci++)
            for (let li = 0; li < LEVELS_PER_CH; li++)
                if (levelGameOf(ci, li) === gid && (ci + '-' + li) in this.data.progress) n++;
        return n;
    },
    chRec(gid: string, key: ChKey): ChRec {
        const d = this.data;
        if (!d.challenge[gid]) d.challenge[gid] = { daily: { done: false, best: null }, weekly: { done: false, best: null }, monthly: { done: false, best: null } };
        return d.challenge[gid][key];
    },
    achvProgress(id: string): number {
        const d = this.data;
        switch (id) {
            case 'first_win': return Math.min(1, this.levelClearCount());
            case 'ten_win': return Math.min(10, this.levelClearCount());
            case 'stars_30': return Math.min(30, this.totalStars());
            case 'sudoku_5': return Math.min(5, this.gameClearCount('sudoku'));
            case 'mine_3': return Math.min(3, this.gameClearCount('mine'));
            case 'ch_daily': return (Object.values(d.challenge) as Array<Record<ChKey, ChRec>>).some(r => r.daily.done) ? 1 : 0;
            case 'collector': return Math.min(2, d.owned.length);
            case 'days_7': return Math.min(7, d.playDays || 1);
        }
        return 0;
    },
};

/** 金币变化事件（监听器绑定节点，节点销毁后自动失效） */
export type CoinsListener = (coins: number) => void;
const coinListeners: Array<{ node: any; fn: CoinsListener }> = [];
export function onCoins(node: any, fn: CoinsListener) {
    coinListeners.push({ node, fn });
}
export function addCoins(n: number) {
    SAVE.data.coins += n;
    SAVE.save();
    for (let i = coinListeners.length - 1; i >= 0; i--) {
        const l = coinListeners[i];
        if (l.node && !l.node.isValid) { coinListeners.splice(i, 1); continue; }
        l.fn(SAVE.data.coins);
    }
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const fmtTime = (s: number) => pad2(Math.floor(s / 60)) + ':' + pad2(Math.floor(s % 60));

/** 倒计时：距下一个零点 hh:mm:ss */
export function countdownToMidnight(): string {
    const now = new Date();
    const end = new Date(now); end.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
    return pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60);
}
/** 距本周结束 */
export function countdownToWeekEnd(): string {
    const now = new Date();
    const day = (7 - now.getDay()) % 7 || 7;
    const end = new Date(now); end.setDate(now.getDate() + day); end.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
    return pad2(Math.floor(s / 86400)) + '天 ' + pad2(Math.floor(s / 3600) % 24) + ':' + pad2(Math.floor(s / 60) % 60);
}
/** 距月末 */
export function countdownToMonthEnd(): string {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
    return pad2(Math.floor(s / 86400)) + '天 ' + pad2(Math.floor(s / 3600) % 24) + '小时';
}

/** 全局定时器管理（界面切换时统一清理） */
const timers: number[] = [];
export function setTimer(cb: () => void, ms: number, loop = false): number {
    const id = loop ? setInterval(cb, ms) : setTimeout(cb, ms) as unknown as number;
    timers.push(id as unknown as number);
    return id as unknown as number;
}
export function clearTimers() {
    timers.forEach(id => { clearInterval(id); clearTimeout(id); });
    timers.length = 0;
}
