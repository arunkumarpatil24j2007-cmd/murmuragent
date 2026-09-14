// scripts/test-google-auth.ts — Automated Test Suite for Google Workspace OAuth & Supabase Persistent Token Store

import assert from 'assert';
import {
  GOOGLE_SCOPES,
  generateGoogleAuthUrl,
  getAuthenticatedGoogleClient,
  getGoogleAuthStatus,
  disconnectGoogle,
} from '../lib/google-auth';
import { tokenStore, GoogleStoredTokens, encryptPayload, decryptPayload } from '../lib/token-store';
import { env, isProviderConfigured } from '../lib/env';

async function runTests() {
  console.log('🧪 Starting Google Workspace OAuth & Persistent Token Store Test Suite...\n');

  // Test 1: Verify Scopes
  console.log('Test 1: Verify Google OAuth Scopes');
  const requiredScopes = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
  ];
  for (const scope of requiredScopes) {
    assert(GOOGLE_SCOPES.includes(scope as any), `Missing required scope: ${scope}`);
  }
  console.log('  ✅ All 4 workspace scopes (Gmail, Drive, Docs, Sheets) verified.');

  // Test 2: Auth URL Generation
  console.log('\nTest 2: Verify Auth URL Generation');
  const mockClientId = 'mock-client-id-12345.apps.googleusercontent.com';
  (env.google as any).clientId = mockClientId;
  const authUrl = generateGoogleAuthUrl('test_state_123', 'http://localhost:3000/api/auth/google/callback');
  assert(authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), 'Must use Google OAuth2 endpoint');
  assert(authUrl.includes('access_type=offline'), 'Must request offline access for refresh tokens');
  assert(authUrl.includes('prompt=consent'), 'Must force consent prompt to ensure refresh token is returned');
  assert(authUrl.includes('state=test_state_123'), 'Must preserve state parameter');
  assert(authUrl.includes('gmail.modify'), 'Must include Gmail scope in query');
  assert(authUrl.includes('spreadsheets'), 'Must include Sheets scope in query');
  assert(authUrl.includes('documents'), 'Must include Docs scope in query');
  console.log('  ✅ Auth URL generates valid offline consent URL with all scopes.');

  // Test 3: Standalone AES-256-GCM Encryption & Decryption
  console.log('\nTest 3: Standalone AES-256-GCM Encryption & Decryption');
  const secretPayload = JSON.stringify({
    refresh_token: '1//04test_refresh_token_very_secret_12345',
    access_token: 'ya29.test_access_token_secret_67890',
  });
  const encrypted = encryptPayload(secretPayload);
  assert(encrypted.split(':').length === 3, 'Ciphertext must format as iv:authTag:encrypted');
  assert(!encrypted.includes('test_refresh_token'), 'Ciphertext must not expose raw token text');

  const decrypted = decryptPayload(encrypted);
  assert.strictEqual(decrypted, secretPayload, 'Decrypted payload must match original secret');
  console.log('  ✅ AES-256-GCM encryption & authenticated decryption verified.');

  // Test 4: Persistent Token Store (Multi-Account Support)
  console.log('\nTest 4: Multi-Account Persistent Token Store');
  // Backup existing real account tokens before running test
  const existingBackup = await tokenStore.getTokens();
  await tokenStore.deleteTokens('primary@example.com');
  await tokenStore.deleteTokens('secondary@company.com');

  const primaryTokens: GoogleStoredTokens = {
    access_token: 'ya29.primary_access_token',
    refresh_token: '1//primary_refresh_token',
    scope: GOOGLE_SCOPES.join(' '),
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600 * 1000,
    user: {
      email: 'primary@example.com',
      name: 'Primary User',
      picture: 'https://lh3.googleusercontent.com/a/primary_avatar',
    },
    updatedAt: new Date().toISOString(),
  };

  const secondaryTokens: GoogleStoredTokens = {
    access_token: 'ya29.secondary_access_token',
    refresh_token: '1//secondary_refresh_token',
    scope: GOOGLE_SCOPES.join(' '),
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600 * 1000,
    user: {
      email: 'secondary@company.com',
      name: 'Secondary Work User',
      picture: 'https://lh3.googleusercontent.com/a/secondary_avatar',
    },
    updatedAt: new Date().toISOString(),
  };

  // Save primary
  await tokenStore.saveTokens(primaryTokens, true);
  // Save secondary
  await tokenStore.saveTokens(secondaryTokens, false);

  // Retrieve accounts list
  const accounts = await tokenStore.listAccounts();
  assert(accounts.length >= 2, 'Store must support multiple accounts');
  const primaryAccount = accounts.find((a) => a.email === 'primary@example.com');
  const secondaryAccount = accounts.find((a) => a.email === 'secondary@company.com');
  assert(primaryAccount?.isPrimary === true, 'Primary account must have isPrimary: true');
  assert(secondaryAccount?.isPrimary === false, 'Secondary account must have isPrimary: false');

  // Verify default getTokens() returns primary account
  const loadedPrimary = await tokenStore.getTokens();
  assert.strictEqual(loadedPrimary?.user?.email, 'primary@example.com', 'Default getTokens() must return primary account');
  assert.strictEqual(loadedPrimary?.refresh_token, '1//primary_refresh_token', 'Must decrypt primary refresh token');

  // Verify getTokens("secondary@company.com") returns secondary account
  const loadedSecondary = await tokenStore.getTokens('secondary@company.com');
  assert.strictEqual(loadedSecondary?.user?.email, 'secondary@company.com', 'getTokens(accountId) must return requested account');
  assert.strictEqual(loadedSecondary?.refresh_token, '1//secondary_refresh_token', 'Must decrypt secondary refresh token');

  console.log('  ✅ Multi-account persistent token store with primary designation verified.');

  // Test 5: Sanitized Auth Status (Zero Token Exposure)
  console.log('\nTest 5: Sanitized Auth Status (Zero Token Exposure)');
  const status = await getGoogleAuthStatus();
  assert(status.isConnected === true, 'Status should report connected');
  assert.strictEqual(status.email, 'primary@example.com', 'Status should report primary email');
  assert(status.storeType === 'supabase' || status.storeType === 'local', 'StoreType must be supabase or local');
  assert(!('access_token' in (status as any)), 'Security: access_token must NEVER be in status response');
  assert(!('refresh_token' in (status as any)), 'Security: refresh_token must NEVER be in status response');
  console.log('  ✅ Security: Refresh tokens strictly isolated server-side and never exposed.');

  // Test 6: Disconnect and Account Deletion
  console.log('\nTest 6: Disconnect and Account Deletion');
  await disconnectGoogle('primary@example.com');
  const afterDeletePrimary = await tokenStore.getTokens('primary@example.com');
  assert(afterDeletePrimary === null, 'Primary account should be deleted');

  // Cleanup secondary
  await disconnectGoogle('secondary@company.com');
  
  // Restore real user account if it existed before the test
  if (existingBackup) {
    await tokenStore.saveTokens(existingBackup, true);
    console.log(`  ℹ️ Restored connected user account: ${existingBackup.user?.email}`);
  } else {
    const postDisconnectStatus = await getGoogleAuthStatus();
    assert(postDisconnectStatus.isConnected === false, 'Status must report isConnected: false when all accounts cleared');
  }
  console.log('  ✅ Account disconnect and cleanup verified.');

  // Test 7: Provider Checks
  console.log('\nTest 7: Provider Checks');
  assert(typeof isProviderConfigured('google') === 'boolean');
  assert(typeof isProviderConfigured('supabase') === 'boolean');
  console.log(`  ℹ️ Store Type detected: ${tokenStore.getStoreType()}`);
  console.log('  ✅ Provider checks verified.');

  console.log('\n🎉 ALL PERSISTENT TOKEN STORE TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
