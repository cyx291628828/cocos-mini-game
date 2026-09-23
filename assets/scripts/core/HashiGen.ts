/**
 * 搭桥（Hashi）出题（纯函数，无 cc 依赖）
 * 规则：岛（数字 1-8 = 该岛桥数）；桥沿行列直线连两座互相可见的岛；
 *      桥不交叉、不跨岛；两岛间最多 2 座；所有岛被桥连成一个整体。
 * 出题：布岛 → 随机搜一个合法桥分配（每岛 1-8 桥 + 连通 + 不交叉）→ 数字=度数 → 唯一解验证。
 * 实测随机合法分配的唯一解率很高（7×7≈90%，9×9/11×11 更高），多轮重试即可收敛。
 */

export interface HashiEdge { a: number; b: number; h: boolean }     // 岛下标对（a<b），h=水平
export interface HashiBridge { a: number; b: number; n: number }    // 岛下标对（a<b）+ 桥数 1|2
export interface HashiPuzzle {
    W: number;
    H: number;
    islands: number[];        // 岛格索引（r * W + c）
    nums: number[];           // 每岛数字（= 桥数）
    bridges: HashiBridge[];   // 解（唯一解验证通过；极端时为一个合法解）
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

/**
 * 布岛：亲和散点。首岛随机，后续岛 65% 概率沿已有岛的行/列对齐放置（距离 2-6，
 * 形成对齐链保证可见图大概率连通），35% 概率纯随机散点（保持边稀疏、少歧义）。
 * 同行/列间距一律 ≥ 2；岛只落在内圈（行/列 1 ~ N-1），不占外围边框。
 */
function genIslands(W: number, H: number, target: number, rng: () => number): number[] | null {
    const placed: number[] = [];
    const inBounds = (r: number, c: number) => r >= 1 && r <= H - 2 && c >= 1 && c <= W - 2;
    const gapOk = (cell: number): boolean => {
        const r = (cell / W) | 0, c = cell % W;
        if (!inBounds(r, c)) return false;
        for (const p of placed) {
            const pr = (p / W) | 0, pc = p % W;
            if ((pr === r && Math.abs(pc - c) < 2) || (pc === c && Math.abs(pr - r) < 2)) return false;
        }
        return true;
    };
    // 首岛在内圈随机
    {
        const c = 1 + ((rng() * (W - 2)) | 0);
        const r = 1 + ((rng() * (H - 2)) | 0);
        placed.push(r * W + c);
    }
    let guard = 0;
    while (placed.length < target && guard++ < target * 60) {
        let cell = -1;
        if (rng() < 0.65 && placed.length > 0) {
            // 沿随机已有岛的行/列放置
            const p = placed[(rng() * placed.length) | 0];
            const pr = (p / W) | 0, pc = p % W;
            const horizontal = rng() < 0.5;
            const step = 2 + ((rng() * 5) | 0);          // 距离 2-6
            const sign = rng() < 0.5 ? -1 : 1;
            if (horizontal) {
                const c = pc + sign * step;
                if (c >= 1 && c <= W - 2) cell = pr * W + c;
            } else {
                const r = pr + sign * step;
                if (r >= 1 && r <= H - 2) cell = r * W + pc;
            }
        } else {
            const c = 1 + ((rng() * (W - 2)) | 0);
            const r = 1 + ((rng() * (H - 2)) | 0);
            cell = r * W + c;
        }
        if (cell >= 0 && !placed.includes(cell) && gapOk(cell)) placed.push(cell);
    }
    const minPlaced = Math.max(5, Math.ceil(target * 0.75));   // 允许略少于目标，凑数失败率高
    return placed.length >= minPlaced ? placed : null;
}

/** 可见边：同行/列相邻岛对（中间无岛）。桥只能搭在可见边两端岛之间。 */
export function hashiEdges(W: number, H: number, islands: number[]): HashiEdge[] {
    const n = islands.length;
    const idAt = new Map<number, number>();
    islands.forEach((cell, id) => idAt.set(cell, id));
    const seen = new Set<number>();
    const edges: HashiEdge[] = [];
    for (let id = 0; id < n; id++) {
        const r = (islands[id] / W) | 0, c = islands[id] % W;
        for (const [dr, dc, h] of [[-1, 0, false], [1, 0, false], [0, -1, true], [0, 1, true]] as const) {
            let rr = r + dr, cc = c + dc;
            while (rr >= 0 && rr < H && cc >= 0 && cc < W) {
                const hit = idAt.get(rr * W + cc);
                if (hit != null) {
                    const a = Math.min(id, hit), b = Math.max(id, hit);
                    const key = a * n + b;
                    if (!seen.has(key)) { seen.add(key); edges.push({ a, b, h }); }
                    break;
                }
                rr += dr; cc += dc;
            }
        }
    }
    return edges;
}

/** 水平边 × 垂直边 在空格处交叉矩阵 */
function crossMatrix(edges: HashiEdge[], islands: number[], W: number): boolean[][] {
    const rc = islands.map(i => ({ r: (i / W) | 0, c: i % W }));
    const m = edges.map(() => edges.map(() => false));
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            const e1 = edges[i], e2 = edges[j];
            if (e1.h === e2.h) continue;
            const hE = e1.h ? e1 : e2, vE = e1.h ? e2 : e1;
            const hr = rc[hE.a].r, c1 = Math.min(rc[hE.a].c, rc[hE.b].c), c2 = Math.max(rc[hE.a].c, rc[hE.b].c);
            const vc = rc[vE.a].c, r1 = Math.min(rc[vE.a].r, rc[vE.b].r), r2 = Math.max(rc[vE.a].r, rc[vE.b].r);
            if (r1 < hr && hr < r2 && c1 < vc && vc < c2) { m[i][j] = true; m[j][i] = true; }
        }
    }
    return m;
}

