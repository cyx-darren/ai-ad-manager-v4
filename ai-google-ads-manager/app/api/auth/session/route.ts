import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Server component, ignore set operations
          },
          remove(name: string, options: any) {
            // Server component, ignore remove operations
          },
        },
      }
    )

    console.log('🔍 API: Checking server-side session...')
    
    // Get the user session from server-side
    const { data: { user }, error } = await supabase.auth.getUser()
    
    console.log('🔍 API: Server session check result:', {
      hasUser: !!user,
      userEmail: user?.email,
      error: error?.message || 'none'
    })

    if (error) {
      console.error('❌ API: Server session error:', error)
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (!user) {
      console.log('ℹ️ API: No user found in server session')
      return NextResponse.json({ user: null, session: null }, { status: 200 })
    }

    // Try to get the full session data
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    console.log('🔍 API: Server session data:', {
      hasSession: !!session,
      sessionUser: !!session?.user,
      sessionError: sessionError?.message || 'none'
    })

    // Return user data (and session if available)
    const responseData = {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
        aud: user.aud,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
        email_confirmed_at: user.email_confirmed_at,
        phone_confirmed_at: user.phone_confirmed_at,
        confirmed_at: user.confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        recovery_sent_at: user.recovery_sent_at,
        invited_at: user.invited_at,
        action_link: user.action_link,
        email_change_sent_at: user.email_change_sent_at,
        new_email: user.new_email,
        phone: user.phone,
        phone_change_sent_at: user.phone_change_sent_at,
        new_phone: user.new_phone,
        identities: user.identities
      },
      session: session || null
    }

    console.log('✅ API: Returning user data:', {
      userEmail: responseData.user.email,
      hasSession: !!responseData.session
    })

    return NextResponse.json(responseData)

  } catch (error: any) {
    console.error('❌ API: Server session fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}