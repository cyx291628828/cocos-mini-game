/* 入口：场景启动后装配全部界面（代码优先，无需在编辑器挂组件） */
import { director, Director, view, ResolutionPolicy, Node, debug } from 'cc'
import { loadConfig } from './core/Config'
import { loadSave, persist, resetSave } from './core/Save'
import * as meta from './core/Meta'
import * as BoardView from './ui/BoardView'
import * as Panels from './ui/Panels'
import { mountSudoku } from './ui/SudokuView'
import { sleep } from './ui/UiKit'

let canvas: Node
let busy = false
let gameLayer: Node | null = null
let currentGame: { debugWin: () => void } | null = null

director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => { void main() })

async function main(): Promise<void> {
    debug.setDisplayStats(false) // 关闭性能统计浮层（左下角数字）
    view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_HEIGHT)
    canvas = director.getScene().getChildByName('Canvas') ?? new Node('Canvas')
    if (canvas.parent === null) director.getScene().addChild(canvas)
    // 关闭预览调试面板（PROFILER_NODE）
    const profiler = director.getScene().getChildByName('PROFILER_NODE')
    if (profiler) profiler.active = false

    const cfg = await loadConfig()
    const save = loadSave()
    meta.initMeta(cfg, save)

    await BoardView.build(canvas, {
        onDice: () => void doRoll(),
        onHotspot: onHotspot,
        toast: (m) => Panels.toast(canvas, m),
    })

    const granted = meta.dailyCheck()
    if (granted) Panels.toast(canvas, `📅 每日登录奖励 · 🎲 +${granted}`)
    BoardView.syncValues()
    if (!meta.getSave().chapterEntered) showIntro()

    ;(window as unknown as Record<string, unknown>).DBG = {
        addDice: (n: number) => { meta.addDice(n); BoardView.syncValues() },
        completeGate: () => {
            const g = meta.gateFor()
            const have = meta.piecesOf(g.picId)
            for (let i = 0; i < g.need; i++) if (have.indexOf(i) === -1) meta.grantExtraPiece(false)
            BoardView.syncValues()
        },
        refresh: () => location.reload(),
        reset: () => { resetSave(); location.reload() },
        state: () => {
            const s = meta.getSave()
            return { chapter: s.chapter, pos: s.pos, locked: s.locked, coins: s.coins, dice: s.dice, pieces: meta.piecesOf(meta.gateFor().picId).length, scene: director.getScene().name }
        },
        roll: () => void doRoll(),
        startDiff: (game: string, diff: string) => enterGameFlow(game, diff, false),
        winNow: () => (currentGame as { debugWin?: () => void } | null)?.debugWin?.(),
    }
}

function showIntro(): void {
    const ch = meta.getSave().chapter
    const prev = ch > 1 ? meta.unlockedGames(ch - 1) : []
    const newGames = meta.unlockedGames(ch).filter(g => prev.indexOf(g) === -1)
    Panels.chapterIntro(canvas, ch, newGames, () => {
        meta.markChapterEntered()
        BoardView.refreshStates()
        BoardView.syncValues()
    })
}

function onHotspot(action: string): void {
    if (action === 'settings') { Panels.settingsPanel(canvas); return }
    if (action === 'gallery') { Panels.toast(canvas, '🖼 拼图馆将在下个版本开放'); return }
    Panels.toast(canvas, '🛠 练习模式将在下个版本开放')
}

function ensureGameLayer(): Node {
    if (gameLayer && gameLayer.isValid) return gameLayer
    gameLayer = new Node('GameLayer')
    canvas.addChild(gameLayer)
    return gameLayer
}

function backToBoard(): void {
    gameLayer?.destroy()
    gameLayer = null
    BoardView.refreshStates()
    BoardView.syncValues()
    busy = false
}

async function doRoll(): Promise<void> {
    const save = meta.getSave()
    if (busy) return
    if (save.finished) { Panels.toast(canvas, '🏆 章节已全部通关，敬请期待扩展'); return }
    if (save.dice <= 0) { offerDiceAd(); return }
    busy = true
    save.dice--
    persist(save)
    BoardView.syncValues()

    await BoardView.diceShake()
    const n = 1 + Math.floor(Math.random() * 6)
    const res = meta.roll(n)
    try {
        await BoardView.animatePath(res, m => Panels.toast(canvas, m))
        if (res.crossedEnd) {
            await sleep(300)
            onCrossEnd()
            return
        }
        await handleTile()
    } finally {
        busy = false
    }
}

