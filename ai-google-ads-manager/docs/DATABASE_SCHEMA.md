# AI Ad Manager v4 - Database Schema Documentation

## Overview

This document describes the complete database schema for the AI Ad Manager v4 application, built on Supabase PostgreSQL with Row Level Security (RLS) for multi-tenant data isolation.

## Database Architecture

### Core Principles
- **Multi-tenant Security**: All data is isolated by user using RLS policies
- **Google Analytics Integration**: Schema optimized for GA4 data storage and analysis  
- **Real-time Updates**: Key tables enabled for Supabase Realtime
- **Type Safety**: Full TypeScript type definitions provided
- **Performance**: Strategic indexes on frequently queried columns

### Technology Stack
- **Database**: PostgreSQL 17.4 (Supabase Cloud)
- **Authentication**: Supabase Auth with Google OAuth
- **Security**: Row Level Security (RLS) policies
- **Real-time**: Supabase Realtime for live updates
- **Project ID**: `fjfwnjrmafoieiciuomm`
- **Region**: `ap-southeast-1`

## Table Structure

### 1. Users Table (`public.users`)

Extends Supabase's built-in `auth.users` table with application-specific fields.

```sql
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'manager')),
    google_refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

**Purpose**: Store user profiles and Google OAuth refresh tokens for API access.

**Key Features**:
- Links to Supabase auth system
- Stores Google Analytics API refresh tokens
- Role-based access control
- Automatic timestamps

**RLS Policies**:
- Users can only view/update their own profile
- No public access

### 2. Accounts Table (`public.accounts`)

Stores Google Analytics properties linked to users.

```sql
CREATE TABLE public.accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    ga_property_id VARCHAR(255) NOT NULL,
    property_name VARCHAR(255) NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC',
    currency_code VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, ga_property_id)
);
```

**Purpose**: Link users to their Google Analytics properties for data access.

**Key Features**:
- One-to-many relationship with users
- Unique constraint on user+property combination
- Timezone and currency support
- Indexes on user_id and ga_property_id

**RLS Policies**:
- Users can only access their own accounts
- Full CRUD permissions for account owners

### 3. GA Data Sources Table (`public.ga_data_sources`)

Tracks data synchronization status for each account.

```sql
CREATE TABLE public.ga_data_sources (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    sync_status VARCHAR(50) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'failed')),
    last_sync_date TIMESTAMP WITH TIME ZONE,
    next_sync_date TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(account_id, source_name)
);
```

**Purpose**: Monitor and manage data sync operations from various sources.

**Key Features**:
- Tracks sync status for GA4, Google Ads, etc.
- Error logging for failed syncs
- Scheduling for next sync operations
- **Realtime Enabled**: Live sync status updates

**RLS Policies**:
- Account-based access control
- Users see only their account data sources

### 4. Performance Metrics Table (`public.performance_metrics`)

Stores Google Analytics 4 data for analysis and reporting.

```sql
CREATE TABLE public.performance_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    sessions INTEGER DEFAULT 0,
    users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5,4) DEFAULT 0,
    engagement_rate DECIMAL(5,4) DEFAULT 0,
    avg_session_duration DECIMAL(10,2) DEFAULT 0,
    source VARCHAR(255),
    medium VARCHAR(255),
    campaign VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

**Purpose**: Store daily GA4 metrics broken down by traffic source/medium/campaign.

**Key Features**:
- Daily granularity with source attribution
- Optimized for time-series analysis
- **Realtime Enabled**: Live metric updates
- Indexes on account_id, date, and source columns

**RLS Policies**:
- Account-based data isolation
- Users access only their metrics data

### 5. Page Performance Table (`public.page_performance`)

Page-level analytics data for detailed website analysis.

```sql
CREATE TABLE public.page_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    page_path VARCHAR(2048) NOT NULL,
    date DATE NOT NULL,
    pageviews INTEGER DEFAULT 0,
    unique_pageviews INTEGER DEFAULT 0,
    avg_time_on_page DECIMAL(10,2) DEFAULT 0,
    bounce_rate DECIMAL(5,4) DEFAULT 0,
    entrances INTEGER DEFAULT 0,
    exits INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(account_id, page_path, date)
);
```

**Purpose**: Detailed page-level performance tracking for optimization insights.

**Key Features**:
- Daily page-level metrics
- Unique constraint prevents duplicates
- Long page path support (2048 chars)
- Performance-focused metrics

**RLS Policies**:
- Account-based access control
- Page data accessible only to account owners

### 6. Recommendations Table (`public.recommendations`)

AI-generated optimization suggestions for accounts.

```sql
CREATE TABLE public.recommendations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(100) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
    estimated_impact DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

**Purpose**: Store AI-generated optimization recommendations with tracking status.

**Key Features**:
- Categorized by type (campaign, keyword, landing_page, etc.)
- Priority and status tracking
- Impact estimation (percentage)
- **Realtime Enabled**: Live recommendation updates

**RLS Policies**:
- Account-scoped recommendations
- Users see only their account recommendations

### 7. Landing Page Analysis Table (`public.landing_page_analysis`)

Firecrawl-powered landing page analysis results.

```sql
CREATE TABLE public.landing_page_analysis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    page_url VARCHAR(2048) NOT NULL,
    analysis_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    content_data JSONB,
    seo_score INTEGER,
    performance_score INTEGER,
    recommendations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

