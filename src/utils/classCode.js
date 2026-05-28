// Class code helpers.
//
// A class code packs four user-entered fields into one short string used as
// the primary key for cloud-save records:
//
//   {initials}{academicYear}-Y{yearGroup}{letter}
//
// e.g. FRB="FRB", academicYear="26-27", yearGroup="10", letter="A"
//      → "FRB26-27-Y10A"

const ALLOWED_INITIALS = /^[A-Z]{1,4}$/;
const ALLOWED_YEAR     = /^\d{1,2}$/;
const ALLOWED_ACADEMIC = /^\d{2}-\d{2}$/;
const ALLOWED_LETTER   = /^[A-Z]$/;

export function buildClassCode({ initials, yearGroup, academicYear, classLetter }) {
  const i = String(initials || '').toUpperCase().trim();
  const y = String(yearGroup || '').trim();
  const a = String(academicYear || '').trim();
  const l = String(classLetter || '').toUpperCase().trim();
  if (!ALLOWED_INITIALS.test(i)) return '';
  if (!ALLOWED_YEAR.test(y))     return '';
  if (!ALLOWED_ACADEMIC.test(a)) return '';
  if (!ALLOWED_LETTER.test(l))   return '';
  return `${i}${a}-Y${y}${l}`;
}

export function validateInitials(s)    { return ALLOWED_INITIALS.test(String(s || '').toUpperCase()); }
export function validateYearGroup(s)   { return ALLOWED_YEAR.test(String(s || '')); }
export function validateAcademicYear(s){ return ALLOWED_ACADEMIC.test(String(s || '')); }
export function validateClassLetter(s) { return ALLOWED_LETTER.test(String(s || '').toUpperCase()); }

// Returns the missing-field hint string a UI can display next to the live
// preview. Empty string when the code is fully valid.
export function classCodeHint(parts) {
  if (!validateInitials(parts.initials))       return 'Enter 1–4 letters for initials.';
  if (!validateYearGroup(parts.yearGroup))     return 'Enter the year group as 1 or 2 digits (e.g. 10).';
  if (!validateAcademicYear(parts.academicYear)) return 'Enter the academic year as NN-NN (e.g. 26-27).';
  if (!validateClassLetter(parts.classLetter)) return 'Enter a single letter for the class (e.g. A).';
  return '';
}

// Used by the backend URL paths — must be URL-safe.
const CLASS_CODE_PATTERN = /^[A-Z]{1,4}\d{2}-\d{2}-Y\d{1,2}[A-Z]$/;

export function isClassCode(s) {
  return typeof s === 'string' && CLASS_CODE_PATTERN.test(s);
}