async function handleTile(): Promise<void> {
    const save = meta.getSave()
    const nd = meta.trackNodes()[save.pos - 1]
    if (!nd) return
    switch (nd.type) {
        case '玩法格': {
            if (!nd.game) return
            openDifficulty(nd.game, false)
            return
        }
        case '金币格': {
            let amount = meta.getConfig().params['金币格金额'] ?? 30
            if (meta.consumeDoubleFlag()) { amount *= 2; Panels.toast(canvas, '✨ 双倍！') }
            meta.addCoins(amount)
            Panels.toast(canvas, `💰 +${amount}`)
            BoardView.syncValues()
            return
        }
        case '骰子格': {
            meta.addDice(1)
            Panels.toast(canvas, '🎲 +1')
            BoardView.syncValues()
            return
        }
        case '事件格': {
            if (nd.param.includes('幸运转盘')) {
                Panels.wheelDraw(canvas, (_pick, apply) => {
                    apply()
                    BoardView.syncValues()
                    busy = false
                })
                return
            }
            if (nd.param.includes('双倍')) {
                meta.setDoubleNext()
                Panels.toast(canvas, '✨ 下一格奖励双倍！')
                return
            }
            if (nd.param.includes('传送')) {
                const m = nd.param.match(/传送\s*(-?\d+)\s*～\s*\+?(\d+)/)
                const lo = m ? parseInt(m[1], 10) : -2
                const hi = m ? parseInt(m[2], 10) : 3
                const delta = lo + Math.floor(Math.random() * (hi - lo + 1))
                Panels.toast(canvas, `🌀 传送 ${delta > 0 ? '前进' : '后退'} ${Math.abs(delta)} 格`)
                const res = meta.teleport(delta)
                await BoardView.animatePath(res, m => Panels.toast(canvas, m))
                if (res.crossedEnd) { await sleep(300); onCrossEnd(); return }
                await handleTile()
                return
            }
            return
        }
        default:
            return
    }
}

function offerDiceAd(): void {
    if (!meta.canDiceAd()) { Panels.toast(canvas, '今日广告次数已用完，明天再来～'); return }
    Panels.showAd(canvas, `骰子 +${meta.getConfig().params['视频补骰子数量'] ?? 3}`, () => {
        meta.grantDiceAd()
        BoardView.syncValues()
        Panels.toast(canvas, '🎲 骰子补充完毕！')
    })
}

function onCrossEnd(): void {
    const ch = meta.getSave().chapter
    const bonus = 100 + ch * 50
    meta.addCoins(bonus)
    Panels.gateCeremony(canvas, ch, bonus, () => {
        const r = meta.enterNextChapter()
        if (r.finished) { Panels.endingScreen(canvas); return }
        // 重建棋盘（新章节无美术图时走占位，由 build 内部处理）
        void BoardView.build(canvas, {
            onDice: () => void doRoll(),
            onHotspot: onHotspot,
            toast: (m) => Panels.toast(canvas, m),
        }).then(() => {
            BoardView.syncValues()
            if (!meta.getSave().chapterEntered) showIntro()
        })
    })
}

function openDifficulty(game: string, free: boolean): void {
    Panels.openDifficulty(canvas, {
        game, free,
        onPick: (diff) => enterGameFlow(game, diff, free),
    })
}

function enterGameFlow(game: string, diff: string, free: boolean): void {
    busy = true
    const layer = ensureGameLayer()
    const settleAndReport = (win: boolean): void => {
        if (win) {
            const br = meta.settleWin(game, diff, free)
            BoardView.syncValues()
            Panels.showResult(canvas, { ...br, free }, {
                onContinue: () => backToBoard(),
                onDouble: () => { meta.addCoins(br.coinsGain); BoardView.syncValues(); Panels.toast(canvas, '🪙 金币翻倍！') },
            })
        } else {
            const c = meta.settleFail(game, diff)
            BoardView.syncValues()
            Panels.showResult(canvas, {
                win: false, game, diff, coinsGain: c, firstLit: false, doubled: false,
                piecesGained: [], pityUsed: false, free,
            }, {
                onContinue: () => backToBoard(),
                onRetry: () => { backToBoard(); enterGameFlow(game, diff, free) },
            })
        }
    }
    currentGame = mountSudoku(layer, diff, {
        onWin: () => settleAndReport(true),
        onFail: () => settleAndReport(false),
        onExit: () => backToBoard(),
        onHintAd: (grant) => Panels.showAd(layer, '获得 1 次提示', grant),
    })
}
