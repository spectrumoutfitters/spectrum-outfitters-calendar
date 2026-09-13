import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANTHROPIC_PLACEHOLDER_API_KEY,
  isAnthropicApiKeyConfigured,
  isAiFeatureFlagEnabled,
  isLocalAiSyncEnabled,
  isAiEnabledSyncFromFlags,
} from '../utils/aiCredentialsGate.js';

describe('isAnthropicApiKeyConfigured', () => {
  it('rejects missing, empty, and whitespace-only keys', () => {
    assert.equal(isAnthropicApiKeyConfigured(undefined), false);
    assert.equal(isAnthropicApiKeyConfigured(null), false);
    assert.equal(isAnthropicApiKeyConfigured(''), false);
    assert.equal(isAnthropicApiKeyConfigured('   '), false);
  });

  it('rejects the exact .env placeholder', () => {
    assert.equal(isAnthropicApiKeyConfigured(ANTHROPIC_PLACEHOLDER_API_KEY), false);
    assert.equal(isAnthropicApiKeyConfigured('your_api_key_here'), false);
  });

  it('accepts a real key', () => {
    assert.equal(isAnthropicApiKeyConfigured('sk-ant-live-abc123'), true);
  });

  it('treats a placeholder with trailing spaces as configured (trim is empty-only)', () => {
    assert.equal(isAnthropicApiKeyConfigured('your_api_key_here '), true);
  });
});

describe('isAiFeatureFlagEnabled / isLocalAiSyncEnabled', () => {
  it('disables AI only on the exact string false', () => {
    assert.equal(isAiFeatureFlagEnabled('false'), false);
    assert.equal(isAiFeatureFlagEnabled(undefined), true);
    assert.equal(isAiFeatureFlagEnabled(''), true);
    assert.equal(isAiFeatureFlagEnabled('true'), true);
    assert.equal(isAiFeatureFlagEnabled('0'), true);
  });

  it('treats only exact true as sync local-AI enabled', () => {
    assert.equal(isLocalAiSyncEnabled('true'), true);
    assert.equal(isLocalAiSyncEnabled('auto'), false);
    assert.equal(isLocalAiSyncEnabled('TRUE'), false);
    assert.equal(isLocalAiSyncEnabled(undefined), false);
  });
});

describe('isAiEnabledSyncFromFlags', () => {
  it('needs the feature flag plus Claude key or USE_LOCAL_AI=true', () => {
    assert.equal(isAiEnabledSyncFromFlags({ apiKeyConfigured: true, aiEnabled: undefined, useLocalAi: undefined }), true);
    assert.equal(isAiEnabledSyncFromFlags({ apiKeyConfigured: false, aiEnabled: undefined, useLocalAi: 'true' }), true);
    assert.equal(isAiEnabledSyncFromFlags({ apiKeyConfigured: false, aiEnabled: undefined, useLocalAi: 'auto' }), false);
    assert.equal(isAiEnabledSyncFromFlags({ apiKeyConfigured: true, aiEnabled: 'false', useLocalAi: 'true' }), false);
  });
});
