(function () {
  function createRenderHelpers(deps) {
    var byId = deps.byId;
    var escapeHtml = deps.escapeHtml;
    var formatDate = deps.formatDate;
    var state = deps.state;
    var getRawConfig = deps.getRawConfig;
    var getManagedConfig = deps.getManagedConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var getCookieSourceLabel = deps.getCookieSourceLabel;

  function buildStatusPill(label, kind) {
    return '<span class="pill ' + kind + '">' + escapeHtml(label) + '</span>';
  }

  function buildSummaryCell(label, value) {
    return '<div class="summary-cell"><div class="mini-label">' + escapeHtml(label) + '</div><div class="mini-value">' + escapeHtml(value) + '</div></div>';
  }

  function buildOverviewGiftSummary(countValue, expireValue) {
    return ''
      + '<div class="strip-metric"><div class="mini-label">当前荧光棒</div><div class="mini-value">' + escapeHtml(countValue) + '</div></div>'
      + '<div class="strip-metric"><div class="mini-label">过期时间</div><div class="mini-value">' + escapeHtml(expireValue) + '</div></div>';
  }

  function getExpiringThresholdHours() {
    var thresholdNode = byId('expiring-threshold-hours');
    var inputValue = thresholdNode ? Number(thresholdNode.value) : NaN;
    if (Number.isFinite(inputValue) && inputValue > 0) {
      return inputValue;
    }
    var rawConfig = getRawConfig();
    var config = getManagedConfig().expiringGift || rawConfig.expiringGift || {};
    var value = Number(config.thresholdHours || 24);
    return Number.isFinite(value) && value > 0 ? value : 24;
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
      return '<div class="task-card-head"><div><div class="section-kicker">登录状态</div><h3 class="task-card-title">登录</h3></div></div><div class="task-card-pills">' + buildStatusPill('等待加载', 'off') + '</div><div class="summary-grid">' + buildSummaryCell('系统就绪', '-') + buildSummaryCell('粉丝牌', '-') + buildSummaryCell('来源', '-') + '</div>';
    }

    var rawConfig = getRawConfig();
    var sourceReady = hasCookieSourceConfigured(rawConfig);

    return ''
      + '<div class="task-card-head"><div><div class="section-kicker">登录状态</div><h3 class="task-card-title">登录</h3></div></div>'
      + '<div class="task-card-pills">'
      + buildStatusPill(overview.cookieSaved ? '已就绪' : '未配置', overview.cookieSaved ? 'ok' : 'off')
      + buildStatusPill(overview.ready ? '可运行' : '待配置', overview.ready ? 'warn' : 'off')
      + '</div>'
      + '<div class="summary-grid">'
      + buildSummaryCell('系统就绪', overview.ready ? '已就绪' : '待配置')
      + buildSummaryCell('粉丝牌', sourceReady ? ((state.managedLoading || state.fansStatusLoading) ? '同步中' : (fansCount + ' 个')) : '未同步')
      + buildSummaryCell('来源', getCookieSourceLabel(overview, rawConfig))
      + '</div>';
  }


  function formatRatioPercent(value) {
    var rounded = Math.round(value * 10) / 10;
    return String(rounded.toFixed(1)).replace(/\.0$/, '') + '%';
  }

  var TABLE_RENDERERS = window.DOUYU_KEEP_WEBUI_TABLE_RENDER.create({
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    state: state,
    buildStatusPill: buildStatusPill,
    getExpiringThresholdHours: getExpiringThresholdHours
  });
  var buildBackpackRowsTable = TABLE_RENDERERS.buildBackpackRowsTable;
  var buildFansStatusTable = TABLE_RENDERERS.buildFansStatusTable;
  var buildYubaStatusTable = TABLE_RENDERERS.buildYubaStatusTable;
  var buildSendTable = TABLE_RENDERERS.buildSendTable;


    return {
      buildStatusPill: buildStatusPill,
      buildSummaryCell: buildSummaryCell,
      buildOverviewGiftSummary: buildOverviewGiftSummary,
      getExpiringThresholdHours: getExpiringThresholdHours,
      buildBackpackRowsTable: buildBackpackRowsTable,
      buildSummaryStatusCell: buildSummaryStatusCell,
      buildLoadingTaskCard: buildLoadingTaskCard,
      buildTaskCard: buildTaskCard,
      buildLoginStatusCard: buildLoginStatusCard,
      buildFansStatusTable: buildFansStatusTable,
      buildYubaStatusTable: buildYubaStatusTable,
      buildSendTable: buildSendTable,
      formatRatioPercent: formatRatioPercent
    };
  }

  window.DOUYU_KEEP_WEBUI_RENDER = {
    create: createRenderHelpers
  };
})();
