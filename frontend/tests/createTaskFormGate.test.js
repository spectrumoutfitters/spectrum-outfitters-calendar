import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CREATE_TASK_PDF_MAX_BYTES,
  createTaskPdfUploadError,
  createTaskTitleError,
  createTaskTitlePresent,
  createTaskImportSelectionError,
} from '../src/utils/createTaskFormGate.js';

describe('createTaskPdfUploadError', () => {
  it('returns null when no file is selected', () => {
    assert.equal(createTaskPdfUploadError(null), null);
    assert.equal(createTaskPdfUploadError(undefined), null);
  });

  it('rejects non-PDF MIME types', () => {
    assert.equal(
      createTaskPdfUploadError({ type: 'image/png', size: 100 }),
      'Please upload a PDF file'
    );
  });

  it('rejects files larger than 10MB', () => {
    assert.equal(
      createTaskPdfUploadError({ type: 'application/pdf', size: CREATE_TASK_PDF_MAX_BYTES + 1 }),
      'File size must be less than 10MB'
    );
  });

  it('accepts a PDF at the 10MB boundary', () => {
    assert.equal(
      createTaskPdfUploadError({ type: 'application/pdf', size: CREATE_TASK_PDF_MAX_BYTES }),
      null
    );
  });
});

describe('createTaskTitleError / createTaskTitlePresent', () => {
  it('submit path rejects empty and whitespace-only titles', () => {
    assert.equal(createTaskTitleError(''), 'Title is required');
    assert.equal(createTaskTitleError('   '), 'Title is required');
    assert.equal(createTaskTitleError(null), 'Title is required');
    assert.equal(createTaskTitleError('Oil change'), null);
  });

  it('AI estimate path treats whitespace as present (falsy-only)', () => {
    assert.equal(createTaskTitlePresent(''), false);
    assert.equal(createTaskTitlePresent(null), false);
    assert.equal(createTaskTitlePresent('   '), true);
    assert.equal(createTaskTitlePresent('Oil change'), true);
  });
});

describe('createTaskImportSelectionError', () => {
  it('requires a non-empty selectedItems array', () => {
    assert.equal(
      createTaskImportSelectionError([]),
      'Please select at least one item to import.'
    );
    assert.equal(
      createTaskImportSelectionError(null),
      'Please select at least one item to import.'
    );
    assert.equal(createTaskImportSelectionError([{ title: 'Oil' }]), null);
  });
});
