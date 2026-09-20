/**
 * 静态配置数据：玩法 / 章节 / 皮肤 / 成就 / 挑战 / 棋盘展示数据
 */

export interface GameDef { id: string; name: string; icon: string; grid: number; }
export const GAMES: Record<string, GameDef> = {
    sudoku:  { id: 'sudoku',  name: '数独',     icon: '🔢', grid: 9 },
    mine:    { id: 'mine',    name: '扫雷',     icon: '💣', grid: 9 },
    shikaku: { id: 'shikaku', name: '数方',     icon: '🔲', grid: 10 },
    star:    { id: 'star',    name: '星之战',   icon: '⭐', grid: 7 },
    killer:  { id: 'killer',  name: '杀手数独', icon: '💀', grid: 9 },
};
export const GAME_ORDER = ['sudoku', 'mine', 'shikaku', 'star', 'killer'];

export interface ChapterDef {
    name: string; emoji: string; deco: string[];
    bg: [string, string]; banner: [string, string, string]; sub: string;
}
export const CHAPTERS: ChapterDef[] = [
    { name: '森林秘境', emoji: '🌲', deco: ['🌲', '🍄', '🦊', '🌿'], bg: ['#EAF7D3', '#C6E8A0'], banner: ['#8FDD6F', '#4FA838', '#3C8A28'], sub: '初入谜题森林 · 基础玩法教学' },
    { name: '糖果王国', emoji: '🍭', deco: ['🍭', '🍬', '🧁', '🍩'], bg: ['#FFE9F2', '#FFC9DF'], banner: ['#FFA5C6', '#F2699F', '#D14B82'], sub: '甜蜜的谜题考验' },
    { name: '海底奇缘', emoji: '🐠', deco: ['🐠', '🐙', '🪸', '💧'], bg: ['#D9F3FF', '#A8E0F7'], banner: ['#7CC2F5', '#3D95D8', '#2B7BB8'], sub: '深海中的数字秘密' },
    { name: '失落沙漠', emoji: '🏜️', deco: ['🏜️', '🐍', '⚱️', '☀️'], bg: ['#FFF2D5', '#F5DCA3'], banner: ['#FFD875', '#E8A93C', '#C98D26'], sub: '黄沙之下的古老谜题' },
    { name: '星空之旅', emoji: '🪐', deco: ['🪐', '🚀', '🔭', '☄️'], bg: ['#E9E2FF', '#C4B4F5'], banner: ['#BC94F7', '#8355D8', '#6A3FBF'], sub: '银河尽头的终极谜题' },
    { name: '极地冰原', emoji: '🐧', deco: ['🐧', '❄️', '🐻‍❄️', '🧊'], bg: ['#E4F6FA', '#BEE8F2'], banner: ['#9ADCEC', '#54A8BE', '#3C91A6'], sub: '冰封谜题 · 敬请期待' },
];
export const LEVELS_PER_CH = 12;
/** 第 ci 章（0 起）解锁所需的前序累计星数 */
export const unlockStarsNeeded = (ci: number) => ci * 15;
/** 关卡玩法（按章节+关序轮换） */
export const levelGameOf = (ci: number, li: number) => GAME_ORDER[(ci * 7 + li * 3) % GAME_ORDER.length];

/** 玩法进入上下文（关卡 / 挑战共用） */
export interface GameCtx {
    from: 'level' | 'challenge';
    ci?: number;
    li?: number;
    gid: string;
    challengeKey?: 'daily' | 'weekly' | 'monthly';
}

export interface SkinDef {
    id: string; name: string; desc: string; price: number;
    frame: string; cell: string; cellAlt: string; given: string; user: string; hi: string;
}
export const SKINS: SkinDef[] = [
    { id: 'classic', name: '经典木纹', desc: '温暖的原木棋盘', price: 0, frame: '#8A5A2B', cell: '#F7E7C5', cellAlt: '#EFDAAD', given: '#5B4030', user: '#2F7FC0', hi: '#FFE9A8' },
    { id: 'candy', name: '糖果亮彩', desc: '草莓牛奶配色', price: 300, frame: '#D86A9B', cell: '#FFF0F6', cellAlt: '#FFDEEC', given: '#B0446E', user: '#E060A0', hi: '#FFD3E6' },
    { id: 'ocean', name: '深海蓝调', desc: '沉静的深海之心', price: 450, frame: '#2C5F8A', cell: '#E3F2FB', cellAlt: '#C9E4F5', given: '#1B4965', user: '#2F7FC0', hi: '#BEE3F8' },
    { id: 'neon', name: '暗夜霓虹', desc: '赛博朋克之夜', price: 600, frame: '#1D1D2E', cell: '#26263B', cellAlt: '#2E2E48', given: '#7CF2C8', user: '#FF7FD4', hi: '#3A3A66' },
    { id: 'sakura', name: '樱花物语', desc: '春日限定的浪漫', price: 800, frame: '#C97A9E', cell: '#FFF5F8', cellAlt: '#FFE8EF', given: '#9E4A6E', user: '#D4699E', hi: '#FFDCE8' },
    { id: 'gold', name: '黄金典藏', desc: '尊贵闪耀的荣耀', price: 1000, frame: '#B8860B', cell: '#FFF8E0', cellAlt: '#FBEDBB', given: '#8A6200', user: '#C99200', hi: '#FFE9A0' },
];
export const skinOf = (id: string) => SKINS.find(s => s.id === id) || SKINS[0];

