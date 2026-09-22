/**
 * 数方（Shikaku）出题算法（纯函数模块，无 cc 依赖，可独立测试）
 *
 * 规则：N×N 网格划分成若干矩形，每个矩形包含恰好一个数字（数字 = 矩形面积），
 *       所有格子被矩形恰好覆盖。题目保证唯一解。
 *
 * 生成管线：随机矩形分割（面积 1~9，权重偏好 2~6）→ 唯一解验证
 *   （求解器枚举所有包含最前未覆盖格的矩形，数到 2 剪枝）→ 多解换分割重试（最多 200 轮）
 */

export interface ShikakuRect { r0: number; c0: number; h: number; w: number; area: number }

export interface ShikakuPuzzle {
    N: number;
    nums: Record<number, number>;   // 数字格 index -> 面积值
    rects: ShikakuRect[];           // 唯一解的矩形划分
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

/** 随机矩形分割（覆盖全盘，面积 1~9 权重偏好 2~6） */
function genBoard(N: number, rng: () => number): { nums: Record<number, number>; rects: ShikakuRect[] } | null {
    const owner = new Array(N * N).fill(-1) as number[];
    const nums: Record<number, number> = {};
    const rects: ShikakuRect[] = [];
    let guard = 0;
    for (;;) {
        if (guard++ > 500) return null;
        let first = -1;
        for (let i = 0; i < N * N; i++) if (owner[i] === -1) { first = i; break; }
        if (first < 0) break;
        const r0 = (first / N) | 0, c0 = first % N;
        const options: ShikakuRect[] = [];
        for (let h = 1; h <= N - r0; h++) for (let w = 1; w <= N - c0; w++) {
            let ok = true;
            for (let r = r0; r < r0 + h && ok; r++) for (let c = c0; c < c0 + w; c++) if (owner[r * N + c] !== -1) { ok = false; break; }
            if (ok) { const area = h * w; if (area <= 9) options.push({ r0, c0, h, w, area }); }
        }
        if (!options.length) return null;
        const weighted: ShikakuRect[] = [];
        for (const o of options) { const wgt = o.area === 1 ? 1 : o.area <= 6 ? 3 : 2; for (let k = 0; k < wgt; k++) weighted.push(o); }
        const sel = weighted[(rng() * weighted.length) | 0];
        const cells: number[] = [];
        for (let r = sel.r0; r < sel.r0 + sel.h; r++) for (let c = sel.c0; c < sel.c0 + sel.w; c++) { owner[r * N + c] = rects.length; cells.push(r * N + c); }
        const numCell = cells[(rng() * cells.length) | 0];
        nums[numCell] = sel.area;
        rects.push(sel);
    }
    return { nums, rects };
}

/** 解数统计（limit 剪枝）：枚举所有包含最前未覆盖格的合法矩形 */
export function countShikakuSolutions(N: number, nums: Record<number, number>, limit: number): number {
    let count = 0;
    const used = new Array(N * N).fill(false);
    const numList = Object.entries(nums).map(([k, v]) => ({ cell: +k, v }));
    const solve = (): void => {
        if (count >= limit) return;
        let first = -1;
        for (let i = 0; i < N * N; i++) if (!used[i]) { first = i; break; }
        if (first < 0) { count++; return; }
        const fr = (first / N) | 0, fc = first % N;
        for (let rr0 = 0; rr0 <= fr; rr0++) for (let rr1 = fr; rr1 < N; rr1++)
            for (let cc0 = 0; cc0 <= fc; cc0++) for (let cc1 = fc; cc1 < N; cc1++) {
                const area = (rr1 - rr0 + 1) * (cc1 - cc0 + 1);
                const cells: number[] = [];
                let ok = true, numsIn = 0, numVal = 0;
                for (let r = rr0; r <= rr1 && ok; r++) for (let c = cc0; c <= cc1; c++) {
                    const i = r * N + c;
                    if (used[i]) { ok = false; break; }
                    cells.push(i);
                    if (nums[i]) { numsIn++; numVal = nums[i]; }
                }
                if (!ok || numsIn !== 1 || numVal !== area) continue;
                cells.forEach(i => used[i] = true);
                solve();
                cells.forEach(i => used[i] = false);
                if (count >= limit) return;
            }
    };
    solve();
    return count;
}

/** 出题入口：返回唯一解题面（多解/失败换分割重试，最多 200 轮）；极端情况返回 null */
export function genShikakuPuzzle(N: number, seed: number): ShikakuPuzzle | null {
    const rng = mulberry32(seed);
    for (let round = 0; round < 200; round++) {
        const b = genBoard(N, rng);
        if (!b) continue;
        if (countShikakuSolutions(N, b.nums, 2) === 1) return { N, nums: b.nums, rects: b.rects };
    }
    return null;
}
