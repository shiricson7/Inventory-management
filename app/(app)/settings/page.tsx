import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ensureCurrentClinicId } from '@/lib/clinic';
import { redirect } from 'next/navigation';

function getString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function deleteClinicAction(formData: FormData) {
  'use server';
  const confirm = getString(formData.get('confirm'));

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { data: me } = await supabase.from('clinic_members').select('role').eq('clinic_id', clinicId).eq('user_id', user.id).maybeSingle();
  if (me?.role !== 'owner') redirect('/dashboard');

  if (confirm !== '삭제') redirect('/settings?error=' + encodeURIComponent('확인 문구(삭제)가 일치하지 않아요.'));

  const { error } = await supabase.from('clinics').delete().eq('id', clinicId);
  if (error) {
    console.error('delete clinic failed', error);
    redirect('/settings?error=' + encodeURIComponent('병원 삭제에 실패했어요.'));
  }

  await supabase.from('profiles').update({ current_clinic_id: null }).eq('user_id', user.id);
  redirect('/setup');
}

async function deleteAccountAction(formData: FormData) {
  'use server';
  const confirm = getString(formData.get('confirm'));

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (confirm !== '탈퇴') redirect('/settings?error=' + encodeURIComponent('확인 문구(탈퇴)가 일치하지 않아요.'));

  const { data: createdClinics } = await supabase.from('clinics').select('id').eq('created_by', user.id).limit(1);
  if (createdClinics?.length) redirect('/settings?error=' + encodeURIComponent('원장으로 생성한 병원이 있어요. 먼저 병원을 삭제해주세요.'));

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('delete account failed', error);
    redirect('/settings?error=' + encodeURIComponent('회원탈퇴에 실패했어요.'));
  }

  redirect('/login?message=' + encodeURIComponent('회원탈퇴가 완료됐어요.'));
}

export default async function SettingsPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { data: me } = await supabase.from('clinic_members').select('role').eq('clinic_id', clinicId).eq('user_id', user.id).maybeSingle();
  const isOwner = me?.role === 'owner';

  return (
    <div className="space-y-6">
      {searchParams.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="status">
          {searchParams.error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">설정</h1>
        <p className="mt-2 text-sm text-slate-600">계정 및 병원 관련 작업을 할 수 있어요.</p>
      </div>

      {isOwner ? (
        <div className="rounded-2xl border border-rose-200 bg-white/70 p-6 shadow-sm backdrop-blur">
          <h2 className="text-base font-semibold text-slate-900">병원 삭제</h2>
          <p className="mt-2 text-sm text-slate-600">
            병원 삭제 시 카테고리/품목/입출고/멤버/초대 링크가 함께 삭제됩니다. 계속하려면 아래에 <span className="font-semibold">삭제</span>
            를 입력하세요.
          </p>
          <form action={deleteClinicAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700" htmlFor="delete_clinic_confirm">
                확인 문구
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                id="delete_clinic_confirm"
                name="confirm"
                placeholder="삭제"
                required
              />
            </div>
            <button className="inline-flex justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-200">
              병원 삭제
            </button>
          </form>
        </div>
      ) : null}

      <div className="rounded-2xl border border-rose-200 bg-white/70 p-6 shadow-sm backdrop-blur">
        <h2 className="text-base font-semibold text-slate-900">회원탈퇴</h2>
        <p className="mt-2 text-sm text-slate-600">
          계정이 삭제됩니다. 계속하려면 아래에 <span className="font-semibold">탈퇴</span>를 입력하세요.
        </p>
        <form action={deleteAccountAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="delete_account_confirm">
              확인 문구
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              id="delete_account_confirm"
              name="confirm"
              placeholder="탈퇴"
              required
            />
          </div>
          <button className="inline-flex justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-200">
            회원탈퇴
          </button>
        </form>
      </div>
    </div>
  );
}

