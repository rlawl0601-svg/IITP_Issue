const app = document.querySelector('#saved-report-app');
const reportId = new URLSearchParams(window.location.search).get('id');
const report = reportId ? window.reportStorage.getReport(reportId) : null;

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function providerMarkup(result) {
  const label = result.provider === 'openai' ? 'OPENAI WEB SEARCH' : 'GEMINI GOOGLE SEARCH';
  if (result.error) return `<article class="saved-provider saved-error"><div class="saved-provider-head"><span>${label}</span><b>실패</b></div><p>${escapeHtml(result.error)}</p></article>`;
  const sources = (result.sources || []).map((source) => `<li><span>[${source.index}]</span><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || source.url)}</a></li>`).join('');
  return `<article class="saved-provider"><div class="saved-provider-head"><span>${label}</span><b>성공</b></div><small>${escapeHtml(result.model || '')}</small><div class="saved-text">${escapeHtml(result.text || '응답 내용이 없습니다.')}</div>${sources ? `<h4>참고 출처</h4><ol>${sources}</ol>` : ''}</article>`;
}

if (!report) {
  app.innerHTML = `<div class="saved-empty"><span class="brand-mark">B</span><h1>저장된 보고서를 찾을 수 없습니다.</h1><a href="/">메인으로 돌아가기</a></div>`;
} else {
  app.innerHTML = `<header class="saved-topbar"><a class="brand" href="/" aria-label="브리프메이커 홈"><span class="brand-mark">B</span><span>BRIEFMAKER</span></a><button onclick="window.print()">인쇄 / PDF 저장</button></header><section class="saved-report-card"><p class="eyebrow">SAVED REPORT · ${new Date(report.savedAt).toLocaleString('ko-KR')}</p><h1>${escapeHtml(report.input || '이슈 대응 보고서')}</h1><p class="saved-meta">${escapeHtml(report.reportTypeLabel || '')} · ${escapeHtml(report.period || '')} · ${escapeHtml((report.sources || []).join(', ') || '전체 소스')}</p>${(report.results || []).map(providerMarkup).join('')}</section>`;
}