export interface AchvDef { id: string; icon: string; name: string; desc: string; target: number; }
export const ACHV_DEF: AchvDef[] = [
    { id: 'first_win', icon: '🎯', name: '初出茅庐', desc: '完成第 1 个关卡', target: 1 },
    { id: 'ten_win', icon: '🧩', name: '解谜新秀', desc: '累计完成 10 个关卡', target: 10 },
    { id: 'stars_30', icon: '🌟', name: '星光璀璨', desc: '累计获得 30 颗星星', target: 30 },
    { id: 'sudoku_5', icon: '🔢', name: '数独行家', desc: '通过 5 个数独关卡', target: 5 },
    { id: 'mine_3', icon: '💣', name: '扫雷勇者', desc: '通过 3 个扫雷关卡', target: 3 },
    { id: 'ch_daily', icon: '⚡', name: '挑战者', desc: '完成 1 个每日挑战', target: 1 },
    { id: 'collector', icon: '🎁', name: '收藏家', desc: '拥有 2 款棋盘皮肤', target: 2 },
    { id: 'days_7', icon: '🗓️', name: '坚持不懈', desc: '累计游玩 7 天', target: 7 },
];

/** 挑战周期 */
export const CH_PERIODS = [
    { key: 'daily', name: '每日挑战', tag: '今日', icon: '☀️', reward: 80 },
    { key: 'weekly', name: '每周挑战', tag: '本周', icon: '🗓️', reward: 300 },
    { key: 'monthly', name: '每月挑战', tag: '本月', icon: '🌙', reward: 1200 },
] as const;
export type ChKey = 'daily' | 'weekly' | 'monthly';

/** 固定种子随机（保证每关展示数据稳定） */
export function mulberry32(a: number) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/** 数独展示用终盘 */
export const SUDOKU_SOLUTION: number[] = [
    5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4, 2, 5, 6, 7,
    8, 5, 9, 7, 6, 1, 4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8, 5, 6,
    9, 6, 1, 5, 3, 7, 2, 8, 4, 2, 8, 7, 4, 1, 9, 6, 3, 5, 3, 4, 5, 2, 8, 6, 1, 7, 9,
];

/** 星之战 7x7 区域（A-G）与星星位置 */
export const STAR_ZONES = ['AABBBCC', 'AADBBCC', 'ADDEBBF', 'GDDEEFF', 'GGGEFFF', 'GGHHIIF', 'HHHIIIF'];
export const STAR_POS = [2, 10, 16, 23, 29, 38, 45];

/** 数方 10x10 提示数字 (r,c)->n */
export const SHIKAKU_CLUES: Record<string, number> = {
    '0,1': 6, '0,7': 4, '1,4': 2, '2,2': 8, '2,8': 3, '3,6': 5, '4,0': 4, '4,9': 6,
    '5,3': 2, '6,5': 6, '7,1': 3, '7,8': 8, '8,4': 4, '9,6': 2,
};
/** 数方已划分矩形 [row, col, h, w] */
export const SHIKAKU_RECTS: number[][] = [
    [0, 0, 2, 3], [0, 3, 1, 2], [1, 5, 2, 2], [0, 7, 2, 2], [2, 0, 2, 2], [3, 2, 3, 2],
    [4, 4, 2, 4], [3, 8, 1, 2], [5, 0, 2, 2], [6, 2, 2, 1], [4, 8, 2, 2], [6, 5, 1, 3],
    [7, 0, 2, 2], [6, 9, 3, 1], [7, 2, 3, 2], [7, 7, 3, 3], [5, 2, 1, 3], [9, 0, 1, 4], [9, 4, 1, 2],
];
