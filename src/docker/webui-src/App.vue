<script setup lang="ts">
import { useAuthSession } from './auth'
import { useCollectTaskPage } from './collect'
import { useCookieLoginPage } from './cookie'
import { useDoubleTaskPage } from './double'
import { useExpiringGiftTaskPage } from './expiring'
import { useKeepaliveTaskPage } from './keepalive'
import { usePageNavigation } from './navigation'
import { useOverviewPage } from './overview'
import { useLogsPage } from './resources'
import { useThemeMode } from './theme'
import { useToastRegion } from './toast'
import { useYubaTaskPage } from './yuba'

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

const {
  activePageMeta,
  activeTab,
  handleTabKeydown,
  selectTab,
  tabs,
} = usePageNavigation(bootstrap.pageRoutes)

const {
  authenticated,
  loginError,
  logout,
  password,
  submitLogin,
  submittingLogin,
} = useAuthSession()

const {
  savingThemeMode,
  selectThemeMode,
  themeMode,
  themeModes,
  themeNote,
} = useThemeMode()

const {
  toastLiveMessage,
  toastMessage,
  toastOk,
  toastVisible,
} = useToastRegion()

const {
  clearLogs,
  clearingLogs,
  formattedLogs,
  logsAutoRefresh,
  logsLoading,
  logsSummary,
  logBoxRef,
  refreshLogs,
} = useLogsPage(activeTab, authenticated)

const {
  overviewFansEmptyText,
  overviewFansNote,
  overviewFansRows,
  overviewGiftMetrics,
  overviewStatusCells,
  refreshLoading,
  refreshOverview,
  refreshOverviewTitle,
  showOverviewFansTable,
  showOverviewLoginAction,
} = useOverviewPage()

const {
  checkCookieSource,
  cookieCheckText,
  cookieCloud,
  cronPreviewText,
  handleCookieCloudToggle,
  loadCookieCloudCronPreview,
  loginStatus,
  mainCookie,
  saveAndEnableCookieCloud,
  saveCookie,
  yubaCookie,
} = useCookieLoginPage()

const {
  collectCron,
  collectCronPreviewText,
  collectEnabled,
  collectTaskCard,
  handleCollectToggle,
  loadCollectCronPreview,
  saveCollectConfig,
  triggerCollectTask,
} = useCollectTaskPage()

const {
  handleYubaToggle,
  loadYubaCronPreview,
  saveYubaConfig,
  showYubaTable,
  triggerYubaTask,
  yubaCron,
  yubaCronPreviewText,
  yubaEmptyText,
  yubaEnabled,
  yubaMode,
  yubaNote,
  yubaTableRows,
  yubaTaskCard,
} = useYubaTaskPage()

const {
  fanRows: keepaliveFanRows,
  handleKeepaliveModelChange,
  handleKeepaliveToggle,
  keepaliveCron,
  keepaliveCronPreviewText,
  keepaliveEmptyText,
  keepaliveEnabled,
  keepaliveModel,
  keepaliveNote,
  keepaliveTaskCard,
  keepaliveValueLabel,
  loadKeepaliveCronPreview,
  saveKeepaliveConfig,
  showKeepaliveTable,
  triggerKeepaliveTask,
} = useKeepaliveTaskPage()

const {
  applyDoubleRatioPreset,
  doubleCron,
  doubleCronPreviewText,
  doubleEmptyText,
  doubleEnabled,
  doubleFanRows,
  doubleGiftScope,
  doubleModeHelp,
  doubleModel,
  doubleNote,
  doubleRatioPreview,
  doubleTaskCard,
  doubleValueLabel,
  handleDoubleToggle,
  loadDoubleCronPreview,
  saveDoubleConfig,
  showDoubleRatioTools,
  showDoubleTable,
  triggerDoubleTask,
} = useDoubleTaskPage()

const {
  expiringBackpackEmptyText,
  expiringBackpackRows,
  expiringCron,
  expiringCronPreviewText,
  expiringEnabled,
  expiringFanRows,
  expiringModel,
  expiringNote,
  expiringTableEmptyText,
  expiringTaskCard,
  expiringThresholdHours,
  expiringValueLabel,
  handleExpiringModelChange,
  handleExpiringToggle,
  loadExpiringCronPreview,
  saveExpiringGiftConfig,
  showExpiringBackpackTable,
  showExpiringTable,
  triggerExpiringTask,
} = useExpiringGiftTaskPage()
</script>

<!-- eslint-disable -->
<template>
<div v-show="!authenticated" class="auth-shell" id="auth-shell">
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
      <form id="login-form" autocomplete="on" @submit.prevent="submitLogin">
        <div class="field-block" style="margin-top:18px">
          <label class="field-label" for="web-password-input">WebUI 密码</label>
          <input id="web-password-input" v-model="password" name="web-password" type="password" autocomplete="current-password" spellcheck="false" placeholder="请输入管理密码" :disabled="submittingLogin">
        </div>
        <div v-show="loginError" class="auth-error" id="login-error" role="alert">{{ loginError }}</div>
        <div class="actions auth-actions">
          <button class="btn btn-success" type="submit" id="login-submit" :disabled="submittingLogin">{{ submittingLogin ? '登录中…' : '登录' }}</button>
        </div>
      </form>
      <div class="auth-hint">初始密码可通过容器环境变量 WEB_PASSWORD 配置。</div>
    </section>
  </div>
