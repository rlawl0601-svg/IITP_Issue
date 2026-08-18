const typeLabels = {
  onePager: '보고용 1장 페이퍼',
  situation: '현황-문제점-대응방향',
};

function createDemoReport({ input, reportType, period, sources }) {
  const subject = input.trim() || '새로운 정책 이슈';
  const sourceText = sources.length ? sources.join(', ') : '전체 소스';

  if (reportType === 'onePager') {
    return {
      title: subject,
      meta: `${typeLabels[reportType]} · ${period} · ${sourceText}`,
      sections: [
        ['한눈에 보기', `${subject}에 대한 최근 동향을 중심으로 핵심 쟁점과 대응 우선순위를 정리한 초안입니다.`],
        ['핵심 현황', '관련 보도와 공공·연구 자료를 종합하면, 정책 환경의 변화와 이해관계자별 요구가 동시에 확대되고 있습니다. 주요 지표와 공식 발표를 기준으로 사실관계를 우선 확인할 필요가 있습니다.'],
        ['주요 쟁점', '① 영향 범위와 대상의 구체화  ② 단기 대응과 중장기 개선의 균형  ③ 대외 커뮤니케이션 메시지 정합성'],
        ['대응 방향', '관계 부처·기관의 최신 자료를 바탕으로 사실관계를 확정하고, 단기적으로는 문의·민원 대응 체계를 정비합니다. 중장기적으로는 성과지표를 설정해 대응 결과를 점검합니다.'],
      ],
    };
  }

  return {
    title: subject,
    meta: `${typeLabels[reportType]} · ${period} · ${sourceText}`,
    sections: [
      ['현황', `${subject} 관련 최근 자료와 보도에서 확인되는 주요 흐름을 정리했습니다. 정책·시장·사회적 관심이 이어지고 있어 지속적인 모니터링이 필요합니다.`],
      ['문제점', '정보가 여러 출처에 분산되어 있고, 자료별 기준 시점과 해석이 다를 수 있습니다. 핵심 사실과 전망을 구분해 검증하는 작업이 선행되어야 합니다.'],
      ['대응 방향', '공식 데이터와 현장 의견을 교차 검증하고, 담당 부서별 역할과 의사결정 시점을 명확히 합니다. 대외 설명자료는 확인된 사실과 향후 계획 중심으로 간결하게 구성합니다.'],
      ['후속 확인 항목', '• 최신 공식 통계 및 발표 일정\n• 주요 이해관계자 반응\n• 대응 조치별 담당자·완료 기한\n• 성과 확인을 위한 측정 지표'],
    ],
  };
}

// Expose the service for the browser entry point. Keeping this in its own file
// makes it straightforward to replace with an OpenAI/Gemini adapter later.
window.createDemoReport = createDemoReport;
