import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get user session
  const { data: { user }, error } = await supabase.auth.getUser()

  // Get user role if authenticated
  let userRole: string | null = null
  if (user) {
    try {
      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (roleError) {
        console.warn('Failed to fetch user role from database (RLS issue), using default role:', roleError.message)
        userRole = 'user' // Default to 'user' role when RLS blocks access
      } else {
        userRole = userData?.role || 'user'
      }
    } catch (error) {
      console.warn('Failed to fetch user role (falling back to default):', error)
      userRole = 'user' // Fallback to basic user role
    }
  }

  // Define protected paths
  const protectedPaths = ['/dashboard']
  const authPaths = ['/auth/login', '/auth/signup', '/auth/forgot-password']
  
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))
  const isAuthPath = authPaths.some(path => request.nextUrl.pathname.startsWith(path))

  // Redirect logic
  if (isProtectedPath && !user) {
    // Redirect unauthenticated users to login
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (isAuthPath && user) {
    // Redirect authenticated users away from auth pages
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * - auth/callback (OAuth callback route)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)',
  ],
} 