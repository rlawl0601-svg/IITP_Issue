const REPORT_STORAGE_KEY = 'briefmaker_saved_reports';

function readReports() {
  try { return JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveReport(report) {
  const id = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = { id, savedAt: new Date().toISOString(), ...report };
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify([record, ...readReports()].slice(0, 30)));
  return record;
}

function getReport(id) { return readReports().find((report) => report.id === id) || null; }

window.reportStorage = { saveReport, getReport };