interface CrossState {
    edges: HashiEdge[];
    cross: boolean[][];
    state: number[];          // -1 未定 | 0/1/2
    deg: number[];
    unass: number[];          // 每岛未定边数
    inc: number[][];
    nodes: number;
    budget: number;
}

function crossBlocked(cs: CrossState, ei: number): boolean {
    return cs.cross[ei].some((x, j) => x && cs.state[j] > 0);
}

function connectedOk(cs: CrossState, n: number): boolean {
    const parent = [...Array(n).keys()];
    const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]));
    for (let i = 0; i < cs.edges.length; i++) {
        if (cs.state[i] <= 0) continue;
        const ra = find(cs.edges[i].a), rb = find(cs.edges[i].b);
        if (ra !== rb) parent[ra] = rb;
    }
    const root = find(0);
    for (let v = 1; v < n; v++) if (find(v) !== root) return false;
    return true;
}

function makeState(n: number, edges: HashiEdge[], cross: boolean[][], budget: number): CrossState {
    const inc: number[][] = Array.from({ length: n }, () => []);
    edges.forEach((e, i) => { inc[e.a].push(i); inc[e.b].push(i); });
    return {
        edges, cross, inc,
        state: new Array(edges.length).fill(-1),
        deg: new Array(n).fill(0),
        unass: inc.map(l => l.length),
        nodes: 0, budget,
    };
}

/**
 * 自由分配搜索：不限数字目标，只求「每岛 1-8 桥 + 全岛连通 + 不交叉 + 边容量 ≤2」的
 * 任一合法分配。静态随机边序 + 双桥权重（更密的分配歧义更少），强前向剪枝。
 */
function findFreeAssignment(n: number, cs: CrossState, rng: () => number): number[] | null {
    const { edges, state, deg, unass } = cs;
    const order = shuffle([...edges.keys()], rng);
    const rec = (pos: number): boolean => {
        if (++cs.nodes > cs.budget) return false;
        if (pos >= order.length) {
            for (let v = 0; v < n; v++) if (deg[v] < 1) return false;
            return connectedOk(cs, n);
        }
        const ei = order[pos];
        const { a, b } = edges[ei];
        for (const m of shuffle([0, 1, 2, 2], rng)) {   // 双桥加倍权重：分配更密
            if (deg[a] + m > 8 || deg[b] + m > 8) continue;
            if (m > 0 && crossBlocked(cs, ei)) continue;
            state[ei] = m; deg[a] += m; deg[b] += m; unass[a]--; unass[b]--;
            let ok = true;
            for (const v of [a, b]) {
                if (deg[v] === 0 && unass[v] === 0) { ok = false; break; }   // 没桥的岛必须还有边可用
            }
            if (ok && rec(pos + 1)) return true;
            state[ei] = -1; deg[a] -= m; deg[b] -= m; unass[a]++; unass[b]++;
        }
        return false;
    };
    if (rec(0)) return cs.state.map(s => (s < 0 ? 0 : s));
    return null;
}

