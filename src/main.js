const sourceOptions = ['정부·공공기관', '연구·학술', '뉴스', '기업', '국제기구'];
const storageKeys = { openai: 'briefmaker_openai_api_key', gemini: 'briefmaker_gemini_api_key' };
const state = {
  input: '',
  reportType: 'onePager',
  period: '최근 30일',
  sources: [...sourceOptions],
  report: null,
  searchResults: null,
  isLoading: false,
  apiKeys: {
    openai: sessionStorage.getItem(storageKeys.openai) || '',
    gemini: sessionStorage.getItem(storageKeys.gemini) || '',
  },
  sessionStatus: (sessionStorage.getItem(storageKeys.openai) || sessionStorage.getItem(storageKeys.gemini)) ? 'saved' : 'empty',
  apiError: '',
  template: { fileName: '', markdown: '', status: 'empty', error: '' },
  savedReportId: '',
};

const app = document.querySelector('#app');

function render() {
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#" aria-label="브리프메이커 홈">
        <span class="brand-mark">B</span><span>BRIEFMAKER</span>
      </a>
      <span class="topbar-note"><span class="status-dot"></span> 초안 작성 모드</span>
    </header>
    <main class="shell">
      <section class="hero">
        <div>
          <p class="eyebrow">ISSUE RESPONSE · PERFORMANCE REPORT</p>
          <h1>복잡한 이슈를<br /><em>한 장의 방향</em>으로.</h1>
          <p class="hero-copy">키워드나 기사 본문을 입력하면, 이슈 대응과 성과 보고에 필요한 구조로 초안을 정리합니다.</p>
        </div>
        <div class="hero-badge">DRAFT<br /><strong>01</strong></div>
      </section>

      <section class="card api-card" aria-labelledby="api-title">
        <div class="api-copy"><div class="card-heading api-heading"><div><span class="step">SET</span><h2 id="api-title">API 키 설정</h2></div><span class="session-pill ${state.sessionStatus === 'saved' ? 'is-saved' : ''}"><span class="status-dot"></span>${state.sessionStatus === 'saved' ? '세션에 저장됨' : '저장되지 않음'}</span></div>
          <p>외부 AI 연결을 위한 키를 입력하세요. 키는 이 브라우저 탭의 <code>sessionStorage</code>에만 저장되며 서버 로그나 보고서 결과에 포함되지 않습니다.</p>
          <p class="session-hint">탭을 닫으면 저장된 API 키가 삭제됩니다.</p>
        </div>
        <div class="api-fields">
          ${apiKeyField('openai', 'OpenAI API 키', 'sk-...')}
          ${apiKeyField('gemini', 'Gemini API 키', 'AIza...')}
        </div>
        <div class="api-actions"><button class="outline-button" id="save-session">세션 저장</button><button class="text-button" id="clear-session">세션 비우기</button><span class="api-status ${state.apiError ? 'has-error' : ''}" id="api-status">${state.apiError || statusMessage()}</span></div>
      </section>

      <section class="card template-card" aria-labelledby="template-title">
        <div class="template-copy"><div class="card-heading api-heading"><div><span class="step">DOC</span><h2 id="template-title">문서 양식 분석</h2></div><span class="required">선택 사항</span></div><p>한글·문서·표 양식을 올리면 제목, 항목, 문단 순서를 분석해 보고서 생성에 반영합니다.</p><p class="template-support">HWP · HWPX · DOCX · PDF · XLSX · XLS / 최대 25MB</p></div>
        <div class="template-upload"><label class="upload-dropzone" id="template-dropzone" for="template-file"><span class="drop-icon">⇧</span><span class="drop-title">파일을 여기에 끌어다 놓으세요</span><span class="drop-subtitle">또는 클릭해서 파일 선택</span><input id="template-file" type="file" accept=".hwp,.hwpx,.docx,.pdf,.xlsx,.xls" /></label><div class="template-status ${state.template.status === 'error' ? 'has-error' : ''}" id="template-status">${templateStatusMarkup()}</div></div>
      </section>

      <div class="workspace">
        <section class="card form-card" aria-labelledby="form-title">
          <div class="card-heading"><div><span class="step">01</span><h2 id="form-title">자료와 조건 입력</h2></div><span class="required">* 필수 입력</span></div>
          <label class="field-label" for="source-input">키워드 또는 뉴스 기사 본문 <span>*</span></label>
          <textarea id="source-input" placeholder="예: 지역 소상공인 지원 정책의 성과와 보완점\n\n기사 본문을 붙여 넣어도 됩니다.">${escapeHtml(state.input)}</textarea>
          <div class="char-count">${state.input.length.toLocaleString()} / 5,000</div>

          <div class="field-group"><span class="field-label">보고서 유형</span><div class="segmented">
            ${radio('onePager', '보고용 1장 페이퍼', '핵심만 빠르게 공유')}${radio('situation', '현황-문제점-대응방향', '논리적 구조로 정리')}
          </div></div>

          <div class="field-group"><span class="field-label">검색 기간</span><div class="periods">${['최근 7일', '최근 30일', '최근 1년', '전체 기간'].map((p) => `<button class="period ${state.period === p ? 'active' : ''}" data-period="${p}">${p}</button>`).join('')}</div></div>

          <div class="field-group"><span class="field-label">검색 소스 <small>중복 선택 가능</small></span><div class="source-grid">${sourceOptions.map((source) => `<label class="check"><input type="checkbox" data-source="${source}" ${state.sources.includes(source) ? 'checked' : ''} /><span class="checkmark"></span>${source}</label>`).join('')}</div></div>

          <button class="generate" id="generate"><span>보고서 초안 생성</span><span class="arrow">→</span></button>
          <button class="reset-button" id="reset-input">입력·결과 리셋 <span>↺</span></button>
          <p class="demo-note">OpenAI Web Search · Gemini Google Search Grounding 연결됨</p>
        </section>

        <section class="card result-card" aria-labelledby="result-title">
          <div class="card-heading result-heading"><div><span class="step">02</span><h2 id="result-title">생성 결과</h2></div><div class="result-actions"><button class="result-action" id="save-report" ${state.searchResults ? '' : 'disabled'}>${state.savedReportId ? '저장됨' : '보고서 저장'}</button><button class="result-action" id="open-report" ${state.searchResults ? '' : 'disabled'}>새 탭에서 보기</button><button class="icon-button" id="copy" title="결과 복사" ${state.searchResults ? '' : 'disabled'}>⌘</button></div></div>
          ${state.isLoading ? loadingMarkup() : state.searchResults ? resultsMarkup(state.searchResults) : emptyMarkup()}
        </section>
      </div>
      <footer><span>BRIEFMAKER</span><span>이슈 대응·성과 보고서 초안 생성기</span><span>v0.1 · DEMO</span></footer>
    </main>`;
  bindEvents();
}

function radio(value, title, caption) { return `<label class="radio-card ${state.reportType === value ? 'selected' : ''}"><input type="radio" name="reportType" value="${value}" ${state.reportType === value ? 'checked' : ''}/><span class="radio-dot"></span><span><strong>${title}</strong><small>${caption}</small></span></label>`; }
function apiKeyField(name, label, placeholder) { return `<label class="api-field" for="${name}-key"><span>${label}</span><div class="password-wrap"><input id="${name}-key" data-api-key="${name}" type="password" autocomplete="off" placeholder="${placeholder}" value="${escapeHtml(state.apiKeys[name])}" /><span class="lock">●●●</span></div></label>`; }
function statusMessage() { return state.sessionStatus === 'saved' ? '현재 탭에서만 유지됩니다.' : '입력 후 세션 저장을 눌러주세요.'; }
function templateStatusMarkup() { if (state.template.status === 'loading') return '분석 중…'; if (state.template.status === 'error') return escapeHtml(state.template.error); if (state.template.status === 'done') return `✓ ${escapeHtml(state.template.fileName)} · 분석 완료`; return '선택된 파일 없음'; }
function emptyMarkup() { return `<div class="empty-state"><div class="empty-icon">✦</div><h3>아직 생성된 초안이 없습니다</h3><p>왼쪽에 자료를 입력하고<br />보고서 초안 생성 버튼을 눌러주세요.</p><div class="empty-line"></div><span>AI-powered report workspace</span></div>`; }
function loadingMarkup() { return `<div class="empty-state loading-state"><div class="loader"></div><h3>두 검색 엔진에서 자료를 찾고 있습니다</h3><p>OpenAI Web Search · Gemini Google Search Grounding<br />최대 120초까지 걸릴 수 있습니다.</p></div>`; }
function resultsMarkup(results) { return `<div class="provider-results">${results.map((result) => providerResultMarkup(result)).join('')}</div>`; }
function providerResultMarkup(result) {
  const label = result.provider === 'openai' ? 'OPENAI WEB SEARCH' : 'GEMINI GOOGLE SEARCH';
  if (result.error) return `<article class="provider-result provider-error"><div class="provider-label"><span>${label}</span><b>실패</b></div><p class="error-copy">${escapeHtml(result.error)}</p></article>`;
  const sourceMarkup = (result.sources || []).map((source) => `<li><span>[${source.index}]</span><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || source.url)}</a></li>`).join('');
  return `<article class="provider-result"><div class="provider-label"><span>${label}</span><b>성공</b></div><div class="model-label">${escapeHtml(result.model || '')}</div><div class="result-text">${escapeHtml(result.text || '응답 내용이 없습니다.')}</div>${sourceMarkup ? `<div class="sources-title">참고 출처</div><ol class="sources-list">${sourceMarkup}</ol>` : '<p class="no-sources">추출된 URL 출처가 없습니다.</p>'}</article>`;
}
function reportMarkup(report) { return `<div class="report"><div class="report-meta">${report.meta}</div><h3>${escapeHtml(report.title)}</h3>${report.sections.map(([title, text]) => `<div class="report-section"><h4>${title}</h4><p>${escapeHtml(text).replace(/\n/g, '<br />')}</p></div>`).join('')}<div class="report-footer">예시 결과 · 사실관계와 수치는 원문 확인 후 사용하세요.</div></div>`; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

function bindEvents() {
  document.querySelectorAll('[data-api-key]').forEach((input) => input.addEventListener('input', (e) => {
    state.apiKeys[e.target.dataset.apiKey] = e.target.value;
    state.sessionStatus = 'dirty';
    state.apiError = '';
    updateApiStatus();
  }));
  document.querySelector('#save-session').addEventListener('click', saveSession);
  document.querySelector('#clear-session').addEventListener('click', clearSession);
  document.querySelector('#template-file').addEventListener('change', handleTemplateUpload);
  const dropzone = document.querySelector('#template-dropzone');
  ['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); }));
  dropzone.addEventListener('drop', handleTemplateUpload);
  document.querySelector('#source-input').addEventListener('input', (e) => { state.input = e.target.value.slice(0, 5000); e.target.value = state.input; document.querySelector('.char-count').textContent = `${state.input.length.toLocaleString()} / 5,000`; });
  document.querySelectorAll('input[name="reportType"]').forEach((input) => input.addEventListener('change', (e) => { state.reportType = e.target.value; render(); }));
  document.querySelectorAll('[data-period]').forEach((button) => button.addEventListener('click', () => { state.period = button.dataset.period; render(); }));
  document.querySelectorAll('[data-source]').forEach((input) => input.addEventListener('change', () => { state.sources = [...document.querySelectorAll('[data-source]:checked')].map((el) => el.dataset.source); }));
  document.querySelector('#generate').addEventListener('click', async () => {
    if (!state.apiKeys.openai && !state.apiKeys.gemini) {
      state.apiError = 'OpenAI 또는 Gemini API 키를 하나 이상 입력하고 세션 저장을 눌러주세요.';
      updateApiStatus();
      document.querySelector('#openai-key').focus();
      return;
    }
    state.apiError = '';
    state.isLoading = true;
    state.searchResults = null;
    render();
    document.querySelector('.result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const response = await fetch('/api/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: state.input, reportType: state.reportType, period: state.period, sources: state.sources, templateMarkdown: state.template.markdown, openaiApiKey: state.apiKeys.openai, geminiApiKey: state.apiKeys.gemini }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'API 검색 요청에 실패했습니다.');
      state.searchResults = data.results || [];
    } catch (error) {
      state.searchResults = [{ provider: 'openai', error: error.message }, { provider: 'gemini', error: error.message }];
    } finally {
      state.isLoading = false;
      render();
    }
  });
  document.querySelector('#reset-input').addEventListener('click', () => { state.input = ''; state.report = null; state.searchResults = null; state.apiError = ''; render(); });
  document.querySelector('#save-report').addEventListener('click', saveCurrentReport);
  document.querySelector('#open-report').addEventListener('click', openSavedReport);
  document.querySelector('#copy')?.addEventListener('click', async () => { if (state.searchResults) { await navigator.clipboard.writeText(state.searchResults.map((result) => `${result.provider}\n${result.text || result.error || ''}`).join('\n\n')); document.querySelector('#copy').textContent = '✓'; } });
}

function reportRecord() {
  return { input: state.input, reportTypeLabel: state.reportType === 'onePager' ? '보고용 1장 페이퍼' : '현황-문제점-대응방향', period: state.period, sources: state.sources, results: state.searchResults };
}

function saveCurrentReport() {
  if (!state.searchResults) return '';
  const saved = window.reportStorage.saveReport(reportRecord());
  state.savedReportId = saved.id;
  render();
  return saved.id;
}

function openSavedReport() {
  const id = state.savedReportId || saveCurrentReport();
  if (id) window.open(`report.html?id=${encodeURIComponent(id)}`, '_blank', 'noopener');
}

async function handleTemplateUpload(event) {
  const file = event.type === 'drop' ? event.dataTransfer.files?.[0] : event.target.files?.[0];
  if (!file) return;
  state.template = { fileName: file.name, markdown: '', status: 'loading', error: '' };
  render();
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await fetch('/api/template', { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '문서 분석에 실패했습니다.');
    state.template = { fileName: data.fileName || file.name, markdown: data.markdown || '', status: 'done', error: '' };
  } catch (error) {
    state.template = { fileName: file.name, markdown: '', status: 'error', error: error.message };
  }
  render();
}

function updateApiStatus() {
  const status = document.querySelector('#api-status');
  if (status) { status.textContent = state.apiError || statusMessage(); status.classList.toggle('has-error', Boolean(state.apiError)); }
  document.querySelector('.session-pill')?.classList.toggle('is-saved', state.sessionStatus === 'saved');
  if (document.querySelector('.session-pill')) document.querySelector('.session-pill').innerHTML = `<span class="status-dot"></span>${state.sessionStatus === 'saved' ? '세션에 저장됨' : '저장되지 않음'}`;
}

function saveSession() {
  Object.entries(storageKeys).forEach(([name, key]) => {
    if (state.apiKeys[name]) sessionStorage.setItem(key, state.apiKeys[name]);
    else sessionStorage.removeItem(key);
  });
  state.sessionStatus = 'saved';
  state.apiError = '';
  updateApiStatus();
}

function clearSession() {
  Object.values(storageKeys).forEach((key) => sessionStorage.removeItem(key));
  state.apiKeys.openai = '';
  state.apiKeys.gemini = '';
  state.sessionStatus = 'empty';
  state.apiError = '';
  render();
}

render();
