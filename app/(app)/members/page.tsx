import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCurrentClinicId } from '@/lib/clinic';
import { redirect } from 'next/navigation';

function roleLabel(role: string | null | undefined) {
  if (role === 'owner') return '원장';
  return '직원';
}

function getOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  return env ? env.replace(/\/+$/, '') : '';
}

async function createInviteAction() {
  'use server';
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { data: me } = await supabase.from('clinic_members').select('role').eq('clinic_id', clinicId).eq('user_id', user.id).maybeSingle();
  if (me?.role !== 'owner') redirect('/dashboard');

  const token = crypto.randomUUID();
  const { error } = await supabase.from('clinic_invitations').insert({ clinic_id: clinicId, token, role: 'staff', created_by: user.id });
  if (error) {
    console.error('create invite failed', error);
    redirect('/members?error=' + encodeURIComponent('초대 링크 생성에 실패했어요.'));
  }

  redirect('/members?created=' + encodeURIComponent(token));
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: { error?: string; created?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);

  const { data: me } = await supabase.from('clinic_members').select('role').eq('clinic_id', clinicId).eq('user_id', user.id).maybeSingle();
  if (me?.role !== 'owner') redirect('/dashboard');

  const { data: members } = await supabase
    .from('clinic_members')
    .select('user_id, role, created_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: true });

  const { data: invites } = await supabase
    .from('clinic_invitations')
    .select('token, created_at, expires_at, used_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(20);

  const origin = getOrigin();
  const createdToken = typeof searchParams.created === 'string' ? searchParams.created : '';
  const createdUrl = createdToken && origin ? `${origin}/invite/${createdToken}` : '';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">멤버</h1>
          <p className="mt-2 text-sm text-slate-600">원장 계정만 멤버를 초대할 수 있습니다.</p>
        </div>

        {searchParams.error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="status">
            {searchParams.error}
          </div>
        ) : null}

        {createdToken ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
            초대 링크가 생성됐어요: <span className="break-all font-mono">{createdUrl || `/invite/${createdToken}`}</span>
          </div>
        ) : null}

        <form action={createInviteAction}>
          <button
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
            type="submit"
          >
            초대 링크 생성
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
        <h2 className="text-base font-semibold text-slate-900">현재 멤버</h2>
        <div className="mt-4 divide-y divide-slate-200">
          {(members || []).map((m) => (
            <div key={m.user_id} className="flex items-center justify-between py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-mono text-slate-900">{m.user_id}</div>
                <div className="mt-1 text-xs text-slate-500">{new Date(m.created_at as string).toLocaleString()}</div>
              </div>
              <div className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{roleLabel(m.role)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
        <h2 className="text-base font-semibold text-slate-900">최근 초대 링크</h2>
        <p className="mt-2 text-xs text-slate-600">링크는 7일 후 만료되고, 1회 사용 시 자동으로 비활성화됩니다.</p>
        <div className="mt-4 divide-y divide-slate-200">
          {(invites || []).map((inv) => {
            const url = origin ? `${origin}/invite/${inv.token}` : `/invite/${inv.token}`;
            const status = inv.used_at ? '사용됨' : '미사용';
            return (
              <div key={inv.token} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="break-all font-mono text-slate-900">{url}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      생성: {new Date(inv.created_at as string).toLocaleString()} · 만료: {new Date(inv.expires_at as string).toLocaleString()}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{status}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