**Purpose**: Store detailed landing page analysis with SEO and performance insights.

**Key Features**:
- JSONB for flexible content data storage
- Multiple analysis types (SEO, content, performance)
- Numeric scoring system
- **Realtime Enabled**: Live analysis updates

**RLS Policies**:
- Account-based analysis access
- Landing page data scoped to account owners

## Indexes and Performance

### Strategic Indexes Created

```sql
-- Performance optimization indexes
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_accounts_ga_property_id ON public.accounts(ga_property_id);
CREATE INDEX idx_performance_metrics_account_date ON public.performance_metrics(account_id, date);
CREATE INDEX idx_performance_metrics_source ON public.performance_metrics(source, medium, campaign);
CREATE INDEX idx_page_performance_account_date ON public.page_performance(account_id, date);
CREATE INDEX idx_recommendations_account_status ON public.recommendations(account_id, status);
CREATE INDEX idx_landing_analysis_account_type ON public.landing_page_analysis(account_id, analysis_type);
```

### Query Optimization
- Time-series queries optimized with date indexes
- Source attribution queries efficient with composite indexes
- Account-based filtering uses dedicated indexes
- JSONB columns use GIN indexes for full-text search

## Row Level Security (RLS)

### Security Model
All tables implement account-based or user-based RLS policies ensuring:

1. **Data Isolation**: Users can only access their own data
2. **Multi-tenancy**: Complete separation between user accounts
3. **API Security**: Automatic enforcement at database level
4. **Audit Trail**: All policies logged and trackable

### Policy Categories

**User-based Policies** (`users` table):
```sql
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);
```

**Account-based Policies** (all other tables):
```sql
CREATE POLICY "Users can view own account data" ON public.table_name
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.accounts 
            WHERE accounts.id = table_name.account_id 
            AND accounts.user_id = auth.uid()
        )
    );
```

## Realtime Configuration

### Enabled Tables
Supabase Realtime is configured for live updates on:
- `performance_metrics` - Live GA4 data updates
- `recommendations` - Real-time AI suggestions  
- `ga_data_sources` - Sync status monitoring
- `landing_page_analysis` - Live analysis results

### Usage Example
```typescript
// Subscribe to performance metrics updates
const subscription = supabase
  .channel('performance-updates')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'performance_metrics'
  }, (payload) => {
    console.log('New metrics data:', payload.new)
  })
  .subscribe()
```

## Data Types and Constraints

### Key Data Types
- **UUIDs**: All primary keys for scalability
- **JSONB**: Flexible structured data (content_data, recommendations)
- **DECIMAL**: Precise numeric values for rates and scores
- **TIMESTAMP WITH TIME ZONE**: Consistent timezone handling
- **TEXT**: Unlimited length for descriptions and content

### Validation Constraints
- **CHECK constraints**: Enum-like validation for status fields
- **UNIQUE constraints**: Prevent duplicate data combinations
- **FOREIGN KEY constraints**: Maintain referential integrity
- **NOT NULL constraints**: Ensure required fields

## Migration History

### Migration Files Applied
1. `create_core_schema` - Core tables and relationships
2. `create_additional_tables` - Remaining application tables  
3. `setup_rls_policies` - Basic RLS implementation
4. `complete_rls_and_triggers` - Advanced policies and automation

### Automatic Features
- **Timestamp Triggers**: Auto-update `updated_at` columns
- **UUID Generation**: Automatic primary key generation
- **RLS Enforcement**: Automatic policy application
- **Constraint Validation**: Real-time data validation

## TypeScript Integration

### Generated Types
```typescript
export interface User {
  id: string
  email: string
  role: 'user' | 'admin' | 'manager'
  google_refresh_token?: string
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  ga_property_id: string
  property_name: string
  timezone?: string
  currency_code?: string
  created_at: string
  updated_at: string
}
// ... additional interfaces
```

### Database Helpers
Full type-safe database operations provided via `lib/supabase.ts` with:
- CRUD operations for all tables
- Type-safe query builders
- Error handling
- Relationship helpers

## Backup and Maintenance

### Automated Backups
- **Daily backups**: Automatic Supabase Cloud backups
- **Point-in-time recovery**: 7-day recovery window
- **Cross-region replication**: Built into Supabase infrastructure

### Maintenance Tasks
- **Vacuum operations**: Automatic PostgreSQL maintenance
- **Index optimization**: Monitored and auto-maintained
- **Query performance**: Built-in Supabase monitoring
- **Security updates**: Automatic Supabase patches

## Connection Information

### Environment Variables Required
```bash
NEXT_PUBLIC_SUPABASE_URL=https://fjfwnjrmafoieiciuomm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Database Access
- **Host**: `db.fjfwnjrmafoieiciuomm.supabase.co`
- **Port**: `5432`
- **Database**: `postgres`
- **SSL**: Required (verify-ca)

## Development Workflow

1. **Schema Changes**: Apply via Supabase migrations
2. **Seed Data**: Use `scripts/seed-data.sql` after authentication
3. **Testing**: Comprehensive RLS policy testing
4. **Type Updates**: Regenerate types after schema changes
5. **Performance**: Monitor query performance via Supabase dashboard

## Next Steps

- Set up Google OAuth in Supabase Auth
- Implement Google Analytics API integration
- Add data sync schedulers
- Configure monitoring and alerting
- Set up automated testing for RLS policies 