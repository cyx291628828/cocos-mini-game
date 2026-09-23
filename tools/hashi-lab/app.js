/* 搭桥实验室交互逻辑（依赖全局 HashiGen，由 HashiGen.ts 编译产物提供） */
(function () {
  const H = window.HashiGen;
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const msg = $('msg');

  // —— 配置 ↔ 滑条 ——
  const bind = (id, label) => {
    const el = $(id), v = $('v-' + id);
    const upd = () => { if (v) v.textContent = el.value; };
    el.addEventListener('input', () => { upd(); });
    upd();
    return el;
  };
  const boardEl = bind('board'), islandsEl = bind('islands'), trialsEl = bind('trials'),
        wavesEl = bind('waves'), fgminEl = bind('fgmin'), fgmaxEl = bind('fgmax'), seedEl = $('seed');

  // —— 状态 ——
  let puzzle = null;      // { islands, nums, bridges }
  let cur = [];           // 每条可见边当前桥数
  let edges = [], edgeIdx = new Map(), pos = [];
  let sel = -1;
  let showAnswer = false;
  let N = 9, cs = 0, half = 0, margin = 30;

  const key = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);

  function generate() {
    const Nn = +boardEl.value;
    const target = +islandsEl.value;
    let seed = +seedEl.value || Math.floor(Math.random() * 1e9);
    const opts = {
      exactIslands: target,
      minTrials: +trialsEl.value || undefined,
      minWaves: +wavesEl.value || undefined,
      minFirstGlance: +fgminEl.value || undefined,
      maxFirstGlance: +fgmaxEl.value,
    };
    const t0 = performance.now();
    let p = null, usedSeed = seed;
    for (let t = 0; t < 8 && !p; t++, usedSeed = seed + t * 7919 + 13) {
      p = H.genHashiPuzzle(Nn, Nn, target, target + 4, usedSeed, opts);
    }
    const dt = (performance.now() - t0).toFixed(0);
    N = Nn;
    if (!p) {
      puzzle = null;
      $('stats').innerHTML = '⚠️ 未找到满足条件的题面，请放宽参数（降低探索深度/波数/岛数，或放宽一眼可读范围）';
      draw();
      return;
    }
    puzzle = p;
    cur = new Array(H.hashiEdges(N, N, p.islands).length).fill(0);
    edges = H.hashiEdges(N, N, p.islands);
    edgeIdx = new Map();
    edges.forEach((e, i) => edgeIdx.set(key(e.a, e.b), i));
    pos = p.islands.map(cell => {
      const r = Math.floor(cell / N), c = cell % N;
      return { r, c };
    });
    const fg = H.hashiFirstGlance(N, N, p.islands, p.nums);
    const prof = H.logicSolveProfile(p.islands.length, edges, crossOf(edges, p.islands), p.nums);
    showAnswer = false;
    $('stats').innerHTML =
      `种子 <b>${usedSeed}</b> · 耗时 <b>${dt}ms</b><br>` +
      `岛数 <b>${p.islands.length}</b>（目标 ${target}）· 桥数 <b>${p.bridges.reduce((s, b) => s + b.n, 0)}</b><br>` +
      `推理波数 <b>${prof.waves}</b> · 试错步数 <b>${prof.trials}</b> · 一眼可读 <b>${fg}</b> 座<br>` +
      `唯一解：<b>${prof.solved ? '✓（逻辑走通保证）' : '✗ 异常'}</b>`;
    msg.textContent = '';
    draw();
  }

  function crossOf(edges, islands) {
    const rc = islands.map(i => ({ r: Math.floor(i / N), c: i % N }));
    const m = edges.map(() => edges.map(() => false));
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const e1 = edges[i], e2 = edges[j];
      if (e1.h === e2.h) continue;
      const hE = e1.h ? e1 : e2, vE = e1.h ? e2 : e1;
      const hr = rc[hE.a].r, c1 = Math.min(rc[hE.a].c, rc[hE.b].c), c2 = Math.max(rc[hE.a].c, rc[hE.b].c);
      const vc = rc[vE.a].c, r1 = Math.min(rc[vE.a].r, rc[vE.b].r), r2 = Math.max(rc[vE.a].r, rc[vE.b].r);
      if (r1 < hr && hr < r2 && c1 < vc && vc < c2) { m[i][j] = true; m[j][i] = true; }
    }
    return m;
  }

  // —— 坐标 ——
  function layout() {
    cv.width = Math.min(680, window.innerWidth - 40);
    cs = (cv.width - margin * 2) / N;
    half = margin;
  }
  const px = c => half + c * cs;
  const py = r => half + r * cs;
  const rIsl = () => cs * 0.475;

  function hitIsland(x, y) {
    for (let id = 0; id < pos.length; id++) {
      if (Math.hypot(x - px(pos[id].c), y - py(pos[id].r)) < cs * 0.45) return id;
    }
    return -1;
  }

  function draw() {
    layout();
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!puzzle) { if (msg.textContent === '') msg.textContent = '请先生成题目'; return; }
    // 网格
    ctx.strokeStyle = '#D8C49E'; ctx.lineWidth = 1.5;
    for (let k = 0; k <= N; k++) {
      ctx.beginPath(); ctx.moveTo(px(0), py(k)); ctx.lineTo(px(N), py(k)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(k), py(0)); ctx.lineTo(px(k), py(N)); ctx.stroke();
    }
    // 桥（玩家）
    const P = i => ({ x: px(pos[i].c), y: py(pos[i].r) });
    const strokeEdge = (ei, off, color, w) => {
      const e = edges[ei];
      const a = P(e.a), b = P(e.b);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const ox = -dy / len * off, oy = dx / len * off;
      const m = rIsl() + 2;
      ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x + dx / len * m + ox, a.y + dy / len * m + oy);
      ctx.lineTo(b.x - dx / len * m + ox, b.y - dy / len * m + oy);
      ctx.stroke();
    };
    if (showAnswer) {
      const sol = new Array(edges.length).fill(0);
      for (const b of puzzle.bridges) sol[edgeIdx.get(key(b.a, b.b))] = b.n;
      for (let ei = 0; ei < edges.length; ei++) {
        if (sol[ei] >= 1) strokeEdge(ei, -3, '#7BB661', 3.5);
        if (sol[ei] >= 2) strokeEdge(ei, 3, '#7BB661', 3.5);
      }
    }
    for (let ei = 0; ei < edges.length; ei++) {
      if (cur[ei] === 1) strokeEdge(ei, 0, '#4A3B28', 3.5);
      else if (cur[ei] >= 2) { strokeEdge(ei, -3.2, '#4A3B28', 3.5); strokeEdge(ei, 3.2, '#4A3B28', 3.5); }
    }
    // 岛
    const deg = new Array(pos.length).fill(0);
    edges.forEach((e, ei) => { deg[e.a] += cur[ei]; deg[e.b] += cur[ei]; });
    pos.forEach((p, id) => {
      const x = px(p.c), y = py(p.r);
      ctx.beginPath(); ctx.arc(x, y, rIsl(), 0, Math.PI * 2);
      ctx.fillStyle = sel === id ? '#FFE9A8' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = deg[id] === puzzle.nums[id] ? '#48A030' : (sel === id ? '#E8A020' : '#5B4030');
      ctx.lineWidth = sel === id ? 4 : 3;
      ctx.stroke();
      ctx.fillStyle = '#5B4030';
      ctx.font = `bold ${Math.round(cs * 0.46)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(puzzle.nums[id]), x, y + 1);
    });
  }

  function tryEdge(ei) {
    cur[ei] = (cur[ei] + 1) % 3;
    draw();
    checkWin();
  }

  function clickIsland(id) {
    if (sel < 0 || sel === id) { sel = sel === id ? -1 : id; draw(); return; }
    const ei = edgeIdx.get(key(sel, id));
    sel = -1; draw();
    if (ei != null) tryEdge(ei);
  }

  function clickLine(x, y) {
    // 就近两条格线：先近后远，线的两端各有一座岛才可搭
    const kv = Math.max(0, Math.min(N, Math.round((x - half) / cs)));
    const kh = Math.max(0, Math.min(N, Math.round((y - half) / cs)));
    const dv = Math.abs(x - px(kv)), dh = Math.abs(y - py(kh));
    const tryLine = (vert, k) => {
      let lo = -1, loA = -1e9, hi = -1, hiA = 1e9;
      pos.forEach((p, id) => {
        const along = vert ? py(p.r) : px(p.c);
        const onLine = vert ? p.c === k : p.r === k;
        const ref = vert ? y : x;
        if (!onLine) return;
        if (along <= ref && along > loA) { loA = along; lo = id; }
        if (along > ref && along < hiA) { hiA = along; hi = id; }
      });
      if (lo < 0 || hi < 0) return -1;
      return edgeIdx.get(key(lo, hi)) ?? -1;
    };
    const firstV = dv <= dh;
    let ei = tryLine(firstV, firstV ? kv : kh);
    if (ei < 0) ei = tryLine(!firstV, !firstV ? kv : kh);
    if (ei >= 0) tryEdge(ei);
  }

  cv.addEventListener('click', e => {
    if (!puzzle) return;
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const id = hitIsland(x, y);
    if (id >= 0) { clickIsland(id); return; }
    clickLine(x, y);
  });

  function checkWin() {
    const win = H.hashiWin(pos.length, edges, puzzle.nums, cur);
    msg.textContent = win ? '🎉 通关！所有岛已连成一片' : '';
    if (win) msg.style.color = '#3E8E4F'; else msg.style.color = '#4A3B28';
  }

  $('gen').addEventListener('click', generate);
  $('clear').addEventListener('click', () => { if (puzzle) { cur.fill(0); sel = -1; msg.textContent = ''; draw(); } });
  $('answer').addEventListener('click', () => { if (puzzle) { showAnswer = !showAnswer; draw(); } });
  $('check').addEventListener('click', () => {
    if (!puzzle) return;
    const sol = new Array(edges.length).fill(0);
    for (const b of puzzle.bridges) sol[edgeIdx.get(key(b.a, b.b))] = b.n;
    const wrong = cur.some((v, i) => v > sol[i]);
    msg.textContent = wrong ? '❌ 当前有错误' : '✅ 目前为止全都对';
    msg.style.color = wrong ? '#D14B3C' : '#3E8E4F';
  });
  window.addEventListener('resize', () => draw());

  generate();
})();
