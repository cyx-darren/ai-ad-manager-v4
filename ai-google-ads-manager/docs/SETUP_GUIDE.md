# AI Ad Manager v4 - Development Setup Guide

## Quick Start

This guide will get you up and running with the AI Ad Manager v4 development environment in under 15 minutes.

## Prerequisites

Before starting, ensure you have:

- **Node.js 22.17.0+** (check with `node --version`)
- **npm 10.9.2+** (check with `npm --version`)
- **Git** for version control
- **Supabase account** (free tier available)
- **Google Cloud Console access** (for OAuth setup)

## Project Overview

**AI Ad Manager v4** is a Next.js application that:
- Analyzes Google Analytics data using AI
- Provides optimization recommendations 
- Tracks performance metrics in real-time
- Uses Supabase for backend infrastructure

**Technology Stack:**
- **Frontend**: Next.js 15.4.4, React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Database**: PostgreSQL 17.4 with Row Level Security
- **Authentication**: Google OAuth via Supabase Auth

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd ai-ad-manager-v4

# Navigate to the Next.js app
cd ai-google-ads-manager

# Install dependencies
npm install

# Install Supabase client libraries
npm install @supabase/supabase-js @supabase/ssr
```

## Step 2: Environment Configuration

### Create Environment File

Create `.env.local` in the `ai-google-ads-manager/` directory:

```bash
# Supabase Configuration (ai-ad-manager-v2 project)
NEXT_PUBLIC_SUPABASE_URL=https://fjfwnjrmafoieiciuomm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZnduanJtYWZvaWVpY2l1b21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1Nzk2MTIsImV4cCI6MjA2OTE1NTYxMn0.J7DAGU0LV2m_RvG07td6fnSxT_-Xn3Lsoslqp9EmIA8

# Google Analytics API (optional for development)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Note**: The current Supabase credentials are for the development project. In production, use your own Supabase project.

## Step 3: Database Setup (Already Complete)

The database schema is **already configured** in the `ai-ad-manager-v2` Supabase project:

### ✅ **What's Already Set Up:**
- 7 database tables with relationships
- Row Level Security (RLS) policies
- Realtime subscriptions for live updates
- Proper indexes for performance
- TypeScript types and database helpers

### **Database Structure:**
```
users → accounts → performance_metrics
               ├── page_performance  
               ├── recommendations
               ├── ga_data_sources
               └── landing_page_analysis
```

### **View Database:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Open project: `ai-ad-manager-v2` (`fjfwnjrmafoieiciuomm`)
3. Navigate to **Table Editor** to see all tables

## Step 4: Authentication Setup

### Google OAuth Configuration

**In Google Cloud Console:**

1. **Create OAuth 2.0 Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing
   - Enable Google Analytics API
   - Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: 
     ```
     https://fjfwnjrmafoieiciuomm.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```

2. **Configure Scopes:**
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

**In Supabase Dashboard:**

1. **Enable Google Provider:**
   - Go to **Authentication** → **Providers**
   - Enable **Google** provider
   - Add your Google Client ID and Secret
   - Set **Redirect URL**: `https://fjfwnjrmafoieiciuomm.supabase.co/auth/v1/callback`

2. **Configure Site URL:**
   - Go to **Authentication** → **Settings**
   - Set **Site URL**: `http://localhost:3000` (development)
   - Add **Additional Redirect URLs**: `http://localhost:3000/auth/callback`

## Step 5: Test the Application

### Start Development Server

```bash
# From ai-google-ads-manager/ directory
npm run dev
```

The application will be available at `http://localhost:3000`

### Test Build

```bash
# Verify everything compiles correctly
npm run build

# Expected output: ✓ Compiled successfully
```

### Test Database Connection

The app automatically connects to Supabase on startup. Check the browser console for any connection errors.

## Step 6: Add Seed Data (Optional)

### After First Login

1. **Authenticate via Google OAuth** in your app
2. **Get your user ID** from Supabase:
   ```sql
   -- In Supabase SQL Editor
   SELECT id, email FROM auth.users;
   ```

3. **Run seed script**:
   - Open `scripts/seed-data.sql`
   - Replace `USER_ID_HERE` with your actual user ID
   - Uncomment the sections you want to populate
   - Run in Supabase SQL Editor

### Sample Data Includes:
- 2 demo accounts (e-commerce store & blog)
- 7 days of performance metrics
- AI-generated recommendations
- Page performance data
- Landing page analysis results

## Step 7: Development Workflow

### File Structure

