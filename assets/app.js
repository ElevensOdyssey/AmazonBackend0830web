/* global supabase, APP_CONFIG */
const client = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabasePublishableKey);
const $ = selector => document.querySelector(selector);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const BASE_PATH = location.hostname.endsWith('github.io') ? '/AmazonBackend0830web' : '';
const REPORT_COLUMNS = [
  { key: 'priority', label: '优先级', aliases: ['优先级'] },
  { key: 'keyword', label: '关键词', aliases: ['关键词'] },
  { key: 'competitionSummary', label: 'SIF 竞争格局', aliases: ['SIF 竞争格局'] },
  { key: 'monthlySearches', label: '月搜索量', aliases: ['月搜索量'], defaultVisible: false },
  { key: 'competition', label: '竞争难度', aliases: ['竞争难度'] },
  { key: 'bid', label: '参考竞价', aliases: ['参考竞价'] },
  { key: 'trend', label: 'ABA 近13周', aliases: ['ABA 近13周', 'ABA近13周', '搜索量月度趋势', '搜索量 月度趋势', 'Sorftime'] },
  { key: 'topCompetitor', label: '最强竞对', aliases: ['最强竞对'] },
  { key: 'ownOrganicRank', label: '自己自然位', aliases: ['自己自然位'] },
  { key: 'competitorOrganicRank', label: '竞对自然位', aliases: ['竞对自然位'] },
  { key: 'ranks', label: '自然位', aliases: ['自然位'] },
  { key: 'orders', label: '广告订单', aliases: ['广告订单', '广告：订单', '订单'] },
  { key: 'spend', label: '广告花费', aliases: ['广告花费', '广告：花费', '花费'] },
  { key: 'acos', label: '广告ACOS', aliases: ['广告ACOS', '广告：ACOS', 'ACOS'] },
  { key: 'fieldSource', label: '字段来源', aliases: ['字段来源'], defaultVisible: false },
  { key: 'action', label: '打法建议', aliases: ['打法建议'] },
  { key: 'promotionAssessment', label: 'SIF 推广评估', aliases: ['SIF 推广评估'], defaultVisible: false }
];

function appUrl(path = '/') {
  return `${BASE_PATH}${path}`;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('kb-theme', theme);
  const el = $('#theme-toggle');
  if (el) el.textContent = theme === 'dark' ? '浅色' : '深色';
  if (el) el.setAttribute('aria-label', `切换到${theme === 'dark' ? '浅色' : '深色'}模式`);
}

function initTheme() {
  setTheme(localStorage.getItem('kb-theme') || 'dark');
  $('#theme-toggle')?.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
}

function humanError(error) {
  const msg = String(error?.message || error || '');
  if (/invalid login credentials/i.test(msg)) return '邮箱或密码不对，请检查后再试。';
  if (/email not confirmed/i.test(msg)) return '邮箱还没有确认。若你已关闭邮箱确认，请重新注册或登录。';
  if (/row-level security|violates row-level/i.test(msg)) return '权限校验没有通过，请重新登录后再试。';
  if (/fetch|network/i.test(msg)) return '网络连接失败，请刷新页面后再试。';
  return msg || '操作失败，请稍后再试。';
}

