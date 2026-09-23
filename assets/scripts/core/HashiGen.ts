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
 * 同行/列间距一律 ≥ 2。
 */
function genIslands(W: number, H: number, target: number, rng: () => number): number[] | null {
    const placed: number[] = [];
    const gapOk = (cell: number): boolean => {
        const r = (cell / W) | 0, c = cell % W;
        for (const p of placed) {
            const pr = (p / W) | 0, pc = p % W;
            if ((pr === r && Math.abs(pc - c) < 2) || (pc === c && Math.abs(pr - r) < 2)) return false;
        }
        return true;
    };
    placed.push((rng() * W * H) | 0);
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
                if (c >= 0 && c < W) cell = pr * W + c;
            } else {
                const r = pr + sign * step;
                if (r >= 0 && r < H) cell = r * W + pc;
            }
        } else {
            cell = (rng() * W * H) | 0;
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
 * 人类逻辑求解器（仅做强制推理，任意落子都在所有解中成立）：
 *  R1 需求 = 2×开边数 → 开边全部补满（到 2）
 *  R2 需求 = 开边数   → 开边全部恰好 1 座
 *  R3 需求 = 2×开边数 - 1 → 开边全部至少 1 座（恰有一条最终双桥）
 *  R4 已放桥与其它边交叉 → 该边封死；容量/需求传播
 * 走通全盘 ⇒ 题面唯一解；中途矛盾或走不动 ⇒ 不可解/待定。
 */
export function logicSolvable(n: number, edges: HashiEdge[], cross: boolean[][], nums: number[]): boolean {
    const inc: number[][] = Array.from({ length: n }, () => []);
    edges.forEach((e, i) => { inc[e.a].push(i); inc[e.b].push(i); });
    const mult = new Array(edges.length).fill(0);
    const blocked = new Array(edges.length).fill(false);
    const need = nums.slice();
    // 岛 v 的剩余容量 = Σ(2 - mult)；isOpen = 未封死且 mult<2
    const opensOf = (v: number) => inc[v].filter(p => !blocked[p] && mult[p] < 2);
    const capOf = (v: number, opens: number[]) => opens.reduce((s, p) => s + (2 - mult[p]), 0);
    let placed = true;
    while (placed) {
        placed = false;
        // R4：新放的桥封死交叉边
        for (let ei = 0; ei < edges.length; ei++) {
            if (!blocked[ei] && cross[ei].some((x, j) => x && mult[j] > 0)) {
                blocked[ei] = true;
                placed = true;
            }
        }
        for (let v = 0; v < n; v++) {
            if (need[v] === 0) continue;
            const opens = opensOf(v);
            const cap = capOf(v, opens);
            if (need[v] > cap) return false;
            if (cap === 0) return false;
            const allZero = opens.every(p => mult[p] === 0);
            const allOne = opens.every(p => mult[p] === 1);
            if (need[v] === cap) {
                // R1：全部补满
                for (const p of opens) {
                    const u = edges[p].a === v ? edges[p].b : edges[p].a;
                    need[u] -= 2 - mult[p];
                    mult[p] = 2;
                }
                need[v] = 0;
                placed = true;
            } else if (allZero && (need[v] === opens.length || need[v] === 2 * opens.length - 1)) {
                // R2/R3：每条开边恰好/至少 1 座
                for (const p of opens) {
                    const u = edges[p].a === v ? edges[p].b : edges[p].a;
                    need[u] -= 1;
                    mult[p] = 1;
                }
                need[v] -= opens.length;
                if (need[v] < 0) return false;
                placed = true;
            } else if (allOne && need[v] === opens.length) {
                // R2'：全部再 +1（到 2）
                for (const p of opens) {
                    const u = edges[p].a === v ? edges[p].b : edges[p].a;
                    need[u] -= 1;
                    mult[p] = 2;
                }
                need[v] = 0;
                placed = true;
            }
            if (need[v] < 0) return false;
        }
    }
    if (need.some(d => d !== 0)) return false;
    // 连通校验
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

/**
 * 出题：固定种子；多轮「布岛 → 自由搜桥分配 → 数字=度数 → 逻辑可解验收（⇒唯一解）」。
 * 极端时返回 null（上层换种子重试）。
 */
export function genHashiPuzzle(W: number, H: number, islandMin: number, islandMax: number, seed: number): HashiPuzzle | null {
    const rng = mulberry32(seed);
    // 大棋盘单轮成功率低，轮数相应加码；找不到唯一解返回 null（上层换种子重试）
    const rounds = W * H <= 81 ? 90 : 140;
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
        const cnt = countHashiSolutions(W, H, islands, nums, 2);
        const puzzle: HashiPuzzle = {
            W, H, islands, nums,
            bridges: edges.map((e, i) => mult[i] > 0 ? { a: e.a, b: e.b, n: mult[i] } : null!).filter(Boolean),
        };
        if (cnt === 1) return puzzle;
    }
    return null;
}
