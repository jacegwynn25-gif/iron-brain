# Vercel Production OAuth Setup

## Quick Setup for https://iron-brain.vercel.app

### Step 1: Google Cloud Console

Go to: https://console.cloud.google.com/apis/credentials

Click on your OAuth 2.0 Client: `60646251152-pfh73apf7mqkmcm5r51kd1vt50kjc4gf`

**Add Authorized JavaScript Origins:**
```
https://iron-brain.vercel.app
http://localhost:3000
```

**Add Authorized Redirect URIs:**
```
https://iron-brain.vercel.app/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

Click **Save**.

### Step 2: Vercel Environment Variables

Go to: https://vercel.com → Your Project → Settings → Environment Variables

Add these 4 variables for **Production**:

| Name | Value |
|------|-------|
| `GOOGLE_CLIENT_ID` | `60646251152-pfh73apf7mqkmcm5r51kd1vt50kjc4gf.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `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` |
| `NEXTAUTH_URL` | `https://iron-brain.vercel.app` |
| `NEXTAUTH_SECRET` | `c3tOtZnmOhLqb9ukATkcyStvwVT4ZCdXifnt8gw1z5M=` |

### Step 3: Redeploy

After adding environment variables, you MUST redeploy:

**Method 1 - Push to Git:**
```bash
git push origin main
```

**Method 2 - Vercel Dashboard:**
- Go to Deployments tab
- Click "Redeploy" on latest deployment

### Step 4: Test

1. Visit: https://iron-brain.vercel.app
2. Click "Sign in with Google"
3. Complete OAuth flow
4. You should be signed in!

## Troubleshooting

**"redirect_uri_mismatch"**
- Verify redirect URI in Google Console is: `https://iron-brain.vercel.app/api/auth/callback/google`
- Make sure there's no trailing slash
- Check NEXTAUTH_URL in Vercel is: `https://iron-brain.vercel.app`

**Environment variables not working**
- Make sure you selected "Production" environment when adding variables
- Redeploy after adding variables (changes don't apply to existing deployments)

**Still not working?**
- Check Vercel Function Logs: https://vercel.com/your-project/logs
- Look for errors in the `/api/auth/[...nextauth]` function

## OAuth Consent Screen

If you haven't configured the OAuth consent screen:

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Configure:
   - App name: "Iron Brain"
   - User support email: Your email
   - Developer contact: Your email
3. If in testing mode, add yourself as a test user
4. For public use, publish the app

## Summary

✅ Google Cloud Console: Add `https://iron-brain.vercel.app` origins and redirect URIs
✅ Vercel: Add all 4 environment variables for Production
✅ Redeploy on Vercel
✅ Test at https://iron-brain.vercel.app
