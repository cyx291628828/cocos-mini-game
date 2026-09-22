import { resources, JsonAsset } from 'cc';
import { GAME_ORDER } from './Data';

/** 数独表行（assets/resources/config/sudoku.json）
 *  扣星为阶梯数组：累计达到数组中每个阈值各扣 1 颗星（最多扣 3 颗，扣光即失败）。
 *  例：timeCostStar=[60,100,200] → 60s 扣 1 星、100s 扣第 2 星、200s 扣第 3 星；
*      errorCostStar=[1,3,6] → 错 1 次扣 1 星、第 3 次错扣第 2 星、第 6 次错扣第 3 星。 */
export interface SudokuCfg {
    id: string;             // 唯一 id，如 su_9_normal
    type: number;           // 数独类型：4 / 6 / 9（宫格规格）
    difficulty: string;     // 难度：简单 / 普通 / 困难
    timeCostStar: number[]; // 超时扣星阶梯（秒）：用时达到各值依次扣 1 星
    errorCostStar: number[];// 错误扣星阶梯（次）：累计错误达到各值依次扣 1 星
    holes: number;          // 挖空数量（出题空格数）
    rewardCoins: number;    // 通关金币奖励
    lives: number;          // 血量：填错一次扣一颗 ❤️，扣完直接失败结算
    keyHint: boolean;       // 键盘辅助：选中格时是否置灰同行/列/宫已有的数字（true=辅助开启）
}

/** 扫雷表行（assets/resources/config/mine.json）
 *  踩雷立即失败结算，故无错误扣星字段；星级仅由超时阶梯决定。 */
export interface MineCfg {
    id: string;             // 唯一 id，如 mine_hard
    board: number;          // 棋盘边长：board × board 格
    mines: number;          // 雷数
    difficulty: string;     // 难度：简单 / 普通 / 困难
    timeCostStar: number[]; // 超时扣星阶梯（秒）
    rewardCoins: number;    // 通关金币奖励
}

/** 星之战表行（assets/resources/config/star.json）
 *  每行/每列/每个区域恰好放 stars 颗星，星不能相邻（含对角线）；无失败路径，星级仅由超时阶梯决定。 */
export interface StarCfg {
    id: string;             // 唯一 id，如 star_hard
    board: number;          // 棋盘边长：board × board 格（= 区域数）
    stars: number;          // 每行/列/区域的星数（1~3）
    difficulty: string;     // 难度：简单 / 普通 / 困难
    timeCostStar: number[]; // 超时扣星阶梯（秒）
    rewardCoins: number;    // 通关金币奖励
}

/** 数方表行（assets/resources/config/shikaku.json）
 *  玩家画矩形覆盖全盘，每矩形恰含一个数字且面积=数字；无失败路径，星级仅由超时阶梯决定。 */
export interface ShikakuCfg {
    id: string;             // 唯一 id，如 shikaku_hard
    board: number;          // 棋盘边长：board × board 格
    difficulty: string;     // 难度：简单 / 普通 / 困难
    timeCostStar: number[]; // 超时扣星阶梯（秒）
    rewardCoins: number;    // 通关金币奖励
}

/** 杀手数独表行（assets/resources/config/killer.json）
 *  9×9 数独 + 笼和；填错扣 ❤️，扣完失败。 */
export interface KillerCfg {
    id: string;             // 唯一 id，如 killer_hard
    difficulty: string;     // 难度：简单 / 普通 / 困难
    timeCostStar: number[]; // 超时扣星阶梯（秒）
    errorCostStar: number[];// 错误扣星阶梯（次）
    rewardCoins: number;    // 通关金币奖励
    lives: number;          // 血量
    keyHint: boolean;       // 键盘辅助
}

/** 关卡表行（assets/resources/config/level.json）
 *  在表里填一行即可把某关指定为某玩法的某配置 id：
 *  { "id": "L1-5", "chapter": 0, "level": 5, "game": "sudoku", "cfgId": "su_6_normal" }
 *  未配置的关卡走 getLevel() 的默认轮换公式。 */
export interface LevelCfg {
    id: string;
    chapter: number;        // 章节（0 起）
    level: number;          // 关序（0 起）
    game: string;           // 玩法 id：sudoku / mine / star / shikaku / killer
    cfgId: string;          // 对应玩法配置表中的行 id（非数独玩法留空）
}

/** 挑战模式默认使用的数独配置 */
const CHALLENGE_SUDOKU: Record<string, string> = {
    daily: 'su_4_easy',
    weekly: 'su_6_normal',
    monthly: 'su_9_hard',
};

