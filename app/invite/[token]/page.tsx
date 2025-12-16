import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function getString(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] ?? '' : value;
}

async function acceptInviteAction(formData: FormData) {
  'use server';
  const token = String(formData.get('token') || '');
  if (!token) redirect('/dashboard');

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const { data, error } = await supabase.rpc('accept_clinic_invite', { invite_token: token });
  if (error || !data) {
    console.error('accept invite failed', error);
    redirect(`/invite/${token}?error=${encodeURIComponent('초대 링크가 유효하지 않거나 만료되었어요.')}`);
  }

  redirect('/dashboard');
}

export default async function InviteAcceptPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { error?: string };
}) {
  const token = getString(params.token);
  const error = getString(searchParams.error);

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">병의원 초대</h1>
        <p className="mt-2 text-sm text-slate-600">초대를 수락하면 병의원 재고관리로 이동합니다.</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="status">
          {error}
        </div>
      ) : null}

      <form action={acceptInviteAction}>
        <input type="hidden" name="token" value={token} />
        <button
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
          type="submit"
        >
          초대 수락하기
        </button>
      </form>
    </div>
  );
}

