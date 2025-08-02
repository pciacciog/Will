#!/usr/bin/env node

// Script to verify and fix APNs private key format for OpenSSL compatibility
import crypto from 'crypto';
import fs from 'fs';

console.log('🔧 APNs Private Key Format Verification');
console.log('======================================');

function validateAndFixKey(privateKeyContent) {
  try {
    console.log('1. Checking current key format...');
    
    // Remove any extra whitespace
    let cleanKey = privateKeyContent.trim();
    
    // Check if it has proper headers
    if (!cleanKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.log('   Key missing PKCS8 headers, fixing...');
      
      // Try to detect if it's a raw key or has wrong headers
      if (cleanKey.includes('-----BEGIN')) {
        // Replace any existing headers with PKCS8 format
        cleanKey = cleanKey.replace(/-----BEGIN.*?-----/, '-----BEGIN PRIVATE KEY-----');
        cleanKey = cleanKey.replace(/-----END.*?-----/, '-----END PRIVATE KEY-----');
      } else {
        // It's a raw key, wrap it
        const lines = cleanKey.match(/.{1,64}/g) || [cleanKey];
        cleanKey = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----';
      }
    }
    
    console.log('2. Testing key with Node.js crypto...');
    
    // Test if Node.js can parse the key
    try {
      const keyObject = crypto.createPrivateKey(cleanKey);
      console.log('   ✅ Key successfully parsed by Node.js crypto');
      
      // Test JWT signing compatibility
      const testPayload = { test: 'data', iat: Math.floor(Date.now() / 1000) };
      const testToken = crypto.sign('RS256', Buffer.from(JSON.stringify(testPayload)), keyObject);
      console.log('   ✅ Key can sign JWT tokens');
      
      return { success: true, fixedKey: cleanKey };
      
    } catch (cryptoError) {
      console.log('   ❌ Key format incompatible with Node.js crypto');
      console.log('   Error:', cryptoError.message);
      
      // Try alternative format fixes
      console.log('3. Attempting alternative key format fixes...');
      
      // Try removing any EC or RSA specific headers
      let altKey = cleanKey;
      if (altKey.includes('EC PRIVATE KEY') || altKey.includes('RSA PRIVATE KEY')) {
        altKey = altKey.replace(/-----BEGIN.*PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----');
        altKey = altKey.replace(/-----END.*PRIVATE KEY-----/, '-----END PRIVATE KEY-----');
        
        try {
          crypto.createPrivateKey(altKey);
          console.log('   ✅ Alternative format works');
          return { success: true, fixedKey: altKey };
        } catch {
          console.log('   ❌ Alternative format failed');
        }
      }
      
      return { 
        success: false, 
        error: cryptoError.message,
        suggestion: 'Key may need to be re-exported from Apple Developer in PKCS8 format'
      };
    }
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      suggestion: 'Invalid key content'
    };
  }
}

// Check if APNs key is available
const apnsKey = process.env.APNS_PRIVATE_KEY;

if (!apnsKey) {
  console.log('❌ APNS_PRIVATE_KEY not found in environment variables');
  console.log('   Please ensure the key is properly set');
  process.exit(1);
}

console.log('✅ APNS_PRIVATE_KEY found in environment');
console.log(`   Key length: ${apnsKey.length} characters`);

const result = validateAndFixKey(apnsKey);

if (result.success) {
  console.log('\n🎉 APNs Key Validation: SUCCESS');
  console.log('   Key format is compatible with Node.js crypto');
  console.log('   JWT token signing will work correctly');
  
  // Check if the key was modified
  if (result.fixedKey !== apnsKey) {
    console.log('\n💡 Key format was improved:');
    console.log('   Original key had formatting issues that were corrected');
    console.log('   The corrected key is now compatible');
    
    // Optionally save the fixed key
    console.log('\n📝 Consider updating your environment variable with the corrected format');
  }
  
} else {
  console.log('\n❌ APNs Key Validation: FAILED');
  console.log('   Error:', result.error);
  console.log('   Suggestion:', result.suggestion);
  
  console.log('\n🔧 Troubleshooting Steps:');
  console.log('1. Re-download the .p8 key from Apple Developer Portal');
  console.log('2. Ensure the key is in PKCS8 format (not PKCS1 or EC format)');
  console.log('3. Copy the entire key content including headers');
  console.log('4. Verify no extra characters or encoding issues');
  
  process.exit(1);
}

console.log('\n📱 Next Steps:');
console.log('- Restart the server to test APNs integration');
console.log('- Test push notifications with /api/notifications/test');
console.log('- Deploy to iOS device for end-to-end verification');