export const runtime = 'nodejs';

const OPENAI_MODEL = 'gpt-5.6-luna';
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 120_000;
const MAX_SOURCES = 20;

const sourceGuidance = {
  '정부·공공기관': '정부 부처, 지방자치단체, 공공기관의 공식 자료를 우선 확인',
  '연구·학술': '학술지, 연구기관, 대학, 전문 연구보고서를 우선 확인',
  뉴스: '주요 언론사의 최신 보도를 확인하되 사실관계를 교차 검증',
  기업: '기업 공식 발표, 공시, IR, 기업 연구자료를 확인',
  국제기구: 'UN, OECD, IMF, World Bank 등 국제기구의 공식 자료를 확인',
};

const sourceDomains = {
  '정부·공공기관': ['go.kr', 'gov.kr', 'korea.kr', 'data.go.kr'],
  '연구·학술': ['arxiv.org', 'nature.com', 'sciencedirect.com', 'kci.go.kr', 'riss.kr'],
  뉴스: ['reuters.com', 'apnews.com', 'bbc.com', 'yna.co.kr', 'chosun.com', 'joongang.co.kr', 'hani.co.kr'],
  기업: ['sec.gov', 'dart.fss.or.kr'],
  국제기구: ['un.org', 'oecd.org', 'imf.org', 'worldbank.org', 'who.int'],
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function cleanUrl(raw) {
  try {
    const url = new URL(raw);
    [...url.searchParams.keys()].forEach((key) => {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    });
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return null;
  }
}

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const url = cleanUrl(source.url);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    source.url = url;
    return true;
  }).slice(0, MAX_SOURCES).map((source, index) => ({ ...source, index: index + 1 }));
}

function sourceListFromOpenAI(response) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'url_citation' && node.url) found.push({ url: node.url, title: node.title || node.url });
    Object.values(node).forEach(visit);
  };
  visit(response.output);
  return found;
}

function textFromOpenAI(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  const chunks = [];
  for (const item of response.output || []) {
    if (item.type === 'message') {
      for (const content of item.content || []) {
        if (typeof content.text === 'string' && content.text.trim()) chunks.push(content.text.trim());
      }
    } else if ((item.type === 'output_text' || item.type === 'text') && typeof item.text === 'string' && item.text.trim()) {
      chunks.push(item.text.trim());
    }
  }
  return chunks.join('\n\n').trim();
}

function sourceListFromGemini(response) {
  return (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []).flatMap((chunk) => {
    const web = chunk.web || {};
    return web.uri ? [{ url: web.uri, title: web.title || web.uri }] : [];
  });
}

function withCitationHint(text, sources) {
  if (!text || !sources.length || /\[\d+\]/.test(text)) return text;
  return `${text.trim()} [1]`;
}

