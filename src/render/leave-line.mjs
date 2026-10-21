function leaveLine() {
  try {
    const PARAM = 'openExternalBrowser';
    const query = location.search.slice(1).split('&').filter(Boolean);
    const otherParams = query.filter((part) => part.split('=')[0] !== PARAM);
    const hasParam = otherParams.length < query.length;
    const urlWithQuery = (params) => `${location.pathname}${params.length ? `?${params.join('&')}` : ''}${location.hash}`;
    const inLine = /\bLine\//i.test(navigator.userAgent);
    if (inLine && !hasParam) {
      location.replace(urlWithQuery([...otherParams, `${PARAM}=1`]));
    } else if (inLine) {
      const root = document.documentElement;
      root.classList.add('from-line');
      document.addEventListener('click', (event) => {
        if (event.target.closest('.line-notice button')) root.classList.remove('from-line');
      });
    } else if (hasParam) {
      history.replaceState(history.state, '', urlWithQuery(otherParams));
    }
  } catch {}
}

export const LEAVE_LINE_SCRIPT = `(${leaveLine})();`;

export const LINE_NOTICE = `<div class="line-notice">
<p>用手機瀏覽器開比較順：點右上角「⋯」，選「用預設瀏覽器開啟」。</p>
<button type="button">知道了</button>
</div>`;