</div>

<div v-show="authenticated" class="shell" id="app-shell">
  <aside class="sidebar">
    <div class="brand-row">
      <h1 class="brand-title">{{ bootstrap.appName }}</h1>
      <span class="version-label">{{ bootstrap.appVersionLabel }}</span>
    </div>
    <p class="brand-copy">更聚焦的 Docker 管理台。先看概况，再分别管理登录、领取、保活、双倍、临期和鱼吧签到任务。</p>

    <div class="tab-list" role="tablist" aria-label="管理台页面" aria-orientation="vertical">
      <button
        v-for="tab in tabs"
        :id="`tab-${tab.key}`"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        type="button"
        role="tab"
        :data-tab="tab.key"
        :aria-selected="activeTab === tab.key ? 'true' : 'false'"
        :aria-controls="`page-${tab.key}`"
        :tabindex="activeTab === tab.key ? 0 : -1"
        @click="selectTab(tab.key)"
        @keydown="handleTabKeydown"
      >{{ tab.label }}</button>
    </div>

    <div class="theme-box">
      <div class="field-label" id="theme-mode-label">主题模式</div>
      <div class="theme-options" role="group" aria-labelledby="theme-mode-label">
        <button
          v-for="option in themeModes"
          :key="option.mode"
          class="theme-option"
          :class="{ active: themeMode === option.mode }"
          type="button"
          :data-theme-mode="option.mode"
          :aria-label="option.label"
          :aria-pressed="themeMode === option.mode ? 'true' : 'false'"
          :aria-busy="savingThemeMode === option.mode ? 'true' : 'false'"
          :title="option.title"
          @click="selectThemeMode(option.mode)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <template v-if="option.mode === 'light'">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M12 2v2"></path>
              <path d="M12 20v2"></path>
              <path d="m4.93 4.93 1.41 1.41"></path>
              <path d="m17.66 17.66 1.41 1.41"></path>
              <path d="M2 12h2"></path>
              <path d="M20 12h2"></path>
              <path d="m6.34 17.66-1.41 1.41"></path>
              <path d="m19.07 4.93-1.41 1.41"></path>
            </template>
            <template v-else-if="option.mode === 'dark'">
              <path d="M12 3a6 6 0 0 0 9 7.4A9 9 0 1 1 12 3Z"></path>
            </template>
            <template v-else>
              <rect x="3" y="4" width="18" height="12" rx="2"></rect>
              <path d="M8 20h8"></path>
              <path d="M12 16v4"></path>
            </template>
          </svg>
        </button>
      </div>
      <div class="theme-note" id="theme-note">{{ themeNote }}</div>
    </div>
  </aside>

  <main class="main">
    <div class="header">
      <div>
        <h2 class="page-title" id="page-title">{{ activePageMeta.title }}</h2>
        <p class="page-subtitle" id="page-subtitle">{{ activePageMeta.subtitle }}</p>
      </div>
      <div class="toolbar">
        <button class="btn btn-secondary toolbar-icon-btn" type="button" aria-label="刷新" :title="refreshOverviewTitle" :disabled="refreshLoading" :aria-busy="refreshLoading ? 'true' : 'false'" @click="refreshOverview">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3z"></path>
          </svg>
        </button>
        <button class="btn btn-secondary toolbar-icon-btn toolbar-icon-btn-wide" type="button" aria-label="退出登录" title="退出登录" @click="logout">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4h2v4h14V5H5v4H3V5a2 2 0 0 1 2-2z"></path>
            <path d="M10.08 15.59 12.67 13H3v-2h9.67l-2.59-2.59L11.5 7l5 5-5 5z"></path>
          </svg>
        </button>
      </div>
    </div>

    <section class="page" :class="{ active: activeTab === 'overview' }" id="page-overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0" :aria-hidden="activeTab === 'overview' ? 'false' : 'true'" :hidden="activeTab !== 'overview'">
      <div class="overview-stack">
        <div class="panel">
          <div class="section-kicker">基础状态</div>
          <h3 class="section-title">概况</h3>
          <p class="subtle">这里只保留登录与任务开关概览，详细状态请进入对应功能页查看。</p>
          <div class="summary-grid quad" style="margin-top:16px">
            <div v-for="cell in overviewStatusCells" :key="cell.label" class="strip-metric">
              <div class="mini-label">{{ cell.label }}</div>
              <div class="mini-value"><span class="pill" :class="cell.enabled ? 'ok' : 'off'">{{ cell.enabled ? cell.enabledText : cell.disabledText }}</span></div>
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
            <div class="strip-metrics compact overview-gift-summary">
              <div v-for="metric in overviewGiftMetrics" :key="metric.label" class="strip-metric">
                <div class="mini-label">{{ metric.label }}</div>
                <div class="mini-value">{{ metric.value }}</div>
              </div>
            </div>
          </div>
          <div class="subtle overview-table-note" role="status" aria-live="polite">{{ overviewFansNote }}</div>
          <div style="margin-top:16px">
            <div v-if="showOverviewLoginAction" class="empty empty-with-action">
              保存 Cookie 或启用 CookieCloud 后再点击顶部“刷新”，这里会直接展示粉丝牌与双倍状态。
              <div class="empty-action"><button class="btn btn-primary" type="button" @click="selectTab('login')">前往登录</button></div>
            </div>
            <div v-else-if="showOverviewFansTable" class="table-shell">
              <table class="table table-fixed fans-status-table">
                <colgroup><col><col><col><col><col><col><col><col></colgroup>
                <thead>
                  <tr>
                    <th scope="col" class="index-head">序号</th>
                    <th scope="col">主播名称</th>
                    <th scope="col" class="num-head">房间号</th>
                    <th scope="col" class="num-head">等级</th>
                    <th scope="col" class="num-head">排名</th>
                    <th scope="col" class="num-head">今日亲密度</th>
                    <th scope="col" class="num-head">亲密度</th>
                    <th scope="col" class="control-head">双倍状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in overviewFansRows" :key="row.roomId">
                    <td data-label="序号" class="index-cell">{{ row.index }}</td>
                    <td data-label="主播名称" class="text-cell" :title="row.name">{{ row.name }}</td>
                    <td data-label="房间号" class="num-cell">{{ row.roomId }}</td>
                    <td data-label="等级" class="num-cell">{{ row.level }}</td>
                    <td data-label="排名" class="num-cell">{{ row.rank }}</td>
                    <td data-label="今日亲密度" class="num-cell">{{ row.today }}</td>
                    <td data-label="亲密度" class="num-cell">{{ row.intimacy }}</td>
                    <td data-label="双倍状态" class="status-cell"><span class="pill" :class="row.doubleKind">{{ row.doubleLabel }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty">{{ overviewFansEmptyText }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="page" :class="{ active: activeTab === 'login' }" id="page-login" role="tabpanel" aria-labelledby="tab-login" tabindex="0" :aria-hidden="activeTab === 'login' ? 'false' : 'true'" :hidden="activeTab !== 'login'">
      <div class="task-card" id="cookie-login-card" style="margin-bottom:16px">
        <div class="task-card-head">
          <div>
            <div class="section-kicker">登录状态</div>
            <h3 class="task-card-title">登录</h3>
          </div>
        </div>
        <div class="task-card-pills">
          <span v-for="pill in loginStatus.pills" :key="pill.label" class="pill" :class="pill.kind">{{ pill.label }}</span>
        </div>
        <div class="summary-grid">
          <div v-for="cell in loginStatus.cells" :key="cell.label" class="summary-cell">
            <div class="mini-label">{{ cell.label }}</div>
            <div class="mini-value">{{ cell.value }}</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <h3 class="section-title">登录 Cookie</h3>
        <p class="subtle">运行时只使用本地登录 Cookie 快照。直播和鱼吧的 Cookie 分开保存，避免同名字段互相覆盖。启用 CookieCloud 后，系统会先同步到这里，再由各任务读取这两份本地值。</p>
        <div class="grid cols-2" style="margin-top:16px">
          <div class="field-block" style="margin-top:0">
            <label class="field-label" for="main-cookie-input">斗鱼直播的 Cookie</label>
            <textarea id="main-cookie-input" v-model="mainCookie" name="main-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 www.douyu.com / douyu.com 登录 Cookie"></textarea>
          </div>
          <div class="field-block" style="margin-top:0">
            <label class="field-label" for="yuba-cookie-input">斗鱼鱼吧的 Cookie</label>
            <textarea id="yuba-cookie-input" v-model="yubaCookie" name="yuba-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 yuba.douyu.com 登录 Cookie"></textarea>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-success" type="button" @click="saveCookie">保存手填 Cookie</button>
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
              <input id="cookie-cloud-enable" v-model="cookieCloud.active" class="switch-input" type="checkbox" name="cookie-cloud-enable" aria-label="启用 CookieCloud 同步" @change="handleCookieCloudToggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field-block">
            <label class="field-label" for="cookie-cloud-endpoint">Endpoint</label>
            <input id="cookie-cloud-endpoint" v-model="cookieCloud.endpoint" name="cookie-cloud-endpoint" type="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="https://cookiecloud.example.com">
          </div>
          <div class="field-block">
            <label class="field-label" for="cookie-cloud-uuid">UUID</label>
            <input id="cookie-cloud-uuid" v-model="cookieCloud.uuid" name="cookie-cloud-uuid" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="CookieCloud UUID">
          </div>
          <div class="field-block">
            <label class="field-label" for="cookie-cloud-cron">同步 Cron</label>
            <input id="cookie-cloud-cron" v-model="cookieCloud.cron" name="cookie-cloud-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="0 5 0 * * *" @input="loadCookieCloudCronPreview">
            <div class="helper cron-preview" id="cookie-cloud-cron-preview" role="status" aria-live="polite">{{ cronPreviewText }}</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="cookie-cloud-password">密码</label>
            <input id="cookie-cloud-password" v-model="cookieCloud.password" name="cookie-cloud-password" type="password" autocomplete="current-password" spellcheck="false" placeholder="CookieCloud Password">
          </div>
        </div>
        <div class="status-box" id="cookie-cloud-note" role="status" aria-live="polite" style="margin-top:16px">{{ cookieCheckText }}</div>
        <div class="actions cookie-cloud-actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" @click="saveAndEnableCookieCloud">保存并启用</button>
          <button class="btn btn-secondary" type="button" @click="checkCookieSource()">同步并校验</button>
        </div>
      </div>
    </section>

    <section class="page" :class="{ active: activeTab === 'collect' }" id="page-collect" role="tabpanel" aria-labelledby="tab-collect" tabindex="0" :aria-hidden="activeTab === 'collect' ? 'false' : 'true'" :hidden="activeTab !== 'collect'">
      <div class="task-card" id="collect-task-card" style="margin-bottom:16px">
        <div class="task-card-head">
          <div>
            <div class="section-kicker">任务状态</div>
            <h3 class="task-card-title">领取</h3>
          </div>
        </div>
        <div class="task-card-pills">
          <span v-for="pill in collectTaskCard.pills" :key="pill.label" class="pill" :class="pill.kind">{{ pill.label }}</span>
        </div>
        <div class="summary-grid">
          <div v-for="cell in collectTaskCard.cells" :key="cell.label" class="summary-cell">
            <div class="mini-label">{{ cell.label }}</div>
            <div class="mini-value">{{ cell.value }}</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div>
            <h3 class="section-title" style="margin-top:0">启动领取任务</h3>
            <p class="subtle">领取任务独立成栏，包含任务状态、启停控制、Cron 设置和手动触发。</p>
          </div>
          <div class="field-block" style="margin:0">
            <label class="switch-control">
              <input id="collect-enable" v-model="collectEnabled" class="switch-input" type="checkbox" name="collect-enable" aria-label="启用领取任务" @change="handleCollectToggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="field-block">
          <label class="field-label" for="collect-cron">Cron 表达式</label>
          <input id="collect-cron" v-model="collectCron" name="collect-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" @input="loadCollectCronPreview">
          <div class="helper cron-preview" id="collect-cron-preview" role="status" aria-live="polite">{{ collectCronPreviewText }}</div>
        </div>
        <div class="actions">
          <button class="btn btn-success" type="button" @click="saveCollectConfig()">保存并启用</button>
          <button class="btn btn-secondary" type="button" @click="triggerCollectTask">立即领取</button>
        </div>
      </div>
    </section>

    <section class="page" :class="{ active: activeTab === 'yuba' }" id="page-yuba" role="tabpanel" aria-labelledby="tab-yuba" tabindex="0" :aria-hidden="activeTab === 'yuba' ? 'false' : 'true'" :hidden="activeTab !== 'yuba'">
      <div class="task-card" id="yuba-task-card">
        <div class="task-card-head">
          <div>
            <div class="section-kicker">任务状态</div>
            <h3 class="task-card-title">鱼吧签到</h3>
          </div>
        </div>
        <div class="task-card-pills">
          <span v-for="pill in yubaTaskCard.pills" :key="pill.label" class="pill" :class="pill.kind">{{ pill.label }}</span>
        </div>
        <div class="summary-grid">
          <div v-for="cell in yubaTaskCard.cells" :key="cell.label" class="summary-cell">
            <div class="mini-label">{{ cell.label }}</div>
            <div class="mini-value">{{ cell.value }}</div>
          </div>
        </div>
      </div>
      <div class="status-box" id="yuba-note" role="status" aria-live="polite" style="margin-top:16px">{{ yubaNote }}</div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用鱼吧签到任务</div>
              <div class="switch-note">通过当前鱼吧 HTTP 接口签到全部已关注鱼吧，不使用浏览器自动化。</div>
            </div>
            <label class="switch-control">
              <input id="yuba-enable" v-model="yubaEnabled" class="switch-input" type="checkbox" name="yuba-enable" aria-label="启用鱼吧签到任务" @change="handleYubaToggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field-block">
            <label class="field-label" for="yuba-cron">Cron 表达式</label>
            <input id="yuba-cron" v-model="yubaCron" name="yuba-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" @input="loadYubaCronPreview">
            <div class="helper cron-preview" id="yuba-cron-preview" role="status" aria-live="polite">{{ yubaCronPreviewText }}</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="yuba-mode">签到模式</label>
            <select id="yuba-mode" v-model="yubaMode" name="yuba-mode">
              <option value="followed">签到全部已关注鱼吧</option>
            </select>
          </div>
        </div>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" @click="saveYubaConfig()">保存并启用</button>
          <button class="btn btn-secondary" type="button" @click="triggerYubaTask">立即签到</button>
        </div>
        <div id="yuba-table-wrap" style="margin-top:16px">
          <div v-if="!showYubaTable" class="empty">{{ yubaEmptyText }}</div>
          <div v-else class="table-shell">
            <table class="table table-fixed yuba-status-table">
              <colgroup>
                <col>
                <col>
                <col>
                <col>
                <col>
                <col>
                <col>
              </colgroup>
              <thead>
                <tr>
                  <th class="index-head" scope="col">序号</th>
                  <th scope="col">鱼吧名称</th>
                  <th class="num-head" scope="col">鱼吧ID</th>
                  <th class="num-head" scope="col">等级</th>
                  <th class="num-head" scope="col">排名</th>
                  <th class="num-head" scope="col">经验值</th>
                  <th class="control-head" scope="col">签到状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in yubaTableRows" :key="`${row.groupId}-${row.index}`">
                  <td class="index-cell" data-label="序号">{{ row.index }}</td>
                  <td class="text-cell" data-label="鱼吧名称">{{ row.groupName }}</td>
                  <td class="num-cell" data-label="鱼吧ID">{{ row.groupId }}</td>
                  <td class="num-cell" data-label="等级">{{ row.groupLevel }}</td>
                  <td class="num-cell" data-label="排名">{{ row.rank }}</td>
                  <td class="num-cell" data-label="经验值">{{ row.expText }}</td>
                  <td class="status-cell" data-label="签到状态">
                    <template v-if="row.error">
                      <span class="pill warn">获取失败</span>
                      <div class="helper error-cell" style="margin-top:6px">{{ row.error }}</div>
                    </template>
                    <span v-else class="pill" :class="row.signed ? 'ok' : 'off'">{{ row.signed ? '已签到' : '未签到' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="page" :class="{ active: activeTab === 'keepalive' }" id="page-keepalive" role="tabpanel" aria-labelledby="tab-keepalive" tabindex="0" :aria-hidden="activeTab === 'keepalive' ? 'false' : 'true'" :hidden="activeTab !== 'keepalive'">
      <div class="task-card" id="keepalive-task-card">
        <div class="task-card-head">
          <div>
            <div class="section-kicker">任务状态</div>
            <h3 class="task-card-title">保活</h3>
          </div>
        </div>
        <div class="task-card-pills">
          <span v-for="pill in keepaliveTaskCard.pills" :key="pill.label" class="pill" :class="pill.kind">{{ pill.label }}</span>
        </div>
        <div class="summary-grid">
          <div v-for="cell in keepaliveTaskCard.cells" :key="cell.label" class="summary-cell">
            <div class="mini-label">{{ cell.label }}</div>
            <div class="mini-value">{{ cell.value }}</div>
          </div>
        </div>
      </div>
      <div class="status-box" id="keepalive-note" role="status" aria-live="polite" style="margin-top:16px">{{ keepaliveNote }}</div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用保活任务</div>
              <div class="switch-note">关闭后保留配置，但不执行保活调度。</div>
            </div>
            <label class="switch-control">
              <input id="keepalive-enable" v-model="keepaliveEnabled" class="switch-input" type="checkbox" name="keepalive-enable" aria-label="启用保活任务" @change="handleKeepaliveToggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field-block">
            <label class="field-label" for="keepalive-cron">Cron 表达式</label>
            <input id="keepalive-cron" v-model="keepaliveCron" name="keepalive-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" @input="loadKeepaliveCronPreview">
            <div class="helper cron-preview" id="keepalive-cron-preview" role="status" aria-live="polite">{{ keepaliveCronPreviewText }}</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="keepalive-model">分配模式</label>
            <select id="keepalive-model" v-model.number="keepaliveModel" name="keepalive-model" @change="handleKeepaliveModelChange">
              <option value="1">按权重</option>
              <option value="2">按固定数量</option>
            </select>
          </div>
        </div>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" @click="saveKeepaliveConfig()">保存并启用</button>
          <button class="btn btn-secondary" type="button" @click="triggerKeepaliveTask">立即保活</button>
        </div>
        <div id="keepalive-table-wrap" style="margin-top:16px">
          <div v-if="!showKeepaliveTable" class="empty">{{ keepaliveEmptyText }}</div>
          <div v-else class="table-shell">
            <table class="table table-fixed keepalive-table">
              <colgroup>
                <col style="width:56px">
                <col style="width:156px">
                <col style="width:104px">
                <col style="width:94px">
                <col style="width:94px">
                <col style="width:94px">
                <col style="width:94px">
                <col style="width:112px">
              </colgroup>
              <thead>
                <tr>
                  <th class="index-head" scope="col">序号</th>
                  <th scope="col">主播名称</th>
                  <th class="num-head" scope="col">房间号</th>
                  <th class="num-head" scope="col">等级</th>
                  <th class="num-head" scope="col">排名</th>
                  <th class="num-head" scope="col">今日亲密度</th>
                  <th class="num-head" scope="col">亲密度</th>
                  <th class="control-head" scope="col">{{ keepaliveValueLabel }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in keepaliveFanRows" :key="row.roomId">
                  <td class="index-cell" data-label="序号">{{ row.index }}</td>
                  <td class="text-cell" data-label="主播名称" :title="row.name">{{ row.name }}</td>
                  <td class="num-cell" data-label="房间号">{{ row.roomId }}</td>
                  <td class="num-cell" data-label="等级">{{ row.level }}</td>
                  <td class="num-cell" data-label="排名">{{ row.rank }}</td>
                  <td class="num-cell" data-label="今日亲密度">{{ row.today }}</td>
                  <td class="num-cell" data-label="亲密度">{{ row.intimacy }}</td>
                  <td class="control-cell" :data-label="keepaliveValueLabel">
                    <input v-model.number="row.value" class="keepalive-value" type="number" :name="`keepalive-value-${row.roomId}`" :data-room-id="row.roomId" :data-level="row.level" min="0" step="1" inputmode="numeric" :aria-label="`保活${keepaliveValueLabel}：${row.name}，房间 ${row.roomId}`">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="page" :class="{ active: activeTab === 'double-card' }" id="page-double-card" role="tabpanel" aria-labelledby="tab-double-card" tabindex="0" :aria-hidden="activeTab === 'double-card' ? 'false' : 'true'" :hidden="activeTab !== 'double-card'">
      <div class="task-card" id="double-task-card">
        <div class="task-card-head">
          <div>
            <div class="section-kicker">任务状态</div>
            <h3 class="task-card-title">双倍</h3>
          </div>
        </div>
        <div class="task-card-pills">
          <span v-for="pill in doubleTaskCard.pills" :key="pill.label" class="pill" :class="pill.kind">{{ pill.label }}</span>
        </div>
        <div class="summary-grid">
          <div v-for="cell in doubleTaskCard.cells" :key="cell.label" class="summary-cell">
            <div class="mini-label">{{ cell.label }}</div>
            <div class="mini-value">{{ cell.value }}</div>
          </div>
        </div>
      </div>
      <div class="status-box" id="double-note" role="status" aria-live="polite" style="margin-top:16px">{{ doubleNote }}</div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用双倍任务</div>
              <div class="switch-note">关闭后不执行双倍检测与赠送，但保留当前分配设置。</div>
            </div>
            <label class="switch-control">
              <input id="double-enable" v-model="doubleEnabled" class="switch-input" type="checkbox" name="double-enable" aria-label="启用双倍任务" @change="handleDoubleToggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-3">
          <div class="field-block">
            <label class="field-label" for="double-cron">Cron 表达式</label>
            <input id="double-cron" v-model="doubleCron" name="double-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" @input="loadDoubleCronPreview">
            <div class="helper cron-preview" id="double-cron-preview" role="status" aria-live="polite">{{ doubleCronPreviewText }}</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="double-gift-scope">礼物范围</label>
            <select id="double-gift-scope" v-model="doubleGiftScope" name="double-gift-scope">
              <option value="glowStick">全部荧光棒</option>
              <option value="limitedTime">限时礼物</option>
            </select>
          </div>
          <div class="field-block">
            <label class="field-label" for="double-model">分配模式</label>
            <select id="double-model" v-model.number="doubleModel" name="double-model">
              <option value="1">按权重</option>
              <option value="2">按固定数量</option>
            </select>
          </div>
        </div>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" @click="saveDoubleConfig()">保存并启用</button>
          <button class="btn btn-secondary" type="button" @click="triggerDoubleTask">立即检测</button>
        </div>
        <div class="status-box" style="margin-top:16px">
          <div class="split-inline">
            <div class="split-inline-copy">
              <div class="section-kicker">分配说明</div>
              <p class="subtle" id="double-mode-help" style="margin-top:8px">{{ doubleModeHelp }}</p>
              <div class="helper" id="double-ratio-preview" role="status" aria-live="polite" style="margin-top:10px; white-space:pre-line">{{ doubleRatioPreview }}</div>
            </div>
            <div v-show="showDoubleRatioTools" class="split-inline-actions" id="double-ratio-tools">
              <button class="btn btn-secondary" type="button" @click="applyDoubleRatioPreset('equal')">参与房间全部设为 1</button>
              <button class="btn btn-secondary" type="button" @click="applyDoubleRatioPreset('level')">按粉丝牌等级填入</button>
            </div>
          </div>
        </div>
        <div id="double-table-wrap" style="margin-top:16px">
          <div v-if="!showDoubleTable" class="empty">{{ doubleEmptyText }}</div>
          <div v-else class="table-shell">
            <table class="table table-fixed double-table">
              <colgroup>
                <col style="width:68px">
                <col style="width:56px">
                <col style="width:156px">
                <col style="width:104px">
                <col style="width:94px">
                <col style="width:94px">
                <col style="width:94px">
                <col style="width:94px">
                <col style="width:112px">
              </colgroup>
              <thead>
                <tr>
                  <th class="control-head" scope="col">参与</th>
                  <th class="index-head" scope="col">序号</th>
                  <th scope="col">主播名称</th>
                  <th class="num-head" scope="col">房间号</th>
                  <th class="num-head" scope="col">等级</th>
                  <th class="num-head" scope="col">排名</th>
                  <th class="num-head" scope="col">今日亲密度</th>
                  <th class="num-head" scope="col">亲密度</th>
                  <th class="control-head" scope="col">{{ doubleValueLabel }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in doubleFanRows" :key="row.roomId">
                  <td class="control-cell" data-label="参与">
                    <input v-model="row.enabled" class="double-enabled" type="checkbox" :name="`double-enabled-${row.roomId}`" :data-room-id="row.roomId" :aria-label="`参与双倍任务：${row.name}，房间 ${row.roomId}`">
                  </td>
                  <td class="index-cell" data-label="序号">{{ row.index }}</td>
                  <td class="text-cell" data-label="主播名称" :title="row.name">{{ row.name }}</td>
                  <td class="num-cell" data-label="房间号">{{ row.roomId }}</td>
                  <td class="num-cell" data-label="等级">{{ row.level }}</td>
                  <td class="num-cell" data-label="排名">{{ row.rank }}</td>
                  <td class="num-cell" data-label="今日亲密度">{{ row.today }}</td>
                  <td class="num-cell" data-label="亲密度">{{ row.intimacy }}</td>
                  <td class="control-cell" :data-label="doubleValueLabel">
                    <input v-model.number="row.value" class="double-value" type="number" :name="`double-value-${row.roomId}`" :data-room-id="row.roomId" :data-level="row.level" min="0" step="1" inputmode="numeric" :aria-label="`双倍${doubleValueLabel}：${row.name}，房间 ${row.roomId}`">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="page" :class="{ active: activeTab === 'expiring-gift' }" id="page-expiring-gift" role="tabpanel" aria-labelledby="tab-expiring-gift" tabindex="0" :aria-hidden="activeTab === 'expiring-gift' ? 'false' : 'true'" :hidden="activeTab !== 'expiring-gift'">
      <div class="task-card" id="expiring-task-card">
        <div class="task-card-head">
          <div>
            <div class="section-kicker">任务状态</div>
            <h3 class="task-card-title">临期</h3>
          </div>
        </div>
        <div class="task-card-pills">
          <span v-for="pill in expiringTaskCard.pills" :key="pill.label" class="pill" :class="pill.kind">{{ pill.label }}</span>
        </div>
        <div class="summary-grid">
          <div v-for="cell in expiringTaskCard.cells" :key="cell.label" class="summary-cell">
            <div class="mini-label">{{ cell.label }}</div>
            <div class="mini-value">{{ cell.value }}</div>
          </div>
        </div>
      </div>
      <div class="status-box" id="expiring-note" role="status" aria-live="polite" style="margin-top:16px">{{ expiringNote }}</div>

      <div class="panel" style="margin-top:16px">
        <div class="field-block">
          <div class="switch-field">
            <div class="switch-copy">
              <div class="switch-title">启用临期任务</div>
              <div class="switch-note">达到临期阈值后，按房间配置释放有明确过期时间的临期背包礼物。</div>
            </div>
            <label class="switch-control">
              <input id="expiring-enable" v-model="expiringEnabled" class="switch-input" type="checkbox" name="expiring-enable" aria-label="启用临期任务" @change="handleExpiringToggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="grid cols-3">
          <div class="field-block">
            <label class="field-label" for="expiring-cron">Cron 表达式</label>
            <input id="expiring-cron" v-model="expiringCron" name="expiring-cron" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" @input="loadExpiringCronPreview">
            <div class="helper cron-preview" id="expiring-cron-preview" role="status" aria-live="polite">{{ expiringCronPreviewText }}</div>
          </div>
          <div class="field-block">
            <label class="field-label" for="expiring-threshold-hours">临期阈值（小时）</label>
            <input id="expiring-threshold-hours" v-model.number="expiringThresholdHours" name="expiring-threshold-hours" type="number" min="1" step="1" inputmode="numeric">
          </div>
          <div class="field-block">
            <label class="field-label" for="expiring-model">分配模式</label>
            <select id="expiring-model" v-model.number="expiringModel" name="expiring-model" @change="handleExpiringModelChange">
              <option value="1">按权重</option>
              <option value="2">按固定数量</option>
            </select>
          </div>
        </div>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-success" type="button" @click="saveExpiringGiftConfig()">保存并启用</button>
          <button class="btn btn-secondary" type="button" @click="triggerExpiringTask">立即执行</button>
        </div>
        <div id="expiring-backpack-wrap" style="margin-top:16px">
          <div v-if="!showExpiringBackpackTable" class="empty">{{ expiringBackpackEmptyText }}</div>
          <div v-else class="table-shell">
            <table class="table table-fixed backpack-table">
              <colgroup>
                <col>
                <col>
                <col>
                <col>
                <col>
                <col>
                <col>
                <col>
              </colgroup>
              <thead>
                <tr>
                  <th class="index-head" scope="col">序号</th>
                  <th scope="col">礼物</th>
                  <th class="num-head" scope="col">ID</th>
                  <th class="num-head" scope="col">数量</th>
                  <th class="date-head" scope="col">过期时间</th>
                  <th class="num-head" scope="col">剩余</th>
                  <th class="control-head" scope="col">临期</th>
                  <th class="control-head" scope="col">自动释放</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in expiringBackpackRows" :key="`${row.giftId}-${row.index}`">
                  <td class="index-cell" data-label="序号">{{ row.index }}</td>
                  <td class="text-cell" data-label="礼物" :title="row.name">{{ row.name }}</td>
                  <td class="num-cell" data-label="ID">{{ row.giftId }}</td>
                  <td class="num-cell" data-label="数量">{{ row.count }}</td>
                  <td class="date-cell" data-label="过期时间">{{ row.expireText }}</td>
                  <td class="num-cell" data-label="剩余">{{ row.remainingText }}</td>
                  <td class="status-cell control-cell" data-label="临期">
                    <span class="pill" :class="row.inThreshold ? 'warn' : 'off'">{{ row.inThreshold ? '是' : '否' }}</span>
                  </td>
                  <td class="status-cell control-cell" data-label="自动释放">
                    <span class="pill" :class="row.autoRelease ? 'ok' : 'off'">{{ row.autoRelease ? '释放' : '跳过' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div id="expiring-table-wrap" style="margin-top:16px">
          <div v-if="!showExpiringTable" class="empty">{{ expiringTableEmptyText }}</div>
          <div v-else class="table-shell">
            <table class="table table-fixed expiring-table">
              <colgroup>
                <col style="width:56px">
                <col style="width:156px">
                <col style="width:104px">
                <col style="width:94px">
                <col style="width:94px">
                <col style="width:94px">
                <col style="width:94px">
                <col style="width:112px">
              </colgroup>
              <thead>
                <tr>
                  <th class="index-head" scope="col">序号</th>
                  <th scope="col">主播名称</th>
                  <th class="num-head" scope="col">房间号</th>
                  <th class="num-head" scope="col">等级</th>
                  <th class="num-head" scope="col">排名</th>
                  <th class="num-head" scope="col">今日亲密度</th>
                  <th class="num-head" scope="col">亲密度</th>
                  <th class="control-head" scope="col">{{ expiringValueLabel }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in expiringFanRows" :key="row.roomId">
                  <td class="index-cell" data-label="序号">{{ row.index }}</td>
                  <td class="text-cell" data-label="主播名称" :title="row.name">{{ row.name }}</td>
                  <td class="num-cell" data-label="房间号">{{ row.roomId }}</td>
                  <td class="num-cell" data-label="等级">{{ row.level }}</td>
                  <td class="num-cell" data-label="排名">{{ row.rank }}</td>
                  <td class="num-cell" data-label="今日亲密度">{{ row.today }}</td>
                  <td class="num-cell" data-label="亲密度">{{ row.intimacy }}</td>
                  <td class="control-cell" :data-label="expiringValueLabel">
                    <input v-model.number="row.value" class="expiring-value" type="number" :name="`expiring-value-${row.roomId}`" :data-room-id="row.roomId" :data-level="row.level" min="0" step="1" inputmode="numeric" :aria-label="`临期${expiringValueLabel}：${row.name}，房间 ${row.roomId}`">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="page" :class="{ active: activeTab === 'logs' }" id="page-logs" role="tabpanel" aria-labelledby="tab-logs" tabindex="0" :aria-hidden="activeTab === 'logs' ? 'false' : 'true'" :hidden="activeTab !== 'logs'">
      <div class="panel">
        <h3 class="section-title">运行日志</h3>
        <p class="subtle" id="logs-summary" role="status" aria-live="polite" style="margin-top:10px">{{ logsSummary }}</p>
        <div class="actions" style="margin-top:16px">
          <button class="btn btn-secondary" type="button" :disabled="logsLoading" :aria-busy="logsLoading ? 'true' : 'false'" @click="refreshLogs">{{ logsLoading ? '刷新中…' : '手动刷新' }}</button>
          <button class="btn btn-danger" type="button" :disabled="clearingLogs" :aria-busy="clearingLogs ? 'true' : 'false'" @click="clearLogs">{{ clearingLogs ? '清空中…' : '清空日志' }}</button>
          <label class="inline" style="margin-left:4px">
            <input id="logs-auto-refresh" v-model="logsAutoRefresh" type="checkbox" name="logs-auto-refresh">
            <span>自动刷新</span>
          </label>
        </div>
        <div id="full-log-box" ref="logBoxRef" class="log-box" style="margin-top:16px">
          <div v-if="!formattedLogs.length" class="empty">暂无日志</div>
          <template v-else>
            <div v-for="(log, index) in formattedLogs" :key="`${log.timestamp}-${index}`" class="log-line">
              <span class="log-stamp">[{{ log.timestamp }}]</span>
              <span class="log-tag">{{ log.category }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </template>
        </div>
      </div>
    </section>
  </main>
</div>

<div class="sr-only" id="toast-live" role="status" aria-live="polite" aria-atomic="true">{{ toastLiveMessage }}</div>
<div
  class="toast"
  id="toast"
  :aria-hidden="toastVisible ? 'false' : 'true'"
  :style="{
    background: toastOk ? '#15803d' : '#dc2626',
    display: toastVisible ? 'block' : 'none',
  }"
>{{ toastMessage }}</div>

</template>