function buildPrompt({ input, reportType, period, sources, templateMarkdown }) {
  const guidance = sources.length ? sources.map((source) => sourceGuidance[source]).join('; ') : '출처 유형 제한 없이 신뢰할 수 있는 1차 자료를 우선 확인';
  const templateInstruction = templateMarkdown?.trim() ? `\n\n업로드된 문서 양식 분석 결과:\n${templateMarkdown.slice(0, 30000)}\n\n중요: 위 양식의 제목·항목·문단 순서·표 구조를 최대한 유지하고, 보고서 본문도 같은 순서와 계층으로 작성하세요. 양식에 없는 내용은 기존 보고서 출력 항목 중 가장 가까운 위치에 배치하세요.` : '\n\n업로드된 문서 양식은 없습니다. 지정된 기본 보고서 항목 순서를 사용하세요.';
  return `당신은 이슈 대응·성과 보고서 작성 보조자입니다. 아래 자료를 바탕으로 한국어 보고서 초안을 작성하세요.

입력 자료:
${input.trim() || '새로운 정책 이슈'}

검색 기간: ${period}
선택 출처 유형: ${sources.join(', ') || '전체'}
검색 지침: ${guidance}
보고서 유형: ${reportType === 'onePager' ? '보고용 1장 페이퍼' : '현황-문제점-대응방향'}

반드시 다음 순서의 제목을 사용하세요: 제목, 핵심 요약, 현황, 문제점, 대응방향, 효과성, 시사점, 참고 출처.
검색으로 확인한 근거가 있는 문장 뒤에는 제공되는 출처 순서에 맞춰 [1], [2] 형식의 인용 번호를 붙이세요. 확인되지 않은 수치나 사실은 단정하지 말고 확인 필요로 표시하세요. 참고 출처 목록은 본문 뒤에 작성하세요. 검색 결과는 최대 ${MAX_SOURCES}개까지 활용하세요.${templateInstruction}`;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function callOpenAI({ apiKey, prompt, sources }) {
  const allowedDomains = [...new Set(sources.flatMap((source) => sourceDomains[source] || []))];
  const body = {
    model: OPENAI_MODEL,
    input: prompt,
    tools: [{ type: 'web_search', ...(allowedDomains.length ? { filters: { allowed_domains: allowedDomains } } : {}) }],
  };
  const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `OpenAI 요청 실패 (${response.status})`);
  const citations = dedupeSources(sourceListFromOpenAI(data));
  const text = textFromOpenAI(data) || (citations.length ? '검색 결과는 확인되었지만 OpenAI가 본문 텍스트를 반환하지 않았습니다. 출처를 확인해 주세요.' : 'OpenAI가 본문 텍스트를 반환하지 않았습니다.');
  return { provider: 'openai', model: OPENAI_MODEL, text: withCitationHint(text, citations), sources: citations };
}

async function callGemini({ apiKey, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const response = await fetchWithTimeout(url, {
    method: 'POST', headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nGoogle Search Grounding을 사용해 위 검색 지침에 맞는 자료를 찾으세요.` }] }], tools: [{ google_search: {} }] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Gemini 요청 실패 (${response.status})`);
  const text = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('\n').trim();
  const citations = dedupeSources(sourceListFromGemini(data));
  return { provider: 'gemini', model: GEMINI_MODEL, text: withCitationHint(text, citations), sources: citations };
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: '요청 형식을 읽을 수 없습니다.' }, 400); }
  const { input = '', reportType = 'onePager', period = '최근 30일', sources = [], templateMarkdown = '', openaiApiKey = '', geminiApiKey = '' } = body || {};
  if (typeof input !== 'string' || input.length > 5000) return json({ error: '입력 자료는 5,000자 이내여야 합니다.' }, 400);
  if (!openaiApiKey && !geminiApiKey) return json({ error: 'OpenAI 또는 Gemini API 키를 하나 이상 입력해 주세요.' }, 400);

  const selectedSources = Array.isArray(sources) ? sources.filter((source) => typeof source === 'string') : [];
  const prompt = buildPrompt({ input, reportType, period, sources: selectedSources, templateMarkdown: typeof templateMarkdown === 'string' ? templateMarkdown : '' });
  const tasks = [
    openaiApiKey ? callOpenAI({ apiKey: openaiApiKey, prompt, sources: selectedSources }) : Promise.reject(new Error('OpenAI API 키가 입력되지 않았습니다.')),
    geminiApiKey ? callGemini({ apiKey: geminiApiKey, prompt }) : Promise.reject(new Error('Gemini API 키가 입력되지 않았습니다.')),
  ];
  const settled = await Promise.allSettled(tasks);
  return json({ results: settled.map((item, index) => item.status === 'fulfilled' ? item.value : ({ provider: index === 0 ? 'openai' : 'gemini', error: item.reason?.name === 'AbortError' ? '요청 시간이 120초를 초과했습니다.' : item.reason?.message || '알 수 없는 오류가 발생했습니다.' })) });
}
