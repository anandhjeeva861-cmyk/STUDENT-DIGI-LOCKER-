(function () {
  const departments = [
    'B.Sc Computer Science (BSC CS)',
    'Artificial Intelligence & Machine Learning (AI & ML)',
    'B.Com',
    'MBA',
    'Information Technology (IT)',
    'Computer Science & Data Analytics (CSDA)',
    'Catering Science & Hotel Management (CS & HM)',
    'BBA',
    'B.Com Professional Accounting (BCOM PA)',
    'B.Com Information Technology (BCOM IT)',
  ];

  window.SL_DEPARTMENTS = departments;
  window.SL_YEARS = ['I', 'II', 'III'];
  window.SL_YEAR_LABELS = {
    I: 'I Year',
    II: 'II Year',
    III: 'III Year',
  };
  window.SL_ACADEMIC_DOCUMENT_TYPES = [
    'Aadhaar Card',
    'Income Certificate',
    'Community Certificate',
    '10th Marksheet',
    '12th Marksheet',
    'Bank Passbook',
  ];

  window.populateDepartmentSelects = function populateDepartmentSelects() {
    document.querySelectorAll('[data-department-select]').forEach((select) => {
      const current = select.value;
      const placeholder = select.dataset.placeholder || 'Select Department';
      select.innerHTML = `<option value="">${placeholder}</option>` + departments
        .map((department) => `<option value="${department}">${department}</option>`)
        .join('');
      if (departments.includes(current)) select.value = current;
    });
  };

  window.populateYearSelects = function populateYearSelects() {
    document.querySelectorAll('[data-year-select]').forEach((select) => {
      const current = select.value;
      const placeholder = select.dataset.placeholder || 'Select Year';
      select.innerHTML = `<option value="">${placeholder}</option>` + window.SL_YEARS
        .map((year) => `<option value="${year}">${window.SL_YEAR_LABELS[year] || year}</option>`)
        .join('');
      if (window.SL_YEARS.includes(current)) select.value = current;
    });
  };

  window.populateAcademicDocumentTypeSelects = function populateAcademicDocumentTypeSelects() {
    document.querySelectorAll('[data-academic-document-type-select]').forEach((select) => {
      const current = select.value;
      const placeholder = select.dataset.placeholder || 'Select Document Type';
      select.innerHTML = `<option value="">${placeholder}</option>` + window.SL_ACADEMIC_DOCUMENT_TYPES
        .map((type) => `<option value="${type}">${type}</option>`)
        .join('');
      if (window.SL_ACADEMIC_DOCUMENT_TYPES.includes(current)) select.value = current;
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.populateDepartmentSelects);
    document.addEventListener('DOMContentLoaded', window.populateYearSelects);
    document.addEventListener('DOMContentLoaded', window.populateAcademicDocumentTypeSelects);
  } else {
    window.populateDepartmentSelects();
    window.populateYearSelects();
    window.populateAcademicDocumentTypeSelects();
  }
})();