/** 解数统计（确定性搜索 + 节点预算；超预算返回 999 视为非唯一） */
/** 胜利判定：每岛桥数 = 数字，且桥连成一整片 */
export function hashiWin(n: number, edges: HashiEdge[], nums: number[], mult: number[]): boolean {
    const deg = new Array(n).fill(0);
    for (let i = 0; i < edges.length; i++) {
        if (mult[i] <= 0) continue;
        deg[edges[i].a] += mult[i];
        deg[edges[i].b] += mult[i];
    }
    for (let v = 0; v < n; v++) if (deg[v] !== nums[v]) return false;
    const parent = [...Array(n).keys()];
    const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]));
    for (let i = 0; i < edges.length; i++) {
        if (mult[i] <= 0) continue;
        const ra = find(edges[i].a), rb = find(edges[i].b);
        if (ra !== rb) parent[ra] = rb;
    }
    const root = find(0);
    for (let v = 1; v < n; v++) if (find(v) !== root) return false;
    return true;
}

export function countHashiSolutions(
    W: number, H: number, islands: number[], nums: number[],
    limit = 2, nodeBudget = 80000,
): number {
    const n = islands.length;
    const edges = hashiEdges(W, H, islands);
    const cross = crossMatrix(edges, islands, W);
    const cs = makeState(n, edges, cross, nodeBudget);
    let count = 0, budgetHit = false;
    const rec = (): void => {
        if (count >= limit || budgetHit) return;
        if (++cs.nodes > cs.budget) { budgetHit = true; return; }
        // 需求/容量比最紧的岛优先（确定性：同分取下标小者）
        let bv = -1, tight = -1;
        for (let v = 0; v < n; v++) {
            const need = nums[v] - cs.deg[v];
            if (need < 0) return;
            if (need > 2 * cs.unass[v]) return;
            if (need === 0) continue;
            const ratio = need / (2 * cs.unass[v] || 1);
            if (ratio > tight) { tight = ratio; bv = v; }
        }
        if (bv < 0) {
            // 所有岛已满足：剩余未定边强制为 0，走到真正叶子（避免同一解被按
            // 「显式 0 / 未赋值」两条路径重复计数）
            let rest = -1;
            for (let ei = 0; ei < edges.length; ei++) if (cs.state[ei] === -1) { rest = ei; break; }
            if (rest < 0) {
                if (connectedOk(cs, n)) count++;
                return;
            }
            cs.state[rest] = 0;
            rec();
            cs.state[rest] = -1;
            return;
        }
        // 只分支取值：选最紧岛的第一条未定边（选边必须确定化，否则同解被重复计数）
        let ei0 = -1;
        for (const ei of cs.inc[bv]) {
            if (cs.state[ei] === -1) { ei0 = ei; break; }
        }
        if (ei0 < 0) return;   // 该岛需求 >0 却无未定边（不可能，unass 检查已兜住）
        {
            const ei = ei0;
            for (let m = 0; m <= 2; m++) {
                if (m + cs.deg[bv] > nums[bv]) break;
                if (m > 0 && crossBlocked(cs, ei)) continue;
                const { a, b } = edges[ei];
                if (cs.deg[a] + m > nums[a] || cs.deg[b] + m > nums[b]) continue;
                cs.state[ei] = m; cs.deg[a] += m; cs.deg[b] += m; cs.unass[a]--; cs.unass[b]--;
                rec();
                cs.state[ei] = -1; cs.deg[a] -= m; cs.deg[b] -= m; cs.unass[a]++; cs.unass[b]++;
                if (count >= limit || budgetHit) return;
            }
        }
    };
    rec();
    return budgetHit ? 999 : count;
}

/**
 * 分级人类逻辑求解器（只做强制推理，每步在所有解中都成立，走通全盘 ⇒ 唯一解）。
 * 规则按推理深度分级，难度 = 解题所需的最深层级：
 *  L1 表面规则：单岛「需求 = 容量 / 需求 = 开边数」等一眼可读的落子
 *  L2 半深规则：need = 2k-1 → 开边全部 ≥1（R3 类）
 *  L3 深度推理：假设某条边不再加桥并传播 L1/L2，导出矛盾 → 该边必须再搭一座
 *  R4 交叉封边：任何层级免费应用
 */
