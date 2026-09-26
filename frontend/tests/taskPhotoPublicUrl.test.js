import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { taskPhotoPublicUrl } from '../src/utils/taskPhotoPublicUrl.js';

describe('taskPhotoPublicUrl', () => {
  it('turns a Windows upload path into a browser URL', () => {
    assert.equal(
      taskPhotoPublicUrl('uploads\\tasks\\task_1710000000000_ab12.jpg'),
      '/uploads/tasks/task_1710000000000_ab12.jpg'
    );
  });

  it('keeps a POSIX path and still prefixes a single slash', () => {
    assert.equal(
      taskPhotoPublicUrl('uploads/tasks/task_1.jpg'),
      '/uploads/tasks/task_1.jpg'
    );
  });

  it('normalizes mixed separators', () => {
    assert.equal(
      taskPhotoPublicUrl('uploads\\tasks/task_2.png'),
      '/uploads/tasks/task_2.png'
    );
  });
});
