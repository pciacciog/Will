import apn from 'node-apn';
import fs from 'fs';

interface TokenValidationResult {
  token: string;
  tokenHash: string;
  sandboxResult: 'success' | 'fail' | 'error';
  productionResult: 'success' | 'fail' | 'error';
  sandboxError?: string;
  productionError?: string;
  environment: 'sandbox' | 'production' | 'unknown' | 'invalid';
  recommendation: string;
}

export class TokenEnvironmentValidator {
  private sandboxProvider: apn.Provider | null = null;
  private productionProvider: apn.Provider | null = null;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    try {
      // Check for fixed .p8 key file first
      const fixedKeyPath = './AuthKey_87W6BN7P29.p8';
      const hasFixedKeyFile = fs.existsSync(fixedKeyPath);
      
      if (hasFixedKeyFile && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID) {
        console.log('[TokenValidator] Initializing APNs providers for validation');
        
        // Sandbox provider (development)
        const sandboxOptions = {
          token: {
            key: fs.readFileSync(fixedKeyPath),
            keyId: process.env.APNS_KEY_ID!,
            teamId: process.env.APNS_TEAM_ID!,
          },
          production: false,
        };
        
        // Production provider
        const productionOptions = {
          token: {
            key: fs.readFileSync(fixedKeyPath),
            keyId: process.env.APNS_KEY_ID!,
            teamId: process.env.APNS_TEAM_ID!,
          },
          production: true,
        };
        
        this.sandboxProvider = new apn.Provider(sandboxOptions);
        this.productionProvider = new apn.Provider(productionOptions);
        
        console.log('[TokenValidator] Both sandbox and production APNs providers initialized');
      } else {
        console.warn('[TokenValidator] Cannot initialize APNs providers - missing credentials');
      }
    } catch (error) {
      console.error('[TokenValidator] Error initializing APNs providers:', error);
    }
  }

  async validateToken(deviceToken: string): Promise<TokenValidationResult> {
    const tokenHash = deviceToken.substring(0, 8);
    
    console.log(`[TokenValidator] 🧪 VALIDATING TOKEN ENVIRONMENT: ${tokenHash}...`);
    
    const result: TokenValidationResult = {
      token: deviceToken,
      tokenHash,
      sandboxResult: 'error',
      productionResult: 'error',
      environment: 'unknown',
      recommendation: 'Unable to determine environment'
    };

    // Validate token format first
    if (!/^[0-9a-fA-F]{64}$/.test(deviceToken)) {
      result.environment = 'invalid';
      result.recommendation = 'Token format invalid - should be 64 hex characters';
      return result;
    }

    // Create a minimal test notification
    const testNotification = new apn.Notification();
    testNotification.alert = {
      title: "Environment Test",
      body: "Testing token environment"
    };
    testNotification.badge = 1;
    testNotification.sound = 'default';
    testNotification.topic = process.env.APNS_TOPIC || 'com.porfirio.will';
    testNotification.payload = { test: true };

    // Test against sandbox
    if (this.sandboxProvider) {
      try {
        console.log(`[TokenValidator] 🔍 Testing against SANDBOX environment...`);
        const sandboxResult = await this.sandboxProvider.send(testNotification, deviceToken);
        
        if (sandboxResult.sent.length > 0) {
          result.sandboxResult = 'success';
          console.log(`[TokenValidator] ✅ SANDBOX test: SUCCESS`);
        } else if (sandboxResult.failed.length > 0) {
          result.sandboxResult = 'fail';
          result.sandboxError = sandboxResult.failed[0]?.response?.reason || 'Unknown error';
          console.log(`[TokenValidator] ❌ SANDBOX test: FAILED (${result.sandboxError})`);
        }
      } catch (error) {
        result.sandboxResult = 'error';
        result.sandboxError = (error as Error).message;
        console.error(`[TokenValidator] ❌ SANDBOX test: ERROR (${result.sandboxError})`);
      }
    } else {
      result.sandboxError = 'Sandbox provider not available';
    }

    // Test against production
    if (this.productionProvider) {
      try {
        console.log(`[TokenValidator] 🔍 Testing against PRODUCTION environment...`);
        const productionResult = await this.productionProvider.send(testNotification, deviceToken);
        
        if (productionResult.sent.length > 0) {
          result.productionResult = 'success';
          console.log(`[TokenValidator] ✅ PRODUCTION test: SUCCESS`);
        } else if (productionResult.failed.length > 0) {
          result.productionResult = 'fail';
          result.productionError = productionResult.failed[0]?.response?.reason || 'Unknown error';
          console.log(`[TokenValidator] ❌ PRODUCTION test: FAILED (${result.productionError})`);
        }
      } catch (error) {
        result.productionResult = 'error';
        result.productionError = (error as Error).message;
        console.error(`[TokenValidator] ❌ PRODUCTION test: ERROR (${result.productionError})`);
      }
    } else {
      result.productionError = 'Production provider not available';
    }

    // Determine environment and recommendation
    if (result.sandboxResult === 'success' && result.productionResult !== 'success') {
      result.environment = 'sandbox';
      result.recommendation = 'Token is from DEVELOPMENT environment - compatible with sandbox APNs';
    } else if (result.productionResult === 'success' && result.sandboxResult !== 'success') {
      result.environment = 'production';
      result.recommendation = 'Token is from PRODUCTION environment - requires production APNs server';
    } else if (result.sandboxResult === 'success' && result.productionResult === 'success') {
      result.environment = 'unknown';
      result.recommendation = 'Token works in both environments - unusual, may indicate test notification issue';
    } else {
      result.environment = 'unknown';
      result.recommendation = `Token failed in both environments. Sandbox: ${result.sandboxError}, Production: ${result.productionError}`;
    }

    console.log(`[TokenValidator] 📊 VALIDATION COMPLETE:`);
    console.log(`  🔍 Token: ${tokenHash}...`);
    console.log(`  🔍 Environment: ${result.environment.toUpperCase()}`);
    console.log(`  🔍 Sandbox: ${result.sandboxResult.toUpperCase()} ${result.sandboxError ? `(${result.sandboxError})` : ''}`);
    console.log(`  🔍 Production: ${result.productionResult.toUpperCase()} ${result.productionError ? `(${result.productionError})` : ''}`);
    console.log(`  🔍 Recommendation: ${result.recommendation}`);

    return result;
  }

  async shutdown() {
    if (this.sandboxProvider) {
      this.sandboxProvider.shutdown();
    }
    if (this.productionProvider) {
      this.productionProvider.shutdown();
    }
  }
}

// Export singleton instance
export const tokenValidator = new TokenEnvironmentValidator();