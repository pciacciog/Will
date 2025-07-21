# APNs Certificates Directory

Place your Apple Push Notifications certificates/keys in this directory:

## APNs Authentication Key (Recommended)
- `AuthKey_XXXXXXXXXX.p8` - Download from Apple Developer Console → Keys

## APNs Certificate (Alternative)
- `cert.pem` - Converted from .cer file downloaded from Apple Developer Console
- `key.pem` - Private key corresponding to the certificate

## Security Note
**Never commit these files to version control!**
They contain sensitive authentication data for your Apple Developer account.

## File Permissions
Set proper permissions for security:
```bash
chmod 600 certs/AuthKey_*.p8
chmod 600 certs/*.pem
```

## Environment Variables
Update your production environment with:
- `APNS_KEY_PATH=./certs/AuthKey_XXXXXXXXXX.p8`
- `APNS_KEY_ID=XXXXXXXXXX` (from Apple Developer Console)
- `APNS_TEAM_ID=XXXXXXXXXX` (from Apple Developer Console)
- `APNS_BUNDLE_ID=com.porfirio.will`