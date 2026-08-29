/**
 * Dev Inspector — right-side floating panel for visual polishing.
 * Toggle with Ctrl+Shift+I or the panel tab.
 * While active: hover highlights elements, click copies info to clipboard
 * and displays details in the panel.
 */
(function () {
  if (window.__devInspector) return;

  var active = false;
  var collapsed = false;
  var overlay = null;
  var tooltip = null;
  var panel = null;
  var panelBody = null;
  var statusDot = null;
  var statusText = null;
  var infoContent = null;
  var collapseBtn = null;
  var tab = null;
  var lastInfo = null;

  /* ===== Overlay (hover highlight) ===== */
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'dev-inspector-overlay';
    overlay.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'border:2px solid #C5A059',
      'background:rgba(197,160,89,0.12)',
      'z-index:999998',
      'transition:all 80ms ease',
      'display:none',
      'border-radius:4px'
    ].join(';');
    document.body.appendChild(overlay);
  }

  /* ===== Tooltip (hover label) ===== */
  function createTooltip() {
    tooltip = document.createElement('div');
    tooltip.id = 'dev-inspector-tooltip';
    tooltip.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:999999',
      'background:#0F281E',
      'color:#F5F5F0',
      'font-family:monospace',
      'font-size:11px',
      'padding:6px 10px',
      'border-radius:6px',
      'border:1px solid #C5A059',
      'max-width:400px',
      'word-break:break-all',
      'display:none',
      'box-shadow:0 4px 12px rgba(0,0,0,0.4)'
    ].join(';');
    document.body.appendChild(tooltip);
  }

  /* ===== Right-side floating panel ===== */
  function createPanel() {
    panel = document.createElement('div');
    panel.id = 'dev-inspector-panel';
    panel.style.cssText = [
      'position:fixed',
      'top:0',
      'right:0',
      'width:300px',
      'height:100vh',
      'background:rgba(15,40,30,0.96)',
      'border-left:2px solid #C5A059',
      'z-index:1000000',
      'display:flex',
      'flex-direction:column',
      'font-family:Inter,sans-serif',
      'color:#F5F5F0',
      'box-shadow:-4px 0 24px rgba(0,0,0,0.5)',
      'transition:transform 250ms ease, width 250ms ease',
      'backdrop-filter:blur(12px)',
      '-webkit-backdrop-filter:blur(12px)'
    ].join(';');

    /* Header */
    var header = document.createElement('div');
    header.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'padding:14px 16px',
      'border-bottom:1px solid rgba(197,160,89,0.3)',
      'flex-shrink:0'
    ].join(';');

    var titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:8px';

    var bugIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>';

    var titleIcon = document.createElement('span');
    titleIcon.style.color = '#C5A059';
    titleIcon.innerHTML = bugIcon;

    var titleText = document.createElement('span');
    titleText.textContent = 'Dev Inspector';
    titleText.style.cssText = 'font-size:14px;font-weight:600;color:#C5A059;letter-spacing:0.02em';

    titleWrap.appendChild(titleIcon);
    titleWrap.appendChild(titleText);
    header.appendChild(titleWrap);

    /* Collapse button */
    collapseBtn = document.createElement('button');
    collapseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    collapseBtn.style.cssText = [
      'background:none',
      'border:none',
      'color:#C5A059',
      'cursor:pointer',
      'padding:4px',
      'display:flex',
      'align-items:center',
      'transition:transform 200ms ease'
    ].join(';');
    collapseBtn.title = 'Collapse panel';
    collapseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleCollapse();
    });
    header.appendChild(collapseBtn);

    panel.appendChild(header);

    /* Status bar */
    var statusBar = document.createElement('div');
    statusBar.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:8px',
      'padding:10px 16px',
      'border-bottom:1px solid rgba(197,160,89,0.15)',
      'flex-shrink:0'
    ].join(';');

    statusDot = document.createElement('span');
    statusDot.style.cssText = [
      'width:8px',
      'height:8px',
      'border-radius:50%',
      'background:#666',
      'transition:background 200ms ease',
      'flex-shrink:0'
    ].join(';');

    statusText = document.createElement('span');
    statusText.textContent = 'OFF — Press Ctrl+Shift+I';
    statusText.style.cssText = 'font-size:11px;color:#999;font-family:monospace';

    statusBar.appendChild(statusDot);
    statusBar.appendChild(statusText);
    panel.appendChild(statusBar);

    /* Body — element info */
    panelBody = document.createElement('div');
    panelBody.style.cssText = [
      'flex:1',
      'overflow-y:auto',
      'padding:0'
    ].join(';');

    infoContent = document.createElement('div');
    infoContent.style.cssText = 'padding:16px';
    infoContent.innerHTML = '<div style="text-align:center;color:#666;font-size:12px;padding:40px 16px;line-height:1.6">' +
      'Click the bug icon or press<br><strong style="color:#C5A059">Ctrl+Shift+I</strong> to activate.<br><br>' +
      'Then click any element on the page<br>to inspect &amp; copy its details.</div>';

    panelBody.appendChild(infoContent);
    panel.appendChild(panelBody);

    /* Footer — toggle button */
    var footer = document.createElement('div');
    footer.style.cssText = [
      'padding:12px 16px',
      'border-top:1px solid rgba(197,160,89,0.3)',
      'flex-shrink:0'
    ].join(';');

    var toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Activate Inspector';
    toggleBtn.style.cssText = [
      'width:100%',
      'padding:10px',
      'border-radius:8px',
      'border:1px solid #C5A059',
      'background:transparent',
      'color:#C5A059',
      'font-family:Inter,sans-serif',
      'font-size:13px',
      'font-weight:600',
      'cursor:pointer',
      'transition:all 200ms ease'
    ].join(';');
    toggleBtn.addEventListener('mouseenter', function () {
      toggleBtn.style.background = 'rgba(197,160,89,0.15)';
    });
    toggleBtn.addEventListener('mouseleave', function () {
      toggleBtn.style.background = 'transparent';
    });
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle();
    });

    footer.appendChild(toggleBtn);
    panel.appendChild(footer);

    document.body.appendChild(panel);

    /* Collapsed tab (slim right-edge handle) */
    tab = document.createElement('div');
    tab.id = 'dev-inspector-tab';
    tab.style.cssText = [
      'position:fixed',
      'top:50%',
      'right:0',
      'transform:translateY(-50%)',
      'width:28px',
      'height:60px',
      'background:rgba(15,40,30,0.96)',
      'border-left:2px solid #C5A059',
      'border-top:1px solid #C5A059',
      'border-bottom:1px solid #C5A059',
      'border-radius:8px 0 0 8px',
      'z-index:1000000',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'cursor:pointer',
      'box-shadow:-4px 0 12px rgba(0,0,0,0.4)',
      'transition:width 200ms ease'
    ].join(';');
    tab.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C5A059" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
    tab.title = 'Expand Dev Inspector';
    tab.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleCollapse();
    });
    tab.addEventListener('mouseenter', function () {
      tab.style.width = '34px';
    });
    tab.addEventListener('mouseleave', function () {
      tab.style.width = '28px';
    });
    document.body.appendChild(tab);
  }

  /* ===== Collapse / expand panel ===== */
  function toggleCollapse() {
    collapsed = !collapsed;
    if (collapsed) {
      panel.style.transform = 'translateX(300px)';
      tab.style.display = 'flex';
      collapseBtn.style.transform = 'rotate(180deg)';
      collapseBtn.title = 'Expand panel';
    } else {
      panel.style.transform = 'translateX(0)';
      tab.style.display = 'none';
      collapseBtn.style.transform = 'rotate(0deg)';
      collapseBtn.title = 'Collapse panel';
    }
  }

  /* ===== Selector builder ===== */
  function buildSelector(el) {
    if (el.id) return '#' + el.id;
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body) {
      var part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift('#' + cur.id);
        break;
      }
      if (cur.className && typeof cur.className === 'string') {
        var classes = cur.className.trim().split(/\s+/).filter(function (c) { return !c.startsWith('lucide'); });
        if (classes.length) part += '.' + classes.join('.');
      }
      var parent = cur.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function (s) { return s.tagName === cur.tagName; });
        if (siblings.length > 1) {
          var idx = siblings.indexOf(cur) + 1;
          part += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  /* ===== Element info extraction ===== */
  function getElementInfo(el) {
    var selector = buildSelector(el);
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var classes = (typeof el.className === 'string' && el.className.trim())
      ? '.' + el.className.trim().split(/\s+/).filter(function (c) { return !c.startsWith('lucide'); }).join('.')
      : '';
    var rect = el.getBoundingClientRect();
    var styles = window.getComputedStyle(el);
    var snippet = el.outerHTML.length > 500
      ? el.outerHTML.slice(0, 500) + '\n<!-- ... truncated -->'
      : el.outerHTML;

    return {
      selector: selector,
      tag: tag,
      id: id,
      classes: classes,
      snippet: snippet,
      dimensions: Math.round(rect.width) + 'x' + Math.round(rect.height),
      position: 'x:' + Math.round(rect.left) + ' y:' + Math.round(rect.top),
      display: styles.display,
      position_css: styles.position,
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      color: styles.color,
      background: styles.backgroundColor
    };
  }

  /* ===== Format info for clipboard ===== */
  function formatInfo(info) {
    return [
      '=== DEV INSPECTOR — Element Info ===',
      '',
      'Selector: ' + info.selector,
      'Element:  <' + info.tag + info.id + info.classes + '>',
      'Size:     ' + info.dimensions,
      'Position: ' + info.position,
      '',
      '--- Computed Styles ---',
      'display:       ' + info.display,
      'position:      ' + info.position_css,
      'font-family:   ' + info.fontFamily,
      'font-size:     ' + info.fontSize,
      'color:         ' + info.color,
      'background:    ' + info.background,
      '',
      '--- HTML Snippet ---',
      info.snippet
    ].join('\n');
  }

  /* ===== Render info in panel ===== */
  function renderInfoInPanel(info) {
    var rowStyle = 'padding:6px 0;border-bottom:1px solid rgba(197,160,89,0.1)';
    var labelStyle = 'font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#999;margin-bottom:2px';
    var valueStyle = 'font-size:12px;font-family:monospace;color:#F5F5F0;word-break:break-all';
    var sectionStyle = 'font-size:11px;font-weight:600;color:#C5A059;text-transform:uppercase;letter-spacing:0.05em;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid rgba(197,160,89,0.2)';

    var html = '';

    /* Element header */
    html += '<div style="background:rgba(197,160,89,0.1);border:1px solid rgba(197,160,89,0.3);border-radius:8px;padding:10px 12px;margin-bottom:12px">';
    html += '<div style="font-size:13px;font-weight:600;color:#C5A059;font-family:monospace;word-break:break-all">&lt;' + escapeHtml(info.tag + info.id + info.classes) + '&gt;</div>';
    html += '</div>';

    /* Selector */
    html += '<div style="' + rowStyle + '">';
    html += '<div style="' + labelStyle + '">Selector</div>';
    html += '<div style="' + valueStyle + ';color:#34d399">' + escapeHtml(info.selector) + '</div>';
    html += '</div>';

    /* Dimensions & Position */
    html += '<div style="display:flex;gap:12px">';
    html += '<div style="' + rowStyle + ';flex:1">';
    html += '<div style="' + labelStyle + '">Size</div>';
    html += '<div style="' + valueStyle + '">' + info.dimensions + '</div>';
    html += '</div>';
    html += '<div style="' + rowStyle + ';flex:1">';
    html += '<div style="' + labelStyle + '">Position</div>';
    html += '<div style="' + valueStyle + '">' + info.position + '</div>';
    html += '</div>';
    html += '</div>';

    /* Computed Styles section */
    html += '<div style="' + sectionStyle + '">Computed Styles</div>';

    var styleRows = [
      ['display', info.display],
      ['position', info.position_css],
      ['font-family', info.fontFamily],
      ['font-size', info.fontSize],
      ['color', info.color],
      ['background', info.background]
    ];

    styleRows.forEach(function (r) {
      html += '<div style="' + rowStyle + '">';
      html += '<div style="' + labelStyle + '">' + r[0] + '</div>';
      html += '<div style="' + valueStyle + '">' + escapeHtml(r[1]) + '</div>';
      html += '</div>';
    });

    /* HTML Snippet section */
    html += '<div style="' + sectionStyle + '">HTML Snippet</div>';
    html += '<pre style="background:rgba(0,0,0,0.3);border:1px solid rgba(197,160,89,0.15);border-radius:6px;padding:10px;font-size:10px;font-family:monospace;color:#aaa;white-space:pre-wrap;word-break:break-all;overflow-x:auto;margin:0;max-height:200px;overflow-y:auto">' + escapeHtml(info.snippet) + '</pre>';

    infoContent.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ===== Overlay & tooltip show/hide ===== */
  function showOverlay(el) {
    var rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  function showTooltip(el, info) {
    var rect = el.getBoundingClientRect();
    tooltip.style.display = 'block';
    tooltip.textContent = '<' + info.tag + info.id + info.classes + '>';
    var x = rect.left;
    var y = rect.top - 28;
    if (y < 0) y = rect.bottom + 4;
    if (x + tooltip.offsetWidth > window.innerWidth) {
      x = window.innerWidth - tooltip.offsetWidth - 8;
    }
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function hideOverlay() {
    overlay.style.display = 'none';
    tooltip.style.display = 'none';
  }

  /* ===== Mouse move handler ===== */
  function onMouseMove(e) {
    if (!active) return;
    var el = e.target;
    if (!el || el === document.body || el === overlay || el === tooltip || el === panel || panel.contains(el) || el === tab) return;
    showOverlay(el);
    var info = getElementInfo(el);
    showTooltip(el, info);
  }

  /* ===== Click handler ===== */
  function onClick(e) {
    if (!active) return;
    var el = e.target;
    if (!el || el === panel || panel.contains(el) || el === tab) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var info = getElementInfo(el);
    lastInfo = info;
    var text = formatInfo(info);

    /* Auto-copy to clipboard */
    navigator.clipboard.writeText(text).then(function () {
      showToast('Copied: <' + info.tag + info.id + info.classes + '>');
    }).catch(function () {
      console.log(text);
      showToast('Copied to console (clipboard failed)');
    });

    /* Render in panel */
    renderInfoInPanel(info);

    /* Console output */
    console.group('%c🔍 Dev Inspector', 'color:#C5A059;font-weight:bold');
    console.log('%cSelector:', 'color:#C5A059', info.selector);
    console.log('%cElement:', 'color:#C5A059', '<' + info.tag + info.id + info.classes + '>');
    console.log('%cSize:', 'color:#C5A059', info.dimensions, '| Position:', info.position);
    console.log('%cDisplay:', 'color:#C5A059', info.display, '| Position:', info.position_css);
    console.log('%cFont:', 'color:#C5A059', info.fontFamily, info.fontSize);
    console.log('%cColor:', 'color:#C5A059', info.color, '| BG:', info.background);
    console.log('%cHTML:', 'color:#C5A059');
    console.log(info.snippet);
    console.groupEnd();
  }

  /* ===== Toast notification ===== */
  function showToast(msg) {
    var toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed',
      'bottom:60px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:#0F281E',
      'color:#C5A059',
      'font-family:Inter,sans-serif',
      'font-size:13px',
      'font-weight:600',
      'padding:10px 20px',
      'border-radius:8px',
      'border:1px solid #C5A059',
      'z-index:1000001',
      'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
      'transition:opacity 300ms ease'
    ].join(';');
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 2000);
  }

  /* ===== Toggle inspector on/off ===== */
  function toggle() {
    active = !active;
    var footerBtn = panel.querySelector('button');
    if (active) {
      statusDot.style.background = '#34d399';
      statusDot.style.boxShadow = '0 0 8px #34d399';
      statusText.textContent = 'ON — Click any element';
      statusText.style.color = '#34d399';
      document.body.style.cursor = 'crosshair';
      if (footerBtn) {
        footerBtn.textContent = 'Deactivate Inspector';
        footerBtn.style.background = '#C5A059';
        footerBtn.style.color = '#0F281E';
      }
      showToast('Dev Inspector ON — click any element');
    } else {
      statusDot.style.background = '#666';
      statusDot.style.boxShadow = 'none';
      statusText.textContent = 'OFF — Press Ctrl+Shift+I';
      statusText.style.color = '#999';
      document.body.style.cursor = '';
      hideOverlay();
      if (footerBtn) {
        footerBtn.textContent = 'Activate Inspector';
        footerBtn.style.background = 'transparent';
        footerBtn.style.color = '#C5A059';
      }
      showToast('Dev Inspector OFF');
    }
  }

  /* ===== Init ===== */
  function init() {
    createOverlay();
    createTooltip();
    createPanel();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && active) {
        toggle();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__devInspector = { toggle: toggle, toggleCollapse: toggleCollapse };
})();
