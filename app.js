// ============================================================
// 副业天赋测试 · 前端逻辑（纯静态 + Supabase 版）
// 后端能力已迁移到 Supabase：
//   - 密码校验 + 每密码 3 次限制 → 数据库函数 claim_password_slot
//   - 结果存储 → 数据表 test_results
// 详见 supabase/schema.sql 与 DEPLOY-GUIDE.md
// ============================================================
(function () {
  const D = QUIZ_DATA;
  const C = SITE_CONFIG;
  // 初始化 Supabase 客户端（anon key 公开安全，安全由 RLS 保证）
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);
  const views = { login: $('view-login'), quiz: $('view-quiz'), result: $('view-result') };
  const state = { entered: false, qIndex: 0, answers: {}, result: null, shareMode: false };

  function showView(name) {
    Object.values(views).forEach((v) => v.classList.remove('active'));
    views[name].classList.add('active');
    window.scrollTo(0, 0);
  }

  // ---------- 登录 / 密码校验（Supabase RPC）----------
  $('btn-enter').addEventListener('click', async () => {
    const pwd = $('pwd-input').value.trim();
    if (!pwd) { $('login-msg').textContent = '请输入密码'; return; }
    $('btn-enter').disabled = true;
    $('btn-enter').textContent = '校验中…';
    try {
      const { data, error } = await sb.rpc('claim_password_slot', { pw: pwd });
      if (error) throw error;
      if (data && data.ok) { state.entered = true; startQuiz(); }
      else { $('login-msg').textContent = (data && data.reason) || '密码错误，请核对后重试'; }
    } catch (e) {
      $('login-msg').textContent = '网络错误，请稍后重试';
    } finally {
      $('btn-enter').disabled = false;
      $('btn-enter').textContent = '进入测试';
    }
  });
  $('pwd-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-enter').click(); });

  // ---------- 答题 ----------
  function startQuiz() {
    state.qIndex = 0; state.answers = {}; showView('quiz'); renderQuestion();
  }
  function renderQuestion() {
    const q = D.questions[state.qIndex];
    const total = D.questions.length;
    $('quiz-progress-text').textContent = `第 ${state.qIndex + 1} / ${total} 题`;
    $('progress-fill').style.width = ((state.qIndex + 1) / total * 100) + '%';
    const selected = state.answers[q.id];
    const opts = D.options.map((o, i) => {
      const score = i + 1;
      const cls = (selected === score) ? 'opt selected' : 'opt';
      return `<div class="${cls}" data-score="${score}">${o}</div>`;
    }).join('');
    $('quiz-body').innerHTML = `<div class="q-text">${q.text}</div><div class="options">${opts}</div>`;
    $('quiz-body').querySelectorAll('.opt').forEach((el) => {
      el.addEventListener('click', () => {
        state.answers[q.id] = parseInt(el.dataset.score, 10);
        $('quiz-body').querySelectorAll('.opt').forEach((x) => x.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
    $('btn-prev').style.visibility = state.qIndex === 0 ? 'hidden' : 'visible';
    $('btn-next').textContent = state.qIndex === total - 1 ? '查看结果' : '下一题';
  }
  $('btn-prev').addEventListener('click', () => {
    if (state.qIndex > 0) { state.qIndex--; renderQuestion(); }
  });
  $('btn-next').addEventListener('click', () => {
    const q = D.questions[state.qIndex];
    if (state.answers[q.id] === undefined) { alert('请先选择一个选项'); return; }
    if (state.qIndex < D.questions.length - 1) { state.qIndex++; renderQuestion(); }
    else { showResult(computeResult()); }
  });
  $('btn-back-home').addEventListener('click', () => showView('login'));

  // ---------- 计分 ----------
  function dimName(k) { return D.dims.find((d) => d.key === k).name; }
  function computeResult() {
    const scores = {};
    D.dims.forEach((d) => (scores[d.key] = 0));
    D.questions.forEach((q) => { if (state.answers[q.id] !== undefined) scores[q.dim] += state.answers[q.id]; });
    D.dims.forEach((d) => (scores[d.key] = Math.round((scores[d.key] / 16) * 100)));
    const sorted = [...D.dims].sort((a, b) => scores[b.key] - scores[a.key]);
    const main = sorted[0].key, sub = sorted[1].key;
    const type = D.types[main];
    const result = {
      main, sub, scores, name: type.name, tag: type.tag,
      subText: `主天赋·${dimName(main)} ｜ 辅助·${dimName(sub)}`,
      type,
    };
    state.result = result;
    return result;
  }

  // ---------- 结果渲染 ----------
  function showResult(res) {
    showView('result');
    $('result-name').textContent = res.name;
    $('result-sub').textContent = res.subText;
    $('result-desc').textContent = res.type.desc;
    $('result-points').innerHTML = res.type.points.map((p) => `<li>${p}</li>`).join('');
    $('result-biz').innerHTML = res.type.biz.map((b) =>
      `<div class="item"><div><span class="n">${b.name}</span><span class="c">${b.cost}</span></div><span class="m">${b.income}</span></div>`
    ).join('');
    $('result-share').textContent = res.type.share;
    drawRadar($('radar'), res.scores);
  }

  // ---------- 雷达图 ----------
  function drawRadarCtx(ctx, cx, cy, R, scores) {
    const n = D.dims.length;
    const ang = (i) => (-Math.PI / 2 + (i * 2 * Math.PI) / n);
    [0.33, 0.66, 1].forEach((f) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = cx + R * f * Math.cos(ang(i)), y = cy + R * f * Math.sin(ang(i));
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.strokeStyle = '#f0e6dc'; ctx.lineWidth = 1; ctx.stroke();
    });
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(ang(i)), cy + R * Math.sin(ang(i)));
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const v = scores[D.dims[i].key] / 100;
      const x = cx + R * v * Math.cos(ang(i)), y = cy + R * v * Math.sin(ang(i));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = 'rgba(255,107,53,.18)'; ctx.fill();
    ctx.strokeStyle = '#ff6b35'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#666'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const lr = R + 18;
      const x = cx + lr * Math.cos(ang(i)), y = cy + lr * Math.sin(ang(i));
      ctx.fillText(D.dims[i].name, x, y);
      ctx.fillStyle = '#ff6b35'; ctx.font = '11px sans-serif';
      ctx.fillText(scores[D.dims[i].key], x, y + 13);
      ctx.fillStyle = '#666'; ctx.font = '13px sans-serif';
    }
  }
  function drawRadar(canvas, scores) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRadarCtx(ctx, canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2 - 40, scores);
  }

  // ---------- 长图生成 ----------
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    let line = ''; const lines = [];
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch; }
      else line = test;
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
    return y + lines.length * lineHeight;
  }
  function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawLongImage(res) {
    const W = 750, estH = 1600;
    const c = document.createElement('canvas'); c.width = W; c.height = estH;
    const ctx = c.getContext('2d');
    const pad = 40;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, estH);
    // 顶部渐变
    const g = ctx.createLinearGradient(0, 0, W, 260);
    g.addColorStop(0, '#ff8a3d'); g.addColorStop(1, '#ff6b35');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 260);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '26px sans-serif'; ctx.fillText('你 的 副 业 天 赋 类 型', W / 2, 80);
    ctx.font = '52px sans-serif'; ctx.fillText(res.name, W / 2, 150);
    ctx.font = '20px sans-serif'; ctx.fillText(res.subText, W / 2, 200);
    ctx.font = '15px sans-serif'; ctx.fillText('副业天赋测试 · 你偷偷值钱的能力', W / 2, 235);
    // 雷达
    const ry = 260 + 170, rr = 150;
    drawRadarCtx(ctx, W / 2, ry, rr, res.scores);
    let y = ry + rr + 40;
    // 描述
    ctx.textAlign = 'center'; ctx.fillStyle = '#444'; ctx.font = '17px sans-serif';
    y = wrapText(ctx, res.type.desc, W / 2, y, W - 2 * pad, 26) + 14;
    // 表现
    ctx.textAlign = 'left'; ctx.fillStyle = '#ff6b35'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText('你偷偷值钱的能力', pad, y + 10); y += 44;
    res.type.points.forEach((p) => {
      ctx.fillStyle = '#ff6b35'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('•', pad, y);
      ctx.fillStyle = '#333'; ctx.font = '17px sans-serif';
      y = wrapText(ctx, p, pad + 24, y, W - 2 * pad - 24, 26) + 6;
    });
    // 副业
    ctx.fillStyle = '#ff6b35'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText('最适合你的 3 个副业', pad, y + 14); y += 48;
    res.type.biz.forEach((b) => {
      ctx.fillStyle = '#fff7f0'; roundRect(ctx, pad, y, W - 2 * pad, 86, 14); ctx.fill();
      ctx.strokeStyle = '#ffe0cc'; ctx.lineWidth = 1; roundRect(ctx, pad, y, W - 2 * pad, 86, 14); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(b.name, pad + 16, y + 30);
      ctx.fillStyle = '#999'; ctx.font = '13px sans-serif'; ctx.fillText(b.cost, pad + 16, y + 54);
      ctx.fillStyle = '#ff6b35'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(b.income, W - pad - 16, y + 50); ctx.textAlign = 'left';
      y += 100;
    });
    // 传播文案
    ctx.fillStyle = '#ff6b35'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText('可直接复制发朋友圈', pad, y + 10); y += 38;
    ctx.fillStyle = '#555'; ctx.font = '16px sans-serif';
    y = wrapText(ctx, res.type.share, pad, y, W - 2 * pad, 24) + 16;
    // 底部
    ctx.fillStyle = '#bbb'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    y += 14; ctx.fillText('本测试为趣味自评，不替代职业测评或专业咨询。', W / 2, y); y += 22;
    ctx.fillText('若情绪持续困扰，请拨打心理援助热线 12356。', W / 2, y); y += 30;
    // 裁剪到实际高度
    const out = document.createElement('canvas'); out.width = W; out.height = y + 10;
    out.getContext('2d').drawImage(c, 0, 0, W, y + 10);
    return out;
  }

  // ---------- 保存长图（本地保存 + 后台入库）----------
  $('btn-save').addEventListener('click', () => {
    const img = drawLongImage(state.result);
    const url = img.toDataURL('image/png');
    $('longimg').src = url;
    $('btn-download-img').href = url;
    $('modal-longimg').classList.add('active');
    // 后台存档到 Supabase（静默，不阻塞）
    sb.from('test_results').insert({
      type_code: state.result.main,
      type_name: state.result.name,
      scores: state.result.scores,
      payload: { sub: state.result.sub, subText: state.result.subText },
      source: 'web',
    }).catch(() => {});
  });

  // ---------- 复制 ----------
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise((resolve) => {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); resolve();
    });
  }
  function encodeResult(res) {
    const obj = { main: res.main, sub: res.sub, scores: res.scores, name: res.name, subText: res.subText, type: res.type };
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  }
  function decodeResult(str) {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  }
  $('btn-copy-link').addEventListener('click', () => {
    const link = location.origin + location.pathname + '#r=' + encodeResult(state.result);
    copyText(link).then(() => alert('结果链接已复制，可分享给好友（好友打开即看你的结果）'));
  });
  $('btn-copy-share').addEventListener('click', () => {
    copyText(state.result.type.share).then(() => alert('文案已复制，可直接发朋友圈'));
  });

  // ---------- 再测一次 ----------
  $('btn-retake').addEventListener('click', () => {
    if (state.shareMode) { location.hash = ''; state.shareMode = false; showView('login'); return; }
    startQuiz();
  });

  // ---------- 好评有礼（配置来自静态 config）----------
  function loadConfig() {
    $('rebate-shop').textContent = '店铺：' + (C.SHOP_NAME || '');
    $('rebate-rule').textContent = C.REBATE_RULE || '';
    $('rebate-cs').textContent = '客服：' + (C.CUSTOMER_SERVICE || '');
  }
  $('btn-rebate').addEventListener('click', () => { loadConfig(); $('modal-rebate').classList.add('active'); });
  $('btn-rebate-close').addEventListener('click', () => $('modal-rebate').classList.remove('active'));
  $('btn-longimg-close').addEventListener('click', () => $('modal-longimg').classList.remove('active'));
  // 点击遮罩关闭
  [$('modal-rebate'), $('modal-longimg')].forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
  });

  // ---------- 分享只读模式 ----------
  function parseHash() {
    const h = location.hash;
    if (h.startsWith('#r=')) {
      try {
        const res = decodeResult(h.slice(3));
        state.shareMode = true; state.result = res;
        showResult(res);
      } catch (e) {}
    }
  }
  parseHash();
})();