/** 挑战模式默认使用的扫雷配置 */
const CHALLENGE_MINE: Record<string, string> = {
    daily: 'mine_easy',
    weekly: 'mine_normal',
    monthly: 'mine_hard',
};

/** 挑战模式默认使用的星之战配置 */
const CHALLENGE_STAR: Record<string, string> = {
    daily: 'star_easy',
    weekly: 'star_normal',
    monthly: 'star_hard',
};

/** 挑战模式默认使用的数方配置 */
const CHALLENGE_SHIKAKU: Record<string, string> = {
    daily: 'shikaku_easy',
    weekly: 'shikaku_normal',
    monthly: 'shikaku_hard',
};

/** 挑战模式默认使用的杀手数独配置 */
const CHALLENGE_KILLER: Record<string, string> = {
    daily: 'killer_easy',
    weekly: 'killer_normal',
    monthly: 'killer_hard',
};

/** 数独配置加载失败时的兜底 */
const FALLBACK_SUDOKU: SudokuCfg = {
    id: 'su_9_normal', type: 9, difficulty: '普通',
    timeCostStar: [120, 240, 360], errorCostStar: [3, 6, 9], holes: 42, rewardCoins: 60, lives: 3, keyHint: true,
};

/** 扫雷配置加载失败时的兜底 */
const FALLBACK_MINE: MineCfg = {
    id: 'mine_normal', board: 9, mines: 12, difficulty: '普通',
    timeCostStar: [180, 300], rewardCoins: 45,
};

/** 星之战配置加载失败时的兜底 */
const FALLBACK_STAR: StarCfg = {
    id: 'star_normal', board: 9, stars: 2, difficulty: '普通',
    timeCostStar: [240, 420], rewardCoins: 45,
};

/** 数方配置加载失败时的兜底 */
const FALLBACK_SHIKAKU: ShikakuCfg = {
    id: 'shikaku_normal', board: 8, difficulty: '普通',
    timeCostStar: [240, 420], rewardCoins: 45,
};

/** 杀手数独配置加载失败时的兜底 */
const FALLBACK_KILLER: KillerCfg = {
    id: 'killer_normal', difficulty: '普通',
    timeCostStar: [360, 600], errorCostStar: [3, 6, 9],
    rewardCoins: 70, lives: 3, keyHint: true,
};

class ConfigMgr {
    sudokuList: SudokuCfg[] = [];
    mineList: MineCfg[] = [];
    starList: StarCfg[] = [];
    shikakuList: ShikakuCfg[] = [];
    killerList: KillerCfg[] = [];
    levelList: LevelCfg[] = [];
    ready = false;
    private sudokuMap = new Map<string, SudokuCfg>();
    private mineMap = new Map<string, MineCfg>();
    private starMap = new Map<string, StarCfg>();
    private shikakuMap = new Map<string, ShikakuCfg>();
    private killerMap = new Map<string, KillerCfg>();
    private levelMap = new Map<string, LevelCfg>();

    /** 在 Game.start 里调用（resources 异步加载） */
    load(cb?: () => void) {
        let pending = 6;
        const done = () => { if (--pending === 0) { this.ready = true; if (cb) cb(); } };
        resources.load('config/sudoku', JsonAsset, (err, asset) => {
            if (!err && asset && Array.isArray(asset.json)) this.sudokuList = asset.json as SudokuCfg[];
            this.sudokuMap.clear();
            this.sudokuList.forEach(c => this.sudokuMap.set(c.id, c));
            if (this.sudokuList.length) console.log('[Config] 数独表加载', this.sudokuList.length, '行');
            else console.warn('[Config] 数独表为空或加载失败，使用兜底配置');
            done();
        });
        resources.load('config/mine', JsonAsset, (err, asset) => {
            if (!err && asset && Array.isArray(asset.json)) this.mineList = asset.json as MineCfg[];
            this.mineMap.clear();
            this.mineList.forEach(c => this.mineMap.set(c.id, c));
            if (this.mineList.length) console.log('[Config] 扫雷表加载', this.mineList.length, '行');
            done();
        });
        resources.load('config/star', JsonAsset, (err, asset) => {
            if (!err && asset && Array.isArray(asset.json)) this.starList = asset.json as StarCfg[];
            this.starMap.clear();
            this.starList.forEach(c => this.starMap.set(c.id, c));
            if (this.starList.length) console.log('[Config] 星之战表加载', this.starList.length, '行');
            done();
        });
        resources.load('config/shikaku', JsonAsset, (err, asset) => {
            if (!err && asset && Array.isArray(asset.json)) this.shikakuList = asset.json as ShikakuCfg[];
            this.shikakuMap.clear();
            this.shikakuList.forEach(c => this.shikakuMap.set(c.id, c));
            if (this.shikakuList.length) console.log('[Config] 数方表加载', this.shikakuList.length, '行');
            done();
        });
        resources.load('config/killer', JsonAsset, (err, asset) => {
            if (!err && asset && Array.isArray(asset.json)) this.killerList = asset.json as KillerCfg[];
            this.killerMap.clear();
            this.killerList.forEach(c => this.killerMap.set(c.id, c));
            if (this.killerList.length) console.log('[Config] 杀手表加载', this.killerList.length, '行');
            else console.warn('[Config] 杀手表为空或加载失败，使用兜底配置');
            done();
        });
        resources.load('config/level', JsonAsset, (err, asset) => {
            if (!err && asset && Array.isArray(asset.json)) this.levelList = asset.json as LevelCfg[];
            this.levelMap.clear();
            this.levelList.forEach(l => this.levelMap.set(l.chapter + '-' + l.level, l));
            if (this.levelList.length) console.log('[Config] 关卡表加载', this.levelList.length, '行');
            done();
        });
    }

