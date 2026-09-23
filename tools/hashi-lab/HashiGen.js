/**
 * 搭桥（Hashi）出题（纯函数，无 cc 依赖）
 * 规则：岛（数字 1-8 = 该岛桥数）；桥沿行列直线连两座互相可见的岛；
 *      桥不交叉、不跨岛；两岛间最多 2 座；所有岛被桥连成一个整体。
 * 出题：布岛 → 随机搜一个合法桥分配（每岛 1-8 桥 + 连通 + 不交叉）→ 数字=度数 → 唯一解验证。
 * 实测随机合法分配的唯一解率很高（7×7≈90%，9×9/11×11 更高），多轮重试即可收敛。
 */
function mulberry32(a) {
    return function () {
        a |= 0;
        a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
/**
 * 生长式构造（参照 erthium/hashiwokakero 的 generator 思路）：
 * 从随机内圈交点起，反复沿网格线随机生长桥（厚度 1/2、长度随机），桥与岛即时占位——
 * 天然不交叉、不跨岛、全连通，数字 = 岛度数。单次候选亚毫秒级。
 * 岛只落内圈交点（行/列 1 ~ N-1），不占外围边框；落点四邻不得有岛。
 */
function growAssignment(W, H, rng) {
    const S = W + 1; // 交点阵 (N+1)×(N+1)，key = r*S + c
    const mark = new Array(S * S).fill(0); // 0 空 | 1 已有桥经过
    const isIsland = new Set();
    const deg = new Map();
    const pairs = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const inner = (r, c) => r >= 1 && r <= H - 2 && c >= 1 && c <= W - 2;
    {
        const c = 1 + ((rng() * (W - 2)) | 0);
        const r = 1 + ((rng() * (H - 2)) | 0);
        const start = r * S + c;
        isIsland.add(start);
        deg.set(start, 0);
    }
    const active = [...isIsland.keys()];
    let steps = 0;
    while (active.length && steps < 300) {
        const u = active[(rng() * active.length) | 0];
        const ur = Math.floor(u / S), uc = u % S;
        const dirsP = [], lensP = [], landsP = [];
        for (let d = 0; d < 4; d++) {
            const [dr, dc] = dirs[d];
            let free = 0;
            for (let k = 1; k <= Math.max(W, H); k++) {
                const r = ur + dr * k, c = uc + dc * k;
                if (r < 0 || r > H || c < 0 || c > W)
                    break;
                const key = r * S + c;
                if (isIsland.has(key) || mark[key])
                    break;
                free = k;
            }
            for (let len = 1; len < free; len++) {
                const lr = ur + dr * (len + 1), lc = uc + dc * (len + 1);
                if (!inner(lr, lc))
                    break; // 落点必须内圈（岛不上外框）
                const lk = lr * S + lc;
                let crowded = false;
                for (const [ar, ac] of dirs)
                    if (isIsland.has((lr + ar) * S + (lc + ac))) {
                        crowded = true;
                        break;
                    }
                if (crowded)
                    break; // 落点四邻不得有岛
                dirsP.push(d);
                lensP.push(len);
                landsP.push(lk);
            }
        }
        if (!dirsP.length) {
            const i = active.indexOf(u);
            if (i >= 0)
                active.splice(i, 1);
            continue;
        }
        const pick = (rng() * dirsP.length) | 0;
        const d = dirsP[pick], len = lensP[pick], landing = landsP[pick];
        const [dr, dc] = dirs[d];
        const du = deg.get(u);
        let t = du <= 6 ? (rng() < 0.5 ? 1 : 2) : 1; // 厚度随机，容量 ≤8
        t = Math.min(t, 8 - du);
        for (let k = 1; k <= len; k++)
            mark[(ur + dr * k) * S + (uc + dc * k)] = 1;
        isIsland.add(landing);
        deg.set(landing, t);
        deg.set(u, du + t);
        pairs.push({ u, v: landing, t });
        active.push(landing);
        steps++;
    }
    if (isIsland.size < 5)
        return null;
    const islands = [];
    const nums = [];
    const idByLk = new Map();
    let id = 0;
    for (const k of isIsland.keys()) {
        const r = Math.floor(k / S), c = k % S;
        islands.push(r * W + c);
        nums.push(deg.get(k));
        idByLk.set(k, id++);
    }
    const bridgePairs = pairs.map(p => ({ key: `${Math.min(idByLk.get(p.u), idByLk.get(p.v))}-${Math.max(idByLk.get(p.u), idByLk.get(p.v))}`, t: p.t }));
    return { islands, nums, pairs: bridgePairs };
}
/** 可见边：同行/列相邻岛对（中间无岛）。桥只能搭在可见边两端岛之间。 */
function hashiEdges(W, H, islands) {
    const n = islands.length;
    const idAt = new Map();
    islands.forEach((cell, id) => idAt.set(cell, id));
    const seen = new Set();
    const edges = [];
    for (let id = 0; id < n; id++) {
        const r = (islands[id] / W) | 0, c = islands[id] % W;
        for (const [dr, dc, h] of [[-1, 0, false], [1, 0, false], [0, -1, true], [0, 1, true]]) {
            let rr = r + dr, cc = c + dc;
            while (rr >= 0 && rr < H && cc >= 0 && cc < W) {
                const hit = idAt.get(rr * W + cc);
                if (hit != null) {
                    const a = Math.min(id, hit), b = Math.max(id, hit);
                    const key = a * n + b;
                    if (!seen.has(key)) {
                        seen.add(key);
                        edges.push({ a, b, h });
                    }
                    break;
                }
                rr += dr;
                cc += dc;
            }
        }
    }
    return edges;
}
/** 水平边 × 垂直边 在空格处交叉矩阵 */
function crossMatrix(edges, islands, W) {
    const rc = islands.map(i => ({ r: (i / W) | 0, c: i % W }));
    const m = edges.map(() => edges.map(() => false));
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            const e1 = edges[i], e2 = edges[j];
            if (e1.h === e2.h)
                continue;
            const hE = e1.h ? e1 : e2, vE = e1.h ? e2 : e1;
            const hr = rc[hE.a].r, c1 = Math.min(rc[hE.a].c, rc[hE.b].c), c2 = Math.max(rc[hE.a].c, rc[hE.b].c);
            const vc = rc[vE.a].c, r1 = Math.min(rc[vE.a].r, rc[vE.b].r), r2 = Math.max(rc[vE.a].r, rc[vE.b].r);
            if (r1 < hr && hr < r2 && c1 < vc && vc < c2) {
                m[i][j] = true;
                m[j][i] = true;
            }
        }
    }
    return m;
}
function crossBlocked(cs, ei) {
    return cs.cross[ei].some((x, j) => x && cs.state[j] > 0);
}
function connectedOk(cs, n) {
    const parent = [...Array(n).keys()];
    const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));
    for (let i = 0; i < cs.edges.length; i++) {
        if (cs.state[i] <= 0)
            continue;
        const ra = find(cs.edges[i].a), rb = find(cs.edges[i].b);
        if (ra !== rb)
            parent[ra] = rb;
    }
    const root = find(0);
    for (let v = 1; v < n; v++)
        if (find(v) !== root)
            return false;
    return true;
}
function makeState(n, edges, cross, budget) {
    const inc = Array.from({ length: n }, () => []);
    edges.forEach((e, i) => { inc[e.a].push(i); inc[e.b].push(i); });
    return {
        edges, cross, inc,
        state: new Array(edges.length).fill(-1),
        deg: new Array(n).fill(0),
        unass: inc.map(l => l.length),
        nodes: 0, budget,
    };
}
/** 解数统计（确定性搜索 + 节点预算；超预算返回 999 视为非唯一） */
/** 胜利判定：每岛桥数 = 数字，且桥连成一整片 */
function hashiWin(n, edges, nums, mult) {
    const deg = new Array(n).fill(0);
    for (let i = 0; i < edges.length; i++) {
        if (mult[i] <= 0)
            continue;
        deg[edges[i].a] += mult[i];
        deg[edges[i].b] += mult[i];
    }
    for (let v = 0; v < n; v++)
        if (deg[v] !== nums[v])
            return false;
    const parent = [...Array(n).keys()];
    const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));
    for (let i = 0; i < edges.length; i++) {
        if (mult[i] <= 0)
            continue;
        const ra = find(edges[i].a), rb = find(edges[i].b);
        if (ra !== rb)
            parent[ra] = rb;
    }
    const root = find(0);
    for (let v = 1; v < n; v++)
        if (find(v) !== root)
            return false;
    return true;
}
function countHashiSolutions(W, H, islands, nums, limit = 2, nodeBudget = 80000) {
    const n = islands.length;
    const edges = hashiEdges(W, H, islands);
    const cross = crossMatrix(edges, islands, W);
    const cs = makeState(n, edges, cross, nodeBudget);
    let count = 0, budgetHit = false;
    const rec = () => {
        if (count >= limit || budgetHit)
            return;
        if (++cs.nodes > cs.budget) {
            budgetHit = true;
            return;
        }
        // 需求/容量比最紧的岛优先（确定性：同分取下标小者）
        let bv = -1, tight = -1;
        for (let v = 0; v < n; v++) {
            const need = nums[v] - cs.deg[v];
            if (need < 0)
                return;
            if (need > 2 * cs.unass[v])
                return;
            if (need === 0)
                continue;
            const ratio = need / (2 * cs.unass[v] || 1);
            if (ratio > tight) {
                tight = ratio;
                bv = v;
            }
        }
        if (bv < 0) {
            // 所有岛已满足：剩余未定边强制为 0，走到真正叶子（避免同一解被按
            // 「显式 0 / 未赋值」两条路径重复计数）
            let rest = -1;
            for (let ei = 0; ei < edges.length; ei++)
                if (cs.state[ei] === -1) {
                    rest = ei;
                    break;
                }
            if (rest < 0) {
                if (connectedOk(cs, n))
                    count++;
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
            if (cs.state[ei] === -1) {
                ei0 = ei;
                break;
            }
        }
        if (ei0 < 0)
            return; // 该岛需求 >0 却无未定边（不可能，unass 检查已兜住）
        {
            const ei = ei0;
            for (let m = 0; m <= 2; m++) {
                if (m + cs.deg[bv] > nums[bv])
                    break;
                if (m > 0 && crossBlocked(cs, ei))
                    continue;
                const { a, b } = edges[ei];
                if (cs.deg[a] + m > nums[a] || cs.deg[b] + m > nums[b])
                    continue;
                cs.state[ei] = m;
                cs.deg[a] += m;
                cs.deg[b] += m;
                cs.unass[a]--;
                cs.unass[b]--;
                rec();
                cs.state[ei] = -1;
                cs.deg[a] -= m;
                cs.deg[b] -= m;
                cs.unass[a]++;
                cs.unass[b]++;
                if (count >= limit || budgetHit)
                    return;
            }
        }
    };
    rec();
    return budgetHit ? 999 : count;
}
function lsContradiction(n, edges, inc, st) {
    for (let v = 0; v < n; v++) {
        if (st.need[v] < 0)
            return true;
        if (st.need[v] === 0)
            continue;
        let cap = 0;
        for (const p of inc[v])
            if (!st.blocked[p] && st.mult[p] < 2)
                cap += 2 - st.mult[p];
        if (st.need[v] > cap || cap === 0)
            return true;
    }
    return false;
}
/** 一步可读规则（只看单岛）传播到不动点；返回矛盾 / 规则步数 / 级联波数（真实推理链深度） */
function lsPropagate(n, edges, inc, cross, st) {
    let steps = 0;
    let waves = 0;
    for (;;) {
        for (let ei = 0; ei < edges.length; ei++) {
            if (!st.blocked[ei] && cross[ei].some((x, j) => x && st.mult[j] > 0))
                st.blocked[ei] = true;
        }
        if (lsContradiction(n, edges, inc, st))
            return { contradiction: true, steps, waves };
        let act = false;
        for (let v = 0; v < n; v++) {
            if (st.need[v] === 0)
                continue;
            const opens = inc[v].filter(p => !st.blocked[p] && st.mult[p] < 2);
            if (opens.length === 0)
                return { contradiction: true, steps, waves };
            const cap = opens.reduce((s, p) => s + (2 - st.mult[p]), 0);
            if (st.need[v] > cap)
                return { contradiction: true, steps, waves };
            const allOne = opens.every(p => st.mult[p] === 1);
            const allZero = opens.every(p => st.mult[p] === 0);
            const other = (p) => (edges[p].a === v ? edges[p].b : edges[p].a);
            if (st.need[v] === cap) {
                // ① 需求=容量 → 全部补满
                for (const p of opens) {
                    st.need[other(p)] -= 2 - st.mult[p];
                    st.mult[p] = 2;
                }
                st.need[v] = 0;
                act = true;
            }
            else if (st.need[v] === cap - 1) {
                // ② 高阶解法：比最多桥数少 1 → 空边全部至少 1 座（鸽笼：空边为 0 则最大 2k-2 < 2k-1）
                //    已有 1 座的边不受强制；剩余需求继续保留；无空边时不产生进度（防死循环）
                let placedNow = 0;
                for (const p of opens) {
                    if (st.mult[p] === 0) {
                        st.need[other(p)] -= 1;
                        st.mult[p] = 1;
                        placedNow++;
                    }
                }
                if (placedNow > 0) {
                    st.need[v] -= placedNow;
                    if (st.need[v] < 0)
                        return { contradiction: true, steps, waves };
                    act = true;
                }
            }
            else if (opens.length === 1) {
                // ③ 唯一开边承担全部剩余需求
                const p = opens[0];
                st.need[other(p)] -= st.need[v];
                st.mult[p] += st.need[v];
                st.need[v] = 0;
                act = true;
            }
            else if (allOne && st.need[v] === opens.length) {
                // ④ 已各 1 座且需求 = 开边数 → 全部 +1
                for (const p of opens) {
                    st.need[other(p)] -= 1;
                    st.mult[p] = 2;
                }
                st.need[v] = 0;
                act = true;
            }
            else if (allZero && st.need[v] === 2 * opens.length) {
                // ⑤ 需求 = 2×开边数 → 全部双桥（=①的特例，显式写出）
                for (const p of opens) {
                    st.need[other(p)] -= 2;
                    st.mult[p] = 2;
                }
                st.need[v] = 0;
                act = true;
            }
            // 注意：「k 条空边需求=k → 每边各 1」不健全（(2,1,0) 型分配同样满足），不得加入
            if (act) {
                steps++;
                if (lsContradiction(n, edges, inc, st))
                    return { contradiction: true, steps, waves };
            }
        }
        if (act)
            waves++;
        if (!act)
            return { contradiction: false, steps, waves };
    }
}
/** L3 深度推理：假设一条开边不再加桥 → 传播 L1/L2 → 矛盾则该边强制 +1 */
function lsTrial(n, edges, inc, cross, st) {
    for (let v = 0; v < n; v++) {
        if (st.need[v] === 0)
            continue;
        for (const e of inc[v]) {
            if (st.blocked[e] || st.mult[e] >= 2)
                continue;
            const st2 = { mult: st.mult.slice(), need: st.need.slice(), blocked: st.blocked.slice() };
            st2.blocked[e] = true; // 假设：这条边不再加桥
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
function logicSolveProfile(n, edges, cross, nums) {
    const inc = Array.from({ length: n }, () => []);
    edges.forEach((e, i) => { inc[e.a].push(i); inc[e.b].push(i); });
    const st = { mult: new Array(edges.length).fill(0), need: nums.slice(), blocked: new Array(edges.length).fill(false) };
    let waves = 0;
    let trials = 0;
    let solved = false;
    for (;;) {
        const r = lsPropagate(n, edges, inc, cross, st);
        waves += r.waves;
        if (r.contradiction)
            break;
        if (r.steps > 0) {
            continue;
        }
        if (lsTrial(n, edges, inc, cross, st)) {
            trials++;
            continue;
        }
        break;
    }
    if (st.need.every(d => d === 0)) {
        const parent = [...Array(n).keys()];
        const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));
        for (let i = 0; i < edges.length; i++) {
            if (st.mult[i] <= 0)
                continue;
            const ra = find(edges[i].a), rb = find(edges[i].b);
            if (ra !== rb)
                parent[ra] = rb;
        }
        const root = find(0);
        let conn = true;
        for (let v = 1; v < n; v++)
            if (find(v) !== root) {
                conn = false;
                break;
            }
        solved = conn;
    }
    return { solved, waves, trials };
}
/** 一眼可读岛数：数字 = 可搭容量（全双桥）或 只有一个邻居（全部桥唯一） */
function hashiFirstGlance(W, H, islands, nums) {
    const edges = hashiEdges(W, H, islands);
    const cnt = new Array(islands.length).fill(0);
    edges.forEach(e => { cnt[e.a]++; cnt[e.b]++; });
    let c = 0;
    for (let v = 0; v < islands.length; v++)
        if (nums[v] === cnt[v] * 2 || cnt[v] === 1)
            c++;
    return c;
}
/**
 * 出题：固定种子；多轮「生长式构造 → 数字=度数 → 分级逻辑求解器验收（按推理深度分带）」。
 * 逻辑走通 ⇒ 唯一解；找不到匹配条件的题返回 null（上层换种子重试）。
 */
function genHashiPuzzle(W, H, islandMin, islandMax, seed, opts = {}) {
    const rng = mulberry32(seed);
    // 生长式构造单次亚毫秒，轮数堆出目标推理深度；找不到返回 null（上层换种子重试）
    const rounds = 300;
    const minIslands = Math.max(5, Math.ceil(islandMin * 0.75));
    // 预设难度带 → 波数/试错约束
    let minWaves = opts.minWaves, maxWaves = opts.maxWaves;
    let minTrials = opts.minTrials, maxTrials = opts.maxTrials;
    if (opts.band === 1) {
        maxWaves = 1;
        maxTrials = 0;
    }
    if (opts.band === 2) {
        minWaves = 2;
        maxTrials = 0;
    }
    if (opts.band === 3) {
        minTrials = 1;
    }
    for (let round = 0; round < rounds; round++) {
        const g = growAssignment(W, H, rng);
        if (!g)
            continue;
        const islands = g.islands, nums = g.nums;
        if (opts.exactIslands != null) {
            if (islands.length !== opts.exactIslands)
                continue;
        }
        else {
            if (islands.length < minIslands || islands.length > islandMax)
                continue;
        }
        const edges = hashiEdges(W, H, islands);
        const edgeIdx = new Map();
        edges.forEach((e, i) => edgeIdx.set(e.a + '-' + e.b, i));
        const mult = new Array(edges.length).fill(0);
        let mapped = true;
        for (const b of g.pairs) {
            const ei = edgeIdx.get(b.key);
            if (ei == null) {
                mapped = false;
                break;
            }
            mult[ei] = b.t;
        }
        if (!mapped)
            continue;
        const cross = crossMatrix(edges, islands, W);
        // 难度带验收（难度 = 解题推理深度）：强制逻辑走通 ⇒ 唯一解
        const profile = logicSolveProfile(islands.length, edges, cross, nums);
        if (!profile.solved)
            continue;
        if (minWaves != null && profile.waves < minWaves)
            continue;
        if (maxWaves != null && profile.waves > maxWaves)
            continue;
        if (minTrials != null && profile.trials < minTrials)
            continue;
        if (maxTrials != null && profile.trials > maxTrials)
            continue;
        if (opts.minFirstGlance != null || opts.maxFirstGlance != null) {
            const fg = hashiFirstGlance(W, H, islands, nums);
            if (opts.minFirstGlance != null && fg < opts.minFirstGlance)
                continue;
            if (opts.maxFirstGlance != null && fg > opts.maxFirstGlance)
                continue;
        }
        return {
            W, H, islands, nums,
            bridges: edges.map((e, i) => mult[i] > 0 ? { a: e.a, b: e.b, n: mult[i] } : null).filter(Boolean),
        };
    }
    return null;
}

(typeof window !== 'undefined' ? window : globalThis).HashiGen = { genHashiPuzzle, hashiEdges, hashiWin, countHashiSolutions, hashiFirstGlance, logicSolveProfile };
