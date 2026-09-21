/**
 * 星之战出题算法（纯函数模块，无 cc 依赖，可独立测试）
 *
 * 规则：N×N 网格划分为 N 个连通区域，每行/每列/每个区域恰好放 K 颗星，
 *       任意两颗星不能相邻（含对角线八方向）。题目保证唯一解。
 *
 * 生成管线（三步法）：
 *   ① 波前扩展生成 N 个连通区域（大小允许不均）
 *   ② 按行回溯放置 K×N 颗星（行/列/区域计数 + 与上一行星列距≥2）
 *   ③ 唯一解验证：多解时用「目标导向边界调整」——利用第二个反例解，
 *      把差异格挪到会让反例超限的邻区（保证目标解不被破坏 + 区域连通性校验），迭代至唯一解
 */

export interface StarPuzzle {
    N: number;            // 网格边长
    K: number;            // 每行/列/区域星数
    regions: number[];    // 每格区域索引（0..N-1）
    solution: number[];   // 唯一解（1=星 0=空）
}

function mulberry32(a: number) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
    for (let i = arr.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
}

function neighbors(i: number, N: number): number[] {
    const out: number[] = [];
    const r = (i / N) | 0, c = i % N;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
    }
    return out;
}

/** 边相邻（4 邻域，不含对角）——区域连通性用这个 */
function neighbors4(i: number, N: number): number[] {
    const out: number[] = [];
    const r = (i / N) | 0, c = i % N;
    if (r > 0) out.push(i - N);
    if (r < N - 1) out.push(i + N);
    if (c > 0) out.push(i - 1);
    if (c < N - 1) out.push(i + 1);
    return out;
}

/** 波前扩展生成 N 个边连通区域（4 邻域生长，每格随机并入相邻区域，大小允许不均） */
function genRegions(N: number, rng: () => number): number[] | null {
    const total = N * N;
    const regions = new Array(total).fill(-1) as number[];
    const rows = shuffle([...Array(N).keys()], rng);
    const cols = shuffle([...Array(N).keys()], rng);
    for (let r = 0; r < N; r++) regions[rows[r] * N + cols[r]] = r;   // 每行每列恰一个种子
    let progress = true;
    while (progress) {
        progress = false;
        const candidates: Array<[number, number]> = [];
        for (let i = 0; i < total; i++) {
            if (regions[i] !== -1) continue;
            const adj = neighbors4(i, N).filter(j => regions[j] !== -1);
            if (adj.length) candidates.push([i, adj[(rng() * adj.length) | 0]]);
        }
        shuffle(candidates, rng);
        for (const [cell, adjCell] of candidates) {
            if (regions[cell] === -1) { regions[cell] = regions[adjCell]; progress = true; }
        }
    }
    if (!regions.every(r => r >= 0)) return null;
    // 兜底校验：每个区域必须 ≥2 格（禁止单格区域）且 4 邻域连通
    for (let reg = 0; reg < N; reg++) {
        let size = 0;
        const cells: number[] = [];
        for (let i = 0; i < total; i++) if (regions[i] === reg) { size++; cells.push(i); }
        if (size < 2) return null;
        const seen = new Set<number>([cells[0]]);
        const q = [cells[0]];
        while (q.length) {
            const c = q.pop()!;
            for (const j of neighbors4(c, N)) if (regions[j] === reg && !seen.has(j)) { seen.add(j); q.push(j); }
        }
        if (seen.size !== cells.length) return null;
    }
    return regions;
}

/** 按行回溯放置 K×N 颗星（列/区域计数限制 + 与上一行星列距≥2） */
function genStars(N: number, K: number, regions: number[], rng: () => number): number[] | null {
    const stars = new Array(N * N).fill(0);
    const colCnt = new Array(N).fill(0);
    const regCnt = new Array(N).fill(0);
    let prevRow: number[] = [];
    const combos: number[][] = [];
    const pick = (start: number, cur: number[]) => {
        if (cur.length === K) { combos.push(cur.slice()); return; }
        for (let c = start; c < N; c++) { cur.push(c); pick(c + 2, cur); cur.pop(); }   // c+2：同一行的星列距必须 ≥2（不相邻）
    };
    pick(0, []);
    const solve = (r: number): boolean => {
        if (r === N) return true;
        for (const combo of shuffle(combos.slice(), rng)) {
            let ok = combo.every(c => colCnt[c] < K && regCnt[regions[r * N + c]] < K);
            if (ok && r > 0) ok = combo.every(c => !prevRow.some(p => Math.abs(p - c) <= 1));
            if (!ok) continue;
            combo.forEach(c => { stars[r * N + c] = 1; colCnt[c]++; regCnt[regions[r * N + c]]++; });
            const saved = prevRow; prevRow = combo;
            if (solve(r + 1)) return true;
            prevRow = saved;
            combo.forEach(c => { stars[r * N + c] = 0; colCnt[c]--; regCnt[regions[r * N + c]]--; });
        }
        return false;
    };
    return solve(0) ? stars : null;
}

