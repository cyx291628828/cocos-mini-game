#!/usr/bin/env bash
# 构建「搭桥实验室」：把游戏同款 HashiGen.ts 编译为网页可用的 HashiGen.js（全局变量 HashiGen）
# 用法：bash build.sh   （改动 assets/scripts/core/HashiGen.ts 后重新执行即可）
set -e
cd "$(dirname "$0")"
npx -y -p typescript@5.4 tsc ../../assets/scripts/core/HashiGen.ts --target ES2020 --module ES2020 --skipLibCheck --outDir .
python - <<'PY'
import io, re
s = io.open('HashiGen.js', encoding='utf-8').read()
s = re.sub(r'^export ', '', s, flags=re.M)
s += ("\n(typeof window !== 'undefined' ? window : globalThis).HashiGen ="
      " { genHashiPuzzle, hashiEdges, hashiWin, countHashiSolutions, hashiFirstGlance, logicSolveProfile };\n")
io.open('HashiGen.js', 'w', encoding='utf-8', newline='').write(s)
print('HashiGen.js 构建完成')
PY
