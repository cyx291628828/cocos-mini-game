// 同步脚本：把需求仓库的 config CSV 与美术资产同步进 Cocos 工程（改名规避中文路径）
// 用法：node scripts/sync-config.mjs
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))            // PuzzleMonopoly/
const SRC_CONFIG = 'F:/zcode/小游戏/config'
const SRC_ASSETS = 'F:/zcode/小游戏/game/src/assets'
const DST_CONFIG = join(root, 'assets/resources/configs')
const DST_BOARD = join(root, 'assets/resources/textures/board')
const NAME_MAP = { '全局参数表.csv': 'params.csv', '难度奖励表.csv': 'rewards.csv', '章节1-轨道表.csv': 'track1.csv' }

await mkdir(DST_CONFIG, { recursive: true })
await mkdir(join(DST_BOARD, 'slots'), { recursive: true })

for (const f of await readdir(SRC_CONFIG)) {
  if (!f.endsWith('.csv')) continue
  const dst = NAME_MAP[f] ?? f
  // 去掉 BOM，Cocos TextAsset 更稳
  let text = await readFile(join(SRC_CONFIG, f), 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  await writeFile(join(DST_CONFIG, dst), text, 'utf8')
}

let n = 0
for (const f of await readdir(SRC_ASSETS)) {
  if (!f.endsWith('.png')) continue
  const dst = f === 'board-island.png' ? 'bg-original.png' : f
  await cp(join(SRC_ASSETS, f), join(DST_BOARD, dst))
  n++
}
for (const f of await readdir(join(SRC_ASSETS, 'slots'))) {
  if (!f.endsWith('.png')) continue
  await cp(join(SRC_ASSETS, 'slots', f), join(DST_BOARD, 'slots', f))
  n++
}
console.log(`[sync] 配置 3 份 + 资产 ${n} 个 已同步进 Cocos 工程`)
