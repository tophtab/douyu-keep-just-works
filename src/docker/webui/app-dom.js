(function () {
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

  function padDatePart(value) {
    return String(value).padStart(2, '0');
  }

  function formatShanghaiMinuteFallback(date) {
    var shanghaiDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return shanghaiDate.getUTCFullYear()
      + '-' + padDatePart(shanghaiDate.getUTCMonth() + 1)
      + '-' + padDatePart(shanghaiDate.getUTCDate())
      + ' ' + padDatePart(shanghaiDate.getUTCHours())
      + ':' + padDatePart(shanghaiDate.getUTCMinutes());
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
        hour12: false,
        hourCycle: 'h23'
      }).format(date);
    } catch (error) {
      return formatShanghaiMinuteFallback(date);
    }
  }

  function toast(message, ok) {
    var node = byId('toast');
    var liveNode = byId('toast-live');
    if (liveNode) {
      liveNode.textContent = '';
      window.setTimeout(function () {
        liveNode.textContent = message;
      }, 0);
    }
    node.textContent = message;
    node.style.display = 'block';
    node.style.background = ok ? '#15803d' : '#dc2626';
    node.setAttribute('aria-hidden', 'false');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(function () {
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
    }, 3200);
  }

  window.DOUYU_KEEP_WEBUI_DOM = {
    byId: byId,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    toast: toast
  };
})();
