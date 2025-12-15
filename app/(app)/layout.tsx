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

  return (
    <div className="shell">
      <aside className="sidebar">
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>재고관리</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {clinic?.name || '내 병의원'}
          </div>
        </div>
        <nav className="nav" aria-label="메인 메뉴">
          <Link href="/dashboard">대시보드</Link>
          <Link href="/items">품목</Link>
          <Link href="/transactions">입출고</Link>
          <Link href="/categories">카테고리</Link>
        </nav>
        <div className="muted" style={{ fontSize: 13, marginTop: 14 }}>
          {user.email}
        </div>
      </aside>

      <main>
        <div className="topbar">
          <div className="muted">쉽고 빠르게 재고를 관리하세요.</div>
          <a className="btn" href="/logout">
            로그아웃
          </a>
        </div>
        <div className="container">{children}</div>
      </main>
    </div>
  );
}