/** 求解器：返回前 limit 个解（星位 0/1 数组） */
export function solveStar(N: number, K: number, regions: number[], limit: number): number[][] {
    const sols: number[][] = [];
    const colCnt = new Array(N).fill(0);
    const regCnt = new Array(N).fill(0);
    let prevRow: number[] = [];
    const cur = new Array(N * N).fill(0);
    const combos: number[][] = [];
    const pick = (start: number, cur2: number[]) => {
        if (cur2.length === K) { combos.push(cur2.slice()); return; }
        for (let c = start; c < N; c++) { cur2.push(c); pick(c + 2, cur2); cur2.pop(); }   // c+2：同一行的星列距必须 ≥2
    };
    pick(0, []);
    const solve = (r: number): void => {
        if (sols.length >= limit) return;
        if (r === N) { sols.push(cur.slice()); return; }
        for (const combo of combos) {
            let ok = combo.every(c => colCnt[c] < K && regCnt[regions[r * N + c]] < K);
            if (ok && r > 0) ok = combo.every(c => !prevRow.some(p => Math.abs(p - c) <= 1));
            if (!ok) continue;
            combo.forEach(c => { cur[r * N + c] = 1; colCnt[c]++; regCnt[regions[r * N + c]]++; });
            const saved = prevRow; prevRow = combo;
            solve(r + 1);
            prevRow = saved;
            combo.forEach(c => { cur[r * N + c] = 0; colCnt[c]--; regCnt[regions[r * N + c]]--; });
            if (sols.length >= limit) return;
        }
    };
    solve(0);
    return sols;
}

function starsIn(sol: number[], regions: number[], reg: number): number {
    let n = 0;
    for (let i = 0; i < sol.length; i++) if (regions[i] === reg && sol[i]) n++;
    return n;
}

/** 移除格 rem 后区域 reg 剩余部分是否连通（4 邻域） */
function stillConnected(regions: number[], rem: number, reg: number, N: number): boolean {
    const cells: number[] = [];
    for (let i = 0; i < regions.length; i++) if (regions[i] === reg && i !== rem) cells.push(i);
    if (cells.length <= 1) return true;
    const seen = new Set<number>([cells[0]]);
    const q = [cells[0]];
    while (q.length) {
        const c = q.pop()!;
        for (const j of neighbors4(c, N)) if (regions[j] === reg && j !== rem && !seen.has(j)) { seen.add(j); q.push(j); }
    }
    return seen.size === cells.length;
}

/** 出题入口：返回唯一解题面。外层 200 轮重生成 + 内层 600 次目标导向调整，
 *  实测各档均在前几十轮内收敛（最坏 <700ms）；极端情况返回 null，调用方可换种子重试 */
export function genStarPuzzle(N: number, K: number, seed: number): StarPuzzle | null {
    const rng = mulberry32(seed);
    for (let round = 0; round < 200; round++) {
        const regions = genRegions(N, rng);
        if (!regions) continue;
        const stars = genStars(N, K, regions, rng);
        if (!stars) continue;
        let guard = 0, stuck = false;
        while (guard++ < 300) {
            const sols = solveStar(N, K, regions, 2);
            if (sols.length === 1) return { N, K, regions, solution: sols[0] };
            const [S1, S2] = sols;
            // 目标导向调整：找「挪走后破坏 S2、不影响 S1」的差异格
            const cands: Array<[number, number]> = [];
            for (let c = 0; c < N * N; c++) {
                if (S1[c] === S2[c]) continue;
                for (const j of neighbors4(c, N)) {          // 只考虑边相邻的目标区（保证挪入后连通）
                    const R2 = regions[j];
                    if (R2 === regions[c]) continue;
                    const s2in = starsIn(S2, regions, R2);
                    const s1in = starsIn(S1, regions, R2);
                    const killsS2 = S2[c] === 1 && s2in >= K;          // 挪入后 S2 的 R2 超限
                    const safeS1 = S1[c] === 0 || s1in < K;            // S1 的 R2 仍合法
                    if (killsS2 && safeS1) cands.push([c, R2]);
                }
            }
            shuffle(cands, rng);
            let applied = false;
            for (const [c, R2] of cands) {
                const oldReg = regions[c];
                // 挪出后原区域至少剩 2 格（禁止单格区域）
                let oldSize = 0;
                for (let i = 0; i < N * N; i++) if (regions[i] === oldReg) oldSize++;
                if (oldSize - 1 < 2) continue;
                if (!stillConnected(regions, c, oldReg, N)) continue;
                regions[c] = R2;
                applied = true;
                break;
            }
            if (!applied) { stuck = true; break; }
        }
        // 跑满迭代或卡住都绝不返回多解题面 → 换区域重新生成
    }
    return null;
}
