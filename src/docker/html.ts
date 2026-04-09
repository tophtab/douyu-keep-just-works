export function getHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>斗鱼粉丝牌续牌</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#1a1a2e;--card:#16213e;--accent:#0f3460;--blue:#53a8b6;--text:#e4e4e4;--muted:#888;--green:#4ecca3;--red:#e74c3c;--border:#2a2a4a}
body{font-family:-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
header{background:var(--accent);padding:16px 24px;font-size:18px;font-weight:600;display:flex;align-items:center;gap:8px}
nav{display:flex;background:var(--card);border-bottom:1px solid var(--border)}
nav button{padding:12px 24px;background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;border-bottom:2px solid transparent}
nav button.active{color:var(--blue);border-bottom-color:var(--blue)}
.tab{display:none;padding:20px;max-width:800px;margin:0 auto}
.tab.active{display:block}
label{display:block;margin:12px 0 4px;font-size:13px;color:var(--muted)}
input,textarea,select{width:100%;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:14px}
textarea{resize:vertical;min-height:60px;font-family:monospace}
.section{background:var(--card);border-radius:8px;padding:16px;margin:12px 0}
.section h3{font-size:15px;margin-bottom:12px;color:var(--blue)}
.row{display:flex;gap:8px;align-items:center;margin:4px 0}
.row input{flex:1}
.btn{padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;color:#fff}
.btn-primary{background:var(--blue)}
.btn-danger{background:var(--red)}
.btn-green{background:var(--green);color:#000}
.btn-sm{padding:4px 10px;font-size:12px}
.btn:disabled{opacity:.5;cursor:not-allowed}
.fans-list{max-height:300px;overflow-y:auto;margin:8px 0}
.fan-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer}
.fan-item:hover{background:var(--accent)}
.fan-item input{width:auto}
.fan-item .fan-info{flex:1;font-size:13px}
.fan-item .fan-level{color:var(--blue);font-size:12px}
.fan-item .fan-intimacy{color:var(--muted);font-size:12px}
.card{background:var(--card);border-radius:8px;padding:16px;margin:8px 0}
.card .status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.card .status-dot.on{background:var(--green)}.card .status-dot.off{background:var(--red)}
.log-box{background:#0d0d1a;border-radius:8px;padding:12px;height:60vh;overflow-y:auto;font-family:monospace;font-size:12px;line-height:1.8}
.log-box .cat{color:var(--blue)}.log-box .time{color:var(--muted)}
.toolbar{display:flex;gap:8px;margin-bottom:12px;align-items:center}
.check{display:flex;align-items:center;gap:6px}
.check input{width:auto}
.mt{margin-top:16px}
.toast{position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:6px;color:#fff;font-size:13px;z-index:99;display:none}
</style>
</head>
<body>
<header>&#127918; 斗鱼粉丝牌续牌 - 管理面板</header>
<nav>
  <button class="active" onclick="switchTab('config')">配置</button>
  <button onclick="switchTab('status')">状态</button>
  <button onclick="switchTab('logs')">日志</button>
</nav>

<div id="config" class="tab active">
  <div class="section">
    <h3>Cookie</h3>
    <textarea id="cookie" placeholder="粘贴斗鱼 Cookie..."></textarea>
  </div>
  <div class="section">
    <div class="check"><input type="checkbox" id="ka-enable" checked><label for="ka-enable" style="margin:0">启用保活任务</label></div>
    <div id="ka-fields">
      <h3 class="mt">保活任务 (Keepalive)</h3>
      <label>Cron 表达式</label>
      <input id="ka-cron" value="0 0 8 * * *" placeholder="秒 分 时 日 月 周">
      <label>分配模式</label>
      <select id="ka-model"><option value="1">按百分比</option><option value="2">按固定数量</option></select>
      <label>房间列表</label>
      <div id="ka-rooms"></div>
      <button class="btn btn-sm btn-primary mt" onclick="addRoom('ka')">+ 添加房间</button>
    </div>
  </div>
  <div class="section">
    <div class="check"><input type="checkbox" id="dc-enable"><label for="dc-enable" style="margin:0">启用双倍卡检测</label></div>
    <div id="dc-fields" style="display:none">
      <h3 class="mt">双倍卡检测 (Double Card)</h3>
      <label>Cron 表达式</label>
      <input id="dc-cron" value="0 */4 * * *" placeholder="分 时 日 月 周">
      <label>分配模式</label>
      <select id="dc-model"><option value="1">按百分比</option><option value="2">按固定数量</option></select>
      <label>房间列表</label>
      <div id="dc-rooms"></div>
      <button class="btn btn-sm btn-primary mt" onclick="addRoom('dc')">+ 添加房间</button>
    </div>
  </div>
  <div class="section">
    <h3>粉丝牌列表</h3>
    <button class="btn btn-primary" onclick="fetchFans()" id="fetch-fans-btn">获取粉丝牌列表</button>
    <div class="fans-list" id="fans-list" style="display:none"></div>
    <button class="btn btn-green mt" onclick="applySelectedFans()" id="apply-fans-btn" style="display:none">应用选中的房间到保活任务</button>
  </div>
  <button class="btn btn-green mt" onclick="saveConfig()" style="width:100%;padding:12px">保存配置并启动</button>
</div>

<div id="status" class="tab">
  <div class="card">
    <h3><span class="status-dot off" id="ka-dot"></span>保活任务</h3>
    <p id="ka-status-text" style="margin:8px 0;font-size:13px;color:var(--muted)">未启动</p>
    <button class="btn btn-primary btn-sm" onclick="trigger('keepalive')">手动执行</button>
  </div>
  <div class="card">
    <h3><span class="status-dot off" id="dc-dot"></span>双倍卡检测</h3>
    <p id="dc-status-text" style="margin:8px 0;font-size:13px;color:var(--muted)">未启动</p>
    <button class="btn btn-primary btn-sm" onclick="trigger('doubleCard')">手动执行</button>
  </div>
</div>

<div id="logs" class="tab">
  <div class="toolbar">
    <div class="check"><input type="checkbox" id="auto-refresh" checked><label for="auto-refresh" style="margin:0">自动刷新</label></div>
    <button class="btn btn-sm btn-danger" onclick="clearLogs()">清空日志</button>
  </div>
  <div class="log-box" id="log-box"></div>
</div>

<div class="toast" id="toast"></div>
<script>
function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  event.target.classList.add('active');
  if(name==='status')loadStatus();
  if(name==='logs')loadLogs();
}
function toast(msg,ok){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.background=ok?'var(--green)':'var(--red)';
  t.style.display='block';setTimeout(()=>t.style.display='none',3000);
}
function roomHtml(prefix,room){
  const r=room||{roomId:'',percentage:100,number:1};
  return '<div class="row room-row"><input type="number" placeholder="房间号" value="'+r.roomId+'" class="room-id">'
    +'<input type="number" placeholder="百分比/数量" value="'+(r.percentage||r.number||1)+'" class="room-val" style="max-width:120px">'
    +'<button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">删除</button></div>';
}
function addRoom(prefix,room){document.getElementById(prefix+'-rooms').insertAdjacentHTML('beforeend',roomHtml(prefix,room))}
function collectRooms(prefix){
  const send={};const model=+document.getElementById(prefix+'-model').value;
  document.querySelectorAll('#'+prefix+'-rooms .room-row').forEach(row=>{
    const id=row.querySelector('.room-id').value.trim();
    const val=+row.querySelector('.room-val').value;
    if(!id)return;
    send[id]={roomId:+id,giftId:268,number:model===2?val:0,percentage:model===1?val:0};
  });return send;
}
document.getElementById('ka-enable').onchange=function(){document.getElementById('ka-fields').style.display=this.checked?'':'none'};
document.getElementById('dc-enable').onchange=function(){document.getElementById('dc-fields').style.display=this.checked?'':'none'};

async function saveConfig(){
  const config={cookie:document.getElementById('cookie').value.trim()};
  if(document.getElementById('ka-enable').checked){
    config.keepalive={cron:document.getElementById('ka-cron').value.trim(),
      model:+document.getElementById('ka-model').value,send:collectRooms('ka'),
      time:'跟随执行模式',timeValue:[0,1,2,3,4,5,6]};
  }
  if(document.getElementById('dc-enable').checked){
    config.doubleCard={cron:document.getElementById('dc-cron').value.trim(),
      model:+document.getElementById('dc-model').value,send:collectRooms('dc'),
      time:'跟随执行模式',timeValue:[0,1,2,3,4,5,6]};
  }
  try{
    const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)});
    const d=await r.json();
    if(d.ok)toast('配置已保存，任务已启动',true);else toast(d.error||'保存失败',false);
  }catch(e){toast('请求失败: '+e.message,false)}
}
async function loadConfig(){
  try{
    const r=await fetch('/api/config/raw');const d=await r.json();
    if(!d.exists)return;const c=d.data;
    document.getElementById('cookie').value=c.cookie||'';
    if(c.keepalive){
      document.getElementById('ka-enable').checked=true;
      document.getElementById('ka-fields').style.display='';
      document.getElementById('ka-cron').value=c.keepalive.cron||'';
      document.getElementById('ka-model').value=c.keepalive.model||1;
      Object.values(c.keepalive.send||{}).forEach(r=>addRoom('ka',r));
    }
    if(c.doubleCard){
      document.getElementById('dc-enable').checked=true;
      document.getElementById('dc-fields').style.display='';
      document.getElementById('dc-cron').value=c.doubleCard.cron||'';
      document.getElementById('dc-model').value=c.doubleCard.model||1;
      Object.values(c.doubleCard.send||{}).forEach(r=>addRoom('dc',r));
    }
  }catch(e){}
}
async function loadStatus(){
  try{
    const r=await fetch('/api/status');const d=await r.json();
    const ka=d.keepalive,dc=d.doubleCard;
    document.getElementById('ka-dot').className='status-dot '+(ka.running?'on':'off');
    document.getElementById('ka-status-text').textContent=ka.running?'运行中 | 上次: '+(ka.lastRun||'无')+' | 下次: '+(ka.nextRun||'无'):'未启动';
    document.getElementById('dc-dot').className='status-dot '+(dc.running?'on':'off');
    document.getElementById('dc-status-text').textContent=dc.running?'运行中 | 上次: '+(dc.lastRun||'无')+' | 下次: '+(dc.nextRun||'无'):'未启动';
  }catch(e){}
}
async function loadLogs(){
  try{
    const r=await fetch('/api/logs');const logs=await r.json();
    const box=document.getElementById('log-box');
    box.innerHTML=logs.map(l=>'<div><span class="time">'+l.timestamp.replace('T',' ').substring(0,19)+'</span> <span class="cat">['+l.category+']</span> '+l.message+'</div>').join('');
    box.scrollTop=box.scrollHeight;
  }catch(e){}
}
async function clearLogs(){
  await fetch('/api/logs',{method:'DELETE'});loadLogs();
}
async function trigger(type){
  toast('正在执行...',true);
  try{
    const r=await fetch('/api/trigger/'+type,{method:'POST'});const d=await r.json();
    if(d.ok)toast('执行完成',true);else toast(d.error||'执行失败',false);
  }catch(e){toast('请求失败',false)}
}
let fansData=[];
async function fetchFans(){
  const btn=document.getElementById('fetch-fans-btn');
  btn.disabled=true;btn.textContent='获取中...';
  try{
    const r=await fetch('/api/fans');if(!r.ok){const e=await r.json();throw new Error(e.error||'获取失败')}
    fansData=await r.json();
    const list=document.getElementById('fans-list');
    list.style.display='';document.getElementById('apply-fans-btn').style.display='';
    list.innerHTML=fansData.map((f,i)=>'<label class="fan-item"><input type="checkbox" value="'+i+'" checked>'
      +'<span class="fan-info">'+f.name+' (房间: '+f.roomId+')</span>'
      +'<span class="fan-level">Lv.'+f.level+'</span>'
      +'<span class="fan-intimacy">亲密度: '+f.intimacy+' | 今日: '+f.today+'</span></label>').join('');
    toast('获取到 '+fansData.length+' 个粉丝牌',true);
  }catch(e){toast(e.message,false)}
  btn.disabled=false;btn.textContent='获取粉丝牌列表';
}
function applySelectedFans(){
  const checks=document.querySelectorAll('#fans-list input:checked');
  const prefix='ka';
  document.getElementById(prefix+'-rooms').innerHTML='';
  checks.forEach(cb=>{
    const f=fansData[+cb.value];
    addRoom(prefix,{roomId:f.roomId,percentage:100,number:1});
  });
  toast('已应用 '+checks.length+' 个房间到保活任务',true);
}
loadConfig();
setInterval(()=>{
  if(document.getElementById('auto-refresh')&&document.getElementById('auto-refresh').checked&&document.getElementById('logs').classList.contains('active'))loadLogs();
  if(document.getElementById('status').classList.contains('active'))loadStatus();
},3000);
</script>
</body></html>`
}
