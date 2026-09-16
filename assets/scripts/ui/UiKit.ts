/* UI 构建工具库：程序化创建节点/图形/文本/图片 */
import { Node, UITransform, Label, Color, Graphics, Sprite, SpriteFrame, resources, Overflow } from 'cc'

export const WHITE = new Color(255, 255, 255, 255)
export const INK = new Color(58, 42, 26, 255)
export const CREAM = new Color(255, 247, 236, 255)

export function node(name: string, parent: Node, x = 0, y = 0, w = 0, h = 0): Node {
    const n = new Node(name)
    n.addComponent(UITransform).setContentSize(w, h)
    parent.addChild(n)
    n.setPosition(x, y)
    return n
}

/** 在节点上画圆角矩形（居中） */
export function roundRect(n: Node, w: number, h: number, color: Color, radius = 0, filled = true, lineWidth = 2): Graphics {
    let g = n.getComponent(Graphics)
    if (!g) g = n.addComponent(Graphics)
    g.clear()
    g.lineWidth = lineWidth
    g.fillColor = color
    g.strokeColor = color
    g.roundRect(-w / 2, -h / 2, w, h, radius)
    if (filled) g.fill()
    else g.stroke()
    return g
}

export function clearG(n: Node): void {
    n.getComponent(Graphics)?.clear()
}

export function label(parent: Node, str: string, size: number, color: Color = WHITE): Label {
    const n = node('lbl', parent)
    const l = n.addComponent(Label)
    l.string = str
    l.fontSize = size
    l.lineHeight = Math.round(size * 1.15)
    l.color = color
    l.overflow = Overflow.NONE
    return l
}

export function loadSF(path: string): Promise<SpriteFrame> {
    return new Promise((resolve, reject) => {
        resources.load(path, SpriteFrame, (err, sf) => {
            if (err || !sf) reject(err ?? new Error('load fail ' + path))
            else resolve(sf)
        })
    })
}

/** 异步挂图片（自动 CUSTOM 尺寸模式，保持给定 contentSize） */
export async function sprite(parent: Node, path: string, w: number, h: number): Promise<Node> {
    const n = node('img', parent, 0, 0, w, h)
    const sp = n.addComponent(Sprite)
    sp.sizeMode = Sprite.SizeMode.CUSTOM
    try {
        sp.spriteFrame = await loadSF(path)
    } catch (e) {
        console.warn('[sprite] 加载失败:', path, e)
    }
    return n
}

export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))
