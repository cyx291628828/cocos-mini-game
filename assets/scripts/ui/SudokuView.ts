/* 数独玩法界面（M1：填数/错误3次/提示/键盘，笔记撤销后续版本） */
import { Node, Color, Label, UITransform, Vec3, tween } from 'cc'
import { genSudoku, type SudokuPuzzle, type Spec } from '../PuzzleKit'
import { node, roundRect, label } from './UiKit'

const DIFF_SPEC: Record<string, { bw: number; bh: number; holes: number }> = {
    '简单': { bw: 3, bh: 2, holes: 8 },
    '中等': { bw: 3, bh: 3, holes: 35 },
    '困难': { bw: 3, bh: 3, holes: 46 },
    '专家': { bw: 3, bh: 3, holes: 52 },
}

export interface SudokuHooks {
    onWin: () => void
    onFail: () => void
    onExit: () => void
    onHintAd: (grant: () => void) => void
}

export interface SudokuHandle { debugWin: () => void }

export function mountSudoku(parent: Node, diff: string, hooks: SudokuHooks): SudokuHandle {
    const spec = DIFF_SPEC[diff] ?? DIFF_SPEC['简单']
    const puzzle: SudokuPuzzle = genSudoku(spec.bw, spec.bh, spec.holes)
    const N = puzzle.N
    const values = puzzle.puzzle.slice()
    const given = puzzle.puzzle.slice()
    const solution = puzzle.solution
    let selected = -1
    let mistakes = 0
    let hints = 1
    let finished = false
    const cellPx = N >= 9 ? 64 : N >= 6 ? 86 : 100

    // 根容器（覆盖棋盘）
    const root = node('SudokuGame', parent, 0, 0, 720, 1280)
    roundRect(root, 720, 1280, new Color(42, 20, 80), 0)

    // 顶栏
    const back = node('back', root, -300, 596, 70, 70)
    roundRect(back, 70, 70, new Color(255, 255, 255, 40), 14)
    label(back, '‹', 40).node.setPosition(0, 0)
    back.on(Node.EventType.TOUCH_END, () => hooks.onExit())
    label(root, `数独 · ${diff}`, 30).node.setPosition(-80, 596)
    const hearts = label(root, '❤️❤️❤️', 26)
    hearts.node.setPosition(240, 596)

    // 棋盘
    const board = node('board', root, 0, 120, N * cellPx + 8, N * cellPx + 8)
    roundRect(board, N * cellPx + 8, N * cellPx + 8, new Color(107, 84, 58), 10)
    const cellEls: Node[] = []
    const lbls: Label[] = []
    for (let i = 0; i < N * N; i++) {
        const r = Math.floor(i / N), c = i % N
        const x = -((N * cellPx) / 2) + cellPx / 2 + c * cellPx
        const y = ((N * cellPx) / 2) - cellPx / 2 - r * cellPx
        const isGiven = given[i] > 0
        const cell = node(`c${i}`, board, x, y, cellPx - 3, cellPx - 3)
        roundRect(cell, cellPx - 3, cellPx - 3, isGiven ? new Color(243, 233, 213) : new Color(255, 253, 247), 6)
        const l = label(cell, given[i] ? String(given[i]) : '', Math.round(cellPx * 0.5), isGiven ? new Color(58, 42, 26) : new Color(58, 93, 176))
        lbls.push(l)
        cellEls.push(cell)
        cell.on(Node.EventType.TOUCH_END, () => {
            if (given[i]) return
            select(i)
        })
    }
    // 宫线（粗描边）
    const bw = spec.bw, bh = spec.bh
    for (let k = 1; k < N / bw; k++) {
        const line = node(`v${k}`, board, -((N * cellPx) / 2) + k * cellPx * bw, 0, 4, N * cellPx)
        roundRect(line, 4, N * cellPx, new Color(138, 117, 96), 0)
    }
    for (let k = 1; k < N / bh; k++) {
        const line = node(`h${k}`, board, 0, ((N * cellPx) / 2) - k * cellPx * bh, N * cellPx, 4)
        roundRect(line, N * cellPx, 4, new Color(138, 117, 96), 0)
    }

    function select(i: number): void {
        selected = i
        cellEls.forEach((c, k) => {
            const ut = c.getComponent(UITransform)!
            roundRect(c, ut.width, ut.height, given[k] ? new Color(243, 233, 213) : new Color(255, 253, 247), 6)
            if (k === selected) roundRect(c, ut.width, ut.height, new Color(255, 227, 168), 6)
        })
    }

    // 键盘
    const pad = node('pad', root, 0, -330, 640, 0)
    for (let d = 1; d <= N; d++) {
        const k = node(`k${d}`, pad, -((Math.min(N, 5) - 1) * 120) / 2 + ((d - 1) % 5) * 120, -Math.floor((d - 1) / 5) * 104, 108, 92)
        roundRect(k, 108, 92, new Color(255, 255, 255), 14)
        label(k, String(d), 40, new Color(74, 44, 0)).node.setPosition(0, 0)
        k.on(Node.EventType.TOUCH_END, () => input(d))
    }
    const erase = node('kE', pad, -((Math.min(N, 5) - 1) * 120) / 2 + (N % 5) * 120, -Math.floor(N / 5) * 104, 108, 92)
    roundRect(erase, 108, 92, new Color(239, 227, 204), 14)
    label(erase, '⌫', 36, new Color(74, 44, 0)).node.setPosition(0, 0)
    erase.on(Node.EventType.TOUCH_END, () => input(0))

    // 提示
    const hintBtn = node('hint', root, 230, -560, 220, 80)
    roundRect(hintBtn, 220, 80, new Color(255, 197, 61), 16)
    const hintLbl = label(hintBtn, hints > 0 ? '💡 提示 ×1' : '📺 提示', 26, new Color(91, 45, 0))
    hintBtn.on(Node.EventType.TOUCH_END, () => {
        if (hints <= 0) {
            hooks.onHintAd(() => { hints++; hintLbl.string = '💡 提示 ×1' })
            return
        }
        const empties: number[] = []
        for (let i = 0; i < N * N; i++) if (values[i] !== solution[i]) empties.push(i)
        if (!empties.length) return
        const i = empties[Math.floor(Math.random() * empties.length)]
        values[i] = solution[i]
        hints--
        paint()
        checkWin()
    })

    function input(d: number): void {
        if (finished || selected < 0) return
        const i = selected
        if (given[i]) return
        values[i] = d
        const wrong = d !== 0 && d !== solution[i]
        if (wrong) {
            mistakes++
            hearts.string = '❤️'.repeat(Math.max(0, 3 - mistakes))
            if (mistakes >= 3) {
                finished = true
                paint()
                hooks.onFail()
                return
            }
        }
        if (d !== 0) {
            // 正确数字弹性动画
            tween(cellEls[i]).to(0.1, { scale: new Vec3(1.15, 1.15, 1) }).to(0.1, { scale: new Vec3(1, 1, 1) }).start()
        }
        paint()
        checkWin()
    }

    function paint(): void {
        for (let i = 0; i < N * N; i++) {
            const v = values[i]
            const l = lbls[i]
            l.string = v ? String(v) : ''
            l.color = given[i]
                ? new Color(58, 42, 26)
                : v === solution[i] ? new Color(43, 179, 95)
                    : v ? new Color(230, 55, 87) : new Color(58, 93, 176)
        }
    }

    function checkWin(): void {
        for (let i = 0; i < N * N; i++) if (values[i] !== solution[i]) return
        finished = true
        hooks.onWin()
    }

    return {
        debugWin: () => {
            for (let i = 0; i < N * N; i++) values[i] = solution[i]
            checkWin()
        },
    }
}
