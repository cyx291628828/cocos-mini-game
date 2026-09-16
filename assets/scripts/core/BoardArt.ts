/* 章节美术棋盘：轨道贴片坐标（设计稿 864×1536，渲染时换算到 720×1280 设计分辨率）
 * 坐标由 scripts/detect-slots.ts 自动检测 + 人工排序；贴片图为自动拆件产物 */
export interface ArtTile { x: number; y: number; w: number; h: number; sprite: string }
export interface ArtRect { x: number; y: number; w: number; h: number }
export interface SkinText { rect: ArtRect; patch: string; bind: 'coins' | 'dice' | 'pieces'; prefix?: string }
export type SkinAction = 'free' | 'gallery' | 'settings'
export interface ArtBoard {
    bg: string
    w: number
    h: number
    tiles: ArtTile[]
    texts: SkinText[]
    dice: ArtRect
    hotspots: { rect: ArtRect; action: SkinAction }[]
}

const SLOT = (n: number): string => `textures/board/slots/slot_${n}/spriteFrame`

export const ART_BOARDS: Record<number, ArtBoard> = {
    1: {
        bg: 'textures/board/bg-clean/spriteFrame',
        w: 864,
        h: 1536,
        tiles: [
            { x: 122, y: 392, w: 110, h: 70, sprite: SLOT(1) },
            { x: 220, y: 396, w: 80, h: 54, sprite: SLOT(2) },
            { x: 306, y: 406, w: 90, h: 56, sprite: SLOT(3) },
            { x: 397, y: 431, w: 90, h: 54, sprite: SLOT(4) },
            { x: 519, y: 479, w: 104, h: 66, sprite: SLOT(5) },
            { x: 622, y: 534, w: 106, h: 76, sprite: SLOT(6) },
            { x: 706, y: 604, w: 98, h: 82, sprite: SLOT(7) },
            { x: 753, y: 686, w: 104, h: 82, sprite: SLOT(8) },
            { x: 770, y: 765, w: 96, h: 72, sprite: SLOT(9) },
            { x: 707, y: 826, w: 112, h: 80, sprite: SLOT(10) },
            { x: 610, y: 875, w: 128, h: 96, sprite: SLOT(11) },
            { x: 510, y: 924, w: 114, h: 86, sprite: SLOT(12) },
            { x: 540, y: 1033, w: 122, h: 88, sprite: SLOT(13) },
            { x: 623, y: 1111, w: 120, h: 86, sprite: SLOT(14) },
            { x: 371, y: 1112, w: 118, h: 78, sprite: SLOT(15) },
            { x: 289, y: 1048, w: 108, h: 78, sprite: SLOT(16) },
            { x: 308, y: 959, w: 114, h: 92, sprite: SLOT(17) },
            { x: 305, y: 856, w: 104, h: 78, sprite: SLOT(18) },
            { x: 230, y: 803, w: 112, h: 80, sprite: SLOT(19) },
            { x: 125, y: 753, w: 108, h: 74, sprite: SLOT(20) },
            { x: 106, y: 646, w: 114, h: 84, sprite: SLOT(21) },
            { x: 176, y: 539, w: 94, h: 74, sprite: SLOT(22) },
            { x: 146, y: 468, w: 82, h: 54, sprite: SLOT(23) },
        ],
        texts: [
            { rect: { x: 497, y: 34, w: 158, h: 50 }, patch: '#9a6c46', bind: 'coins' },
            { rect: { x: 703, y: 34, w: 52, h: 50 }, patch: '#8b5a3b', bind: 'dice' },
            { rect: { x: 106, y: 1436, w: 164, h: 54 }, patch: '#647e89', bind: 'coins' },
            { rect: { x: 352, y: 34, w: 108, h: 50 }, patch: '#5a3a1a', bind: 'pieces', prefix: '🧩' },
        ],
        dice: { x: 320, y: 1232, w: 224, h: 226 },
        hotspots: [
            { rect: { x: 606, y: 1376, w: 88, h: 118 }, action: 'free' },
            { rect: { x: 686, y: 1374, w: 88, h: 120 }, action: 'gallery' },
            { rect: { x: 766, y: 1374, w: 88, h: 120 }, action: 'settings' },
            { rect: { x: 779, y: 24, w: 72, h: 70 }, action: 'settings' },
        ],
    },
}
