#!/bin/bash

echo "📦 Creating backup of critical APNs files"
echo "========================================="

# Create backup directory
mkdir -p backup-apns-$(date +%Y%m%d-%H%M)
BACKUP_DIR="backup-apns-$(date +%Y%m%d-%H%M)"

echo "Creating backup in: $BACKUP_DIR"

# Critical APNs files to preserve
cp server/pushNotificationService.ts $BACKUP_DIR/
cp AuthKey_4J2R866V2R_fixed.p8 $BACKUP_DIR/
cp capacitor.config.json $BACKUP_DIR/
cp FINAL_PUSH_NOTIFICATION_STATUS.md $BACKUP_DIR/
cp replit.md $BACKUP_DIR/

# Additional important files
cp server/index-standalone.ts $BACKUP_DIR/ 2>/dev/null || true
cp server/routes.ts $BACKUP_DIR/ 2>/dev/null || true
cp shared/schema.ts $BACKUP_DIR/ 2>/dev/null || true

echo "✅ Backup created successfully!"
echo "Files backed up:"
ls -la $BACKUP_DIR/

echo ""
echo "🔐 These files contain your APNs integration work:"
echo "- server/pushNotificationService.ts (Real APNs functionality)"
echo "- AuthKey_4J2R866V2R_fixed.p8 (Fixed Apple certificate)"
echo "- capacitor.config.json (Push notification config)"
echo "- FINAL_PUSH_NOTIFICATION_STATUS.md (Implementation docs)"
echo ""
echo "Use this backup if you need to restore after conflict resolution."