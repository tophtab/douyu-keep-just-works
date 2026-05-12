(function () {
  function createDoubleTaskPage(deps) {
    var byId = deps.byId;
    var escapeHtml = deps.escapeHtml;
    var toast = deps.toast;
    var state = deps.state;
    var getRawConfig = deps.getRawConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var getManagedConfig = deps.getManagedConfig;
    var getManagedFans = deps.getManagedFans;
    var isTaskActive = deps.isTaskActive;
    var renderRefreshButton = deps.renderRefreshButton;
    var hasLoadedFansList = deps.hasLoadedFansList;
    var ensureFansListForActiveTab = deps.ensureFansListForActiveTab;
    var ensureCronPreview = deps.ensureCronPreview;
    var buildTaskCard = deps.buildTaskCard;
    var buildLoadingTaskCard = deps.buildLoadingTaskCard;
    var buildSendTable = deps.buildSendTable;
    var formatRatioPercent = deps.formatRatioPercent;

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
      renderRefreshButton();
      var rawConfig = getRawConfig();
      var config = getManagedConfig().doubleCard || rawConfig.doubleCard || { active: true, cron: '0 20 17,20,22,23 * * *', model: 1, giftScope: 'glowStick', send: {}, enabled: {} };
      var fans = getManagedFans();
      byId('double-task-card').innerHTML = state.overview
        ? buildTaskCard('双倍', state.overview.doubleCardConfigured, state.overview.status.doubleCard, '房间数', state.overview.doubleCardRooms)
        : buildLoadingTaskCard('双倍');
      byId('double-enable').checked = isTaskActive(getManagedConfig().doubleCard || rawConfig.doubleCard);
      byId('double-cron').value = config.cron || '0 20 17,20,22,23 * * *';
      byId('double-model').value = String(config.model || 1);
      byId('double-gift-scope').value = config.giftScope === 'limitedTime' ? 'limitedTime' : 'glowStick';
      void ensureCronPreview('doubleCard', byId('double-cron').value, 'double-cron-preview');

      if (!hasCookieSourceConfigured(rawConfig)) {
        byId('double-note').textContent = '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也不会生成双倍房间列表。';
        byId('double-table-wrap').innerHTML = '<div class="empty">保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现房间列表。</div>';
        setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', '保存登录凭证并同步粉丝牌后，这里会显示当前权重预览。');
        return;
      }

      if (state.managedLoading && !fans.length) {
        byId('double-note').textContent = '正在同步粉丝牌与双倍配置…';
        byId('double-table-wrap').innerHTML = '<div class="empty">请稍候…</div>';
        setDoubleModeEmptyState('正在同步双倍任务配置。', '同步完成后，这里会显示当前权重预览。');
        return;
      }

      if (!fans.length) {
        var doubleFansLoaded = hasLoadedFansList();
        if (state.fansListError) {
          byId('double-note').textContent = '粉丝牌列表加载失败。';
          byId('double-table-wrap').innerHTML = '<div class="empty">加载粉丝牌列表失败：' + escapeHtml(state.fansListError) + '。请点击顶部“刷新”重试。</div>';
          setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', '粉丝牌列表加载失败，刷新成功后会显示当前权重预览。');
          return;
        }
        byId('double-note').textContent = doubleFansLoaded ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。';
        byId('double-table-wrap').innerHTML = doubleFansLoaded
          ? '<div class="empty">已同步，但当前账号没有可用粉丝牌数据。</div>'
          : '<div class="empty">正在准备加载粉丝牌列表，也可以点击刷新手动加载。</div>';
        setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', doubleFansLoaded ? '当前没有可用于预览的粉丝牌房间。' : '粉丝牌列表加载后，这里会显示当前权重预览。');
        ensureFansListForActiveTab();
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
      byId('double-note').textContent = (state.managedLoading ? '正在后台同步，当前显示上次结果。' : '') + '当前已勾选 ' + enabledCount + ' / ' + fans.length + ' 个房间参与双倍。';
      byId('double-table-wrap').innerHTML = buildSendTable(fans, config, true, 'double-value');
      updateDoubleModeUi();
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

    return {
      renderDoublePage: renderDoublePage,
      setDoubleModeEmptyState: setDoubleModeEmptyState,
      updateDoubleModeUi: updateDoubleModeUi,
      applyDoubleRatioPreset: applyDoubleRatioPreset
    };
  }

  window.DOUYU_KEEP_WEBUI_DOUBLE_TASK_PAGE = {
    create: createDoubleTaskPage
  };
})();
