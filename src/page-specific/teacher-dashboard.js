const analyticsRoot = document.getElementById('academicAnalytics');
let analyticsData = [];
let activeDocuments = [];
let activePreviewDocument = null;
let unsubscribeAnalytics = null;

function studentName(student = {}) {
  return student.fullName || student.name || 'Student';
}

function studentMeta(student = {}) {
  return [student.registerNumber || student.reg, student.year].filter(Boolean).join(' | ') || '-';
}

function docUrl(doc = {}) {
  return window.slDocumentUrl(doc);
}

function renderPreview(doc) {
  activePreviewDocument = doc;
  const body = document.getElementById('documentPreviewBody');
  body.replaceChildren();
  const url = docUrl(doc);
  const type = doc.fileType || doc.type || '';
  document.getElementById('documentPreviewTitle').textContent = doc.title || doc.fileName || 'Preview';
  if (!url) {
    body.innerHTML = '<div class="empty-state">Preview is not available for this document.</div>';
  } else if (type.startsWith('image/')) {
    const image = document.createElement('img');
    image.src = url;
    image.className = 'img-fluid rounded';
    body.appendChild(image);
  } else if (type === 'application/pdf') {
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.style.cssText = 'width:100%;height:70vh;border:0';
    body.appendChild(frame);
  } else {
    body.innerHTML = '<div class="empty-state">Preview is not supported for this file type.</div>';
  }
  new bootstrap.Modal(document.getElementById('documentPreviewModal')).show();
}

window.printActiveDocument = function printActiveDocument() {
  const url = docUrl(activePreviewDocument || {});
  if (!url) return slToast('Print link is not available for this document.', 'error');
  const printWindow = window.open(url, '_blank', 'noopener');
  printWindow?.addEventListener?.('load', () => printWindow.print());
};

function openList(type, mode) {
  const group = analyticsData.find((item) => item.type === type);
  if (!group) return;
  const isUploaded = mode === 'uploaded';
  const rows = isUploaded ? group.uploadedStudents : group.pendingStudents;
  activeDocuments = isUploaded ? rows.map((row) => row.document).filter(Boolean) : [];
  document.getElementById('analyticsListTitle').textContent = `${type} - ${isUploaded ? 'Uploaded' : 'Pending'} Students`;
  document.getElementById('analyticsListBody').innerHTML = rows.length ? `
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>Student</th><th>Register</th><th>Year</th>${isUploaded ? '<th>Status</th><th>Actions</th>' : ''}</tr></thead>
          <tbody>
            ${rows.map((student) => {
              const documentId = student.document?.id || '';
              const url = docUrl(student.document);
              const downloadUrl = window.slDownloadUrl(student.document, student.document?.fileName || student.document?.documentName || type);
              return `<tr>
                <td>${escapeHtml(studentName(student))}</td>
                <td>${escapeHtml(student.registerNumber || student.reg || '-')}</td>
                <td>${escapeHtml(student.year || '-')}</td>
                ${isUploaded ? `<td><span class="badge-info">${escapeHtml(student.document?.status || 'uploaded')}</span></td>` : ''}
                ${isUploaded ? `<td class="text-nowrap">
                  <a class="btn btn-sm btn-outline-primary ${url ? '' : 'disabled'}" href="${escapeHtml(url)}" target="_blank" rel="noopener"><i class="fas fa-eye me-1"></i>View</a>
                  <button type="button" class="btn btn-sm btn-outline-secondary ${downloadUrl ? '' : 'disabled'}" data-download-doc="${escapeHtml(documentId)}"><i class="fas fa-download me-1"></i>Download</button>
                </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : '<div class="empty-state">No students found.</div>';
  new bootstrap.Modal(document.getElementById('analyticsListModal')).show();
}

function drawAnalytics(data) {
  analyticsData = data;
  analyticsRoot.innerHTML = analyticsData.map((item) => `
      <div class="col-md-6 col-xl-4">
        <div class="sl-card h-100">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <h5 class="mb-1">${escapeHtml(item.type.toUpperCase())}</h5>
              <p class="text-muted small mb-0">Academic Certificate</p>
            </div>
            <div class="sl-icon-circle"><i class="fas fa-chart-simple"></i></div>
          </div>
          <div class="row g-2 mt-3">
            <div class="col-6">
              <div class="border rounded p-2">
                <small class="text-muted d-block">Uploaded</small>
                <strong>${item.uploadedCount} Students</strong>
              </div>
            </div>
            <div class="col-6">
              <div class="border rounded p-2">
                <small class="text-muted d-block">Pending</small>
                <strong>${item.pendingCount} Students</strong>
              </div>
            </div>
          </div>
          <div class="d-flex gap-2 mt-3">
            <button class="btn btn-sm btn-outline-primary" data-open-list="${escapeHtml(item.type)}" data-mode="uploaded">Uploaded Student List</button>
            <button class="btn btn-sm btn-outline-secondary" data-open-list="${escapeHtml(item.type)}" data-mode="pending">Pending Student List</button>
          </div>
        </div>
      </div>
    `).join('');
}

async function renderAnalytics() {
  try {
    unsubscribeAnalytics = await window.teacherService.subscribeAcademicDocumentAnalytics(drawAnalytics);
  } catch (error) {
    analyticsRoot.innerHTML = `<div class="col-12"><div class="empty-state">${escapeHtml(error.message || 'Unable to load analytics.')}</div></div>`;
  }
}

analyticsRoot.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-list]');
  if (!button) return;
  openList(button.getAttribute('data-open-list'), button.getAttribute('data-mode'));
});

document.getElementById('analyticsListBody').addEventListener('click', (event) => {
  const downloadButton = event.target.closest('[data-download-doc]');
  if (!downloadButton) return;
  const doc = activeDocuments.find((item) => String(item.id) === String(downloadButton.getAttribute('data-download-doc')));
  if (doc) window.slDownloadDocument(doc, doc.fileName || doc.documentName || doc.title || 'document');
});

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeAnalytics === 'function') unsubscribeAnalytics();
});

renderAnalytics();