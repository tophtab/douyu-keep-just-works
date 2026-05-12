(function () {
  function createTableRenderHelpers(deps) {
    var escapeHtml = deps.escapeHtml;
    var formatDate = deps.formatDate;
    var state = deps.state;
    var buildStatusPill = deps.buildStatusPill;
    var getExpiringThresholdHours = deps.getExpiringThresholdHours;

    function formatRemainingTime(expireTime) {
      if (!expireTime) {
        return '-';
      }
      var remainingMs = expireTime - Date.now();
      var remainingHours = Math.max(0, remainingMs / (60 * 60 * 1000));
      if (remainingHours >= 48) {
        return (remainingHours / 24).toFixed(1).replace(/\.0$/, '') + ' 天';
      }
      return remainingHours.toFixed(1).replace(/\.0$/, '') + ' 小时';
    }

    function describeBackpackRow(row, thresholdHours) {
      var count = Number(row && row.count || 0);
      var expireTime = Number(row && row.expireTime || 0);
      if (count <= 0) {
        return { inThreshold: false, autoRelease: false };
      }
      if (!expireTime) {
        return { inThreshold: false, autoRelease: false };
      }
      var inThreshold = expireTime - Date.now() <= thresholdHours * 60 * 60 * 1000;
      return { inThreshold: inThreshold, autoRelease: inThreshold };
    }

    function buildTableCell(label, html, className, titleText) {
      var attrs = ' data-label="' + escapeHtml(label) + '"';
      if (className) {
        attrs += ' class="' + escapeHtml(className) + '"';
      }
      if (titleText) {
        attrs += ' title="' + escapeHtml(titleText) + '"';
      }
      return '<td' + attrs + '>' + html + '</td>';
    }

    function buildTableHeadCell(label, className) {
      var attrs = ' scope="col"';
      if (className) {
        attrs += ' class="' + escapeHtml(className) + '"';
      }
      return '<th' + attrs + '>' + escapeHtml(label) + '</th>';
    }

    function buildTextCell(label, value, className) {
      var text = value == null || value === '' ? '-' : String(value);
      return buildTableCell(label, escapeHtml(text), className || 'text-cell', text);
    }

    function buildNumericCell(label, value) {
      return buildTableCell(label, escapeHtml(value == null || value === '' ? '-' : value), 'num-cell');
    }

    function buildBackpackRowsTable(giftStatus) {
      if (!giftStatus) {
        if (state.fansStatusDetailsLoading) {
          return '<div class="empty">正在加载背包明细…</div>';
        }
        return '<div class="empty">尚未加载背包明细。点击顶部“刷新”后会展示可见礼物行。</div>';
      }
      if (giftStatus.error) {
        return '<div class="empty">背包明细暂不可用：' + escapeHtml(giftStatus.error) + '</div>';
      }
      var rows = giftStatus.rows || [];
      if (!rows.length) {
        return '<div class="empty">当前背包没有可展示的礼物行。</div>';
      }

      var thresholdHours = getExpiringThresholdHours();
      var body = [];
      var i;
      for (i = 0; i < rows.length; i += 1) {
        var row = rows[i];
        var rowState = describeBackpackRow(row, thresholdHours);
        body.push('<tr>');
        body.push(buildTableCell('序号', escapeHtml(i + 1), 'index-cell'));
        body.push(buildTextCell('礼物', row.name || '未知礼物'));
        body.push(buildNumericCell('ID', row.giftId));
        body.push(buildNumericCell('数量', row.count));
        body.push(buildTableCell('过期时间', escapeHtml(row.expireTime ? formatDate(row.expireTime) : '-'), 'date-cell'));
        body.push(buildTableCell('剩余', escapeHtml(formatRemainingTime(row.expireTime)), 'num-cell'));
        body.push(buildTableCell('临期', buildStatusPill(rowState.inThreshold ? '是' : '否', rowState.inThreshold ? 'warn' : 'off'), 'status-cell control-cell'));
        body.push(buildTableCell('自动释放', buildStatusPill(rowState.autoRelease ? '释放' : '跳过', rowState.autoRelease ? 'ok' : 'off'), 'status-cell control-cell'));
        body.push('</tr>');
      }

      return ''
        + '<div class="table-shell"><table class="table table-fixed backpack-table"><colgroup><col><col><col><col><col><col><col><col></colgroup><thead><tr>'
        + buildTableHeadCell('序号', 'index-head')
        + buildTableHeadCell('礼物')
        + buildTableHeadCell('ID', 'num-head')
        + buildTableHeadCell('数量', 'num-head')
        + buildTableHeadCell('过期时间', 'date-head')
        + buildTableHeadCell('剩余', 'num-head')
        + buildTableHeadCell('临期', 'control-head')
        + buildTableHeadCell('自动释放', 'control-head')
        + '</tr></thead><tbody>' + body.join('') + '</tbody></table></div>';
    }

    function buildFansStatusTable(items) {
      var colgroup = '<colgroup><col><col><col><col><col><col><col><col></colgroup>';
      var header = '<tr>'
        + buildTableHeadCell('序号', 'index-head')
        + buildTableHeadCell('主播名称')
        + buildTableHeadCell('房间号', 'num-head')
        + buildTableHeadCell('等级', 'num-head')
        + buildTableHeadCell('排名', 'num-head')
        + buildTableHeadCell('今日亲密度', 'num-head')
        + buildTableHeadCell('亲密度', 'num-head')
        + buildTableHeadCell('双倍状态', 'control-head')
        + '</tr>';
      var rows = [];
      var i;
      for (i = 0; i < items.length; i += 1) {
        var item = items[i];
        rows.push('<tr>');
        rows.push(buildTableCell('序号', escapeHtml(i + 1), 'index-cell'));
        rows.push(buildTextCell('主播名称', item.name || '未知主播'));
        rows.push(buildNumericCell('房间号', item.roomId));
        rows.push(buildNumericCell('等级', item.level));
        rows.push(buildNumericCell('排名', item.rank));
        rows.push(buildNumericCell('今日亲密度', item.today));
        rows.push(buildNumericCell('亲密度', item.intimacy));
        var doubleStatus = typeof item.doubleActive === 'boolean'
          ? buildStatusPill(item.doubleActive ? '双倍中' : '未开启', item.doubleActive ? 'ok' : 'off')
          : buildStatusPill('检测中', 'warn');
        rows.push(buildTableCell('双倍状态', doubleStatus, 'status-cell'));
        rows.push('</tr>');
      }
      return '<div class="table-shell"><table class="table table-fixed fans-status-table">' + colgroup + '<thead>' + header + '</thead><tbody>' + rows.join('') + '</tbody></table></div>';
    }

    function buildYubaStatusTable(items) {
      var colgroup = '<colgroup><col><col><col><col><col><col><col></colgroup>';
      var header = '<tr>'
        + buildTableHeadCell('序号', 'index-head')
        + buildTableHeadCell('鱼吧名称')
        + buildTableHeadCell('鱼吧ID', 'num-head')
        + buildTableHeadCell('等级', 'num-head')
        + buildTableHeadCell('排名', 'num-head')
        + buildTableHeadCell('经验值', 'num-head')
        + buildTableHeadCell('签到状态', 'control-head')
        + '</tr>';
      var rows = [];
      var i;
      for (i = 0; i < items.length; i += 1) {
        var item = items[i];
        var isSigned = typeof item.isSigned === 'number' ? item.isSigned : -1;
        var currentExp = item.groupExp != null ? String(item.groupExp) : '-';
        var nextExp = item.nextLevelExp != null ? String(item.nextLevelExp) : '-';
        var expText = currentExp + '/' + nextExp;
        rows.push('<tr>');
        rows.push(buildTableCell('序号', escapeHtml(i + 1), 'index-cell'));
        rows.push(buildTextCell('鱼吧名称', item.groupName || '未知鱼吧'));
        rows.push(buildNumericCell('鱼吧ID', item.groupId));
        rows.push(buildNumericCell('等级', item.groupLevel != null ? item.groupLevel : '-'));
        rows.push(buildNumericCell('排名', item.rank > 0 ? item.rank : '-'));
        rows.push(buildTableCell('经验值', escapeHtml(expText), 'num-cell'));
        rows.push(buildTableCell('签到状态', item.error
          ? buildStatusPill('获取失败', 'warn') + '<div class="helper error-cell" style="margin-top:6px">' + escapeHtml(item.error) + '</div>'
          : buildStatusPill(isSigned > 0 ? '已签到' : '未签到', isSigned > 0 ? 'ok' : 'off'), 'status-cell'));
        rows.push('</tr>');
      }
      return '<div class="table-shell"><table class="table table-fixed yuba-status-table">' + colgroup + '<thead>' + header + '</thead><tbody>' + rows.join('') + '</tbody></table></div>';
    }

    function buildSendTable(fans, config, withEnabled, valueClass, options) {
      var model = Number(config.model || 1);
      var rows = [];
      var i;
      var taskLabel = valueClass === 'double-value'
        ? '双倍'
        : (valueClass === 'expiring-value' ? '临期' : '保活');
      for (i = 0; i < fans.length; i += 1) {
        var fan = fans[i];
        var key = String(fan.roomId);
        var roomLabel = String(fan.name || '未知主播') + '，房间 ' + key;
        var defaultWeight = options && options.firstWeightOnly ? (i === 0 ? 1 : 0) : 1;
        var sendItem = config.send && config.send[key] ? config.send[key] : {
          roomId: fan.roomId,
          number: model === 2 ? 1 : 0,
          weight: model === 1 ? defaultWeight : 0
        };
        var value = model === 2 ? Number(sendItem.number || 0) : Number(sendItem.weight || 0);
        rows.push('<tr>');
        if (withEnabled) {
          rows.push(buildTableCell('参与', '<input type="checkbox" class="double-enabled" name="double-enabled-' + escapeHtml(key) + '" data-room-id="' + escapeHtml(fan.roomId) + '" aria-label="' + escapeHtml('参与双倍任务：' + roomLabel) + '"' + (config.enabled && config.enabled[key] ? ' checked' : '') + '>', 'control-cell'));
        }
        rows.push(buildTableCell('序号', escapeHtml(i + 1), 'index-cell'));
        rows.push(buildTextCell('主播名称', fan.name || '未知主播'));
        rows.push(buildNumericCell('房间号', fan.roomId));
        rows.push(buildNumericCell('等级', fan.level));
        rows.push(buildNumericCell('排名', fan.rank));
        rows.push(buildNumericCell('今日亲密度', fan.today));
        rows.push(buildNumericCell('亲密度', fan.intimacy));
        rows.push(buildTableCell(model === 2 ? '数量' : '权重值', '<input type="number" class="' + valueClass + '" name="' + escapeHtml(valueClass + '-' + key) + '" data-room-id="' + escapeHtml(fan.roomId) + '" data-level="' + escapeHtml(fan.level) + '" min="0" step="1" inputmode="numeric" aria-label="' + escapeHtml(taskLabel + (model === 2 ? '数量：' : '权重值：') + roomLabel) + '" value="' + escapeHtml(value) + '">', 'control-cell'));
        rows.push('</tr>');
      }

      var colCount = withEnabled ? 9 : 8;
      var colgroup = '<colgroup>';
      for (var ci = 0; ci < colCount; ci += 1) {
        if (withEnabled && ci === 0) {
          colgroup += '<col style="width:68px">';
        } else if ((!withEnabled && ci === 0) || (withEnabled && ci === 1)) {
          colgroup += '<col style="width:56px">';
        } else if ((!withEnabled && ci === 1) || (withEnabled && ci === 2)) {
          colgroup += '<col style="width:156px">';
        } else if ((!withEnabled && ci === 2) || (withEnabled && ci === 3)) {
          colgroup += '<col style="width:104px">';
        } else if ((!withEnabled && ci === 7) || (withEnabled && ci === 8)) {
          colgroup += '<col style="width:112px">';
        } else {
          colgroup += '<col style="width:94px">';
        }
      }
      colgroup += '</colgroup>';

      var header = '<tr>';
      if (withEnabled) {
        header += buildTableHeadCell('参与', 'control-head');
      }
      header += buildTableHeadCell('序号', 'index-head')
        + buildTableHeadCell('主播名称')
        + buildTableHeadCell('房间号', 'num-head')
        + buildTableHeadCell('等级', 'num-head')
        + buildTableHeadCell('排名', 'num-head')
        + buildTableHeadCell('今日亲密度', 'num-head')
        + buildTableHeadCell('亲密度', 'num-head')
        + buildTableHeadCell(model === 2 ? '数量' : '权重值', 'control-head')
        + '</tr>';

      var tableClass = 'table table-fixed';
      if (valueClass === 'keepalive-value') tableClass += ' keepalive-table';
      else if (valueClass === 'double-value') tableClass += ' double-table';
      else if (valueClass === 'expiring-value') tableClass += ' expiring-table';

      return '<div class="table-shell"><table class="' + tableClass + '">' + colgroup + '<thead>' + header + '</thead><tbody>' + rows.join('') + '</tbody></table></div>';
    }

    return {
      buildBackpackRowsTable: buildBackpackRowsTable,
      buildFansStatusTable: buildFansStatusTable,
      buildYubaStatusTable: buildYubaStatusTable,
      buildSendTable: buildSendTable
    };
  }

  window.DOUYU_KEEP_WEBUI_TABLE_RENDER = {
    create: createTableRenderHelpers
  };
})();
