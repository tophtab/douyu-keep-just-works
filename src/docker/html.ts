export function getHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>斗鱼粉丝牌续牌</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0b1020;--card:#121a30;--card-2:#18233f;--accent:#2c4f86;--blue:#67b7ff;--text:#edf3ff;--muted:#94a3b8;--green:#49d7a5;--red:#ff6b6b;--yellow:#f7c948;--border:#243252;--shadow:0 12px 30px rgba(0,0,0,.22)}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:radial-gradient(circle at top,#15213e 0%,#0b1020 55%,#080c18 100%);color:var(--text);min-height:100vh}
.app-shell{display:flex;min-height:100vh}
.sidebar{width:248px;flex:0 0 248px;padding:24px 18px 18px;border-right:1px solid rgba(255,255,255,.06);background:linear-gradient(180deg,rgba(10,16,32,.98),rgba(16,25,46,.95));position:sticky;top:0;height:100vh}
.brand{padding:6px 10px 20px}
.brand h1{font-size:20px;font-weight:700;line-height:1.3}
.brand p{margin-top:8px;font-size:12px;line-height:1.6;color:rgba(237,243,255,.66)}
nav{display:flex;flex-direction:column;gap:8px}
nav button{padding:12px 14px;background:transparent;border:1px solid transparent;color:var(--muted);cursor:pointer;font-size:14px;border-radius:14px;transition:.2s;text-align:left}
nav button.active{color:var(--text);border-color:rgba(103,183,255,.28);background:linear-gradient(135deg,rgba(103,183,255,.18),rgba(103,183,255,.08))}
nav button:hover{color:var(--text);background:rgba(255,255,255,.04)}
.sidebar-footer{margin-top:18px;padding:14px 12px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);font-size:12px;line-height:1.7;color:var(--muted)}
.content-shell{flex:1;min-width:0;padding:20px}
header{padding:22px 24px 18px;background:linear-gradient(135deg,rgba(78,115,184,.92),rgba(22,34,64,.95));border:1px solid rgba(255,255,255,.08);border-radius:22px;box-shadow:var(--shadow);margin-bottom:18px}
header h2{font-size:22px;font-weight:700}
header p{margin-top:6px;font-size:13px;color:rgba(237,243,255,.72)}
main{max-width:1180px}
.tab{display:none}
.tab.active{display:block}
.hero{display:grid;grid-template-columns:1.35fr .9fr;gap:16px;margin-bottom:16px}
.panel,.section{background:rgba(18,26,48,.92);border:1px solid rgba(255,255,255,.06);border-radius:18px;box-shadow:var(--shadow)}
.panel{padding:18px}
.section{padding:18px;margin-bottom:16px}
.panel h2,.section h2{font-size:18px;margin-bottom:8px}
.panel h3,.section h3{font-size:15px;margin-bottom:12px;color:var(--blue)}
.muted{color:var(--muted)}
.subtle{font-size:13px;color:var(--muted)}
.status-line{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px}
.badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}
.dot{width:8px;height:8px;border-radius:50%}
.dot.on{background:var(--green)}
.dot.off{background:var(--red)}
.dot.wait{background:var(--yellow)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.metric{padding:16px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.05)}
.metric .label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.metric .value{font-size:26px;font-weight:700;margin-top:10px}
.metric .hint{margin-top:10px;font-size:13px;color:var(--muted);line-height:1.6}
.quick-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.btn{padding:10px 16px;border:none;border-radius:12px;cursor:pointer;font-size:14px;color:#fff;transition:.2s}
.btn:hover{transform:translateY(-1px)}
.btn-primary{background:linear-gradient(135deg,#4e86ff,#3561d8)}
.btn-secondary{background:rgba(255,255,255,.08);color:var(--text);border:1px solid rgba(255,255,255,.08)}
.btn-green{background:linear-gradient(135deg,#49d7a5,#1ea97d);color:#071610}
.btn-danger{background:linear-gradient(135deg,#ff6b6b,#df4d4d)}
.btn-sm{padding:7px 12px;font-size:12px;border-radius:10px}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:16px}
.task-card{padding:16px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.task-card .meta{margin-top:10px;font-size:13px;color:var(--muted);line-height:1.8}
.mini-log{background:rgba(8,12,24,.9);border-radius:14px;padding:14px;min-height:220px;max-height:360px;overflow-y:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.8;border:1px solid rgba(255,255,255,.05)}
.mini-log .cat{color:var(--blue)}
.mini-log .time{color:var(--muted)}
.table-shell{overflow:auto;border:1px solid rgba(255,255,255,.05);border-radius:16px;background:rgba(8,12,24,.76)}
.table{width:100%;border-collapse:collapse;min-width:860px}
.table th,.table td{padding:12px 14px;text-align:left;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px}
.table th{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;background:rgba(255,255,255,.02)}
.table tbody tr:hover{background:rgba(255,255,255,.03)}
.table td strong{font-size:14px}
.table-meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px}
.table-meta .badge{background:rgba(255,255,255,.03)}
.pill{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;font-size:12px;border:1px solid rgba(255,255,255,.08)}
.pill.on{color:var(--green);background:rgba(73,215,165,.09)}
.pill.off{color:var(--muted);background:rgba(255,255,255,.04)}
.loading{padding:22px 14px;color:var(--muted);text-align:center}
.steps{display:flex;flex-direction:column;gap:16px}
.step{padding:16px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.step-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
.step-index{width:34px;height:34px;border-radius:12px;background:rgba(103,183,255,.18);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--blue)}
.step-title{display:flex;gap:12px}
.step-title h3{margin:0;font-size:16px}
.step-title p{margin-top:4px;font-size:13px;color:var(--muted);line-height:1.6}
.step-state{font-size:12px;color:var(--muted);padding-top:4px;white-space:nowrap}
label{display:block;margin:12px 0 6px;font-size:13px;color:var(--muted)}
input,textarea,select{width:100%;padding:10px 12px;background:#0d1528;border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px}
textarea{resize:vertical;min-height:90px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.field-row{display:grid;grid-template-columns:1fr 180px;gap:10px}
.hint{margin-top:8px;font-size:12px;color:var(--muted);line-height:1.6}
.row{display:flex;gap:8px;align-items:center;margin:6px 0}
.row input{flex:1}
.rooms{margin-top:10px}
.check{display:flex;align-items:center;gap:8px}
.check input{width:auto}
.fans-list{max-height:320px;overflow-y:auto;margin:10px 0;border:1px solid rgba(255,255,255,.05);border-radius:14px;background:rgba(8,12,24,.72)}
.fan-item{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer}
.fan-item:last-child{border-bottom:none}
.fan-item:hover{background:rgba(255,255,255,.04)}
.fan-item input{width:auto}
.fan-item .fan-info{flex:1;font-size:13px}
.fan-item .fan-level{color:var(--blue);font-size:12px}
.fan-item .fan-intimacy{color:var(--muted);font-size:12px}
.toolbar{display:flex;gap:10px;margin-bottom:12px;align-items:center;flex-wrap:wrap}
.log-box{background:rgba(8,12,24,.94);border-radius:14px;padding:14px;height:62vh;overflow-y:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.8;border:1px solid rgba(255,255,255,.05)}
.empty{padding:24px 12px;color:var(--muted);text-align:center}
.toast{position:fixed;top:20px;right:20px;padding:12px 18px;border-radius:10px;color:#fff;font-size:13px;z-index:99;display:none;max-width:420px;box-shadow:var(--shadow)}
</style>
</head>
<body>
<div class="app-shell">
  <aside class="sidebar">
    <div class="brand">
      <h1>斗鱼粉丝牌续牌</h1>
      <p>Docker WebUI<br>桌面端固定侧边导航</p>
    </div>
    <nav>
      <button class="active" onclick="switchTab('overview', this)">概况</button>
      <button onclick="switchTab('fans-status', this)">粉丝牌状态</button>
      <button onclick="switchTab('config', this)">配置</button>
      <button onclick="switchTab('logs', this)">日志</button>
    </nav>
    <div class="sidebar-footer">
      当前界面按桌面端优先设计。
      <br>
      移动端导航暂不在本次实现范围内。
    </div>
  </aside>

  <div class="content-shell">
    <header>
      <h2>Docker 管理面板</h2>
      <p>状态优先的概况页，独立的粉丝牌状态页面，以及拆分后的 Cookie / 任务配置保存流程。</p>
    </header>

    <main>
  <section id="overview" class="tab active">
    <div class="hero">
      <div class="panel">
        <h2>系统概况</h2>
        <div class="subtle">优先展示当前是否可运行、任务是否已配置、以及最近的运行信号。</div>
        <div class="status-line" id="overview-badges"></div>
        <div class="quick-actions">
          <button class="btn btn-primary" onclick="switchTab('config', document.querySelectorAll('nav button')[2])">前往配置</button>
          <button class="btn btn-secondary" onclick="loadOverview()">刷新概况</button>
          <button class="btn btn-secondary" id="trigger-keepalive-btn" onclick="trigger('keepalive')">手动执行保活</button>
          <button class="btn btn-secondary" id="trigger-double-btn" onclick="trigger('doubleCard')">手动执行双倍卡</button>
        </div>
      </div>
      <div class="panel">
        <h2>当前状态</h2>
        <div class="grid">
          <div class="metric">
            <div class="label">系统可运行</div>
            <div class="value" id="metric-ready">-</div>
            <div class="hint" id="metric-ready-hint">加载中...</div>
          </div>
          <div class="metric">
            <div class="label">Cookie</div>
            <div class="value" id="metric-cookie">-</div>
            <div class="hint" id="metric-cookie-hint">加载中...</div>
          </div>
          <div class="metric">
            <div class="label">任务配置</div>
            <div class="value" id="metric-tasks">-</div>
            <div class="hint" id="metric-tasks-hint">加载中...</div>
          </div>
        </div>
      </div>
    </div>

    <div class="cards">
      <div class="task-card">
        <h3>保活任务</h3>
        <div class="status-line" id="keepalive-badge"></div>
        <div class="meta" id="keepalive-meta">加载中...</div>
      </div>
      <div class="task-card">
        <h3>双倍卡任务</h3>
        <div class="status-line" id="double-badge"></div>
        <div class="meta" id="double-meta">加载中...</div>
      </div>
    </div>

    <div class="panel">
      <h2>最近日志</h2>
      <div class="mini-log" id="overview-logs"></div>
    </div>
  </section>

  <section id="fans-status" class="tab">
    <div class="section">
      <h2>粉丝牌状态</h2>
      <div class="subtle">参考桌面端列表视图，自动展示粉丝牌基础信息，并补充每个房间当前是否开启双倍。</div>
      <div class="quick-actions" style="margin-top:12px">
        <button class="btn btn-secondary" onclick="loadFanStatusPage(true)">刷新粉丝牌状态</button>
      </div>
      <div class="table-meta" id="fans-status-meta"></div>
    </div>
    <div class="section">
      <div class="table-shell">
        <div id="fans-status-loading" class="loading" style="display:none">正在加载粉丝牌状态...</div>
        <div id="fans-status-empty" class="empty" style="display:none"></div>
        <table id="fans-status-table" class="table" style="display:none">
          <thead>
            <tr>
              <th>序号</th>
              <th>主播名称</th>
              <th>房间号</th>
              <th>粉丝牌等级</th>
              <th>粉丝牌排名</th>
              <th>今日亲密度</th>
              <th>亲密度</th>
              <th>倍数</th>
            </tr>
          </thead>
          <tbody id="fans-status-body"></tbody>
        </table>
      </div>
    </div>
  </section>

  <section id="config" class="tab">
    <div class="section">
      <h2>配置流程</h2>
      <div class="subtle">先保存 Cookie，再配置任务。任务设置仍然使用一个统一保存动作，避免过度碎片化。</div>
    </div>

    <div class="steps">
      <div class="step">
        <div class="step-head">
          <div class="step-title">
            <div class="step-index">01</div>
            <div>
              <h3>保存 Cookie</h3>
              <p>Cookie 单独保存，不再要求保活 / 双倍卡任务同时填写完整。</p>
            </div>
          </div>
          <div class="step-state" id="cookie-step-state">未检测</div>
        </div>
        <label for="cookie">斗鱼 Cookie</label>
        <textarea id="cookie" placeholder="粘贴斗鱼 Cookie..."></textarea>
        <div class="hint">保存后即可单独验证 Cookie，并支持获取粉丝牌列表。</div>
        <div class="quick-actions" style="margin-top:12px">
          <button class="btn btn-green" onclick="saveCookie()">保存 Cookie</button>
        </div>
      </div>

      <div class="step">
        <div class="step-head">
          <div class="step-title">
            <div class="step-index">02</div>
            <div>
              <h3>配置保活任务</h3>
              <p>设置保活 cron、分配模式和房间列表。保活任务仍然支持粉丝牌列表自动导入。</p>
            </div>
          </div>
          <div class="step-state" id="ka-step-state">未配置</div>
        </div>
        <div class="check">
          <input type="checkbox" id="ka-enable" checked>
          <label for="ka-enable" style="margin:0">启用保活任务</label>
        </div>
        <div id="ka-fields">
          <label for="ka-cron">Cron 表达式</label>
          <input id="ka-cron" value="0 0 8 * * *" placeholder="秒 分 时 日 月 周">
          <div class="field-row">
            <div>
              <label for="ka-model">分配模式</label>
              <select id="ka-model">
                <option value="1">按百分比</option>
                <option value="2">按固定数量</option>
              </select>
            </div>
            <div>
              <label>辅助说明</label>
              <div class="hint" style="margin-top:10px">按百分比时总和应为 100；按固定数量时可手动调整每个房间数量。</div>
            </div>
          </div>
          <label>房间列表</label>
          <div id="ka-rooms" class="rooms"></div>
          <div class="quick-actions" style="margin-top:12px">
            <button class="btn btn-sm btn-secondary" onclick="addRoom('ka')">+ 添加房间</button>
          </div>
        </div>
      </div>

      <div class="step">
        <div class="step-head">
          <div class="step-title">
            <div class="step-index">03</div>
            <div>
              <h3>配置双倍卡任务</h3>
              <p>设置双倍卡检测 cron 和房间列表。只有检测到双倍卡生效时才会分配荧光棒。</p>
            </div>
          </div>
          <div class="step-state" id="dc-step-state">未配置</div>
        </div>
        <div class="check">
          <input type="checkbox" id="dc-enable">
          <label for="dc-enable" style="margin:0">启用双倍卡检测</label>
        </div>
        <div id="dc-fields" style="display:none">
          <label for="dc-cron">Cron 表达式</label>
          <input id="dc-cron" value="0 0 */4 * * *" placeholder="秒 分 时 日 月 周">
          <label for="dc-model">分配模式</label>
          <select id="dc-model">
            <option value="1">按百分比</option>
            <option value="2">按固定数量</option>
          </select>
          <label>房间列表</label>
          <div id="dc-rooms" class="rooms"></div>
          <div class="quick-actions" style="margin-top:12px">
            <button class="btn btn-sm btn-secondary" onclick="addRoom('dc')">+ 添加房间</button>
          </div>
        </div>
      </div>

      <div class="step">
        <div class="step-head">
          <div class="step-title">
            <div class="step-index">04</div>
            <div>
              <h3>粉丝牌辅助导入</h3>
              <p>先获取粉丝牌列表，再勾选需要同步到保活任务的房间。</p>
            </div>
          </div>
          <div class="step-state">Keepalive Only</div>
        </div>
        <div class="quick-actions" style="margin-top:0">
          <button class="btn btn-primary" onclick="fetchFans()" id="fetch-fans-btn">获取粉丝牌列表</button>
          <button class="btn btn-secondary" onclick="applySelectedFans()" id="apply-fans-btn" style="display:none">应用选中的房间到保活任务</button>
        </div>
        <div class="fans-list" id="fans-list" style="display:none"></div>
      </div>
    </div>

    <div class="section">
      <h2>保存任务配置</h2>
      <div class="subtle">该操作会统一保存保活 / 双倍卡设置，并根据当前 Cookie 与任务启用情况更新运行状态。</div>
      <div class="quick-actions" style="margin-top:12px">
        <button class="btn btn-green" onclick="saveTasks()">保存任务配置</button>
      </div>
    </div>
  </section>

  <section id="logs" class="tab">
    <div class="section">
      <h2>运行日志</h2>
      <div class="toolbar">
        <div class="check">
          <input type="checkbox" id="auto-refresh" checked>
          <label for="auto-refresh" style="margin:0">自动刷新</label>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="loadLogs()">手动刷新</button>
        <button class="btn btn-sm btn-danger" onclick="clearLogs()">清空日志</button>
      </div>
      <div class="log-box" id="log-box"></div>
    </div>
  </section>
    </main>
  </div>
</div>

<div class="toast" id="toast"></div>
<script>
const state={fansData:[],overview:null,fansStatus:[],fansStatusLoaded:false,fansStatusLoading:false,fansStatusLastLoadedAt:null};

function escapeHtml(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function switchTab(name,button){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  if(button)button.classList.add('active');
  if(name==='overview')loadOverview();
  if(name==='fans-status')loadFanStatusPage(true);
  if(name==='logs')loadLogs();
}

function toast(msg,ok){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.style.background=ok?'linear-gradient(135deg,#49d7a5,#1ea97d)':'linear-gradient(135deg,#ff6b6b,#df4d4d)';
  t.style.display='block';
  setTimeout(()=>t.style.display='none',3000);
}

function formatDate(value){
  if(!value)return '无';
  return String(value).replace('T',' ').substring(0,19);
}

function renderBadges(items,targetId){
  const target=document.getElementById(targetId);
  target.innerHTML=items.map(item=>{
    return '<span class="badge"><span class="dot '+item.dot+'"></span>'+escapeHtml(item.label)+'</span>';
  }).join('');
}

function renderLogs(logs,targetId,scrollToBottom){
  const box=document.getElementById(targetId);
  if(!logs.length){
    box.innerHTML='<div class="empty">暂无日志</div>';
    return;
  }
  box.innerHTML=logs.map(l=>{
    return '<div><span class="time">'+escapeHtml(formatDate(l.timestamp))+'</span> <span class="cat">['+escapeHtml(l.category)+']</span> '+escapeHtml(l.message)+'</div>';
  }).join('');
  if(scrollToBottom)box.scrollTop=box.scrollHeight;
}

function renderFanStatusMeta(){
  const target=document.getElementById('fans-status-meta');
  const activeCount=state.fansStatus.filter(item=>item.doubleActive).length;
  const lastLoaded=state.fansStatusLastLoadedAt?formatDate(state.fansStatusLastLoadedAt):'未加载';
  target.innerHTML=[
    '<span class="badge"><span class="dot '+(state.fansStatusLoaded?'on':'wait')+'"></span>粉丝牌总数 '+state.fansStatus.length+'</span>',
    '<span class="badge"><span class="dot '+(activeCount>0?'on':'off')+'"></span>双倍开启 '+activeCount+'</span>',
    '<span class="badge"><span class="dot wait"></span>最近刷新 '+escapeHtml(lastLoaded)+'</span>',
  ].join('');
}

function setFanStatusView(options){
  const loading=document.getElementById('fans-status-loading');
  const empty=document.getElementById('fans-status-empty');
  const table=document.getElementById('fans-status-table');
  loading.style.display=options.loading?'':'none';
  empty.style.display=options.empty?'':'none';
  table.style.display=options.table?'':'none';
  if(options.message!==undefined){
    empty.textContent=options.message;
  }
}

function renderFanStatusTable(items){
  const body=document.getElementById('fans-status-body');
  body.innerHTML=items.map((item,index)=>{
    const pillClass=item.doubleActive?'pill on':'pill off';
    const pillLabel=item.doubleActive?'2x':'-';
    const title=item.doubleActive && item.doubleExpireTime ? ' title="有效期至 '+escapeHtml(formatDate(new Date(item.doubleExpireTime * 1000).toISOString()))+'"' : '';
    return '<tr>'
      +'<td>'+(index + 1)+'</td>'
      +'<td><strong>'+escapeHtml(item.name)+'</strong></td>'
      +'<td>'+escapeHtml(item.roomId)+'</td>'
      +'<td>'+escapeHtml(item.level)+'</td>'
      +'<td>'+escapeHtml(item.rank)+'</td>'
      +'<td>'+escapeHtml(item.today)+'</td>'
      +'<td>'+escapeHtml(item.intimacy)+'</td>'
      +'<td><span class="'+pillClass+'"'+title+'>'+pillLabel+'</span></td>'
      +'</tr>';
  }).join('');
}

function roomHtml(prefix,room){
  const model=+document.getElementById(prefix+'-model').value;
  const value=model===1?(room?.percentage ?? 100):(room?.number ?? 1);
  const roomId=room?.roomId ?? '';
  return '<div class="row room-row">'
    +'<input type="number" placeholder="房间号" value="'+escapeHtml(roomId)+'" class="room-id">'
    +'<input type="number" placeholder="'+(model===1?'百分比':'数量')+'" value="'+escapeHtml(value)+'" class="room-val" style="max-width:140px">'
    +'<button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">删除</button>'
    +'</div>';
}

function addRoom(prefix,room){
  document.getElementById(prefix+'-rooms').insertAdjacentHTML('beforeend',roomHtml(prefix,room));
}

function clearRooms(prefix){
  document.getElementById(prefix+'-rooms').innerHTML='';
}

function collectRooms(prefix){
  const send={};
  const model=+document.getElementById(prefix+'-model').value;
  document.querySelectorAll('#'+prefix+'-rooms .room-row').forEach(row=>{
    const id=row.querySelector('.room-id').value.trim();
    const rawVal=row.querySelector('.room-val').value;
    const val=Number(rawVal);
    if(!id)return;
    send[id]={
      roomId:+id,
      giftId:268,
      number:model===2?val:0,
      percentage:model===1?val:0,
    };
  });
  return send;
}

function buildTaskConfig(prefix){
  if(!document.getElementById(prefix+'-enable').checked)return null;
  return {
    cron:document.getElementById(prefix+'-cron').value.trim(),
    model:+document.getElementById(prefix+'-model').value,
    send:collectRooms(prefix),
    time:'跟随执行模式',
    timeValue:[0,1,2,3,4,5,6],
  };
}

function updateSectionVisibility(){
  document.getElementById('ka-fields').style.display=document.getElementById('ka-enable').checked?'':'none';
  document.getElementById('dc-fields').style.display=document.getElementById('dc-enable').checked?'':'none';
}

function updateConfigStepState(overview){
  document.getElementById('cookie-step-state').textContent=overview?.cookieSaved?'已保存':'未保存';
  document.getElementById('ka-step-state').textContent=overview?.keepaliveConfigured?'已配置':'未配置';
  document.getElementById('dc-step-state').textContent=overview?.doubleCardConfigured?'已配置':'未配置';
}

async function loadOverview(){
  try{
    const response=await fetch('/api/overview');
    const data=await response.json();
    state.overview=data;

    document.getElementById('metric-ready').textContent=data.ready?'Ready':'Pending';
    document.getElementById('metric-ready-hint').textContent=data.ready?'Cookie 与任务配置已就绪':'仍有关键配置未完成';
    document.getElementById('metric-cookie').textContent=data.cookieSaved?'Saved':'Missing';
    document.getElementById('metric-cookie-hint').textContent=data.cookieSaved?'Cookie 已保存，可用于请求斗鱼接口':'请先在配置页保存 Cookie';
    const configuredCount=(data.keepaliveConfigured?1:0)+(data.doubleCardConfigured?1:0);
    document.getElementById('metric-tasks').textContent=String(configuredCount);
    document.getElementById('metric-tasks-hint').textContent=configuredCount>0?'已配置 '+configuredCount+' 个任务类型':'尚未配置任何任务';

    renderBadges([
      {label:data.cookieSaved?'Cookie 已保存':'Cookie 未保存',dot:data.cookieSaved?'on':'off'},
      {label:data.keepaliveConfigured?'保活已配置':'保活未配置',dot:data.keepaliveConfigured?'on':'wait'},
      {label:data.doubleCardConfigured?'双倍卡已配置':'双倍卡未配置',dot:data.doubleCardConfigured?'on':'wait'},
      {label:data.ready?'系统可运行':'待完成配置',dot:data.ready?'on':'wait'},
    ],'overview-badges');

    renderBadges([
      {label:data.status.keepalive.running?'运行中':'未运行',dot:data.status.keepalive.running?'on':(data.keepaliveConfigured?'wait':'off')},
    ],'keepalive-badge');
    document.getElementById('keepalive-meta').innerHTML=
      '配置状态: '+(data.keepaliveConfigured?'已配置':'未配置')+'<br>'
      +'房间数: '+data.keepaliveRooms+'<br>'
      +'上次执行: '+escapeHtml(formatDate(data.status.keepalive.lastRun))+'<br>'
      +'下次执行: '+escapeHtml(formatDate(data.status.keepalive.nextRun));

    renderBadges([
      {label:data.status.doubleCard.running?'运行中':'未运行',dot:data.status.doubleCard.running?'on':(data.doubleCardConfigured?'wait':'off')},
    ],'double-badge');
    document.getElementById('double-meta').innerHTML=
      '配置状态: '+(data.doubleCardConfigured?'已配置':'未配置')+'<br>'
      +'房间数: '+data.doubleCardRooms+'<br>'
      +'上次执行: '+escapeHtml(formatDate(data.status.doubleCard.lastRun))+'<br>'
      +'下次执行: '+escapeHtml(formatDate(data.status.doubleCard.nextRun));

    document.getElementById('trigger-keepalive-btn').disabled=!data.cookieSaved || !data.keepaliveConfigured;
    document.getElementById('trigger-double-btn').disabled=!data.cookieSaved || !data.doubleCardConfigured;

    updateConfigStepState(data);
    renderLogs(data.recentLogs || [],'overview-logs',false);
  }catch(error){
    toast('加载概况失败: '+error.message,false);
  }
}

async function loadFanStatusPage(force=false){
  if(state.fansStatusLoading){
    return;
  }
  if(state.fansStatusLoaded && !force){
    renderFanStatusMeta();
    return;
  }

  state.fansStatusLoading=true;
  setFanStatusView({loading:true,empty:false,table:false});

  try{
    const response=await fetch('/api/fans/status');
    const data=await response.json();
    if(!response.ok)throw new Error(data.error || '加载失败');
    state.fansStatus=data;
    state.fansStatusLoaded=true;
    state.fansStatusLastLoadedAt=new Date().toISOString();
    renderFanStatusMeta();
    if(!state.fansStatus.length){
      setFanStatusView({loading:false,empty:true,table:false,message:'当前没有可展示的粉丝牌数据'});
      return;
    }
    renderFanStatusTable(state.fansStatus);
    setFanStatusView({loading:false,empty:false,table:true});
  }catch(error){
    state.fansStatusLoaded=false;
    renderFanStatusMeta();
    setFanStatusView({loading:false,empty:true,table:false,message:error.message});
  }finally{
    state.fansStatusLoading=false;
  }
}

async function loadConfig(){
  clearRooms('ka');
  clearRooms('dc');
  updateSectionVisibility();
  try{
    const response=await fetch('/api/config/raw');
    const data=await response.json();
    if(!data.exists)return;
    const config=data.data;
    document.getElementById('cookie').value=config.cookie || '';

    document.getElementById('ka-enable').checked=Boolean(config.keepalive);
    document.getElementById('dc-enable').checked=Boolean(config.doubleCard);
    updateSectionVisibility();

    if(config.keepalive){
      document.getElementById('ka-cron').value=config.keepalive.cron || '0 0 8 * * *';
      document.getElementById('ka-model').value=String(config.keepalive.model || 1);
      Object.values(config.keepalive.send || {}).forEach(room=>addRoom('ka',room));
    }

    if(config.doubleCard){
      document.getElementById('dc-cron').value=config.doubleCard.cron || '0 0 */4 * * *';
      document.getElementById('dc-model').value=String(config.doubleCard.model || 1);
      Object.values(config.doubleCard.send || {}).forEach(room=>addRoom('dc',room));
    }

    if(!config.keepalive && !config.doubleCard){
      clearRooms('ka');
      clearRooms('dc');
    }
  }catch(error){
    toast('加载配置失败: '+error.message,false);
  }
}

async function saveCookie(){
  const cookie=document.getElementById('cookie').value.trim();
  if(!cookie){
    toast('请先填写 Cookie',false);
    return;
  }
  try{
    const response=await fetch('/api/cookie',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({cookie}),
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data.error || '保存失败');
    toast('Cookie 已保存',true);
    await loadOverview();
    if(document.getElementById('fans-status').classList.contains('active')){
      await loadFanStatusPage(true);
    }
  }catch(error){
    toast('保存 Cookie 失败: '+error.message,false);
  }
}

async function saveTasks(){
  const payload={};
  const keepalive=buildTaskConfig('ka');
  const doubleCard=buildTaskConfig('dc');
  if(keepalive)payload.keepalive=keepalive;
  if(doubleCard)payload.doubleCard=doubleCard;

  try{
    const response=await fetch('/api/config',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data.error || '保存失败');
    toast('任务配置已保存',true);
    await loadOverview();
  }catch(error){
    toast('保存任务配置失败: '+error.message,false);
  }
}

async function loadLogs(){
  try{
    const response=await fetch('/api/logs');
    const logs=await response.json();
    renderLogs(logs,'log-box',true);
  }catch(error){
    toast('加载日志失败: '+error.message,false);
  }
}

async function clearLogs(){
  await fetch('/api/logs',{method:'DELETE'});
  loadLogs();
  loadOverview();
}

async function trigger(type){
  toast('正在执行...',true);
  try{
    const response=await fetch('/api/trigger/'+type,{method:'POST'});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error || '执行失败');
    toast('执行完成',true);
    await loadOverview();
    if(document.getElementById('logs').classList.contains('active'))await loadLogs();
    if(document.getElementById('fans-status').classList.contains('active'))await loadFanStatusPage(true);
  }catch(error){
    toast('执行失败: '+error.message,false);
  }
}

async function fetchFans(){
  const button=document.getElementById('fetch-fans-btn');
  button.disabled=true;
  button.textContent='获取中...';
  try{
    const response=await fetch('/api/fans');
    const data=await response.json();
    if(!response.ok)throw new Error(data.error || '获取失败');
    state.fansData=data;
    const list=document.getElementById('fans-list');
    list.style.display='';
    document.getElementById('apply-fans-btn').style.display='';
    list.innerHTML=state.fansData.map((fan,index)=>{
      return '<label class="fan-item"><input type="checkbox" value="'+index+'" checked>'
        +'<span class="fan-info">'+escapeHtml(fan.name)+' (房间: '+escapeHtml(fan.roomId)+')</span>'
        +'<span class="fan-level">Lv.'+escapeHtml(fan.level)+'</span>'
        +'<span class="fan-intimacy">亲密度: '+escapeHtml(fan.intimacy)+' | 今日: '+escapeHtml(fan.today)+'</span></label>';
    }).join('');
    toast('获取到 '+state.fansData.length+' 个粉丝牌',true);
  }catch(error){
    toast('获取粉丝牌失败: '+error.message,false);
  }
  button.disabled=false;
  button.textContent='获取粉丝牌列表';
}

function distributePercentages(count){
  if(count<=0)return [];
  const base=Math.floor(100/count);
  const result=new Array(count).fill(base);
  let remainder=100-base*count;
  let index=result.length-1;
  while(remainder>0){
    result[index]+=1;
    remainder--;
    index=index===0?result.length-1:index-1;
  }
  return result;
}

function applySelectedFans(){
  const checked=Array.from(document.querySelectorAll('#fans-list input:checked'));
  clearRooms('ka');
  if(!checked.length){
    toast('请先选择至少一个粉丝牌',false);
    return;
  }

  const model=+document.getElementById('ka-model').value;
  const percentages=distributePercentages(checked.length);
  checked.forEach((item,index)=>{
    const fan=state.fansData[+item.value];
    addRoom('ka',{
      roomId:fan.roomId,
      percentage:model===1?percentages[index]:0,
      number:model===2?1:0,
    });
  });
  toast('已应用 '+checked.length+' 个房间到保活任务',true);
}

document.getElementById('ka-enable').onchange=updateSectionVisibility;
document.getElementById('dc-enable').onchange=updateSectionVisibility;
document.getElementById('ka-model').onchange=()=>{const rooms=[...document.querySelectorAll('#ka-rooms .room-row')];if(rooms.length){const cached=rooms.map(row=>({roomId:row.querySelector('.room-id').value.trim(),number:Number(row.querySelector('.room-val').value),percentage:Number(row.querySelector('.room-val').value)}));clearRooms('ka');cached.forEach(room=>addRoom('ka',room));}};
document.getElementById('dc-model').onchange=()=>{const rooms=[...document.querySelectorAll('#dc-rooms .room-row')];if(rooms.length){const cached=rooms.map(row=>({roomId:row.querySelector('.room-id').value.trim(),number:Number(row.querySelector('.room-val').value),percentage:Number(row.querySelector('.room-val').value)}));clearRooms('dc');cached.forEach(room=>addRoom('dc',room));}};

Promise.all([loadOverview(),loadConfig()]);

setInterval(()=>{
  if(document.getElementById('overview').classList.contains('active'))loadOverview();
  if(document.getElementById('auto-refresh') && document.getElementById('auto-refresh').checked && document.getElementById('logs').classList.contains('active'))loadLogs();
},5000);
</script>
</body></html>`
}
