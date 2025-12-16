import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

const PROTECTED_PREFIXES = ['/dashboard', '/categories', '/items', '/transactions', '/setup', '/export', '/members', '/invite'];

export async function middleware(request: NextRequest) {
  const { supabase, response } = await updateSupabaseSession(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/login')) return response;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
