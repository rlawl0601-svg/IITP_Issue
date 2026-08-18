import { parse } from 'kordoc';

export const runtime = 'nodejs';

const supported = new Set(['hwp', 'hwpx', 'docx', 'pdf', 'xlsx', 'xls']);
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function extensionOf(name) {
  return String(name || '').toLowerCase().split('.').pop();
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return json({ error: '분석할 파일을 선택해 주세요.' }, 400);

    const fileName = file.name || '업로드 파일';
    const extension = extensionOf(fileName);
    if (!supported.has(extension)) return json({ fileName, error: `지원하지 않는 파일 형식입니다: .${extension || '확장자 없음'}. HWP, HWPX, DOCX, PDF, XLSX, XLS만 업로드할 수 있습니다.` }, 415);

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_BYTES) return json({ fileName, error: '파일 크기가 25MB를 초과했습니다.' }, 413);

    const result = await parse(Buffer.from(arrayBuffer), { keepEmptyParagraphs: true, keepTrailingEmptyCols: true });
    if (!result.success) return json({ fileName, fileType: result.fileType, error: `문서 분석 실패 (${result.code || 'PARSE_ERROR'}): ${result.error || 'kordoc이 문서 내용을 읽지 못했습니다.'}` }, 422);

    const outline = (result.outline || []).map((item) => `${'#'.repeat(Math.max(1, Math.min(6, item.level || 1)))} ${item.text}`).join('\n');
    const markdown = [outline, result.markdown || ''].filter(Boolean).join('\n\n');
    if (!markdown.trim()) return json({ fileName, fileType: result.fileType, error: '문서에서 분석할 텍스트나 표 구조를 찾지 못했습니다.' }, 422);

    return json({ success: true, fileName, fileType: result.fileType, markdown, metadata: result.metadata || {}, warnings: result.warnings || [] });
  } catch (error) {
    return json({ error: `문서 분석 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류가 발생했습니다.'}` }, 500);
  }
}
