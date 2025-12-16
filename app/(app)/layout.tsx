import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCurrentClinicId } from '@/lib/clinic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { data: clinic } = await supabase.from('clinics').select('name').eq('id', clinicId).maybeSingle();
  const { data: membership } = await supabase.from('clinic_members').select('role').eq('clinic_id', clinicId).eq('user_id', user.id).maybeSingle();
  const isOwner = membership?.role === 'owner';
  const roleLabel = isOwner ? '원장' : '직원';

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="shell">
      <aside className="sidebar">
        <div className="mb-4">
          <div className="text-lg font-semibold tracking-tight text-slate-900">재고관리</div>
          <div className="mt-1 text-xs font-medium text-slate-600">{clinic?.name || '내 병의원'}</div>
        </div>

        <nav className="nav" aria-label="메인 메뉴">
          <Link href="/dashboard">대시보드</Link>
          <Link href="/items">품목</Link>
          <Link href="/transactions">입출고</Link>
          <Link href="/categories">카테고리</Link>
          {isOwner ? <Link href="/members">멤버</Link> : null}
        </nav>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">로그인</div>
          <div className="mt-1 break-all">{user.email}</div>
          <div className="mt-2 inline-flex rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{roleLabel}</div>
        </div>
      </aside>

      <main>
        <div className="topbar">
          <div className="text-sm font-medium text-slate-600">쉽고 빠르게 재고를 관리하세요.</div>
          <a className="btn" href="/logout">
            로그아웃
          </a>
        </div>
        <div className="container">{children}</div>
      </main>
      </div>
    </div>
  );
}
