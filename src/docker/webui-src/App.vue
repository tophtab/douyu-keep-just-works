<script setup lang="ts">
interface WebUiBootstrap {
  appName: string
  appVersionLabel: string
  pageRoutes: Record<string, string>
}

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_BOOTSTRAP?: WebUiBootstrap
  }
}

const bootstrap: WebUiBootstrap = window.DOUYU_KEEP_WEBUI_BOOTSTRAP ?? {
  appName: 'douyu-keep',
  appVersionLabel: 'V0.0.0',
  pageRoutes: { overview: '/' },
}
</script>

<!-- eslint-disable -->
<template>
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
      <form id="login-form" autocomplete="on">
        <div class="field-block" style="margin-top:18px">
          <label class="field-label" for="web-password-input">WebUI 密码</label>
          <input id="web-password-input" name="web-password" type="password" autocomplete="current-password" spellcheck="false" placeholder="请输入管理密码">
        </div>
        <div class="auth-error" id="login-error" role="alert"></div>
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
    <div class="brand-row">
      <h1 class="brand-title">{{ bootstrap.appName }}</h1>
      <span class="version-label">{{ bootstrap.appVersionLabel }}</span>
    </div>
    <p class="brand-copy">更聚焦的 Docker 管理台。先看概况，再分别管理登录、领取、保活、双倍、临期和鱼吧签到任务。</p>

    <div class="tab-list" role="tablist" aria-label="管理台页面" aria-orientation="vertical">
      <button class="tab-btn active" type="button" role="tab" id="tab-overview" data-action="tab" data-tab="overview" aria-selected="true" aria-controls="page-overview">概况</button>
      <button class="tab-btn" type="button" role="tab" id="tab-login" data-action="tab" data-tab="login" aria-selected="false" aria-controls="page-login" tabindex="-1">登录</button>
      <button class="tab-btn" type="button" role="tab" id="tab-collect" data-action="tab" data-tab="collect" aria-selected="false" aria-controls="page-collect" tabindex="-1">领取任务</button>
      <button class="tab-btn" type="button" role="tab" id="tab-keepalive" data-action="tab" data-tab="keepalive" aria-selected="false" aria-controls="page-keepalive" tabindex="-1">保活任务</button>
      <button class="tab-btn" type="button" role="tab" id="tab-double-card" data-action="tab" data-tab="double-card" aria-selected="false" aria-controls="page-double-card" tabindex="-1">双倍任务</button>
      <button class="tab-btn" type="button" role="tab" id="tab-expiring-gift" data-action="tab" data-tab="expiring-gift" aria-selected="false" aria-controls="page-expiring-gift" tabindex="-1">临期任务</button>
      <button class="tab-btn" type="button" role="tab" id="tab-yuba" data-action="tab" data-tab="yuba" aria-selected="false" aria-controls="page-yuba" tabindex="-1">鱼吧签到</button>
      <button class="tab-btn" type="button" role="tab" id="tab-logs" data-action="tab" data-tab="logs" aria-selected="false" aria-controls="page-logs" tabindex="-1">运行日志</button>
    </div>

    <div class="theme-box">
      <div class="field-label" id="theme-mode-label">主题模式</div>
      <div class="theme-options" role="group" aria-labelledby="theme-mode-label">
        <button class="theme-option" type="button" data-action="theme-mode" data-theme-mode="light" aria-label="浅色模式" title="浅色模式">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2"></path>
            <path d="M12 20v2"></path>
            <path d="m4.93 4.93 1.41 1.41"></path>
            <path d="m17.66 17.66 1.41 1.41"></path>
            <path d="M2 12h2"></path>
            <path d="M20 12h2"></path>
            <path d="m6.34 17.66-1.41 1.41"></path>
            <path d="m19.07 4.93-1.41 1.41"></path>
          </svg>
        </button>
        <button class="theme-option" type="button" data-action="theme-mode" data-theme-mode="dark" aria-label="深色模式" title="深色模式">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a6 6 0 0 0 9 7.4A9 9 0 1 1 12 3Z"></path>
          </svg>
        </button>
        <button class="theme-option" type="button" data-action="theme-mode" data-theme-mode="system" aria-label="自动模式" title="自动模式">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="12" rx="2"></rect>
            <path d="M8 20h8"></path>
            <path d="M12 16v4"></path>
          </svg>
        </button>
      </div>
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
        <button class="btn btn-secondary toolbar-icon-btn" type="button" data-action="refresh-overview" aria-label="刷新" title="刷新">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3z"></path>
          </svg>
        </button>
        <button class="btn btn-secondary toolbar-icon-btn toolbar-icon-btn-wide" type="button" data-action="logout" aria-label="退出登录" title="退出登录">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4h2v4h14V5H5v4H3V5a2 2 0 0 1 2-2z"></path>
            <path d="M10.08 15.59 12.67 13H3v-2h9.67l-2.59-2.59L11.5 7l5 5-5 5z"></path>
          </svg>
        </button>
      </div>
    </div>

    <section class="page active" id="page-overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0" aria-hidden="false">
      <div class="overview-stack">
        <div class="panel">
          <div class="section-kicker">基础状态</div>
          <h3 class="section-title">概况</h3>
          <p class="subtle">这里只保留登录与任务开关概览，详细状态请进入对应功能页查看。</p>
          <div class="summary-grid quad" id="overview-basic-summary" style="margin-top:16px">
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
            <div class="strip-metrics compact overview-gift-summary" id="overview-gift-summary">
              <div class="strip-metric">
                <div class="mini-label">当前荧光棒</div>
                <div class="mini-value">-</div>
              </div>
              <div class="strip-metric">
                <div class="mini-label">过期时间</div>
                <div class="mini-value">-</div>
              </div>
            </div>
          </div>
          <div class="subtle overview-table-note" id="overview-fans-note" role="status" aria-live="polite">正在加载粉丝牌状态…</div>
          <div id="overview-fans-table-wrap" style="margin-top:16px"></div>
        </div>
      </div>
    </section>

    <section class="page" id="page-login" role="tabpanel" aria-labelledby="tab-login" tabindex="0" aria-hidden="true" hidden>
      <div class="task-card" id="cookie-login-card" style="margin-bottom:16px">
        <div class="task-card-title">登录状态</div>
      </div>

      <div class="panel">
        <h3 class="section-title">登录 Cookie</h3>
        <p class="subtle">运行时只使用本地登录 Cookie 快照。直播和鱼吧的 Cookie 分开保存，避免同名字段互相覆盖。启用 CookieCloud 后，系统会先同步到这里，再由各任务读取这两份本地值。</p>
        <div class="grid cols-2" style="margin-top:16px">
          <div class="field-block" style="margin-top:0">
            <label class="field-label" for="main-cookie-input">斗鱼直播的 Cookie</label>
            <textarea id="main-cookie-input" name="main-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 www.douyu.com / douyu.com 登录 Cookie"></textarea>
          </div>
          <div class="field-block" style="margin-top:0">
            <label class="field-label" for="yuba-cookie-input">斗鱼鱼吧的 Cookie</label>
            <textarea id="yuba-cookie-input" name="yuba-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 yuba.douyu.com 登录 Cookie"></textarea>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-success" type="button" data-action="save-cookie">保存手填 Cookie</button>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-head">
          <div>
            <h3 class="section-title" style="margin-top:0">CookieCloud 同步</h3>
            <p class="subtle">从浏览器同步斗鱼相关域完整 Cookie，自动覆盖主站与鱼吧，避免手动复制两份 Cookie。</p>
          </div>
          <div class="field-block" style="margin:0">
            <label class="switch-control">
              <input class="switch-input" type="checkbox" id="cookie-cloud-enable" name="cookie-cloud-enable" aria-label="启用 CookieCloud 同步">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field-block">
            <label class="field-label" for="cookie-cloud-endpoint">Endpoint</label>
            <input id="cookie-cloud-endpoint" name="cookie-cloud-endpoint" type="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="https://cookiecloud.example.com">
          </div>
          <div class="field-block">
            <label class="field-label" for="cookie-cloud-uuid">UUID</label>
            <input id="cookie-cloud-uuid" name="cookie-cloud-uuid" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="CookieCloud UUID">
          </div>
          <div class="field-block">
            <label class="field-label" for="cookie-cloud-cron">同步 Cron</label>
            <input id="cookie-cloud-cron" name="cookie-cloud-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="0 5 0 * * *">
            <div class="helper cron-preview" id="cookie-cloud-cron-preview" role="status" aria-live="polite">正在计算未来执行时间…</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="cookie-cloud-password">密码</label>
            <input id="cookie-cloud-password" name="cookie-cloud-password" type="password" autocomplete="current-password" spellcheck="false" placeholder="CookieCloud Password">
          </div>
        </div>
        <div class="status-box" id="cookie-cloud-note" role="status" aria-live="polite" style="margin-top:16px">等待校验…</div>
        <div class="actions cookie-cloud-actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" data-action="save-cookie-cloud">保存并启用</button>
          <button class="btn btn-secondary" type="button" data-action="check-cookie-source">同步并校验</button>
        </div>
      </div>
    </section>

    <section class="page" id="page-collect" role="tabpanel" aria-labelledby="tab-collect" tabindex="0" aria-hidden="true" hidden>
      <div class="task-card" id="collect-task-card" style="margin-bottom:16px">
        <div class="task-card-title">领取状态</div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div>
            <h3 class="section-title" style="margin-top:0">启动领取任务</h3>
            <p class="subtle">领取任务独立成栏，包含任务状态、启停控制、Cron 设置和手动触发。</p>
          </div>
          <div class="field-block" style="margin:0">
            <label class="switch-control">
              <input class="switch-input" type="checkbox" id="collect-enable" name="collect-enable" aria-label="启用领取任务">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="field-block">
          <label class="field-label" for="collect-cron">Cron 表达式</label>
          <input id="collect-cron" name="collect-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">
          <div class="helper cron-preview" id="collect-cron-preview" role="status" aria-live="polite">正在计算未来执行时间…</div>
        </div>
        <div class="actions">
          <button class="btn btn-success" type="button" data-action="save-collect">保存并启用</button>
          <button class="btn btn-secondary" type="button" data-action="trigger" data-trigger="collectGift">立即领取</button>
        </div>
      </div>
    </section>

    <section class="page" id="page-yuba" role="tabpanel" aria-labelledby="tab-yuba" tabindex="0" aria-hidden="true" hidden>
      <div class="task-card" id="yuba-task-card">
        <div class="task-card-title">鱼吧签到状态</div>
      </div>
      <div class="status-box" id="yuba-note" role="status" aria-live="polite" style="margin-top:16px">等待加载…</div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用鱼吧签到任务</div>
              <div class="switch-note">通过当前鱼吧 HTTP 接口签到全部已关注鱼吧，不使用浏览器自动化。</div>
            </div>
            <label class="switch-control">
              <input class="switch-input" type="checkbox" id="yuba-enable" name="yuba-enable" aria-label="启用鱼吧签到任务">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field-block">
            <label class="field-label" for="yuba-cron">Cron 表达式</label>
            <input id="yuba-cron" name="yuba-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">
            <div class="helper cron-preview" id="yuba-cron-preview" role="status" aria-live="polite">正在计算未来执行时间…</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="yuba-mode">签到模式</label>
            <select id="yuba-mode" name="yuba-mode">
              <option value="followed">签到全部已关注鱼吧</option>
            </select>
          </div>
        </div>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" data-action="save-yuba">保存并启用</button>
          <button class="btn btn-secondary" type="button" data-action="trigger" data-trigger="yubaCheckIn">立即签到</button>
        </div>
        <div id="yuba-table-wrap" style="margin-top:16px"></div>
      </div>
    </section>

    <section class="page" id="page-keepalive" role="tabpanel" aria-labelledby="tab-keepalive" tabindex="0" aria-hidden="true" hidden>
      <div class="task-card" id="keepalive-task-card">
        <div class="task-card-title">保活状态</div>
      </div>
      <div class="status-box" id="keepalive-note" role="status" aria-live="polite" style="margin-top:16px">等待加载…</div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用保活任务</div>
              <div class="switch-note">关闭后保留配置，但不执行保活调度。</div>
            </div>
            <label class="switch-control">
              <input class="switch-input" type="checkbox" id="keepalive-enable" name="keepalive-enable" aria-label="启用保活任务">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field-block">
            <label class="field-label" for="keepalive-cron">Cron 表达式</label>
            <input id="keepalive-cron" name="keepalive-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">
            <div class="helper cron-preview" id="keepalive-cron-preview" role="status" aria-live="polite">正在计算未来执行时间…</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="keepalive-model">分配模式</label>
            <select id="keepalive-model" name="keepalive-model">
              <option value="1">按权重</option>
              <option value="2">按固定数量</option>
            </select>
          </div>
        </div>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" data-action="save-keepalive">保存并启用</button>
          <button class="btn btn-secondary" type="button" data-action="trigger" data-trigger="keepalive">立即保活</button>
        </div>
        <div id="keepalive-table-wrap" style="margin-top:16px"></div>
      </div>
    </section>

    <section class="page" id="page-double-card" role="tabpanel" aria-labelledby="tab-double-card" tabindex="0" aria-hidden="true" hidden>
      <div class="task-card" id="double-task-card">
        <div class="task-card-title">双倍状态</div>
      </div>
      <div class="status-box" id="double-note" role="status" aria-live="polite" style="margin-top:16px">等待加载…</div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用双倍任务</div>
              <div class="switch-note">关闭后不执行双倍检测与赠送，但保留当前分配设置。</div>
            </div>
            <label class="switch-control">
              <input class="switch-input" type="checkbox" id="double-enable" name="double-enable" aria-label="启用双倍任务">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-3">
          <div class="field-block">
            <label class="field-label" for="double-cron">Cron 表达式</label>
            <input id="double-cron" name="double-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">
            <div class="helper cron-preview" id="double-cron-preview" role="status" aria-live="polite">正在计算未来执行时间…</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="double-gift-scope">礼物范围</label>
            <select id="double-gift-scope" name="double-gift-scope">
              <option value="glowStick">全部荧光棒</option>
              <option value="limitedTime">限时礼物</option>
            </select>
          </div>
          <div class="field-block">
            <label class="field-label" for="double-model">分配模式</label>
            <select id="double-model" name="double-model">
              <option value="1">按权重</option>
              <option value="2">按固定数量</option>
            </select>
          </div>
        </div>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" data-action="save-double">保存并启用</button>
          <button class="btn btn-secondary" type="button" data-action="trigger" data-trigger="doubleCard">立即检测</button>
        </div>
        <div class="status-box" style="margin-top:16px">
          <div class="split-inline">
            <div class="split-inline-copy">
              <div class="section-kicker">分配说明</div>
              <p class="subtle" id="double-mode-help" style="margin-top:8px">按权重模式会根据当前勾选房间的权重值动态重新分配。</p>
              <div class="helper" id="double-ratio-preview" role="status" aria-live="polite" style="margin-top:10px">等待计算当前权重预览…</div>
            </div>
            <div class="split-inline-actions" id="double-ratio-tools">
              <button class="btn btn-secondary" type="button" data-action="double-fill-equal">参与房间全部设为 1</button>
              <button class="btn btn-secondary" type="button" data-action="double-fill-level">按粉丝牌等级填入</button>
            </div>
          </div>
        </div>
        <div id="double-table-wrap" style="margin-top:16px"></div>
      </div>
    </section>

    <section class="page" id="page-expiring-gift" role="tabpanel" aria-labelledby="tab-expiring-gift" tabindex="0" aria-hidden="true" hidden>
      <div class="task-card" id="expiring-task-card">
        <div class="task-card-title">临期状态</div>
      </div>
      <div class="status-box" id="expiring-note" role="status" aria-live="polite" style="margin-top:16px">等待加载…</div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用临期任务</div>
              <div class="switch-note">达到临期阈值后，按房间配置释放有明确过期时间的临期背包礼物。</div>
            </div>
            <label class="switch-control">
              <input class="switch-input" type="checkbox" id="expiring-enable" name="expiring-enable" aria-label="启用临期任务">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-3">
          <div class="field-block">
            <label class="field-label" for="expiring-cron">Cron 表达式</label>
            <input id="expiring-cron" name="expiring-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">
            <div class="helper cron-preview" id="expiring-cron-preview" role="status" aria-live="polite">正在计算未来执行时间…</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="expiring-threshold-hours">临期阈值（小时）</label>
            <input id="expiring-threshold-hours" name="expiring-threshold-hours" type="number" min="1" step="1" inputmode="numeric">
          </div>
          <div class="field-block">
            <label class="field-label" for="expiring-model">分配模式</label>
            <select id="expiring-model" name="expiring-model">
              <option value="1">按权重</option>
              <option value="2">按固定数量</option>
            </select>
          </div>
        </div>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" data-action="save-expiring">保存并启用</button>
          <button class="btn btn-secondary" type="button" data-action="trigger" data-trigger="expiringGift">立即执行</button>
        </div>
        <div id="expiring-backpack-wrap" style="margin-top:16px"></div>
        <div id="expiring-table-wrap" style="margin-top:16px"></div>
      </div>
    </section>

    <section class="page" id="page-logs" role="tabpanel" aria-labelledby="tab-logs" tabindex="0" aria-hidden="true" hidden>
      <div class="panel">
        <h3 class="section-title">运行日志</h3>
        <p class="subtle" id="logs-summary" role="status" aria-live="polite" style="margin-top:10px">仅保留最近 500 条日志，正在加载…</p>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-secondary" type="button" data-action="refresh-logs">手动刷新</button>
          <button class="btn btn-danger" type="button" data-action="clear-logs">清空日志</button>
          <label class="inline" style="margin-left:4px">
            <input type="checkbox" id="logs-auto-refresh" name="logs-auto-refresh" checked>
            <span>自动刷新</span>
          </label>
        </div>
        <div class="log-box" id="full-log-box" style="margin-top:16px"></div>
      </div>
    </section>
  </main>
</div>

<div class="sr-only" id="toast-live" role="status" aria-live="polite" aria-atomic="true"></div>
<div class="toast" id="toast" aria-hidden="true"></div>

</template>