    getSudoku(id: string): SudokuCfg | null {
        return this.sudokuMap.get(id) || null;
    }

    getMine(id: string): MineCfg | null {
        return this.mineMap.get(id) || null;
    }

    getStar(id: string): StarCfg | null {
        return this.starMap.get(id) || null;
    }

    getShikaku(id: string): ShikakuCfg | null {
        return this.shikakuMap.get(id) || null;
    }

    getKiller(id: string): KillerCfg | null {
        return this.killerMap.get(id) || null;
    }

    /** 挑战模式的数独配置 id */
    getChallengeSudokuId(key: string): string {
        return CHALLENGE_SUDOKU[key] || 'su_9_normal';
    }

    /** 挑战模式的扫雷配置 id */
    getChallengeMineId(key: string): string {
        return CHALLENGE_MINE[key] || 'mine_normal';
    }

    /** 挑战模式的星之战配置 id */
    getChallengeStarId(key: string): string {
        return CHALLENGE_STAR[key] || 'star_normal';
    }

    getFallbackSudoku(): SudokuCfg {
        return { ...FALLBACK_SUDOKU };
    }

    getFallbackMine(): MineCfg {
        return { ...FALLBACK_MINE };
    }

    getFallbackStar(): StarCfg {
        return { ...FALLBACK_STAR };
    }
    getChallengeShikakuId(key: string): string {
        return CHALLENGE_SHIKAKU[key] || 'shikaku_normal';
    }

    getFallbackShikaku(): ShikakuCfg {
        return { ...FALLBACK_SHIKAKU };
    }

    getChallengeKillerId(key: string): string {
        return CHALLENGE_KILLER[key] || 'killer_normal';
    }

    getFallbackKiller(): KillerCfg {
        return { ...FALLBACK_KILLER };
    }

    /** 章节关序 → 玩法与配置：关卡表行优先，未配置走默认轮换 */
    getLevel(ci: number, li: number): { game: string; cfgId: string } {
        const hit = this.levelMap.get(ci + '-' + li);
        if (hit) return { game: hit.game, cfgId: hit.cfgId };
        // 第五章（ci=4）整章杀手数独
        if (ci === 4) {
            const pool = ['killer_easy', 'killer_easy', 'killer_normal', 'killer_normal', 'killer_normal', 'killer_hard', 'killer_hard', 'killer_hard', 'killer_hard', 'killer_normal', 'killer_hard', 'killer_hard'];
            return { game: 'killer', cfgId: pool[li % pool.length] };
        }
        const game = GAME_ORDER[(ci * 7 + li * 3) % GAME_ORDER.length];
        // 数独关按章节难度递进选取配置
        const pools: string[][] = [
            ['su_4_easy', 'su_4_normal', 'su_6_easy'],
            ['su_4_hard', 'su_6_normal', 'su_6_easy'],
            ['su_6_normal', 'su_6_hard', 'su_9_easy'],
            ['su_9_easy', 'su_9_normal', 'su_9_easy'],
            ['su_9_normal', 'su_9_hard', 'su_9_normal'],
            ['su_9_hard', 'su_9_hard', 'su_9_normal'],
        ];
        const pool = pools[Math.min(ci, pools.length - 1)];
        const cfgId = game === 'sudoku' ? pool[li % pool.length] : '';
        return { game, cfgId };
    }
}

export const Config = new ConfigMgr();
