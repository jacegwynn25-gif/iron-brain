# Google OAuth Setup Guide for Iron Brain

## Current Status
✅ NextAuth configured in `app/api/auth/[...nextauth]/route.ts`
✅ Environment variables set in `.env.local`
❌ Google Cloud Console configuration incomplete

## Step-by-Step Setup

### 1. Update NEXTAUTH_SECRET (Important!)

The current secret "change-me-to-a-random-string" needs to be changed to a secure random string.

**Generate a new secret:**
```bash
# Run this command in your terminal:
openssl rand -base64 32
```

**Update `.env.local`:**
```bash
NEXTAUTH_SECRET=<paste-the-generated-string-here>
```

### 2. Configure Google Cloud Console

Go to: https://console.cloud.google.com/apis/credentials

#### A. Find Your OAuth 2.0 Client

Your Client ID: `60646251152-pfh73apf7mqkmcm5r51kd1vt50kjc4gf.apps.googleusercontent.com`

Click on this client to edit it.

#### B. Add Authorized JavaScript Origins

Add these URLs:
```
http://localhost:3000
http://127.0.0.1:3000
```

#### C. Add Authorized Redirect URIs (CRITICAL!)

Add these exact URLs:
```
http://localhost:3000/api/auth/callback/google
http://127.0.0.1:3000/api/auth/callback/google
```

**Important:** The redirect URI must EXACTLY match this format:
`{NEXTAUTH_URL}/api/auth/callback/google`

#### D. Save Changes

Click **Save** at the bottom of the page.

### 3. Verify Environment Variables

Your `.env.local` should look like this:

```bash
GOOGLE_CLIENT_ID=60646251152-pfh73apf7mqkmcm5r51kd1vt50kjc4gf.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<your-generated-secret-here>
```

### 4. Restart Dev Server

After making changes, restart your development server:

```bash
# Kill the current server (Ctrl+C)
npm run dev
```

### 5. Test Google Sign-In

1. Go to http://localhost:3000
2. Click the "Sign in with Google" button
3. You should see the Google OAuth consent screen
4. Select your Google account
5. Grant permissions
6. You should be redirected back to the app and signed in!

## Common Issues & Solutions

### Issue: "redirect_uri_mismatch" Error

**Cause:** The redirect URI in Google Cloud Console doesn't match what NextAuth is sending.

**Solution:**
- Make sure `NEXTAUTH_URL` in `.env.local` is `http://localhost:3000` (no trailing slash)
- Make sure the redirect URI in Google Cloud Console is EXACTLY:
  `http://localhost:3000/api/auth/callback/google`

### Issue: "invalid_client" Error

**Cause:** Client ID or Client Secret is incorrect.

**Solution:**
- Double-check the values in `.env.local` match what's in Google Cloud Console
- Make sure there are no extra spaces or quotes around the values

### Issue: OAuth Consent Screen Not Configured

**Cause:** You haven't set up the OAuth consent screen.

**Solution:**
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Choose "External" user type (unless you have a Google Workspace)
3. Fill in required fields:
   - App name: "Iron Brain"
   - User support email: Your email
   - Developer contact: Your email
4. Save and continue
5. Add scopes (optional - defaults are fine)
6. Add test users if app is in testing mode
7. Publish the app (if ready) or keep in testing mode

### Issue: "Access blocked: This app's request is invalid"

**Cause:** Missing OAuth consent screen configuration or app not published.

**Solution:**
- Complete OAuth consent screen setup (see above)
- Add yourself as a test user if app is in testing mode
- Or publish the app for production use

## For Production Deployment

When you deploy to production (e.g., Vercel), you'll need to:

1. **Update `.env.local` on Vercel:**
   - `NEXTAUTH_URL=https://your-production-domain.com`
   - `NEXTAUTH_SECRET=<new-production-secret>`
   - Keep same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

2. **Add production URLs to Google Cloud Console:**
   - Authorized JavaScript origins: `https://your-production-domain.com`
   - Authorized redirect URIs: `https://your-production-domain.com/api/auth/callback/google`

3. **Publish your OAuth consent screen** (if still in testing mode)

## Verification Checklist

Before testing, verify:

- [ ] NEXTAUTH_SECRET is set to a random 32-character string (not "change-me-to-a-random-string")
- [ ] Redirect URI in Google Cloud Console exactly matches: `http://localhost:3000/api/auth/callback/google`
- [ ] JavaScript origins includes: `http://localhost:3000`
- [ ] OAuth consent screen is configured
- [ ] If app is in testing mode, you're added as a test user
- [ ] Dev server has been restarted after env changes
- [ ] No trailing slashes in `NEXTAUTH_URL`

## Quick Test Command

Run this to verify your environment variables are loaded:

```bash
node -e "console.log({
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET (' + process.env.NEXTAUTH_SECRET.length + ' chars)' : 'NOT SET'
})"
```

## Need Help?

If you're still having issues:

1. Check the browser console for errors (F12 → Console tab)
2. Check the terminal where `npm run dev` is running for server errors
3. Verify the exact error message you're getting
4. Make sure cookies are enabled in your browser
5. Try in an incognito window to rule out browser cache issues

## Resources

- NextAuth.js Docs: https://next-auth.js.org/providers/google
- Google OAuth Setup: https://support.google.com/cloud/answer/6158849
- NextAuth Configuration: https://next-auth.js.org/configuration/options