```
ai-google-ads-manager/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   └── page.tsx           # Home page
├── components/            # React components
│   └── auth/             # Auth-specific components
├── lib/                  # Utility libraries
│   ├── supabase.ts      # Database client & helpers
│   └── auth.ts          # Authentication utilities
├── contexts/             # React contexts
├── middleware.ts         # Route protection
├── docs/                # Documentation
└── scripts/             # Database scripts
```

### Key Files

- **`lib/supabase.ts`**: Database client and type-safe helpers
- **`lib/auth.ts`**: Authentication utilities
- **`middleware.ts`**: Route protection for authenticated pages
- **`components/auth/LoginButton.tsx`**: Google OAuth login component
- **`contexts/AuthContext.tsx`**: React authentication state

### Database Operations

```typescript
import { db } from '@/lib/supabase'

// Get user accounts
const { data: accounts } = await db.accounts.getByUserId(userId)

// Get performance metrics
const { data: metrics } = await db.metrics.getByAccountId(accountId)

// Get recommendations
const { data: recs } = await db.recommendations.getByAccountId(accountId)
```

### Realtime Subscriptions

```typescript
import { supabase } from '@/lib/supabase'

// Subscribe to real-time updates
const subscription = supabase
  .channel('metrics-updates')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'performance_metrics'
  }, (payload) => {
    console.log('New metrics:', payload.new)
  })
  .subscribe()
```

## Step 8: Testing Authentication

### Test Login Flow

1. **Visit**: `http://localhost:3000`
2. **Click**: "Sign in with Google" button
3. **Authenticate**: Via Google OAuth
4. **Verify**: Redirect to app with user session
5. **Check**: User profile created in `public.users` table

### Test Protected Routes

```typescript
// Add to middleware.ts for testing
const protectedRoutes = ['/dashboard', '/analytics']

// These routes require authentication
// Unauthenticated users are redirected to login
```

## Common Issues & Solutions

### Build Errors

**Issue**: TypeScript errors about missing types
```bash
# Solution: Install missing types
npm install @types/node @types/react @types/react-dom
```

**Issue**: Supabase connection errors
```bash
# Solution: Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Authentication Issues

**Issue**: Google OAuth redirect errors
- **Check**: Redirect URLs in Google Cloud Console
- **Verify**: Supabase Auth provider configuration
- **Ensure**: Site URL is correct in Supabase settings

**Issue**: User profile not created
- **Check**: RLS policies allow user creation
- **Verify**: User ID from auth.users exists
- **Debug**: Browser console for errors

### Database Issues

**Issue**: RLS policy blocks data access
```sql
-- Check if user is authenticated
SELECT auth.uid();

-- Verify user has accounts
SELECT * FROM public.accounts WHERE user_id = auth.uid();
```

**Issue**: Realtime not working
- **Check**: Tables are added to `supabase_realtime` publication
- **Verify**: Subscription code is correct
- **Test**: Manual data insertion triggers events

## Next Steps

### Development Tasks

1. **Implement GA4 Integration**:
   - Set up Google Analytics API client
   - Create data sync jobs
   - Handle OAuth refresh tokens

2. **Add AI Recommendations**:
   - Integrate with OpenAI or Anthropic APIs
   - Implement recommendation algorithms
   - Create recommendation UI components

3. **Build Analytics Dashboard**:
   - Create data visualization components
   - Implement filtering and date ranges
   - Add export functionality

4. **Landing Page Analysis**:
   - Integrate Firecrawl API
   - Implement SEO scoring algorithms
   - Create analysis result displays

### Production Deployment

1. **Create Production Supabase Project**
2. **Set up Custom Domain and SSL**
3. **Configure Production OAuth Credentials**
4. **Set up Monitoring and Logging**
5. **Implement Error Tracking**

## Support Resources

### Documentation
- **Database Schema**: `docs/DATABASE_SCHEMA.md`
- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **Next.js Docs**: [https://nextjs.org/docs](https://nextjs.org/docs)

### Development Tools
- **Supabase Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
- **Project URL**: `https://fjfwnjrmafoieiciuomm.supabase.co`
- **Database URL**: `https://supabase.com/dashboard/project/fjfwnjrmafoieiciuomm`

### Support
- **Database Issues**: Check Supabase Dashboard logs
- **Auth Issues**: Check Google Cloud Console and Supabase Auth logs
- **Build Issues**: Check Next.js build output and browser console

---

**You're ready to develop!** 🚀

The foundation is solid with:
- ✅ Database schema configured
- ✅ Authentication system ready
- ✅ TypeScript types available
- ✅ Realtime features enabled
- ✅ Development environment setup

Start building your Google Analytics integration and AI recommendation features! 