export interface HashiSolveProfile {
    solved: boolean;        // 强制推理走通全盘（⇒ 唯一解）
    maxLevel: number;       // 用到的最深规则层级（1/2/3）
    initialQuiet: boolean;  // 开局无 L1/L2 强制手（每个数字都不能一眼读出桥数）
    rounds: number;         // 推理传播轮数（强制手的级联波数 = 推理链长度）
}

interface LSState {
    mult: number[];
    need: number[];
    blocked: boolean[];
}

function lsContradiction(n: number, edges: HashiEdge[], inc: number[][], st: LSState): boolean {
    for (let v = 0; v < n; v++) {
        if (st.need[v] < 0) return true;
        if (st.need[v] === 0) continue;
        let cap = 0;
        for (const p of inc[v]) if (!st.blocked[p] && st.mult[p] < 2) cap += 2 - st.mult[p];
        if (st.need[v] > cap || cap === 0) return true;
    }
    return false;
}

/** L1(+可选 L2) 传播到不动点；返回矛盾 / 是否有落子 / 是否用过 L2 */
function lsPropagate(n: number, edges: HashiEdge[], inc: number[][], cross: boolean[][], st: LSState): { contradiction: boolean; moved: boolean; usedL2: boolean } {
    let moved = false, usedL2 = false;
    for (;;) {
        for (let ei = 0; ei < edges.length; ei++) {
            if (!st.blocked[ei] && cross[ei].some((x, j) => x && st.mult[j] > 0)) st.blocked[ei] = true;
        }
        if (lsContradiction(n, edges, inc, st)) return { contradiction: true, moved, usedL2 };
        let act = false;
        for (let v = 0; v < n; v++) {
            if (st.need[v] === 0) continue;
            const opens = inc[v].filter(p => !st.blocked[p] && st.mult[p] < 2);
            if (opens.length === 0) return { contradiction: true, moved, usedL2 };
            const cap = opens.reduce((s, p) => s + (2 - st.mult[p]), 0);
            if (st.need[v] > cap) return { contradiction: true, moved, usedL2 };
            const allZero = opens.every(p => st.mult[p] === 0);
            const allOne = opens.every(p => st.mult[p] === 1);
            const other = (p: number) => (edges[p].a === v ? edges[p].b : edges[p].a);
            if (st.need[v] === cap) {
                // L1：全部补满
                for (const p of opens) { st.need[other(p)] -= 2 - st.mult[p]; st.mult[p] = 2; }
                st.need[v] = 0;
                act = true;
            } else if (allOne && st.need[v] === opens.length) {
                // L1：全部再 +1（到 2）—— k 条 {0,1} 边之和为 k ⇒ 全部 +1
                for (const p of opens) { st.need[other(p)] -= 1; st.mult[p] = 2; }
                st.need[v] = 0;
                act = true;
            } else if (allZero && st.need[v] === 2 * opens.length - 1) {
                // L2：全部至少 1（鸽笼：任一边为 0 则最大 2k-2 < 2k-1）
                for (const p of opens) { st.need[other(p)] -= 1; st.mult[p] = 1; }
                st.need[v] -= opens.length;
                usedL2 = true;
                act = true;
            }
            if (act) {
                moved = true;
                if (lsContradiction(n, edges, inc, st)) return { contradiction: true, moved, usedL2 };
            }
        }
        if (!act) return { contradiction: false, moved, usedL2 };
    }
}

/** L3 深度推理：假设一条开边不再加桥 → 传播 L1/L2 → 矛盾则该边强制 +1 */
function lsTrial(n: number, edges: HashiEdge[], inc: number[][], cross: boolean[][], st: LSState): boolean {
    for (let v = 0; v < n; v++) {
        if (st.need[v] === 0) continue;
        for (const e of inc[v]) {
            if (st.blocked[e] || st.mult[e] >= 2) continue;
            const st2: LSState = { mult: st.mult.slice(), need: st.need.slice(), blocked: st.blocked.slice() };
            st2.blocked[e] = true;   // 假设：这条边不再加桥
            const r = lsPropagate(n, edges, inc, cross, st2);
            if (r.contradiction) {
                // 矛盾 ⇒ 该边必须再搭一座
                const u = edges[e].a === v ? edges[e].b : edges[e].a;
                st.need[v] -= 1;
                st.need[u] -= 1;
                st.mult[e] += 1;
                return true;
            }
        }
    }
    return false;
}

