/* ============================================================
 * puzzle-kit · 五个玩法的生成器/求解器（纯逻辑，零渲染依赖）
 * 从 Web 版原样移植，全部保证唯一解
 * ============================================================ */

export function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
    }
    return a
}
export function randInt(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1))
}

/* ---------------- 数独（bw×bh 宫） ---------------- */

export interface SudokuPuzzle { bw: number; bh: number; N: number; puzzle: number[]; solution: number[] }

function boxId(bw: number, bh: number, i: number): number {
    const N = bw * bh, r = Math.floor(i / N), c = i % N
    return Math.floor(r / bh) * (N / bw) + Math.floor(c / bw)
}
function popcount(x: number): number { let c = 0; while (x) { x &= x - 1; c++ } return c }

export function countSudokuSolutions(grid: number[], bw: number, bh: number, limit = 2): number {
    const N = bw * bh
    const g = grid.slice()
    const rows = new Array<number>(N).fill(0), cols = new Array<number>(N).fill(0), boxes = new Array<number>(N).fill(0)
    for (let i = 0; i < N * N; i++) {
        const v = g[i]
        if (!v) continue
        const b = 1 << v
        rows[Math.floor(i / N)] |= b; cols[i % N] |= b; boxes[boxId(bw, bh, i)] |= b
    }
    const empties: number[] = []
    for (let i = 0; i < N * N; i++) if (!g[i]) empties.push(i)
    let count = 0
    const fullMask = ((1 << (N + 1)) - 2)
    function dfs(): void {
        if (count >= limit) return
        let best = -1, bestCand = 0, bestCnt = 99
        for (const i of empties) {
            if (g[i]) continue
            const r = Math.floor(i / N), c = i % N
            const cand = ~(rows[r] | cols[c] | boxes[boxId(bw, bh, i)]) & fullMask
            const cnt = popcount(cand)
            if (cnt === 0) return
            if (cnt < bestCnt) { bestCnt = cnt; best = i; bestCand = cand; if (cnt === 1) break }
        }
        if (best === -1) { count++; return }
        const r = Math.floor(best / N), c = best % N, bx = boxId(bw, bh, best)
        for (let v = 1; v <= N; v++) {
            const b = 1 << v
            if (!(bestCand & b)) continue
            g[best] = v; rows[r] |= b; cols[c] |= b; boxes[bx] |= b
            dfs()
            g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[bx] &= ~b
            if (count >= limit) return
        }
    }
    dfs()
    return count
}

function sudokuOk(grid: number[], bw: number, bh: number, i: number, v: number): boolean {
    const N = bw * bh, r = Math.floor(i / N), c = i % N
    for (let k = 0; k < N; k++) {
        if (grid[r * N + k] === v || grid[k * N + c] === v) return false
    }
    const br = Math.floor(r / bh) * bh, bc = Math.floor(c / bw) * bw
    for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) {
        if (grid[(br + dr) * N + bc + dc] === v) return false
    }
    return true
}

export function genSudokuFull(bw: number, bh: number): number[] {
    const N = bw * bh
    const grid = new Array<number>(N * N).fill(0)
    const vals = Array.from({ length: N }, (_, k) => k + 1)
    function fill(i: number): boolean {
        if (i >= N * N) return true
        for (const v of shuffle(vals.slice())) {
            if (sudokuOk(grid, bw, bh, i, v)) { grid[i] = v; if (fill(i + 1)) return true; grid[i] = 0 }
        }
        return false
    }
    fill(0)
    return grid
}

export function genSudoku(bw: number, bh: number, holes: number): SudokuPuzzle {
    const N = bw * bh
    const solution = genSudokuFull(bw, bh)
    const puzzle = solution.slice()
    const order = shuffle(Array.from({ length: N * N }, (_, i) => i))
    let removed = 0
    for (const i of order) {
        if (removed >= holes) break
        const backup = puzzle[i]
        puzzle[i] = 0
        if (countSudokuSolutions(puzzle, bw, bh, 2) === 1) removed++
        else puzzle[i] = backup
    }
    return { bw, bh, N, puzzle, solution }
}

/* ---------------- 扫雷 ---------------- */

export interface MinesBoard { W: number; H: number; mines: boolean[]; nums: number[] }

export function neighbors8(W: number, H: number, i: number): number[] {
    const r = Math.floor(i / W), c = i % W
    const out: number[] = []
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        const nr = r + dr, nc = c + dc
        if (nr >= 0 && nr < H && nc >= 0 && nc < W) out.push(nr * W + nc)
    }
    return out
}

export function genMines(W: number, H: number, count: number, safeIdx: number): MinesBoard {
    const cells = W * H
    const forbidden = new Set<number>([safeIdx])
    {
        const r = Math.floor(safeIdx / W), c = safeIdx % W
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc
            if (nr >= 0 && nr < H && nc >= 0 && nc < W) forbidden.add(nr * W + nc)
        }
    }
    const pool = shuffle(Array.from({ length: cells }, (_, i) => i).filter(i => !forbidden.has(i)))
    const mines = new Array<boolean>(cells).fill(false)
    for (let k = 0; k < Math.min(count, pool.length); k++) mines[pool[k]] = true
    const nums = new Array<number>(cells).fill(0)
    for (let i = 0; i < cells; i++) {
        const r = Math.floor(i / W), c = i % W
        let n = 0
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue
            const nr = r + dr, nc = c + dc
            if (nr >= 0 && nr < H && nc >= 0 && nc < W && mines[nr * W + nc]) n++
        }
        nums[i] = n
    }
    return { W, H, mines, nums }
}

/* ---------------- 难度规格映射（与 rewards.csv 的规格说明保持一致） ---------------- */

export type Spec =
    | { kind: 'sudoku'; bw: number; bh: number; holes: number }
    | { kind: 'mines'; W: number; H: number; mines: number }

export const SPECS: Record<string, Spec> = {
    '数独|简单': { kind: 'sudoku', bw: 3, bh: 2, holes: 8 },
    '数独|中等': { kind: 'sudoku', bw: 3, bh: 3, holes: 35 },
    '数独|困难': { kind: 'sudoku', bw: 3, bh: 3, holes: 46 },
    '数独|专家': { kind: 'sudoku', bw: 3, bh: 3, holes: 52 },
    '扫雷|简单': { kind: 'mines', W: 9, H: 9, mines: 10 },
    '扫雷|中等': { kind: 'mines', W: 12, H: 12, mines: 20 },
    '扫雷|困难': { kind: 'mines', W: 16, H: 16, mines: 40 },
    '扫雷|专家': { kind: 'mines', W: 16, H: 30, mines: 99 },
}
