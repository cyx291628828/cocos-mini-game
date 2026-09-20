import { resources, JsonAsset } from 'cc';
import { GAME_ORDER } from './Data';

/** 数独表行（assets/resources/config/sudoku.json） */
export interface SudokuCfg {
    id: string;             // 唯一 id，如 su_9_normal
    type: number;           // 数独类型：4 / 6 / 9（宫格规格）
    difficulty: string;     // 难度：简单 / 普通 / 困难
    timeCostStar: number;   // 超时扣星（秒）：用时超过该值扣 1 颗星
    errorCostStar: number;  // 错误次数扣星：每错满该次数扣 1 颗星（可累进，扣完 3 星失败）
    holes: number;          // 挖空数量（出题空格数）
    rewardCoins: number;    // 通关金币奖励
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

/** 数独配置加载失败时的兜底 */
const FALLBACK_SUDOKU: SudokuCfg = {
    id: 'su_9_normal', type: 9, difficulty: '普通',
    timeCostStar: 200, errorCostStar: 4, holes: 42, rewardCoins: 60,
};

class ConfigMgr {
    sudokuList: SudokuCfg[] = [];
    levelList: LevelCfg[] = [];
    ready = false;
    private sudokuMap = new Map<string, SudokuCfg>();
    private levelMap = new Map<string, LevelCfg>();

    /** 在 Game.start 里调用（resources 异步加载） */
    load(cb?: () => void) {
        let pending = 2;
        const done = () => { if (--pending === 0) { this.ready = true; if (cb) cb(); } };
        resources.load('config/sudoku', JsonAsset, (err, asset) => {
            if (!err && asset && Array.isArray(asset.json)) this.sudokuList = asset.json as SudokuCfg[];
            this.sudokuMap.clear();
            this.sudokuList.forEach(c => this.sudokuMap.set(c.id, c));
            if (this.sudokuList.length) console.log('[Config] 数独表加载', this.sudokuList.length, '行');
            else console.warn('[Config] 数独表为空或加载失败，使用兜底配置');
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

    /** 章节关序 → 玩法与配置：关卡表行优先，未配置走默认轮换 */
    getLevel(ci: number, li: number): { game: string; cfgId: string } {
        const hit = this.levelMap.get(ci + '-' + li);
        if (hit) return { game: hit.game, cfgId: hit.cfgId };
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

    /** 挑战模式的数独配置 id */
    getChallengeSudokuId(key: string): string {
        return CHALLENGE_SUDOKU[key] || 'su_9_normal';
    }

    getFallbackSudoku(): SudokuCfg {
        return { ...FALLBACK_SUDOKU };
    }
}

export const Config = new ConfigMgr();
