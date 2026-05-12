(function () {
  function createCronPreviewRenderers(deps) {
    var byId = deps.byId;
    var formatDate = deps.formatDate;
    var state = deps.state;
    var createEmptyCronPreview = deps.createEmptyCronPreview;
    var requestJson = deps.requestJson;

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
      if (preview.loading) {
        target.textContent = '正在计算未来执行时间…';
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
        error: '',
        loading: true
      };
      renderCronPreview(targetId, key);

      return requestJson('/api/cron-preview?value=' + encodeURIComponent(value)).then(function (data) {
        if (state.cronPreviewSeq[key] !== requestSeq) {
          return;
        }
        state.cronPreview[key] = {
          value: value,
          runs: data.runs || [],
          error: '',
          loading: false
        };
        renderCronPreview(targetId, key);
      }).catch(function (error) {
        if (state.cronPreviewSeq[key] !== requestSeq) {
          return;
        }
        state.cronPreview[key] = {
          value: value,
          runs: [],
          error: error.message,
          loading: false
        };
        renderCronPreview(targetId, key);
      });
    }

    function ensureCronPreview(key, cron, targetId) {
      var value = String(cron || '').trim();
      var preview = state.cronPreview[key];
      if (!preview || preview.value !== value) {
        return loadCronPreview(key, value, targetId);
      }
      renderCronPreview(targetId, key);
      if (preview.loading || preview.error || preview.runs.length) {
        return Promise.resolve();
      }
      return loadCronPreview(key, value, targetId);
    }

    return {
      renderCronPreview: renderCronPreview,
      loadCronPreview: loadCronPreview,
      ensureCronPreview: ensureCronPreview
    };
  }

  window.DOUYU_KEEP_WEBUI_PAGE_CRON = {
    create: createCronPreviewRenderers
  };
})();
