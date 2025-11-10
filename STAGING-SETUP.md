# Staging Database Setup Guide

This guide will help you complete the setup of your staging database environment.

## ✅ What's Been Implemented

1. **Environment-aware database connection** (`server/db.ts`)
   - Automatically switches between production and staging databases based on `NODE_ENV`
   - Logs which database is being used on startup

2. **New npm scripts** (`package.json`)
   - `npm run dev:staging` - Run the app in staging mode
   - `npm run db:push:staging` - Push schema to staging database
   - `npm run seed:staging` - Seed staging database with test data

3. **Staging seed script** (`server/seed-staging.ts`)
   - Creates 3 test users with known credentials
   - Creates a test circle with all members
   - Creates sample wills (active, pending, scheduled)
   - Adds sample commitments

## 🚀 Next Steps

### 1. Create Staging Database in Neon

1. Go to your [Neon Console](https://console.neon.tech/)
2. Select your project
3. Create a new database named `will_staging`
4. Copy the connection string (it will look like):
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/will_staging?sslmode=require
   ```

### 2. Add Database Secret to Replit

In your Replit workspace:

1. Click the **Secrets** tool (🔒) in the left sidebar
2. Click **Add Secret**
3. Set:
   - **Key**: `DATABASE_URL_STAGING`
   - **Value**: Your staging database connection string from Neon

### 3. Push Schema to Staging Database

Run this command to create all tables in your staging database:

```bash
npm run db:push:staging
```

This will apply your schema from `shared/schema.ts` to the staging database.

### 4. Seed Test Data

Run this command to populate your staging database with test data:

```bash
npm run seed:staging
```

This creates:
- **3 Test Users**:
  - `test1@staging.com` (user role)
  - `test2@staging.com` (user role)
  - `test3@staging.com` (admin role)
  - Password for all: `Test123!`
  
- **1 Test Circle**:
  - Name: "Test Circle"
  - Invite Code: `TEST01`
  - All 3 users are members

- **3 Sample Wills**:
  - Active will (in progress)
  - Pending will (not started)
  - Scheduled will (future start date)

### 5. Run Application in Staging Mode

```bash
npm run dev:staging
```

Your app will now connect to the staging database instead of production.

## 🔍 Verification

After running the seed script, you should see:

```
🌱 Seeding staging database...

✅ Created 3 test users
   📧 test1@staging.com (user)
   📧 test2@staging.com (user)
   📧 test3@staging.com (admin)
   🔑 Password for all: Test123!

✅ Created test circle
   🔗 Circle ID: 1
   🎫 Invite Code: TEST01

✅ Added all 3 users to the test circle

✅ Created 3 sample wills:
   📝 Will #1 - ACTIVE (ends in 7 days)
   📝 Will #2 - PENDING (ends in 7 days)
   📝 Will #3 - SCHEDULED (starts in 7 days)

✅ Added sample commitments to active will

🎉 Staging database seeded successfully!
```

## 💡 Usage Tips

### Switch Between Environments

- **Development/Production**: `npm run dev` (uses `DATABASE_URL`)
- **Staging**: `npm run dev:staging` (uses `DATABASE_URL_STAGING`)

### Database Operations

- **Push schema to production**: `npm run db:push`
- **Push schema to staging**: `npm run db:push:staging`
- **Seed staging**: `npm run seed:staging`

### Check Which Database Is Connected

When you start the app, you'll see a console log:
- `🟢 Using DEVELOPMENT database` (development)
- `🟡 Using STAGING database` (staging)
- `🟢 Using PRODUCTION database` (production)

## 🔒 Security Notes

1. **Never** commit database URLs to version control
2. Keep `DATABASE_URL_STAGING` in Replit Secrets only
3. Test users have a simple password (`Test123!`) - this is okay for staging but never use in production
4. Staging database should mirror production schema but not production data

## 📝 Database Schema

Your staging database includes these tables:

- `users` - User accounts
- `sessions` - Session storage (required for auth)
- `circles` - User circles/groups
- `circle_members` - Circle membership
- `wills` - Will entries
- `will_commitments` - User commitments for wills
- `will_acknowledgments` - User acknowledgments
- `daily_progress` - Daily progress tracking
- `will_pushes` - Push notifications
- `blog_posts` - Blog content
- `page_contents` - CMS pages
- `device_tokens` - Push notification tokens

## 🛠️ Troubleshooting

### Error: "DATABASE_URL_STAGING must be set"

- Make sure you've added the `DATABASE_URL_STAGING` secret in Replit
- Verify the secret name is exactly `DATABASE_URL_STAGING`

### Error during schema push

- Verify your Neon database connection string is correct
- Make sure the database exists in Neon
- Check that the connection string includes `?sslmode=require`

### Seed script fails

- Run `npm run db:push:staging` first to create the schema
- If re-running, you may need to clear the database first (duplicate emails/IDs)

## 📞 Need Help?

If you encounter any issues:
1. Check the console logs for specific error messages
2. Verify your `DATABASE_URL_STAGING` secret is set correctly
3. Ensure the Neon database exists and is accessible
