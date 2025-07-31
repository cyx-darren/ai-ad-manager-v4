import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Type definitions for database tables
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

export interface UpdateUserData {
  email?: string
  role?: 'user' | 'admin' | 'manager'
  google_refresh_token?: string
}

export interface CreateAccountData {
  user_id: string
  ga_property_id: string
  property_name: string
  timezone?: string
  currency_code?: string
}

export interface UpdateAccountData {
  ga_property_id?: string
  property_name?: string
  timezone?: string
  currency_code?: string
}

// Database helper utilities
export const db = {
  // User operations
  users: {
    getById: (id: string) => supabase.from('users').select('*').eq('id', id).single(),
    create: (user: Omit<User, 'id' | 'created_at' | 'updated_at'>) => supabase.from('users').insert(user).select().single(),
    update: (id: string, updates: UpdateUserData) => supabase.from('users').update(updates).eq('id', id).select().single(),
  },
  
  // Account operations  
  accounts: {
    getByUserId: (userId: string) => supabase.from('accounts').select('*').eq('user_id', userId),
    getById: (id: string) => supabase.from('accounts').select('*').eq('id', id).single(),
    create: (account: CreateAccountData) => supabase.from('accounts').insert(account).select().single(),
    update: (id: string, updates: UpdateAccountData) => supabase.from('accounts').update(updates).eq('id', id).select().single(),
    delete: (id: string) => supabase.from('accounts').delete().eq('id', id),
  },
  
  // Performance metrics operations
  metrics: {
    getByAccountId: (accountId: string, startDate?: string, endDate?: string) => {
      let query = supabase.from('performance_metrics').select('*').eq('account_id', accountId)
      if (startDate) query = query.gte('date', startDate)
      if (endDate) query = query.lte('date', endDate)
      return query.order('date', { ascending: false })
    },
  },
  
  // Recommendations operations
  recommendations: {
    getByAccountId: (accountId: string, status?: string) => {
      let query = supabase.from('recommendations').select('*').eq('account_id', accountId)
      if (status) query = query.eq('status', status)
      return query.order('created_at', { ascending: false })
    },
  },
} 