import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { API_NETWORK_ERROR_MESSAGE, apiFailureAction } from '../src/utils/apiFailure.js';

describe('apiFailureAction', () => {
  it('treats transport failures as network errors and does not clear the session', () => {
    for (const error of [
      { code: 'ERR_NETWORK', message: 'Network Error' },
      { code: 'ERR_EMPTY_RESPONSE', message: 'Empty response' },
      { code: 'ERR_BAD_RESPONSE', message: 'timeout of Network Error' },
      { message: 'connect ERR_CONNECTION_REFUSED 127.0.0.1:5000' },
      { message: 'Empty response from server' },
    ]) {
      const action = apiFailureAction(error, '/dashboard');
      assert.equal(action.type, 'network');
      assert.equal(action.clearToken, false);
      assert.equal(action.redirectToLogin, false);
      assert.equal(action.message, API_NETWORK_ERROR_MESSAGE);
    }
  });

  it('does not log the user out when a network code is paired with 401', () => {
    const action = apiFailureAction({
      code: 'ERR_NETWORK',
      message: undefined,
      response: { status: 401 },
    }, '/time');
    assert.equal(action.type, 'network');
    assert.equal(action.redirectToLogin, false);
    assert.equal(action.clearToken, false);
  });

  it('clears the token and redirects on 401 and 403 off the login page', () => {
    for (const status of [401, 403]) {
      const action = apiFailureAction({ message: 'nope', response: { status } }, '/so-app/admin');
      assert.equal(action.type, 'auth');
      assert.equal(action.clearToken, true);
      assert.equal(action.redirectToLogin, true);
    }
  });

  it('does not redirect when the path already ends in /login', () => {
    for (const pathname of ['/login', '/so-app/login']) {
      const action = apiFailureAction({ message: 'expired', response: { status: 401 } }, pathname);
      assert.equal(action.type, 'reject');
      assert.equal(action.redirectToLogin, false);
      assert.equal(action.clearToken, false);
    }
  });

  it('leaves other statuses to the caller', () => {
    for (const status of [400, 404, 500]) {
      const action = apiFailureAction({ message: 'bad', response: { status } }, '/crm');
      assert.equal(action.type, 'reject');
      assert.equal(action.clearToken, false);
      assert.equal(action.redirectToLogin, false);
    }
  });
});