function setMessage(text, type = '') {
  const el = $('#message');
  if (el) {
    el.textContent = text;
    el.className = `message ${type}`;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function normalizeHeader(value) {
  return String(value || '').replace(/\s+/g, '').replace(/[：:]/g, '').toLowerCase();
}

function numbersFromText(text) {
  return [...String(text || '').matchAll(/-?\d+(?:\.\d+)?%?/g)].map(match => ({
    raw: match[0],
    value: Number(match[0].replace('%', ''))
  })).filter(item => Number.isFinite(item.value));
}

function shortText(text, max = 32) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function lineSvg(values, color = '#7467f0', large = false) {
  if (values.length < 2) return '';
  const nums = values.map(item => item.value).slice(large ? -13 : -8);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const points = nums.map((n, i) => {
    const xRange = large ? 260 : 112;
    const yBase = large ? 112 : 34;
    const yRange = large ? 92 : 26;
    const x = 8 + i * (xRange / Math.max(nums.length - 1, 1));
    const y = yBase - ((n - min) / span) * yRange;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const labels = large ? nums.map((n, i) => `<text x="${(8 + i * (260 / Math.max(nums.length - 1, 1))).toFixed(1)}" y="137" text-anchor="middle">${i + 1}</text>`).join('') : '';
  return `<svg class="${large ? 'trend-line-large' : 'mini-line'}" viewBox="${large ? '0 0 280 146' : '0 0 120 40'}" role="img" aria-label="搜索量趋势"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="${large ? 4 : 3}" stroke-linecap="round" stroke-linejoin="round"></polyline>${labels}</svg>`;
}

function barSvg(values, large = false) {
  const nums = values.map(item => item.value).slice(large ? -13 : -8);
  if (!nums.length) return '';
  const max = Math.max(...nums, 1);
  return `<div class="${large ? 'trend-bars-large' : 'mini-bars'}">${nums.map(n => `<span style="height:${Math.max(large ? 18 : 12, Math.round((n / max) * (large ? 84 : 28)))}px"></span>`).join('')}</div>`;
}

function splitCellLines(text) {
  return String(text || '').split(/[\n；;]+/).map(item => item.trim()).filter(Boolean);
}

function isMonthToken(value) {
  return /^202\d(0[1-9]|1[0-2])$/.test(String(value || ''));
}

function trendPointsFromText(text) {
  const tokens = numbersFromText(text).map(item => item.raw.replace('%', ''));
  const points = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (isMonthToken(tokens[i])) continue;
    const nextMonth = tokens.slice(i + 1).find(isMonthToken);
    points.push({ value: Number(tokens[i]), label: nextMonth || '' });
  }
  return points.filter(item => Number.isFinite(item.value)).slice(-13);
}

async function getUser() {
  const { data: { user } } = await client.auth.getUser();
  return user;
}

async function requireUser() {
  const user = await getUser();
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    location.href = appUrl(`/?next=${encodeURIComponent(next)}`);
    return null;
  }
  return user;
}

function taskClass(status) {
  return `status status-${status}`;
}

async function renderTasks(user) {
  const target = $('#task-list');
  if (!target) return;
  const { data, error } = await client
    .from('keyword_tasks')
    .select('id,asin,status,report_link,failure_reason,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    target.innerHTML = `<div class="empty">读取任务失败：${escapeHtml(humanError(error))}</div>`;
    return;
  }
  if (!data?.length) {
    target.innerHTML = '<div class="empty">还没有任务。提交第一份广告报表后，进度会显示在这里。</div>';
    return;
  }
  target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>提交时间</th><th>ASIN</th><th>状态</th><th>报告／失败原因</th></tr></thead><tbody>${data.map(t => `<tr><td>${new Date(t.created_at).toLocaleString()}</td><td>${escapeHtml(t.asin)}</td><td><span class="${taskClass(t.status)}">${escapeHtml(t.status)}</span></td><td>${t.report_link ? `<a class="button secondary" href="${appUrl(`/report/?task=${encodeURIComponent(t.id)}`)}">查看报告</a>` : escapeHtml(t.failure_reason || '等待工人领取')}</td></tr>`).join('')}</tbody></table></div>`;
}

async function initLogin() {
  const form = $('#auth-form');
  if (!form) return;
  const user = await getUser();
  if (user) {
    location.href = new URLSearchParams(location.search).get('next') || appUrl('/tool/');
    return;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('#email').value.trim();
    const password = $('#password').value;
    setMessage('正在登录...');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(humanError(error), 'error');
      return;
    }
    location.href = new URLSearchParams(location.search).get('next') || appUrl('/tool/');
  });
  $('#sign-up').addEventListener('click', async () => {
    const email = $('#email').value.trim();
    const password = $('#password').value;
    if (!email || !password) {
      setMessage('先填写邮箱和密码。', 'error');
      return;
    }
    setMessage('正在注册...');
    const { error } = await client.auth.signUp({ email, password });
    setMessage(error ? humanError(error) : '注册成功，现在可以登录。', error ? 'error' : 'ok');
  });
}

async function initTool() {
  if (!$('#task-form')) return;
  const user = await requireUser();
  if (!user) return;
  $('#user-email').textContent = user.email || '已登录';
  $('#sign-out').addEventListener('click', async () => {
    await client.auth.signOut();
    location.href = appUrl('/');
  });
  const refresh = () => renderTasks(user);
  $('#refresh-tasks')?.addEventListener('click', refresh);
  await refresh();
  setInterval(refresh, 30000);
  $('#task-form').addEventListener('submit', async event => {
    event.preventDefault();
    const asin = $('#asin').value.trim().toUpperCase();
    const file = $('#report-file').files[0];
    if (!/^B0[A-Z0-9]{8}$/.test(asin)) {
      setMessage('ASIN 必须是 10 位，并且以 B0 开头。', 'error');
      return;
    }
    if (!file || !(/\.(xlsx|csv)$/i.test(file.name))) {
      setMessage('请选择 .xlsx 或 .csv 广告报表。', 'error');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage('报表不能超过 10MB。请压缩或拆分后再上传。', 'error');
      return;
    }
    const id = crypto.randomUUID();
    const ext = file.name.toLowerCase().endsWith('.csv') ? '.csv' : '.xlsx';
    const reportFilePath = `${user.id}/${id}${ext}`;
    $('#submit-task').disabled = true;
    setMessage('正在上传报表...');
    const { error: uploadError } = await client.storage.from('task-inbox').upload(reportFilePath, file, { upsert: false, contentType: file.type || undefined });
    if (uploadError) {
      $('#submit-task').disabled = false;
      setMessage(`上传失败：${humanError(uploadError)}`, 'error');
      return;
    }
    setMessage('正在创建任务...');
    const { error: insertError } = await client.from('keyword_tasks').insert({ id, user_id: user.id, asin, report_file_path: reportFilePath, status: '待处理' });
    $('#submit-task').disabled = false;
    if (insertError) {
      setMessage(`任务创建失败：${humanError(insertError)}。已上传文件不会被工人处理。`, 'error');
      return;
    }
    event.target.reset();
    setMessage('提交成功，工人将在约 30 秒内领取。', 'ok');
    refresh();
  });
}

function updateSummary(doc) {
  const table = doc.querySelector('table');
  const rows = [...(table?.querySelectorAll('tbody tr') || [])];
  const actionIndex = table ? findReportColumns(table).find(col => col.key === 'action')?.index : -1;
  const rowText = row => row.textContent || '';
  const kindOf = row => {
    const text = rowText(row);
    const actionCell = actionIndex >= 0 ? row.cells[actionIndex] : null;
    const action = actionCell?.textContent || text;
    if (/止损|暂停|降价|无订单/.test(action)) return 'stop';
    if (/重点进攻|进攻|放大/.test(action)) return 'attack';
    if (/防守|守住/.test(action)) return 'defense';
    return 'observe';
  };
  const counts = { stop: 0, attack: 0, defense: 0, observe: 0 };
  rows.forEach(row => {
    const kind = kindOf(row);
    counts[kind] += 1;
    row.classList.add(`action-${kind}`);
  });
  $('#sum-defense').textContent = counts.defense;
  $('#sum-attack').textContent = counts.attack;
  $('#sum-stop').textContent = counts.stop;
  $('#sum-observe').textContent = counts.observe;
}

function findReportColumns(table) {
  const headers = [...table.querySelectorAll('thead th')];
  return REPORT_COLUMNS.map(config => {
    const index = headers.findIndex(th => {
      const text = normalizeHeader(th.textContent);
      return config.aliases.some(alias => text.includes(normalizeHeader(alias)));
    });
    return { ...config, index };
  }).filter(item => item.index >= 0);
}

function setColumnVisible(table, index, visible) {
  [...table.rows].forEach(row => {
    const cell = row.cells[index];
    if (cell) cell.classList.toggle('is-hidden-column', !visible);
  });
}

function hideStructurallyEmptyColumns(table) {
  const headers = [...table.querySelectorAll('thead th')];
  const bodyRows = [...table.querySelectorAll('tbody tr')];
  headers.forEach((header, index) => {
    const headerEmpty = normalizeHeader(header.textContent) === '';
    const columnEmpty = bodyRows.every(row => !String(row.cells[index]?.textContent || '').trim());
    if (headerEmpty && columnEmpty) setColumnVisible(table, index, false);
  });
}

function markReportColumns(table, columns) {
  columns.forEach(col => {
    if (['orders', 'spend', 'acos'].includes(col.key)) {
      const header = table.tHead?.rows[0]?.cells[col.index];
      if (header) header.textContent = col.label;
    }
    [...table.rows].forEach(row => {
      const cell = row.cells[col.index];
      if (cell) cell.classList.add(`report-col-${col.key}`);
    });
  });
}

function enhanceCell(cell, key) {
  if (!cell || cell.dataset.enhanced === '1') return;
  const text = cell.textContent.trim();
  if (!text) return;
  cell.dataset.enhanced = '1';
  const safe = escapeHtml(text);
  const nums = numbersFromText(text);
  if (key === 'competitionSummary') {
    const asinLine = cell.querySelector('.competition-cell > span');
    if (asinLine) {
      const asins = asinLine.textContent.split('/').map(value => value.trim()).filter(Boolean);
      asinLine.classList.add('competition-asins');
      asinLine.innerHTML = asins.map(asin => `<span class="competition-asin">${escapeHtml(asin)}</span>`).join('');
    }
    return;
  }
  if (key === 'keyword') {
    const lines = splitCellLines(text);
    const title = lines[0] || text;
    const meta = lines.slice(1, 3);
    cell.innerHTML = `<div class="kw-card"><strong>${escapeHtml(title)}</strong>${meta.map(item => `<span>${escapeHtml(shortText(item, 18))}</span>`).join('')}</div>`;
    return;
  }
  if (key === 'trend') {
    const points = trendPointsFromText(text);
    const latest = points.at(-1);
    const first = points[0];
    const delta = first && latest ? Math.round(((latest.value - first.value) / Math.max(first.value, 1)) * 100) : null;
    const deltaClass = delta === null ? '' : delta >= 0 ? 'up' : 'down';
    const labels = points.map((item, i) => `<span>${escapeHtml(item.label || `M${i + 1}`)}：${escapeHtml(String(item.value))}</span>`).join('');
    cell.innerHTML = `<div class="trend-card"><button class="trend-trigger" type="button"><span>Sorftime 趋势</span><strong>${escapeHtml(latest ? String(latest.value) : '—')}</strong>${delta === null ? '' : `<em class="${deltaClass}">${delta >= 0 ? '+' : ''}${delta}%</em>`}</button><div class="trend-popover">${lineSvg(points, '#7467f0', true)}${barSvg(points, true)}<div class="trend-labels">${labels}</div><small>来源：Sorftime 月度搜索量趋势序列</small></div></div>`;
    return;
  }
  if (key === 'competition') {
    const score = nums[0]?.value;
    const level = score >= 80 || /极高|高/.test(text) ? 'high' : score >= 50 || /中/.test(text) ? 'mid' : 'low';
    cell.innerHTML = `<div class="difficulty-badge ${level}"><b>${escapeHtml(nums[0]?.raw || shortText(text, 6))}</b><span>${/极高/.test(text) ? '极高' : /高/.test(text) ? '高' : /中/.test(text) ? '中' : /低/.test(text) ? '低' : '难度'}</span></div>`;
    return;
  }
  if (key === 'bid') {
    const values = nums.map(item => item.raw).slice(0, 3);
    cell.innerHTML = `<div class="bid-card"><strong>${escapeHtml(values[0] || text)}</strong>${values.slice(1).map((v, i) => `<span>${i ? '上限' : '下限'} ${escapeHtml(v)}</span>`).join('')}</div>`;
    return;
  }
  if (key === 'topCompetitor') {
    cell.innerHTML = `<div class="asin-card"><strong>${escapeHtml(shortText(text, 14))}</strong><span>最强竞对</span></div>`;
    return;
  }
  if (key === 'ownOrganicRank' || key === 'competitorOrganicRank') {
    const lines = splitCellLines(text);
    cell.innerHTML = `<div class="rank-card">${lines.slice(0, 3).map((line, i) => `<p class="${i === 0 ? 'rank-main' : ''}">${escapeHtml(line)}</p>`).join('') || safe}</div>`;
    return;
  }
  if (key === 'orders' || key === 'spend' || key === 'acos') {
    cell.innerHTML = `<div class="ad-metric"><strong>${escapeHtml(nums[0]?.raw || text)}</strong><span>${key === 'orders' ? '订单' : key === 'spend' ? '花费' : 'ACOS'}</span></div>`;
    return;
  }
  if (key === 'fieldSource') {
    const lines = splitCellLines(text);
    cell.innerHTML = `<div class="source-list">${lines.slice(0, 5).map(line => `<span>${escapeHtml(shortText(line, 34))}</span>`).join('')}</div>`;
    return;
  }
  if (key === 'action') {
    const kind = /止损|暂停/.test(text) ? 'stop' : /进攻|放大/.test(text) ? 'attack' : /防守|守住/.test(text) ? 'defense' : 'observe';
    cell.innerHTML = `<div class="action-card ${kind}"><strong>${kind === 'stop' ? '止损/控本' : kind === 'attack' ? '进攻放大' : kind === 'defense' ? '防守保持' : '观察验证'}</strong><p>${safe}</p></div>`;
  }
}

function enhanceReportTable(table, columns) {
  table.classList.add('ops-report-table');
  [...table.tBodies].forEach(tbody => {
    [...tbody.rows].forEach(row => {
      columns.forEach(col => enhanceCell(row.cells[col.index], col.key));
    });
  });
}

function buildColumnControls(host) {
  const table = host.querySelector('table');
  if (!table) return;
  host.querySelectorAll('.column-controls,.report-filter-panel,.report-toolbar,.view-controls').forEach(el => el.remove());
  hideStructurallyEmptyColumns(table);
  const columns = findReportColumns(table);
  if (!columns.length) return;
  markReportColumns(table, columns);
  table.classList.add('freeze-columns');
  const controls = document.createElement('details');
  controls.className = 'report-filter-panel';
  controls.innerHTML = `<summary><span class="filter-title"><b>表格筛选</b><small>全部筛选、排序与字段显示</small></span><span class="filter-status"><b data-visible-count>0</b> 条可见<i data-active-count hidden>0 个条件</i></span></summary><div class="filter-body"><div class="filter-actions"><button type="button" data-reset-filter>清空筛选</button><button type="button" data-default-view>恢复默认视图</button><label class="freeze-toggle"><input type="checkbox" data-freeze checked> 冻结表头与关键词</label></div><div class="filter-grid"><label class="filter-wide"><span>关键词</span><input type="search" data-filter-keyword placeholder="搜索关键词"></label><label><span>SIF 竞争格局</span><select data-filter-availability="competitionSummary"><option value="all">全部</option><option value="yes">有数据</option><option value="no">数据缺失</option></select></label><label><span>竞争难度</span><select data-filter-difficulty><option value="all">全部</option><option value="high">高</option><option value="mid">中</option><option value="low">低</option><option value="missing">数据缺失</option></select></label><label><span>ABA 近13周</span><select data-filter-availability="trend"><option value="all">全部</option><option value="yes">有数据</option><option value="no">数据缺失</option></select></label><label><span>最强竞对</span><select data-filter-availability="topCompetitor"><option value="all">全部</option><option value="yes">有数据</option><option value="no">数据缺失</option></select></label><label><span>自然位</span><select data-filter-rank><option value="all">全部</option><option value="self">自己有排名</option><option value="competitor">竞对有排名</option><option value="both">双方有排名</option><option value="missing">双方缺失</option></select></label><label><span>字段来源</span><select data-filter-availability="fieldSource"><option value="all">全部</option><option value="yes">有说明</option><option value="no">数据缺失</option></select></label><label><span>排序字段</span><select data-sort-key><option value="default">默认顺序</option>${columns.filter(col => ['priority','monthlySearches','competition','bid','orders','spend','acos'].includes(col.key)).map(col => `<option value="${col.key}">${escapeHtml(col.label)}</option>`).join('')}</select></label><label><span>排序方向</span><select data-sort-direction><option value="desc">高 → 低</option><option value="asc">低 → 高</option></select></label></div><fieldset class="action-filter"><legend>打法建议</legend><button type="button" class="active" data-action-filter="all">全部</button><button type="button" data-action-filter="defense">防守</button><button type="button" data-action-filter="attack">进攻</button><button type="button" data-action-filter="stop">止损</button><button type="button" data-action-filter="observe">观察</button></fieldset><fieldset><legend>数值区间（留空表示不限）</legend><div class="range-grid">${[['priority','优先级'],['monthlySearches','月搜索量'],['bid','参考竞价'],['orders','广告订单'],['spend','广告花费'],['acos','广告 ACOS']].filter(([key]) => columns.some(col => col.key === key)).map(([key,label]) => `<label><span>${label}</span><span class="range-inputs"><input type="number" inputmode="decimal" data-range-key="${key}" data-range-side="min" placeholder="最低"><i>—</i><input type="number" inputmode="decimal" data-range-key="${key}" data-range-side="max" placeholder="最高"></span></label>`).join('')}</div></fieldset><fieldset><legend>字段显示</legend><div class="field-toolbar"><button type="button" data-show-core>核心字段</button><button type="button" data-show-all>全部字段</button></div><div class="column-toggle-list">${columns.map(col => `<label class="column-toggle"><input type="checkbox" data-column-index="${col.index}" ${col.defaultVisible === false ? '' : 'checked'}><span>${escapeHtml(col.label)}</span></label>`).join('')}</div></fieldset></div>`;
  host.prepend(controls);
  const rows = [...table.querySelectorAll('tbody tr')];
  rows.forEach((row, index) => { row.dataset.originalIndex = String(index); });
  const columnByKey = key => columns.find(col => col.key === key);
  const cellText = (row, key) => {
    const col = columnByKey(key);
    return col ? String(row.cells[col.index]?.textContent || '').trim() : '';
  };
  const hasData = text => Boolean(text && !/^(?:—|-|数据缺失|暂无|无)$/i.test(text.replace(/\s+/g, '')) && !/数据缺失/.test(text));
  let actionFilter = 'all';
  const applyFilters = () => {
    const keyword = controls.querySelector('[data-filter-keyword]').value.trim().toLowerCase();
    const difficulty = controls.querySelector('[data-filter-difficulty]').value;
    const rankMode = controls.querySelector('[data-filter-rank]').value;
    const availability = [...controls.querySelectorAll('[data-filter-availability]')];
    const ranges = {};
    controls.querySelectorAll('[data-range-key]').forEach(input => {
      const value = input.value === '' ? null : Number(input.value);
      (ranges[input.dataset.rangeKey] ||= {})[input.dataset.rangeSide] = Number.isFinite(value) ? value : null;
    });
    let visible = 0;
    rows.forEach(row => {
      let show = !keyword || cellText(row, 'keyword').toLowerCase().includes(keyword);
      if (show && actionFilter !== 'all') show = row.classList.contains(`action-${actionFilter}`);
      const difficultyText = cellText(row, 'competition');
      if (show && difficulty !== 'all') {
        const level = !hasData(difficultyText) ? 'missing' : /极高|高/.test(difficultyText) ? 'high' : /中/.test(difficultyText) ? 'mid' : 'low';
        show = level === difficulty;
      }
      if (show && rankMode !== 'all') {
        const rankText = cellText(row, 'ranks') || `${cellText(row, 'ownOrganicRank')} ${cellText(row, 'competitorOrganicRank')}`;
        const self = /自己[^—-]*(?:P\s*\d|第\s*\d|\d+\/\d+)/i.test(rankText);
        const competitor = /竞对[^—-]*(?:P\s*\d|第\s*\d|\d+\/\d+)/i.test(rankText);
        show = rankMode === 'self' ? self : rankMode === 'competitor' ? competitor : rankMode === 'both' ? self && competitor : !self && !competitor;
      }
      if (show) show = availability.every(select => select.value === 'all' || (select.value === 'yes') === hasData(cellText(row, select.dataset.filterAvailability)));
      if (show) show = Object.entries(ranges).every(([key, range]) => {
        const value = numbersFromText(cellText(row, key))[0]?.value;
        if (!Number.isFinite(value)) return range.min === null && range.max === null;
        return (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
      });
      row.hidden = !show;
      if (show) visible += 1;
    });
    const sortKey = controls.querySelector('[data-sort-key]').value;
    const direction = controls.querySelector('[data-sort-direction]').value;
    [...table.tBodies].forEach(tbody => [...tbody.rows].sort((a, b) => {
      if (sortKey === 'default') return Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
      const av = numbersFromText(cellText(a, sortKey))[0]?.value ?? -Infinity;
      const bv = numbersFromText(cellText(b, sortKey))[0]?.value ?? -Infinity;
      return direction === 'asc' ? av - bv : bv - av;
    }).forEach(row => tbody.appendChild(row)));
    controls.querySelector('[data-visible-count]').textContent = String(visible);
    const changedColumns = [...controls.querySelectorAll('input[data-column-index]')].filter(input => {
      const col = columns.find(item => item.index === Number(input.dataset.columnIndex));
      return input.checked !== (col?.defaultVisible !== false);
    }).length;
    const active = (keyword ? 1 : 0) + (actionFilter === 'all' ? 0 : 1) + [...controls.querySelectorAll('select')].filter(select => !['all','default','desc'].includes(select.value)).length + [...controls.querySelectorAll('[data-range-key]')].filter(input => input.value !== '').length + changedColumns;
    const badge = controls.querySelector('[data-active-count]');
    badge.textContent = `${active} 个条件`;
    badge.hidden = active === 0;
  };
  columns.forEach(col => {
    if (col.defaultVisible === false) setColumnVisible(table, col.index, false);
  });
  controls.addEventListener('input', event => {
    const input = event.target.closest('input[data-column-index]');
    if (input) setColumnVisible(table, Number(input.dataset.columnIndex), input.checked);
    if (event.target.matches('[data-freeze]')) table.classList.toggle('freeze-columns', event.target.checked);
    applyFilters();
  });
  controls.querySelectorAll('[data-action-filter]').forEach(button => button.addEventListener('click', () => {
    actionFilter = button.dataset.actionFilter;
    controls.querySelectorAll('[data-action-filter]').forEach(b => b.classList.toggle('active', b === button));
    applyFilters();
  }));
  controls.querySelector('[data-show-all]')?.addEventListener('click', event => {
    event.preventDefault();
    controls.querySelectorAll('input[data-column-index]').forEach(input => {
      input.checked = true;
      setColumnVisible(table, Number(input.dataset.columnIndex), true);
    });
    applyFilters();
  });
  controls.querySelector('[data-show-core]')?.addEventListener('click', event => {
    event.preventDefault();
    const hide = new Set(['monthlySearches', 'fieldSource', 'orders', 'spend']);
    controls.querySelectorAll('input[data-column-index]').forEach(input => {
      const col = columns.find(item => item.index === Number(input.dataset.columnIndex));
      input.checked = !hide.has(col?.key);
      setColumnVisible(table, Number(input.dataset.columnIndex), input.checked);
    });
    applyFilters();
  });
  controls.querySelector('[data-reset-filter]')?.addEventListener('click', () => {
    controls.querySelectorAll('input[type="search"],input[type="number"]').forEach(input => { input.value = ''; });
    controls.querySelectorAll('select').forEach(select => { select.value = select.matches('[data-sort-direction]') ? 'desc' : select.matches('[data-sort-key]') ? 'default' : 'all'; });
    actionFilter = 'all';
    controls.querySelectorAll('[data-action-filter]').forEach(button => button.classList.toggle('active', button.dataset.actionFilter === 'all'));
    applyFilters();
  });
  controls.querySelector('[data-default-view]')?.addEventListener('click', () => {
    controls.querySelector('[data-reset-filter]').click();
    controls.querySelector('[data-freeze]').checked = true;
    table.classList.add('freeze-columns');
    controls.querySelectorAll('input[data-column-index]').forEach(input => {
      const col = columns.find(item => item.index === Number(input.dataset.columnIndex));
      input.checked = col?.defaultVisible !== false;
      setColumnVisible(table, Number(input.dataset.columnIndex), input.checked);
    });
    applyFilters();
  });
  applyFilters();
}

async function initReport() {
  const host = $('#report-content');
  if (!host) return;
  const user = await requireUser();
  if (!user) return;
  const taskId = new URLSearchParams(location.search).get('task');
  if (!taskId) {
    host.innerHTML = '<div class="empty">从工具页的“查看报告”进入，或在地址后添加 ?task=任务号。</div>';
    return;
  }
  try {
    host.innerHTML = '<div class="empty">正在加载报告...</div>';
    const { data: task, error } = await client
      .from('keyword_tasks')
      .select('id,status,report_link,failure_reason')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!task) throw new Error('没有找到这条任务，或它不属于当前账号。');
    if (task.status !== '已完成' || !task.report_link) throw new Error(task.failure_reason || `任务当前状态：${task.status}`);
    const response = await fetch(task.report_link);
    if (!response.ok) throw new Error(`报告读取失败，HTTP ${response.status}`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    updateSummary(doc);
    doc.querySelector('.top')?.remove();
    doc.querySelector('#summary-module')?.remove();
    doc.querySelector('.settings')?.remove();
    host.innerHTML = doc.body.innerHTML;
    buildColumnControls(host);
  } catch (error) {
    host.innerHTML = `<div class="empty">${escapeHtml(humanError(error))}。请确认任务已完成，且 OSS CORS 已允许本站域名。</div>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLogin();
  initTool();
  initReport();
});
