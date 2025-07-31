import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error_param = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  const origin = requestUrl.origin
  const redirectTo = requestUrl.searchParams.get('redirectTo') ?? '/dashboard'

  console.log('🔄 OAuth callback received:', { 
    code: code ? `${code.substring(0, 10)}...` : 'missing',
    error_param,
    error_description,
    redirectTo 
  })

  // Check for OAuth errors from the provider
  if (error_param) {
    console.error('❌ OAuth provider error:', error_param, error_description)
    return NextResponse.redirect(`${origin}/auth/error?error=${error_param}&message=${encodeURIComponent(error_description || 'OAuth provider error')}`)
  }

  if (code) {
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
              try {
                cookieStore.set({ name, value, ...options })
              } catch (error) {
                // The `set` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set({ name, value: '', ...options })
              } catch (error) {
                // The `delete` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
              }
            },
          },
        }
      )

      console.log('🔄 Attempting to exchange code for session...')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('❌ Supabase auth error:', {
          message: error.message,
          status: error.status,
          details: error
        })
        return NextResponse.redirect(`${origin}/auth/error?error=server_error&message=${encodeURIComponent(`Authentication failed: ${error.message}`)}`)
      }

      if (data?.session) {
        console.log('✅ OAuth callback successful - user:', data.user?.email)
        
        // 🔍 CRITICAL DEBUGGING: Check session creation details
        console.log('🔍 CALLBACK - Session creation details:', {
          hasSession: !!data.session,
          hasUser: !!data.user,
          hasAccessToken: !!data.session?.access_token,
          hasRefreshToken: !!data.session?.refresh_token,
          sessionExpiresAt: data.session?.expires_at,
          userEmail: data.user?.email,
          sessionTokenType: data.session?.token_type
        })
        
        // 🔍 STEP 1: Immediately verify session was persisted
        console.log('🔍 CALLBACK - Verifying session persistence...')
        try {
          const { data: verifyData, error: verifyError } = await supabase.auth.getSession()
          
          console.log('🔍 CALLBACK - Session verification result:', {
            hasVerifiedSession: !!verifyData.session,
            hasVerifiedUser: !!verifyData.session?.user,
            verifyError: verifyError?.message || 'none',
            userEmailMatch: verifyData.session?.user?.email === data.user?.email,
            accessTokenMatch: verifyData.session?.access_token === data.session?.access_token
          })
          
          if (!verifyData.session) {
            console.error('❌ CRITICAL: Session was NOT persisted after creation!')
            console.log('🔍 CALLBACK - Attempting to set session manually...')
            
            // Try to manually set the session
            const { data: setData, error: setError } = await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token
            })
            
            console.log('🔍 CALLBACK - Manual session set result:', {
              hasSetSession: !!setData.session,
              setError: setError?.message || 'none'
            })
            
            if (setError || !setData.session) {
              return NextResponse.redirect(`${origin}/auth/error?error=session_persistence_failed&message=${encodeURIComponent('Session could not be persisted')}`)
            }
          }
          
        } catch (verifyErr: any) {
          console.error('❌ Session verification failed:', verifyErr.message)
          return NextResponse.redirect(`${origin}/auth/error?error=session_verification_failed&message=${encodeURIComponent('Session verification failed')}`)
        }
        
        // 🔍 CRITICAL: Check HOW session is being stored
        console.log('🔍 CALLBACK - Checking session storage mechanism...')
        
        // Check cookies
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        const supabaseCookies = allCookies.filter(cookie => 
          cookie.name.includes('supabase') || cookie.name.includes('sb-')
        )
        
        console.log('🔍 CALLBACK - Cookie storage analysis:', {
          totalCookies: allCookies.length,
          supabaseCookies: supabaseCookies.length,
          supabaseCookieNames: supabaseCookies.map(c => c.name),
          accessTokenInCookies: supabaseCookies.some(c => c.value.includes('access_token')),
          refreshTokenInCookies: supabaseCookies.some(c => c.value.includes('refresh_token'))
        })
        
        // 🔍 CRITICAL: Force client-side session persistence
        console.log('🔍 CALLBACK - Attempting to bridge session to client...')
        
        const response = NextResponse.redirect(`${origin}${redirectTo}`)
        
        // Set explicit session bridge cookies for client-side access
        response.cookies.set('sb-session-bridge', JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user: data.user,
          expires_at: data.session.expires_at,
          timestamp: Date.now()
        }), {
          httpOnly: false, // Allow client-side access
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60, // 1 hour
          path: '/'
        })
        
        // Also set a simple flag cookie
        response.cookies.set('sb-auth-success', 'true', {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production', 
          sameSite: 'lax',
          maxAge: 60,
          path: '/'
        })
        
        console.log('✅ Session bridge cookies set - redirecting to:', redirectTo)
        return response
      } else {
        console.error('❌ No session returned from Supabase')
        return NextResponse.redirect(`${origin}/auth/error?error=server_error&message=${encodeURIComponent('No session created')}`)
      }
    } catch (error: any) {
      console.error('❌ Unexpected error in OAuth callback:', error)
      return NextResponse.redirect(`${origin}/auth/error?error=server_error&message=${encodeURIComponent(`Unexpected error: ${error.message}`)}`)
    }
  }

  // No code parameter
  console.error('❌ OAuth callback missing authorization code')
  return NextResponse.redirect(`${origin}/auth/error?error=invalid_request&message=${encodeURIComponent('Missing authorization code')}`)
}