export function logicSolveProfile(n: number, edges: HashiEdge[], cross: boolean[][], nums: number[], allowTrial = true): HashiSolveProfile {
    const inc: number[][] = Array.from({ length: n }, () => []);
    edges.forEach((e, i) => { inc[e.a].push(i); inc[e.b].push(i); });
    const st: LSState = { mult: new Array(edges.length).fill(0), need: nums.slice(), blocked: new Array(edges.length).fill(false) };
    // 开局静默检测：初始局面是否存在表面强制手（用副本跑，不影响主状态）
    const st0: LSState = { mult: st.mult.slice(), need: st.need.slice(), blocked: st.blocked.slice() };
    const r0 = lsPropagate(n, edges, inc, cross, st0);
    const initialQuiet = !r0.moved && !r0.contradiction;
    let maxLevel = 0;
    let rounds = 0;
    let solved = false;
    for (;;) {
        const r = lsPropagate(n, edges, inc, cross, st);
        if (r.contradiction) break;
        if (r.moved) {
            maxLevel = Math.max(maxLevel, r.usedL2 ? 2 : 1);
            rounds++;
            continue;
        }
        if (lsTrial(n, edges, inc, cross, st)) {
            maxLevel = 3;
            rounds++;
            continue;
        }
        break;
    }
    if (st.need.every(d => d === 0)) {
        const parent = [...Array(n).keys()];
        const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]));
        for (let i = 0; i < edges.length; i++) {
            if (st.mult[i] <= 0) continue;
            const ra = find(edges[i].a), rb = find(edges[i].b);
            if (ra !== rb) parent[ra] = rb;
        }
        const root = find(0);
        let conn = true;
        for (let v = 1; v < n; v++) if (find(v) !== root) { conn = false; break; }
        solved = conn;
    }
    return { solved, maxLevel, initialQuiet, rounds };
}

/**
 * 出题：固定种子；多轮「布岛 → 自由搜桥分配 → 数字=度数 → 分级逻辑求解器验收」。
 * band = 难度带：1 表面规则可解 / 2 需要半深推理 / 3 需要深度试错推理（开局数字不可一眼读出）。
 * 逻辑走通 ⇒ 唯一解；找不到匹配难度的题返回 null（上层换种子重试）。
 */
export function genHashiPuzzle(W: number, H: number, islandMin: number, islandMax: number, seed: number, band: 1 | 2 | 3 = 1): HashiPuzzle | null {
    const rng = mulberry32(seed);
    // 小棋盘单轮命中难度带的概率低，靠轮数堆；找不到返回 null（上层换种子重试）
    const rounds = W * H <= 49 ? 260 : W * H <= 81 ? 90 : 140;
    for (let round = 0; round < rounds; round++) {
        const target = islandMin + ((rng() * (islandMax - islandMin + 1)) | 0);
        const islands = genIslands(W, H, target, rng);
        if (!islands) continue;
        const edges = hashiEdges(W, H, islands);
        const cross = crossMatrix(edges, islands, W);
        // 可见图必须连通，否则无解
        {
            const parent = [...Array(islands.length).keys()];
            const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]));
            for (const e of edges) { const ra = find(e.a), rb = find(e.b); if (ra !== rb) parent[ra] = rb; }
            const root = find(0);
            if (edges.length < islands.length - 1 || [...Array(islands.length).keys()].some(v => find(v) !== root)) continue;
        }
        const cs = makeState(islands.length, edges, cross, 50000);
        const mult = findFreeAssignment(islands.length, cs, rng);
        if (!mult) continue;
        const nums = new Array(islands.length).fill(0);
        for (let i = 0; i < edges.length; i++) {
            if (!mult[i]) continue;
            nums[edges[i].a] += mult[i];
            nums[edges[i].b] += mult[i];
        }
        if (nums.some(d => d < 1 || d > 8)) continue;
        // 难度带验收（难度 = 解题推理深度）：逻辑走通 ⇒ 唯一解
        //   1 简单：表面规则即可解  2 普通：需要半深推理  3 困难：必须深度试错推理
        const profile = logicSolveProfile(islands.length, edges, cross, nums);
        if (!profile.solved) continue;
        if (band === 1 && profile.maxLevel !== 1) continue;
        if (band === 2 && profile.maxLevel !== 2) continue;
        if (band === 3 && profile.maxLevel !== 3) continue;
        return {
            W, H, islands, nums,
            bridges: edges.map((e, i) => mult[i] > 0 ? { a: e.a, b: e.b, n: mult[i] } : null!).filter(Boolean),
        };
    }
    return null;
}
