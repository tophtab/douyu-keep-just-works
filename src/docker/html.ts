export function getHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>斗鱼粉丝牌续牌</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231967d2'/%3E%3Cpath d='M18 18h28v28H18z' fill='white' opacity='.15'/%3E%3Cpath d='M24 24h16c4.4 0 8 3.6 8 8s-3.6 8-8 8h-4v8h-8V24zm8 8v8h8c2.2 0 4-1.8 4-4s-1.8-4-4-4h-8z' fill='white'/%3E%3C/svg%3E">
<style>
:root{
  --bg:#f4ede4;
  --bg-alt:#edf4fb;
  --surface:rgba(255,255,255,.76);
  --surface-strong:rgba(255,255,255,.9);
  --surface-soft:rgba(255,248,240,.72);
  --line:rgba(91,111,145,.16);
  --line-strong:rgba(72,93,129,.28);
  --text:#182338;
  --muted:#5f6f86;
  --accent:#d86a18;
  --accent-2:#f19a2a;
  --accent-soft:rgba(216,106,24,.12);
  --accent-gradient:linear-gradient(135deg,#d86a18 0%,#f19a2a 100%);
  --success:#16825d;
  --danger:#c33b35;
  --warning:#b7791f;
  --shadow:0 24px 60px rgba(25,40,68,.12);
  --btn-shadow:0 14px 30px rgba(216,106,24,.2);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;min-height:100%}
body{
  font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  color:var(--text);
  background:
    radial-gradient(circle at top left, rgba(216,106,24,.16), transparent 28%),
    radial-gradient(circle at top right, rgba(241,154,42,.14), transparent 24%),
    linear-gradient(180deg, var(--bg) 0%, var(--bg-alt) 52%, #edf3fb 100%);
}
body::before{
  content:"";
  position:fixed;
  inset:0;
  pointer-events:none;
  background:linear-gradient(180deg, rgba(255,255,255,.28), transparent 18%, transparent 82%, rgba(255,255,255,.12));
}
body[data-theme="dark"]{
  --bg:#000;
  --bg-alt:#000;
  --surface:rgba(10,10,10,.92);
  --surface-strong:rgba(4,4,4,.98);
  --surface-soft:rgba(28,17,10,.92);
  --line:rgba(255,135,77,.16);
  --line-strong:rgba(255,135,77,.28);
  --text:#edf7ff;
  --muted:#c7a38d;
  --accent:#FF874D;
  --accent-2:#c75b1e;
  --accent-soft:rgba(255,135,77,.18);
  --accent-gradient:linear-gradient(135deg,#FF874D 0%,#c75b1e 100%);
  --success:#27b27f;
  --danger:#ff6b6b;
  --warning:#f8b84c;
  --shadow:0 30px 70px rgba(0,0,0,.58);
  --btn-shadow:0 18px 34px rgba(0,0,0,.38);
  background:
    radial-gradient(circle at top left, rgba(255,135,77,.14), transparent 24%),
    radial-gradient(circle at top right, rgba(199,91,30,.14), transparent 20%),
    linear-gradient(180deg, #000 0%, #000 100%);
}
body[data-theme="dark"]::before{
  background:linear-gradient(180deg, rgba(255,255,255,.02), transparent 18%, transparent 84%, rgba(255,135,77,.06));
}
.auth-shell{
  position:relative;
  z-index:1;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:28px;
}
.auth-card{
  width:min(960px,100%);
  display:grid;
  grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);
  gap:18px;
}
.auth-panel{
  padding:28px;
  border-radius:28px;
  border:1px solid var(--line);
  background:var(--surface);
  backdrop-filter:blur(18px);
  box-shadow:var(--shadow);
}
.auth-hero{
  position:relative;
  overflow:hidden;
}
.auth-hero::after{
  content:"";
  position:absolute;
  right:-60px;
  bottom:-80px;
  width:240px;
  height:240px;
  border-radius:50%;
  background:radial-gradient(circle, rgba(216,106,24,.22), transparent 68%);
}
.auth-title{
  margin:10px 0 12px;
  font-size:34px;
  line-height:1.15;
}
.auth-copy{
  max-width:30rem;
  color:var(--muted);
  font-size:14px;
  line-height:1.9;
}
.auth-list{
  margin:22px 0 0;
  padding:0;
  list-style:none;
  display:grid;
  gap:10px;
}
.auth-list li{
  padding:12px 14px;
  border:1px solid var(--line);
  border-radius:18px;
  background:var(--surface-soft);
  font-size:13px;
  line-height:1.7;
}
.auth-form-title{
  margin:10px 0 8px;
  font-size:24px;
}
.auth-error{
  display:none;
  margin-top:10px;
  padding:10px 12px;
  border-radius:14px;
  background:rgba(195,59,53,.14);
  border:1px solid rgba(195,59,53,.22);
  color:var(--danger);
  font-size:13px;
  line-height:1.6;
}
.auth-hint{
  margin-top:10px;
  color:var(--muted);
  font-size:12px;
  line-height:1.7;
}
.auth-actions{
  margin-top:18px;
}
.shell{
  position:relative;
  z-index:1;
  min-height:100vh;
  display:flex;
}
.sidebar{
  width:292px;
  flex:0 0 292px;
  padding:24px 20px;
  border-right:1px solid var(--line);
  background:var(--surface);
  backdrop-filter:blur(18px);
}
.brand-title{
  margin:0 0 10px;
  font-size:26px;
  font-weight:800;
  letter-spacing:.02em;
}
.brand-copy{
  margin:0 0 22px;
  color:var(--muted);
  font-size:13px;
  line-height:1.75;
}
.tab-list{
  display:flex;
  flex-direction:column;
  gap:8px;
}
.tab-btn{
  width:100%;
  border:1px solid transparent;
  background:transparent;
  color:inherit;
  text-align:left;
  padding:13px 15px;
  border-radius:18px;
  cursor:pointer;
  font:inherit;
  font-weight:600;
  transition:transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.tab-btn:hover{
  transform:translateX(3px);
  background:rgba(255,255,255,.28);
  border-color:var(--line-strong);
}
.tab-btn.active{
  background:var(--accent-gradient);
  color:#fff;
  border-color:transparent;
  box-shadow:var(--btn-shadow);
}
.theme-box{
  margin-top:22px;
  padding:16px;
  border:1px solid var(--line);
  border-radius:20px;
  background:var(--surface-strong);
  box-shadow:var(--shadow);
}
.theme-note{
  margin-top:8px;
  color:var(--muted);
  font-size:12px;
  line-height:1.7;
}
.main{
  flex:1;
  min-width:0;
  padding:24px;
}
.header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:16px;
  margin-bottom:18px;
}
.page-title{
  margin:0;
  font-size:30px;
  font-weight:800;
  letter-spacing:.01em;
}
.page-subtitle{
  margin:8px 0 0;
  color:var(--muted);
  font-size:13px;
  line-height:1.75;
}
.toolbar{
  display:flex;
  gap:10px;
}
.page{display:none}
.page.active{display:block}
.grid{
  display:grid;
  gap:16px;
}
.grid.cols-3{
  grid-template-columns:repeat(3,minmax(0,1fr));
}
.grid.cols-2{
  grid-template-columns:repeat(2,minmax(0,1fr));
}
.panel,
.table-shell,
.log-box,
.empty,
.status-box{
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:24px;
  backdrop-filter:blur(18px);
  box-shadow:var(--shadow);
}
.panel,
.status-box,
.empty{
  padding:18px;
}
.section-kicker{
  font-size:11px;
  font-weight:700;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:var(--muted);
}
.section-title{
  margin:8px 0 6px;
  font-size:22px;
  line-height:1.2;
}
.subtle{
  margin:0;
  color:var(--muted);
  font-size:13px;
  line-height:1.75;
}
.panel-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:14px;
}
.overview-stack{
  display:grid;
  gap:16px;
}
.strip-metrics{
  min-width:280px;
  display:grid;
  gap:12px;
  grid-template-columns:repeat(2,minmax(0,1fr));
}
.strip-metric{
  border:1px solid var(--line);
  border-radius:18px;
  padding:14px;
  background:var(--surface-soft);
}
.mini-label{
  color:var(--muted);
  font-size:12px;
  margin-bottom:6px;
}
.mini-value{
  font-size:16px;
  font-weight:700;
}
.task-grid{
  display:grid;
  gap:16px;
  grid-template-columns:repeat(3,minmax(0,1fr));
}
.task-card{
  padding:18px;
  border-radius:24px;
  background:var(--surface);
  border:1px solid var(--line);
  box-shadow:var(--shadow);
  backdrop-filter:blur(18px);
  display:flex;
  flex-direction:column;
}
.task-card-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
}
.task-card-title{
  margin:0;
  font-size:22px;
}
.task-card-pills{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:12px;
}
.summary-grid{
  margin-top:16px;
  display:grid;
  gap:10px;
  grid-template-columns:repeat(3,minmax(0,1fr));
}
.summary-grid.quad{
  grid-template-columns:repeat(4,minmax(0,1fr));
}
.summary-cell{
  border-top:1px solid var(--line);
  padding-top:10px;
}
.pill{
  display:inline-flex;
  align-items:center;
  min-height:28px;
  padding:4px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:700;
  background:var(--accent-soft);
  color:var(--accent);
}
.pill.warn{
  background:rgba(248,184,76,.16);
  color:var(--warning);
}
.pill.ok{
  background:rgba(39,178,127,.16);
  color:var(--success);
}
.pill.off{
  background:rgba(120,138,160,.14);
  color:var(--muted);
}
.field-block{margin-bottom:16px}
.field-label{
  display:block;
  margin-bottom:6px;
  font-size:12px;
  color:var(--muted);
}
input,textarea,select{
  width:100%;
  border:1px solid var(--line-strong);
  border-radius:16px;
  padding:11px 13px;
  background:var(--surface-strong);
  color:var(--text);
  font:inherit;
  outline:none;
  transition:border-color .18s ease, box-shadow .18s ease, background .18s ease;
}
input:focus,textarea:focus,select:focus{
  border-color:var(--accent);
  box-shadow:0 0 0 4px var(--accent-soft);
}
textarea{
  min-height:150px;
  resize:vertical;
}
.inline{
  display:flex;
  align-items:center;
  gap:8px;
}
.inline input[type="checkbox"]{
  width:auto;
}
.switch-field{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:18px;
  padding:16px 18px;
  border:1px solid var(--line);
  border-radius:22px;
  background:var(--surface-soft);
}
.switch-copy{
  min-width:0;
}
.switch-title{
  font-size:18px;
  font-weight:700;
}
.switch-note{
  margin-top:4px;
  color:var(--muted);
  font-size:13px;
  line-height:1.65;
}
.switch-control{
  position:relative;
  display:inline-flex;
  align-items:center;
}
.switch-input{
  position:absolute;
  opacity:0;
  pointer-events:none;
}
.switch-slider{
  position:relative;
  width:58px;
  height:34px;
  border-radius:999px;
  background:rgba(121,138,160,.28);
  border:1px solid var(--line-strong);
  transition:background .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.switch-slider::after{
  content:"";
  position:absolute;
  top:3px;
  left:3px;
  width:26px;
  height:26px;
  border-radius:50%;
  background:#fff;
  box-shadow:0 6px 16px rgba(0,0,0,.18);
  transition:transform .18s ease;
}
.switch-input:checked + .switch-slider{
  background:var(--accent-gradient);
  border-color:transparent;
  box-shadow:var(--btn-shadow);
}
.switch-input:checked + .switch-slider::after{
  transform:translateX(24px);
}
.helper{
  color:var(--muted);
  font-size:13px;
  line-height:1.7;
}
.label-row{
  display:flex;
  align-items:center;
  gap:8px;
  margin-bottom:6px;
}
.split-inline{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:16px;
}
.split-inline-copy{
  flex:1;
  min-width:0;
}
.split-inline-actions{
  display:flex;
  flex-wrap:wrap;
  justify-content:flex-end;
  gap:10px;
}
.label-row .field-label{
  margin-bottom:0;
}
.help-icon{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:18px;
  height:18px;
  border-radius:999px;
  border:1px solid var(--line-strong);
  background:var(--surface-soft);
  color:var(--accent);
  font-size:12px;
  font-weight:800;
  line-height:1;
  cursor:help;
}
.cron-preview{
  margin-top:8px;
}
.btn{
  border:1px solid transparent;
  border-radius:999px;
  padding:11px 16px;
  cursor:pointer;
  font:inherit;
  font-weight:700;
  transition:transform .18s ease, box-shadow .18s ease, opacity .18s ease, border-color .18s ease;
}
.btn:hover{
  transform:translateY(-1px);
}
.btn:disabled{
  opacity:.55;
  cursor:not-allowed;
  transform:none;
  box-shadow:none;
}
.btn-primary,
.btn-success{
  background:var(--accent-gradient);
  color:#fff;
  box-shadow:var(--btn-shadow);
}
.btn-secondary{
  background:var(--surface-strong);
  color:var(--text);
  border-color:var(--line-strong);
}
.btn-danger{
  background:linear-gradient(135deg,#cc4c45 0%, #ef6d63 100%);
  color:#fff;
  box-shadow:0 14px 30px rgba(204,76,69,.24);
}
.actions{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}
.table-shell{
  overflow:auto;
}
.table{
  width:100%;
  border-collapse:collapse;
  min-width:760px;
}
.table th,
.table td{
  padding:12px;
  border-bottom:1px solid var(--line);
  text-align:left;
  font-size:13px;
}
.table th{
  position:sticky;
  top:0;
  background:var(--surface-strong);
  color:var(--muted);
  font-size:12px;
  z-index:1;
}
.table tbody tr:nth-child(even){
  background:rgba(255,255,255,.04);
}
.table input[type="number"]{
  min-width:96px;
}
.table input[type="checkbox"]{
  width:auto;
  accent-color:var(--accent);
}
.overview-table-note{
  margin-top:8px;
}
.empty{
  color:var(--muted);
  font-size:13px;
  line-height:1.75;
}
.empty-action{
  margin-top:14px;
}
.log-box{
  min-height:260px;
  max-height:62vh;
  overflow:auto;
  padding:16px;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:12px;
  line-height:1.8;
}
.log-line{
  display:flex;
  gap:10px;
  align-items:flex-start;
  margin-bottom:8px;
  padding:8px 10px;
  border:1px solid var(--line);
  border-radius:14px;
  background:var(--surface-soft);
}
.log-stamp{
  color:var(--muted);
  white-space:nowrap;
}
.log-tag{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:42px;
  padding:0 8px;
  border-radius:999px;
  background:var(--accent-soft);
  color:var(--accent);
  font-weight:700;
}
.log-message{
  flex:1;
  min-width:0;
  white-space:pre-wrap;
  word-break:break-word;
}
.muted{
  color:var(--muted);
}
.toast{
  position:fixed;
  top:20px;
  right:20px;
  min-width:220px;
  max-width:420px;
  padding:12px 14px;
  border-radius:16px;
  color:#fff;
  display:none;
  z-index:999;
  box-shadow:var(--shadow);
}
@media (max-width: 1100px){
  .task-grid,
  .grid.cols-3{
    grid-template-columns:1fr;
  }
  .strip-metrics,
  .summary-grid{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}
@media (max-width: 960px){
  .auth-card{
    grid-template-columns:1fr;
  }
  .shell{display:block}
  .sidebar{
    width:auto;
    border-right:none;
    border-bottom:1px solid var(--line);
  }
  .main{
    padding:18px;
  }
  .header{display:block}
  .toolbar{
    margin-top:14px;
  }
  .strip-metrics,
  .grid.cols-2,
  .summary-grid{
    grid-template-columns:1fr;
  }
  .split-inline{
    display:block;
  }
  .split-inline-actions{
    justify-content:flex-start;
    margin-top:14px;
  }
}
</style>
</head>
<body data-theme="dark" data-auth="login">
<div class="auth-shell" id="auth-shell">
  <div class="auth-card">
    <section class="auth-panel auth-hero">
      <div class="section-kicker">Docker WebUI</div>
      <h1 class="auth-title">先登录，再管理续牌任务。</h1>
      <p class="auth-copy">这个入口现在会先校验 WebUI 密码。登录后才能查看 Cookie、粉丝牌、任务状态和运行日志。</p>
      <ul class="auth-list">
        <li>登录成功后使用当前浏览器会话访问，不会把密码回显到页面。</li>
        <li>密码来自容器环境变量，默认可在 compose 文件里配置。</li>
        <li>现有任务配置和 Cookie 文件不会因为登录页改造而被重写。</li>
      </ul>
    </section>

    <section class="auth-panel">
      <div class="section-kicker">密码验证</div>
      <h2 class="auth-form-title">进入管理台</h2>
      <p class="subtle">输入 WebUI 密码，认证通过后再加载当前配置和状态。</p>
      <form id="login-form">
        <div class="field-block" style="margin-top:18px">
          <label class="field-label" for="web-password-input">WebUI 密码</label>
          <input id="web-password-input" type="password" autocomplete="current-password" placeholder="请输入管理密码">
        </div>
        <div class="auth-error" id="login-error"></div>
        <div class="actions auth-actions">
          <button class="btn btn-success" type="submit" id="login-submit">登录</button>
        </div>
      </form>
      <div class="auth-hint">初始密码可通过容器环境变量 WEB_PASSWORD 配置。</div>
    </section>
  </div>
</div>

<div class="shell" id="app-shell" style="display:none">
  <aside class="sidebar">
    <h1 class="brand-title">斗鱼粉丝牌续牌</h1>
    <p class="brand-copy">更聚焦的 Docker 管理台。先看概况，再分别管理登录、保活和双倍任务。</p>

    <div class="tab-list">
      <button class="tab-btn active" data-action="tab" data-tab="overview">概况</button>
      <button class="tab-btn" data-action="tab" data-tab="cookie">登录与领取</button>
      <button class="tab-btn" data-action="tab" data-tab="keepalive">保活任务</button>
      <button class="tab-btn" data-action="tab" data-tab="double-card">双倍任务</button>
      <button class="tab-btn" data-action="tab" data-tab="logs">运行日志</button>
    </div>

    <div class="theme-box">
      <label class="field-label" for="theme-mode">主题模式</label>
      <select id="theme-mode">
        <option value="system">跟随系统</option>
        <option value="light">浅色</option>
        <option value="dark">深色</option>
      </select>
      <div class="theme-note" id="theme-note">当前主题由配置加载。</div>
    </div>
  </aside>

  <main class="main">
    <div class="header">
      <div>
        <h2 class="page-title" id="page-title">概况</h2>
        <p class="page-subtitle" id="page-subtitle">先看基础状态，再确认当前粉丝牌列表。</p>
      </div>
      <div class="toolbar">
        <button class="btn btn-secondary" data-action="refresh-overview">刷新</button>
        <button class="btn btn-secondary" data-action="logout">退出登录</button>
      </div>
    </div>

    <section class="page active" id="page-overview">
      <div class="overview-stack">
        <div class="panel">
          <div class="section-kicker">基础状态</div>
          <h3 class="section-title">概况</h3>
          <p class="subtle">这里只保留登录与任务开关概览，详细状态请进入对应功能页查看。</p>
          <div class="summary-grid quad" id="overview-basic-summary" style="margin-top:14px">
            <div class="strip-metric">
              <div class="mini-label">登录</div>
              <div class="mini-value">-</div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">粉丝牌</div>
              <h3 class="section-title">粉丝牌列表</h3>
              <p class="subtle">概况页直接展示当前粉丝牌与双倍状态。</p>
            </div>
          </div>
          <div class="subtle overview-table-note" id="overview-fans-note">正在加载粉丝牌状态...</div>
          <div id="overview-fans-table-wrap" style="margin-top:14px"></div>
        </div>
      </div>
    </section>

    <section class="page" id="page-cookie">
      <div class="grid cols-2" style="margin-bottom:16px">
        <div class="task-card" id="cookie-login-card">
          <div class="task-card-title">登录状态</div>
        </div>
        <div class="task-card" id="collect-task-card">
          <div class="task-card-title">领取状态</div>
        </div>
      </div>

      <div class="panel">
        <h3 class="section-title">登录 Cookie</h3>
        <p class="subtle">先保存 Cookie，后续领取、保活、双倍和粉丝牌同步都会基于它运行。</p>
        <div class="field-block" style="margin-top:14px">
          <label class="field-label" for="cookie-input">斗鱼 Cookie</label>
          <textarea id="cookie-input" placeholder="粘贴斗鱼 Cookie"></textarea>
        </div>
        <div class="actions">
          <button class="btn btn-success" data-action="save-cookie">保存 Cookie</button>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-head">
          <div>
            <h3 class="section-title" style="margin-top:0">启动领取任务</h3>
            <p class="subtle">在这里设置自动领取时间，也可以手动触发领取。</p>
          </div>
          <div class="field-block" style="margin:0">
            <label class="switch-control">
              <input class="switch-input" type="checkbox" id="collect-enable">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="field-block">
          <label class="field-label" for="collect-cron">Cron 表达式</label>
          <input id="collect-cron" type="text">
          <div class="helper cron-preview" id="collect-cron-preview">正在计算未来执行时间...</div>
        </div>
        <div class="actions">
          <button class="btn btn-success" data-action="save-collect">保存并启用</button>
          <button class="btn btn-secondary" data-action="trigger" data-trigger="collectGift">立即领取</button>
        </div>
      </div>
    </section>

    <section class="page" id="page-keepalive">
      <div class="panel">
        <div class="task-card" id="keepalive-task-card">
          <div class="task-card-title">保活状态</div>
        </div>
        <div class="status-box" id="keepalive-note" style="margin-top:14px">等待加载...</div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用保活任务</div>
              <div class="switch-note">关闭后保留配置，但不执行保活调度。</div>
            </div>
            <label class="switch-control">
              <input class="switch-input" type="checkbox" id="keepalive-enable">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field-block">
            <label class="field-label" for="keepalive-cron">Cron 表达式</label>
            <input id="keepalive-cron" type="text">
            <div class="helper cron-preview" id="keepalive-cron-preview">正在计算未来执行时间...</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="keepalive-model">分配模式</label>
            <select id="keepalive-model">
              <option value="1">按百分比</option>
              <option value="2">按固定数量</option>
            </select>
          </div>
        </div>
        <div id="keepalive-table-wrap" style="margin-top:16px"></div>
        <div class="actions" style="margin-top:14px">
          <button class="btn btn-success" data-action="save-keepalive">保存并启用</button>
        </div>
      </div>
    </section>

    <section class="page" id="page-double-card">
      <div class="panel">
        <div class="task-card" id="double-task-card">
          <div class="task-card-title">双倍状态</div>
        </div>
        <div class="status-box" id="double-note" style="margin-top:14px">等待加载...</div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用双倍任务</div>
              <div class="switch-note">关闭后不执行双倍检测与赠送，但保留当前分配设置。</div>
            </div>
            <label class="switch-control">
              <input class="switch-input" type="checkbox" id="double-enable">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field-block">
            <label class="field-label" for="double-cron">Cron 表达式</label>
            <input id="double-cron" type="text">
            <div class="helper cron-preview" id="double-cron-preview">正在计算未来执行时间...</div>
          </div>
          <div class="field-block">
            <div class="label-row">
              <label class="field-label" for="double-model">分配模式</label>
              <span class="help-icon" title="双倍任务在按权重模式下，不要求总和等于 100。没有房间开双倍时本次不送；只有 1 个房间开双倍时本次全部送给它；多个房间开双倍时，只会在这些房间里按你填写的权重值重新分配。">?</span>
            </div>
            <select id="double-model">
              <option value="1">按权重</option>
              <option value="2">按固定数量</option>
            </select>
          </div>
        </div>
        <div class="status-box" style="margin-top:16px">
          <div class="split-inline">
            <div class="split-inline-copy">
              <div class="section-kicker">分配说明</div>
              <p class="subtle" id="double-mode-help" style="margin-top:8px">按权重模式会根据当前勾选房间的权重值动态重新分配。</p>
              <div class="helper" id="double-ratio-preview" style="margin-top:10px">等待计算当前权重预览...</div>
            </div>
            <div class="split-inline-actions" id="double-ratio-tools">
              <button class="btn btn-secondary" type="button" data-action="double-fill-equal">参与房间全部设为 1</button>
              <button class="btn btn-secondary" type="button" data-action="double-fill-level">按粉丝牌等级填入</button>
            </div>
          </div>
        </div>
        <div id="double-table-wrap" style="margin-top:16px"></div>
        <div class="actions" style="margin-top:14px">
          <button class="btn btn-success" data-action="save-double">保存并启用</button>
        </div>
      </div>
    </section>

    <section class="page" id="page-logs">
      <div class="panel">
        <h3 class="section-title">运行日志</h3>
        <p class="subtle" id="logs-summary" style="margin-top:10px">仅保留最近 500 条日志，正在加载...</p>
        <div class="actions" style="margin-top:14px">
          <button class="btn btn-secondary" data-action="refresh-logs">手动刷新</button>
          <button class="btn btn-danger" data-action="clear-logs">清空日志</button>
          <label class="inline" style="margin-left:4px">
            <input type="checkbox" id="logs-auto-refresh" checked>
            <span>自动刷新</span>
          </label>
        </div>
        <div class="log-box" id="full-log-box" style="margin-top:16px"></div>
      </div>
    </section>
  </main>
</div>

<div class="toast" id="toast"></div>

<script>
(function () {
  var PAGE_META = {
    overview: {
      title: '概况',
      subtitle: '先看基础状态，再确认当前粉丝牌列表。'
    },
    cookie: {
      title: '登录与领取',
      subtitle: '查看登录情况、领取状态，并配置独立的领取任务。'
    },
    keepalive: {
      title: '保活任务',
      subtitle: '查看保活状态，并维护随粉丝牌同步的房间配置。'
    },
    'double-card': {
      title: '双倍任务',
      subtitle: '查看双倍状态，并维护参与勾选与分配值。'
    },
    logs: {
      title: '运行日志',
      subtitle: '查看系统、领取、保活和双倍任务的执行记录。'
    }
  };

  var DEFAULT_RAW_CONFIG = {
    cookie: '',
    ui: { themeMode: 'system' },
    collectGift: { active: true, cron: '0 10 0,1 * * *' },
    keepalive: { active: true, cron: '0 0 8 */6 * *', model: 2, send: {} },
    doubleCard: { active: true, cron: '0 20 14,17,20,23 * * *', model: 1, send: {}, enabled: {} }
  };

  function createEmptyCronPreview() {
    return {
      value: '',
      runs: [],
      error: ''
    };
  }

  var state = {
    activeTab: 'overview',
    auth: {
      checked: false,
      authenticated: false,
      submitting: false,
      error: ''
    },
    rawConfig: null,
    overview: null,
    managed: null,
    logs: [],
    logsRefreshedAt: null,
    fansStatus: [],
    fansStatusLoading: false,
    fansStatusLoaded: false,
    managedLoading: false,
    themeMode: 'system',
    cronPreview: {
      collectGift: createEmptyCronPreview(),
      keepalive: createEmptyCronPreview(),
      doubleCard: createEmptyCronPreview()
    },
    cronPreviewSeq: {
      collectGift: 0,
      keepalive: 0,
      doubleCard: 0
    }
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSystemPrefersDark() {
    if (!window.matchMedia) {
      return true;
    }
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (error) {
      return true;
    }
  }

  function formatDate(value) {
    if (!value) {
      return '无';
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date).replace(/\\//g, '-');
    } catch (error) {
      return date.toISOString();
    }
  }

  function toast(message, ok) {
    var node = byId('toast');
    node.textContent = message;
    node.style.display = 'block';
    node.style.background = ok ? '#15803d' : '#dc2626';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(function () {
      node.style.display = 'none';
    }, 3200);
  }

  function getRawConfig() {
    if (state.rawConfig) {
      return state.rawConfig;
    }
    return JSON.parse(JSON.stringify(DEFAULT_RAW_CONFIG));
  }

  function isUnauthorizedError(error) {
    return Boolean(error && error.status === 401);
  }

  function clearProtectedState() {
    state.rawConfig = null;
    state.overview = null;
    state.managed = null;
    state.logs = [];
    state.logsRefreshedAt = null;
    state.fansStatus = [];
    state.fansStatusLoading = false;
    state.fansStatusLoaded = false;
    state.managedLoading = false;
  }

  function renderAuth() {
    var bodyMode = state.auth.authenticated ? 'app' : 'login';
    document.body.setAttribute('data-auth', bodyMode);

    var authShell = byId('auth-shell');
    var appShell = byId('app-shell');
    if (authShell) {
      authShell.style.display = state.auth.authenticated ? 'none' : 'flex';
    }
    if (appShell) {
      appShell.style.display = state.auth.authenticated ? 'flex' : 'none';
    }

    var errorNode = byId('login-error');
    if (errorNode) {
      errorNode.textContent = state.auth.error || '';
      errorNode.style.display = state.auth.error ? 'block' : 'none';
    }

    var submitNode = byId('login-submit');
    if (submitNode) {
      submitNode.disabled = state.auth.submitting;
      submitNode.textContent = state.auth.submitting ? '登录中...' : '登录';
    }

    var passwordNode = byId('web-password-input');
    if (passwordNode) {
      passwordNode.disabled = state.auth.submitting;
    }
  }

  function handleUnauthorized() {
    state.auth.checked = true;
    state.auth.authenticated = false;
    state.auth.submitting = false;
    state.auth.error = '登录已失效，请重新输入密码。';
    clearProtectedState();
    renderAuth();
  }

  function getManagedConfig() {
    if (state.managed && state.managed.config) {
      return state.managed.config;
    }
    return getRawConfig();
  }

  function getManagedFans() {
    if (state.managed && state.managed.fans) {
      return state.managed.fans;
    }
    return [];
  }

  function isTaskActive(config) {
    return Boolean(config && config.active !== false);
  }

  function requestJson(url, options) {
    var opts = options || {};
    return fetch(url, opts).then(function (response) {
      return response.text().then(function (text) {
        var data = text ? JSON.parse(text) : {};
        if (!response.ok) {
          var error = new Error(data && data.error ? data.error : '请求失败');
          error.status = response.status;
          if (response.status === 401) {
            handleUnauthorized();
          }
          throw error;
        }
        return data;
      });
    });
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    var buttons = document.querySelectorAll('.tab-btn');
    var i;
    for (i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      button.classList.toggle('active', button.getAttribute('data-tab') === tab);
    }

    var pages = document.querySelectorAll('.page');
    for (i = 0; i < pages.length; i += 1) {
      var page = pages[i];
      page.classList.toggle('active', page.id === 'page-' + tab);
    }

    byId('page-title').textContent = PAGE_META[tab].title;
    byId('page-subtitle').textContent = PAGE_META[tab].subtitle;

    if (tab === 'overview' && getRawConfig().cookie && !state.fansStatusLoaded) {
      loadFansStatus(false);
    }
    if (tab === 'logs') {
      loadLogs();
    }
  }

  function buildStatusPill(label, kind) {
    return '<span class="pill ' + kind + '">' + escapeHtml(label) + '</span>';
  }

  function buildSummaryCell(label, value) {
    return '<div class="summary-cell"><div class="mini-label">' + escapeHtml(label) + '</div><div class="mini-value">' + escapeHtml(value) + '</div></div>';
  }

  function buildSummaryStatusCell(label, enabled, enabledText, disabledText) {
    var active = Boolean(enabled);
    return ''
      + '<div class="strip-metric">'
      + '<div class="mini-label">' + escapeHtml(label) + '</div>'
      + '<div class="mini-value">' + buildStatusPill(active ? enabledText : disabledText, active ? 'ok' : 'off') + '</div>'
      + '</div>';
  }

  function buildLoadingTaskCard(title) {
    return '<div class="task-card-head"><div><div class="section-kicker">任务状态</div><h3 class="task-card-title">' + escapeHtml(title) + '</h3></div></div><div class="task-card-pills">' + buildStatusPill('等待加载', 'off') + '</div><div class="summary-grid">' + buildSummaryCell('上次执行', '-') + buildSummaryCell('下次执行', '-') + buildSummaryCell('运行状态', '-') + '</div>';
  }

  function buildTaskCard(title, configured, status, extraLabel, extraValue) {
    var enabledLabel = configured ? '已启动' : '未启动';
    var runningLabel = configured ? (status.running ? '调度中' : '已停止') : '未启用';
    return ''
      + '<div class="task-card-head"><div><div class="section-kicker">任务状态</div><h3 class="task-card-title">' + escapeHtml(title) + '</h3></div></div>'
      + '<div class="task-card-pills">'
      + buildStatusPill(enabledLabel, configured ? 'ok' : 'off')
      + buildStatusPill(runningLabel, configured ? (status.running ? 'warn' : 'off') : 'off')
      + '</div>'
      + '<div class="summary-grid">'
      + buildSummaryCell('上次执行', formatDate(status.lastRun))
      + buildSummaryCell('下次执行', formatDate(status.nextRun))
      + buildSummaryCell(extraLabel, extraValue)
      + '</div>';
  }

  function buildLoginStatusCard(overview, fansCount) {
    if (!overview) {
      return '<div class="task-card-head"><div><div class="section-kicker">登录状态</div><h3 class="task-card-title">登录</h3></div></div><div class="task-card-pills">' + buildStatusPill('等待加载', 'off') + '</div><div class="summary-grid">' + buildSummaryCell('系统就绪', '-') + buildSummaryCell('粉丝牌', '-') + buildSummaryCell('Cookie', '-') + '</div>';
    }

    var rawConfig = getRawConfig();

    return ''
      + '<div class="task-card-head"><div><div class="section-kicker">登录状态</div><h3 class="task-card-title">登录</h3></div></div>'
      + '<div class="task-card-pills">'
      + buildStatusPill(overview.cookieSaved ? '已登录' : '未登录', overview.cookieSaved ? 'ok' : 'off')
      + buildStatusPill(overview.ready ? '可运行' : '待配置', overview.ready ? 'warn' : 'off')
      + '</div>'
      + '<div class="summary-grid">'
      + buildSummaryCell('系统就绪', overview.ready ? '已就绪' : '待配置')
      + buildSummaryCell('粉丝牌', rawConfig.cookie ? ((state.managedLoading || state.fansStatusLoading) ? '同步中' : (fansCount + ' 个')) : '未同步')
      + buildSummaryCell('Cookie', overview.cookieSaved ? '已保存' : '未保存')
      + '</div>';
  }

  function renderCronPreview(targetId, key) {
    var target = byId(targetId);
    var preview = state.cronPreview[key];
    if (!target || !preview) {
      return;
    }
    if (!preview.value) {
      target.textContent = '填写 cron 后显示未来三次执行时间。';
      return;
    }
    if (preview.error) {
      target.textContent = 'cron 校验失败：' + preview.error;
      return;
    }
    if (!preview.runs.length) {
      target.textContent = '暂未生成未来执行时间。';
      return;
    }
    target.textContent = '未来三次：' + preview.runs.map(function (item) {
      return formatDate(item);
    }).join(' / ');
  }

  function loadCronPreview(key, cron, targetId) {
    var value = String(cron || '').trim();
    state.cronPreviewSeq[key] += 1;
    var requestSeq = state.cronPreviewSeq[key];

    if (!value) {
      state.cronPreview[key] = createEmptyCronPreview();
      renderCronPreview(targetId, key);
      return Promise.resolve();
    }

    state.cronPreview[key] = {
      value: value,
      runs: [],
      error: ''
    };
    if (byId(targetId)) {
      byId(targetId).textContent = '正在计算未来执行时间...';
    }

    return requestJson('/api/cron-preview?value=' + encodeURIComponent(value)).then(function (data) {
      if (state.cronPreviewSeq[key] !== requestSeq) {
        return;
      }
      state.cronPreview[key] = {
        value: value,
        runs: data.runs || [],
        error: ''
      };
      renderCronPreview(targetId, key);
    }).catch(function (error) {
      if (state.cronPreviewSeq[key] !== requestSeq) {
        return;
      }
      state.cronPreview[key] = {
        value: value,
        runs: [],
        error: error.message
      };
      renderCronPreview(targetId, key);
    });
  }

  function buildFansStatusTable(items) {
    var rows = [];
    var i;
    for (i = 0; i < items.length; i += 1) {
      var item = items[i];
      rows.push('<tr>');
      rows.push('<td>' + escapeHtml(i + 1) + '</td>');
      rows.push('<td>' + escapeHtml(item.name) + '</td>');
      rows.push('<td>' + escapeHtml(item.roomId) + '</td>');
      rows.push('<td>' + escapeHtml(item.level) + '</td>');
      rows.push('<td>' + escapeHtml(item.rank) + '</td>');
      rows.push('<td>' + escapeHtml(item.today) + '</td>');
      rows.push('<td>' + escapeHtml(item.intimacy) + '</td>');
      rows.push('<td>' + buildStatusPill(item.doubleActive ? '双倍中' : '未开启', item.doubleActive ? 'ok' : 'off') + '</td>');
      rows.push('</tr>');
    }
    return '<div class="table-shell"><table class="table"><thead><tr><th>序号</th><th>主播名称</th><th>房间号</th><th>等级</th><th>排名</th><th>今日亲密度</th><th>亲密度</th><th>双倍状态</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function renderOverview() {
    var overview = state.overview;
    var rawConfig = getRawConfig();
    var fans = state.fansStatusLoaded ? state.fansStatus : getManagedFans();
    if (!overview) {
      byId('overview-basic-summary').innerHTML = ''
        + '<div class="strip-metric"><div class="mini-label">登录</div><div class="mini-value">-</div></div>'
        + '<div class="strip-metric"><div class="mini-label">领取</div><div class="mini-value">-</div></div>'
        + '<div class="strip-metric"><div class="mini-label">保活</div><div class="mini-value">-</div></div>'
        + '<div class="strip-metric"><div class="mini-label">双倍</div><div class="mini-value">-</div></div>';
      byId('overview-fans-note').textContent = '正在加载粉丝牌状态...';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty">请稍候...</div>';
      return;
    }

    byId('overview-basic-summary').innerHTML = ''
      + buildSummaryStatusCell('登录', overview.cookieSaved, '已登录', '未登录')
      + buildSummaryStatusCell('领取', overview.collectGiftConfigured, '已开启', '未开启')
      + buildSummaryStatusCell('保活', overview.keepaliveConfigured, '已开启', '未开启')
      + buildSummaryStatusCell('双倍', overview.doubleCardConfigured, '已开启', '未开启');

    if (!rawConfig.cookie) {
      byId('overview-fans-note').textContent = '请先保存 Cookie，概况页才会显示粉丝牌列表。';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty">保存 Cookie 后再点击顶部“刷新”，这里会直接展示粉丝牌与双倍状态。<div class="empty-action"><button class="btn btn-primary" data-action="tab" data-tab="cookie">前往登录与领取</button></div></div>';
      return;
    }

    if (state.managedLoading || state.fansStatusLoading) {
      byId('overview-fans-note').textContent = '正在同步粉丝牌状态...';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty">请稍候，列表正在更新。</div>';
      return;
    }

    if (!state.fansStatusLoaded) {
      byId('overview-fans-note').textContent = '点击顶部“刷新”可重新加载粉丝牌状态。';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty">尚未加载粉丝牌状态。</div>';
      return;
    }

    if (!state.fansStatus.length) {
      byId('overview-fans-note').textContent = '当前没有可展示的粉丝牌数据。';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty">当前没有可展示的粉丝牌数据。</div>';
      return;
    }

    byId('overview-fans-note').textContent = '当前共 ' + state.fansStatus.length + ' 个粉丝牌房间，双倍状态已直接并入列表。';
    byId('overview-fans-table-wrap').innerHTML = buildFansStatusTable(state.fansStatus);
  }

  function renderLogBox(targetId, logs) {
    var target = byId(targetId);
    if (!logs || !logs.length) {
      target.innerHTML = '<div class="empty">暂无日志</div>';
      return;
    }
    var html = [];
    var i;
    for (i = 0; i < logs.length; i += 1) {
      html.push(
        '<div class="log-line">'
        + '<span class="log-stamp">[' + escapeHtml(formatDate(logs[i].timestamp)) + ']</span>'
        + '<span class="log-tag">' + escapeHtml(logs[i].category) + '</span>'
        + '<span class="log-message">' + escapeHtml(logs[i].message) + '</span>'
        + '</div>'
      );
    }
    target.innerHTML = html.join('');
    target.scrollTop = target.scrollHeight;
  }

  function renderCookiePage() {
    var config = getRawConfig();
    var fansCount = state.fansStatusLoaded ? state.fansStatus.length : getManagedFans().length;
    byId('cookie-login-card').innerHTML = buildLoginStatusCard(state.overview, fansCount);
    byId('collect-task-card').innerHTML = state.overview
      ? buildTaskCard(
        '领取',
        state.overview.collectGiftConfigured,
        state.overview.status.collectGift,
        '执行方式',
        state.overview.collectGiftConfigured ? '独立任务' : '等待启用'
      )
      : buildLoadingTaskCard('领取');
    byId('cookie-input').value = config.cookie || '';
    byId('collect-enable').checked = isTaskActive(config.collectGift);
    byId('collect-cron').value = config.collectGift ? config.collectGift.cron : '0 10 0,1 * * *';
    void loadCronPreview('collectGift', byId('collect-cron').value, 'collect-cron-preview');
  }

  function renderKeepalivePage() {
    var rawConfig = getRawConfig();
    var config = getManagedConfig().keepalive || rawConfig.keepalive || { active: true, cron: '0 0 8 */6 * *', model: 2, send: {} };
    var fans = getManagedFans();
    byId('keepalive-task-card').innerHTML = state.overview
      ? buildTaskCard('保活', state.overview.keepaliveConfigured, state.overview.status.keepalive, '房间数', state.overview.keepaliveRooms)
      : buildLoadingTaskCard('保活');
    byId('keepalive-enable').checked = isTaskActive(getManagedConfig().keepalive || rawConfig.keepalive);
    byId('keepalive-cron').value = config.cron || '0 0 8 */6 * *';
    byId('keepalive-model').value = String(config.model || 2);
    void loadCronPreview('keepalive', byId('keepalive-cron').value, 'keepalive-cron-preview');

    if (!rawConfig.cookie) {
      byId('keepalive-note').textContent = '请先保存 Cookie。没有 Cookie 时无法同步粉丝牌，也不会生成保活房间列表。';
      byId('keepalive-table-wrap').innerHTML = '<div class="empty">保存 Cookie 后再同步粉丝牌，这里才会出现房间列表。</div>';
      return;
    }

    if (state.managedLoading) {
      byId('keepalive-note').textContent = '正在同步粉丝牌与保活配置...';
      byId('keepalive-table-wrap').innerHTML = '<div class="empty">请稍候...</div>';
      return;
    }

    if (!fans.length) {
      byId('keepalive-note').textContent = '当前没有可用粉丝牌。';
      byId('keepalive-table-wrap').innerHTML = '<div class="empty">同步后如果仍为空，说明当前账号没有可用粉丝牌数据。</div>';
      return;
    }

    byId('keepalive-note').textContent = '当前已同步 ' + fans.length + ' 个粉丝牌房间。';
    byId('keepalive-table-wrap').innerHTML = buildSendTable(fans, config, false, 'keepalive-value');
  }

  function setDoubleModeEmptyState(helpText, previewText) {
    if (byId('double-mode-help')) {
      byId('double-mode-help').textContent = helpText;
    }
    if (byId('double-ratio-preview')) {
      byId('double-ratio-preview').textContent = previewText;
    }
    if (byId('double-ratio-tools')) {
      byId('double-ratio-tools').style.display = Number(byId('double-model').value || 1) === 1 ? '' : 'none';
    }
  }

  function renderDoublePage() {
    var rawConfig = getRawConfig();
    var config = getManagedConfig().doubleCard || rawConfig.doubleCard || { active: true, cron: '0 20 14,17,20,23 * * *', model: 1, send: {}, enabled: {} };
    var fans = getManagedFans();
    byId('double-task-card').innerHTML = state.overview
      ? buildTaskCard('双倍', state.overview.doubleCardConfigured, state.overview.status.doubleCard, '房间数', state.overview.doubleCardRooms)
      : buildLoadingTaskCard('双倍');
    byId('double-enable').checked = isTaskActive(getManagedConfig().doubleCard || rawConfig.doubleCard);
    byId('double-cron').value = config.cron || '0 20 14,17,20,23 * * *';
    byId('double-model').value = String(config.model || 1);
    void loadCronPreview('doubleCard', byId('double-cron').value, 'double-cron-preview');

    if (!rawConfig.cookie) {
      byId('double-note').textContent = '请先保存 Cookie。没有 Cookie 时无法同步粉丝牌，也不会生成双倍房间列表。';
      byId('double-table-wrap').innerHTML = '<div class="empty">保存 Cookie 后再同步粉丝牌，这里才会出现房间列表。</div>';
      setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', '保存 Cookie 并同步粉丝牌后，这里会显示当前权重预览。');
      return;
    }

    if (state.managedLoading) {
      byId('double-note').textContent = '正在同步粉丝牌与双倍配置...';
      byId('double-table-wrap').innerHTML = '<div class="empty">请稍候...</div>';
      setDoubleModeEmptyState('正在同步双倍任务配置。', '同步完成后，这里会显示当前权重预览。');
      return;
    }

    if (!fans.length) {
      byId('double-note').textContent = '当前没有可用粉丝牌。';
      byId('double-table-wrap').innerHTML = '<div class="empty">同步后如果仍为空，说明当前账号没有可用粉丝牌数据。</div>';
      setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', '当前没有可用于预览的粉丝牌房间。');
      return;
    }

    var enabledCount = 0;
    var i;
    for (i = 0; i < fans.length; i += 1) {
      var roomKey = String(fans[i].roomId);
      if (config.enabled && config.enabled[roomKey]) {
        enabledCount += 1;
      }
    }
    byId('double-note').textContent = '当前已勾选 ' + enabledCount + ' / ' + fans.length + ' 个房间参与双倍。';
    byId('double-table-wrap').innerHTML = buildSendTable(fans, config, true, 'double-value');
    updateDoubleModeUi();
  }

  function buildSendTable(fans, config, withEnabled, valueClass) {
    var model = Number(config.model || 1);
    var rows = [];
    var i;
    for (i = 0; i < fans.length; i += 1) {
      var fan = fans[i];
      var key = String(fan.roomId);
      var sendItem = config.send && config.send[key] ? config.send[key] : {
        roomId: fan.roomId,
        number: model === 2 ? 1 : 0,
        weight: model === 1 ? 1 : 0
      };
      var value = model === 2 ? Number(sendItem.number || 0) : Number(sendItem.weight || 0);
      rows.push('<tr>');
      rows.push('<td>' + escapeHtml(i + 1) + '</td>');
      if (withEnabled) {
        rows.push('<td><input type="checkbox" class="double-enabled" data-room-id="' + escapeHtml(fan.roomId) + '"' + (config.enabled && config.enabled[key] ? ' checked' : '') + '></td>');
      }
      rows.push('<td>' + escapeHtml(fan.name) + '</td>');
      rows.push('<td>' + escapeHtml(fan.roomId) + '</td>');
      rows.push('<td>' + escapeHtml(fan.level) + '</td>');
      rows.push('<td>' + escapeHtml(fan.rank) + '</td>');
      rows.push('<td>' + escapeHtml(fan.today) + '</td>');
      rows.push('<td>' + escapeHtml(fan.intimacy) + '</td>');
      rows.push('<td><input type="number" class="' + valueClass + '" data-room-id="' + escapeHtml(fan.roomId) + '" data-level="' + escapeHtml(fan.level) + '" value="' + escapeHtml(value) + '"></td>');
      rows.push('</tr>');
    }

    var header = '<tr><th>序号</th>';
    if (withEnabled) {
      header += '<th>参与</th>';
    }
    header += '<th>主播名称</th><th>房间号</th><th>等级</th><th>排名</th><th>今日亲密度</th><th>亲密度</th><th>' + (model === 2 ? '数量' : (withEnabled ? '权重值' : '百分比')) + '</th></tr>';

    return '<div class="table-shell"><table class="table"><thead>' + header + '</thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function formatRatioPercent(value) {
    var rounded = Math.round(value * 10) / 10;
    return String(rounded.toFixed(1)).replace(/\\.0$/, '') + '%';
  }

  function updateDoubleTableHeaderLabel(model) {
    var header = document.querySelector('#double-table-wrap thead th:last-child');
    if (!header) {
      return;
    }
    header.textContent = model === 2 ? '数量' : '权重值';
  }

  function getDoubleFormSnapshot() {
    var fans = getManagedFans();
    var model = Number(byId('double-model').value || 1);
    var entries = [];
    var i;

    for (i = 0; i < fans.length; i += 1) {
      var fan = fans[i];
      var roomId = String(fan.roomId);
      var enabledNode = document.querySelector('.double-enabled[data-room-id="' + roomId + '"]');
      var inputNode = document.querySelector('.double-value[data-room-id="' + roomId + '"]');
      var rawValue = inputNode ? Number(inputNode.value) : 0;
      entries.push({
        fan: fan,
        roomId: roomId,
        enabled: Boolean(enabledNode && enabledNode.checked),
        value: Number.isFinite(rawValue) ? rawValue : 0
      });
    }

    return {
      model: model,
      entries: entries
    };
  }

  function updateDoubleModeUi() {
    var helpNode = byId('double-mode-help');
    var previewNode = byId('double-ratio-preview');
    var toolsNode = byId('double-ratio-tools');
    if (!helpNode || !previewNode || !toolsNode) {
      return;
    }

    var snapshot = getDoubleFormSnapshot();
    var enabledEntries = snapshot.entries.filter(function (entry) {
      return entry.enabled;
    });

    updateDoubleTableHeaderLabel(snapshot.model);

    if (snapshot.model === 2) {
      helpNode.textContent = '按固定数量时，会只在当前开双倍的房间里使用你填写的数量。没有房间开双倍时本次不送；只有 1 个房间开双倍时本次全部送给它。';
      previewNode.textContent = '固定数量模式保留现有行为。如果你想平均分配，切回“按权重”后点击“参与房间全部设为 1”即可。';
      toolsNode.style.display = 'none';
      return;
    }

    toolsNode.style.display = '';
    helpNode.textContent = '按权重模式不要求总和等于 100。多个房间同时开双倍时，只会在这些房间里按权重值重新分配。';

    if (!enabledEntries.length) {
      previewNode.textContent = '当前还没有勾选参与双倍的房间。';
      return;
    }

    var positiveEntries = enabledEntries.filter(function (entry) {
      return entry.value > 0;
    });
    if (!positiveEntries.length) {
      previewNode.textContent = '当前已勾选房间的权重值全是 0。至少给一个已勾选房间填写大于 0 的权重值。';
      return;
    }

    var totalWeight = positiveEntries.reduce(function (sum, entry) {
      return sum + entry.value;
    }, 0);
    var ratioText = positiveEntries.map(function (entry) {
      return entry.fan.name + '(' + entry.value + ')';
    }).join(' / ');
    var percentText = positiveEntries.map(function (entry) {
      return entry.fan.name + ' ' + formatRatioPercent((entry.value / totalWeight) * 100);
    }).join(' / ');

    previewNode.innerHTML = '当前权重：' + escapeHtml(ratioText) + '<br>折算占比：' + escapeHtml(percentText);
  }

  function applyDoubleRatioPreset(preset) {
    if (Number(byId('double-model').value || 1) !== 1) {
      toast('当前不是按权重模式', false);
      return;
    }

    var inputs = document.querySelectorAll('.double-value');
    var updated = 0;
    var i;
    for (i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      var roomId = String(input.getAttribute('data-room-id'));
      var checkbox = document.querySelector('.double-enabled[data-room-id="' + roomId + '"]');
      if (!checkbox || !checkbox.checked) {
        continue;
      }
      input.value = preset === 'level'
        ? String(Math.max(Number(input.getAttribute('data-level') || 1), 1))
        : '1';
      updated += 1;
    }

    if (updated === 0) {
      toast('请先勾选参与双倍的房间', false);
      return;
    }

    updateDoubleModeUi();
    toast(preset === 'level' ? '已按粉丝牌等级填入权重值' : '已将参与房间全部设为 1', true);
  }

  function renderLogsPage() {
    var refreshedAt = state.logsRefreshedAt ? formatDate(state.logsRefreshedAt) : '尚未刷新';
    byId('logs-summary').textContent = '当前 ' + (state.logs ? state.logs.length : 0) + ' 条日志，仅保留最近 500 条。最近刷新：' + refreshedAt;
    renderLogBox('full-log-box', state.logs || []);
  }

  function renderTheme() {
    var config = getRawConfig();
    var mode = 'system';
    if (config.ui && config.ui.themeMode) {
      mode = config.ui.themeMode;
    }
    state.themeMode = mode;
    byId('theme-mode').value = mode;
    var resolved = mode === 'system' ? (getSystemPrefersDark() ? 'dark' : 'light') : mode;
    document.body.setAttribute('data-theme', resolved);
    byId('theme-note').textContent = mode === 'system'
      ? '当前跟随系统，系统为 ' + (getSystemPrefersDark() ? '深色' : '浅色')
      : '当前固定为 ' + (mode === 'dark' ? '深色' : '浅色') + ' 模式';
  }

  function renderAll() {
    renderTheme();
    renderOverview();
    renderCookiePage();
    renderKeepalivePage();
    renderDoublePage();
    renderLogsPage();
  }

  function loadProtectedData() {
    return Promise.all([
      loadRawConfig(),
      loadOverview(),
      loadLogs()
    ]).then(function () {
      var rawConfig = getRawConfig();
      if (rawConfig.cookie) {
        return syncFans(false).then(function () {
          if (!state.auth.authenticated) {
            return;
          }
          return loadFansStatus(false);
        });
      }

      renderAll();
      return Promise.resolve();
    });
  }

  function loadAuthStatus() {
    return requestJson('/api/auth/status').then(function (data) {
      state.auth.checked = true;
      state.auth.authenticated = Boolean(data.authenticated);
      state.auth.submitting = false;
      state.auth.error = '';
      renderAuth();
      return state.auth.authenticated;
    }).catch(function (error) {
      state.auth.checked = true;
      state.auth.authenticated = false;
      state.auth.submitting = false;
      state.auth.error = '检查登录状态失败：' + error.message;
      clearProtectedState();
      renderAuth();
      return false;
    });
  }

  function submitLogin() {
    var password = byId('web-password-input').value;
    if (!password) {
      state.auth.error = '请输入密码';
      renderAuth();
      return;
    }

    state.auth.submitting = true;
    state.auth.error = '';
    renderAuth();

    requestJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    }).then(function () {
      state.auth.checked = true;
      state.auth.authenticated = true;
      state.auth.submitting = false;
      state.auth.error = '';
      byId('web-password-input').value = '';
      renderAuth();
      return loadProtectedData();
    }).then(function () {
      toast('登录成功', true);
    }).catch(function (error) {
      state.auth.submitting = false;
      state.auth.authenticated = false;
      state.auth.error = '登录失败：' + error.message;
      renderAuth();
    });
  }

  function logout() {
    requestJson('/api/auth/logout', {
      method: 'POST'
    }).catch(function () {
      return null;
    }).then(function () {
      var passwordNode = byId('web-password-input');
      if (passwordNode) {
        passwordNode.value = '';
      }
      handleUnauthorized();
      state.auth.error = '';
      renderAuth();
      toast('已退出登录', true);
    });
  }

  function loadRawConfig() {
    return requestJson('/api/config/raw').then(function (data) {
      state.rawConfig = data.exists ? data.data : JSON.parse(JSON.stringify(DEFAULT_RAW_CONFIG));
      renderAll();
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('加载配置失败：' + error.message, false);
    });
  }

  function loadOverview() {
    return requestJson('/api/overview').then(function (data) {
      state.overview = data;
      renderOverview();
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('加载概览失败：' + error.message, false);
    });
  }

  function loadLogs() {
    return requestJson('/api/logs').then(function (data) {
      state.logs = data;
      state.logsRefreshedAt = new Date().toISOString();
      renderLogsPage();
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('加载日志失败：' + error.message, false);
    });
  }

  function syncFans(showToast) {
    var rawConfig = getRawConfig();
    if (!rawConfig.cookie) {
      toast('请先保存 Cookie', false);
      renderAll();
      return Promise.resolve();
    }

    state.managedLoading = true;
    renderAll();
    return requestJson('/api/fans/reconcile', {
      method: 'POST'
    }).then(function (data) {
      state.managed = data;
      state.rawConfig = data.config;
      state.managedLoading = false;
      renderAll();
      loadOverview();
      if (showToast) {
        toast('粉丝牌与任务配置已同步', true);
      }
    }).catch(function (error) {
      state.managedLoading = false;
      renderAll();
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('同步粉丝牌失败：' + error.message, false);
    });
  }

  function loadFansStatus(showToast) {
    var rawConfig = getRawConfig();
    if (!rawConfig.cookie) {
      state.fansStatus = [];
      state.fansStatusLoaded = false;
      renderOverview();
      if (showToast) {
        toast('请先保存 Cookie', false);
      }
      return Promise.resolve();
    }

    state.fansStatusLoading = true;
    renderOverview();
    return requestJson('/api/fans/status').then(function (data) {
      state.fansStatus = data;
      state.fansStatusLoaded = true;
      state.fansStatusLoading = false;
      renderOverview();
      if (showToast) {
        toast('粉丝牌状态已刷新', true);
      }
    }).catch(function (error) {
      state.fansStatusLoading = false;
      state.fansStatusLoaded = false;
      state.fansStatus = [];
      renderOverview();
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('加载粉丝牌状态失败：' + error.message, false);
    });
  }

  function refreshOverviewSurface(showToast) {
    return loadRawConfig().then(function () {
      if (!state.auth.authenticated) {
        return;
      }
      var rawConfig = getRawConfig();
      if (!rawConfig.cookie) {
        state.managed = null;
        state.fansStatus = [];
        state.fansStatusLoaded = false;
        renderAll();
        return loadOverview().then(function () {
          if (showToast) {
            toast('概况已刷新', true);
          }
        });
      }

      return syncFans(false).then(function () {
        return loadFansStatus(false);
      }).then(function () {
        return loadOverview();
      }).then(function () {
        if (showToast) {
          toast('概况已刷新', true);
        }
      });
    });
  }

  function saveCookie() {
    var cookie = byId('cookie-input').value.trim();
    if (!cookie) {
      toast('请先填写 Cookie', false);
      return;
    }

    requestJson('/api/cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: cookie })
    }).then(function () {
      toast('Cookie 已保存', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存 Cookie 失败：' + error.message, false);
    });
  }

  function saveCollectConfig(options) {
    byId('collect-enable').checked = true;
    var payload = {
      collectGift: { active: true, cron: byId('collect-cron').value.trim() }
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('领取任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('collect-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用领取任务失败：' + error.message, false);
    });
  }

  function disableCollectConfig() {
    var currentConfig = getRawConfig().collectGift || { active: true, cron: '0 10 0,1 * * *' };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectGift: {
          active: false,
          cron: currentConfig.cron || '0 10 0,1 * * *'
        }
      })
    }).then(function () {
      toast('领取任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('collect-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用领取任务失败：' + error.message, false);
    });
  }

  function buildSendPayload(valueClass, includeEnabled) {
    var fans = getManagedFans();
    var send = {};
    var model = Number(includeEnabled ? byId('double-model').value : byId('keepalive-model').value);
    var i;
    for (i = 0; i < fans.length; i += 1) {
      var roomId = fans[i].roomId;
      var input = document.querySelector('.' + valueClass + '[data-room-id="' + roomId + '"]');
      var value = input ? Number(input.value) : 0;
      send[String(roomId)] = {
        roomId: roomId,
        giftId: 268,
        number: model === 2 ? value : 0,
        weight: model === 1 ? value : 0,
        count: 0
      };
    }

    var result = {
      active: true,
      cron: includeEnabled ? byId('double-cron').value.trim() : byId('keepalive-cron').value.trim(),
      model: model,
      send: send
    };

    if (includeEnabled) {
      var enabledMap = {};
      var checkboxes = document.querySelectorAll('.double-enabled');
      for (i = 0; i < checkboxes.length; i += 1) {
        enabledMap[String(checkboxes[i].getAttribute('data-room-id'))] = Boolean(checkboxes[i].checked);
      }
      result.enabled = enabledMap;
    }

    return result;
  }

  function saveKeepaliveConfig(options) {
    byId('keepalive-enable').checked = true;
    var payload = {
      keepalive: buildSendPayload('keepalive-value', false)
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('保活任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('keepalive-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用保活任务失败：' + error.message, false);
    });
  }

  function disableKeepaliveConfig() {
    var currentConfig = getManagedConfig().keepalive || getRawConfig().keepalive || { active: true, cron: '0 0 8 */6 * *', model: 2, send: {} };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keepalive: {
          active: false,
          cron: currentConfig.cron || '0 0 8 */6 * *',
          model: Number(currentConfig.model || 2),
          send: currentConfig.send || {}
        }
      })
    }).then(function () {
      toast('保活任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('keepalive-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用保活任务失败：' + error.message, false);
    });
  }

  function saveDoubleConfig(options) {
    byId('double-enable').checked = true;
    var nextConfig = buildSendPayload('double-value', true);
    if (nextConfig.model === 1) {
      var enabledKeys = Object.keys(nextConfig.enabled || {}).filter(function (key) {
        return nextConfig.enabled[key];
      });
      var totalWeight = enabledKeys.reduce(function (sum, key) {
        return sum + (nextConfig.send[key] ? Number(nextConfig.send[key].weight || 0) : 0);
      }, 0);
      if (enabledKeys.length > 0 && totalWeight <= 0) {
        toast('按权重模式至少需要一个已勾选房间填写大于 0 的权重值', false);
        return;
      }
    }

    var payload = {
      doubleCard: nextConfig
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('双倍任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('double-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用双倍任务失败：' + error.message, false);
    });
  }

  function disableDoubleConfig() {
    var currentConfig = getManagedConfig().doubleCard || getRawConfig().doubleCard || { active: true, cron: '0 20 14,17,20,23 * * *', model: 1, send: {}, enabled: {} };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doubleCard: {
          active: false,
          cron: currentConfig.cron || '0 20 14,17,20,23 * * *',
          model: Number(currentConfig.model || 1),
          send: currentConfig.send || {},
          enabled: currentConfig.enabled || {}
        }
      })
    }).then(function () {
      toast('双倍任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('double-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用双倍任务失败：' + error.message, false);
    });
  }

  function triggerTask(type) {
    requestJson('/api/trigger/' + type, {
      method: 'POST'
    }).then(function () {
      toast('执行完成', true);
      loadOverview();
      loadLogs();
      if (state.activeTab === 'overview') {
        loadFansStatus(false);
      }
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('执行失败：' + error.message, false);
    });
  }

  function clearLogs() {
    requestJson('/api/logs', {
      method: 'DELETE'
    }).then(function () {
      toast('日志已清空', true);
      loadLogs();
      loadOverview();
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('清空日志失败：' + error.message, false);
    });
  }

  function saveTheme() {
    var mode = byId('theme-mode').value;
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ui: { themeMode: mode } })
    }).then(function () {
      var config = getRawConfig();
      if (!config.ui) {
        config.ui = {};
      }
      config.ui.themeMode = mode;
      state.rawConfig = config;
      renderTheme();
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存主题失败：' + error.message, false);
    });
  }

  function findActionTarget(node) {
    var current = node;
    while (current && current !== document.body) {
      if (current.getAttribute && current.getAttribute('data-action')) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  document.addEventListener('click', function (event) {
    var target = findActionTarget(event.target);
    if (!target) {
      return;
    }

    var action = target.getAttribute('data-action');
    if (action === 'tab') {
      setActiveTab(target.getAttribute('data-tab'));
      return;
    }
    if (action === 'refresh-overview') {
      refreshOverviewSurface(true);
      return;
    }
    if (action === 'logout') {
      logout();
      return;
    }
    if (action === 'refresh-logs') {
      loadLogs();
      return;
    }
    if (action === 'clear-logs') {
      clearLogs();
      return;
    }
    if (action === 'save-cookie') {
      saveCookie();
      return;
    }
    if (action === 'save-collect') {
      saveCollectConfig();
      return;
    }
    if (action === 'save-keepalive') {
      saveKeepaliveConfig();
      return;
    }
    if (action === 'save-double') {
      saveDoubleConfig();
      return;
    }
    if (action === 'double-fill-equal') {
      applyDoubleRatioPreset('equal');
      return;
    }
    if (action === 'double-fill-level') {
      applyDoubleRatioPreset('level');
      return;
    }
    if (action === 'trigger') {
      triggerTask(target.getAttribute('data-trigger'));
    }
  });

  function handleTaskToggleChange(event, enableTask, disableTask) {
    if (event.target.checked) {
      enableTask({ revertCheckboxOnError: true });
      return;
    }
    disableTask();
  }

  byId('login-form').addEventListener('submit', function (event) {
    event.preventDefault();
    submitLogin();
  });
  byId('theme-mode').addEventListener('change', saveTheme);
  byId('collect-cron').addEventListener('input', function (event) {
    void loadCronPreview('collectGift', event.target.value, 'collect-cron-preview');
  });
  byId('collect-enable').addEventListener('change', function (event) {
    handleTaskToggleChange(event, saveCollectConfig, disableCollectConfig);
  });
  byId('keepalive-cron').addEventListener('input', function (event) {
    void loadCronPreview('keepalive', event.target.value, 'keepalive-cron-preview');
  });
  byId('keepalive-enable').addEventListener('change', function (event) {
    handleTaskToggleChange(event, saveKeepaliveConfig, disableKeepaliveConfig);
  });
  byId('double-cron').addEventListener('input', function (event) {
    void loadCronPreview('doubleCard', event.target.value, 'double-cron-preview');
  });
  byId('double-enable').addEventListener('change', function (event) {
    handleTaskToggleChange(event, saveDoubleConfig, disableDoubleConfig);
  });
  byId('double-model').addEventListener('change', updateDoubleModeUi);
  document.addEventListener('input', function (event) {
    if (event.target && event.target.classList && event.target.classList.contains('double-value')) {
      updateDoubleModeUi();
    }
  });
  document.addEventListener('change', function (event) {
    if (event.target && event.target.classList && event.target.classList.contains('double-enabled')) {
      updateDoubleModeUi();
    }
  });

  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (state.themeMode === 'system') {
          renderTheme();
        }
      });
    } catch (error) {
      // Ignore older browsers that do not support addEventListener on MediaQueryList.
    }
  }

  setInterval(function () {
    if (!state.auth.authenticated) {
      return;
    }
    if (state.activeTab === 'overview') {
      loadOverview();
    }
    if (state.activeTab === 'logs' && byId('logs-auto-refresh').checked) {
      loadLogs();
    }
  }, 5000);

  renderAuth();
  loadAuthStatus().then(function (authenticated) {
    if (!authenticated) {
      return;
    }
    return loadProtectedData();
  });
})();
</script>
</body>
</html>`
}
