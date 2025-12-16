import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCurrentClinicId } from '@/lib/clinic';
import { redirect } from 'next/navigation';

function getString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function createClinicAction(formData: FormData) {
  'use server';
  const name = getString(formData.get('name'));
  if (!name) redirect('/setup?error=' + encodeURIComponent('병의원 이름을 입력해주세요.'));

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: existingMemberships } = await supabase.from('clinic_members').select('clinic_id').eq('user_id', user.id).limit(1);
  if (existingMemberships?.length) redirect('/dashboard');

  const clinicId = crypto.randomUUID();
  const { error: clinicError } = await supabase.from('clinics').insert({ id: clinicId, name, created_by: user.id });
  if (clinicError) {
    console.error('create clinic failed', clinicError);
    redirect('/setup?error=' + encodeURIComponent('병의원 생성에 실패했어요.'));
  }

  const { error: memberError } = await supabase.from('clinic_members').insert({ clinic_id: clinicId, user_id: user.id, role: 'owner' });
  if (memberError) {
    console.error('create clinic member failed', memberError);
    redirect('/setup?error=' + encodeURIComponent('멤버 생성에 실패했어요.'));
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, current_clinic_id: clinicId }, { onConflict: 'user_id' });
  if (profileError) {
    console.error('upsert profile failed', profileError);
    redirect('/setup?error=' + encodeURIComponent('프로필 저장에 실패했어요.'));
  }

  const defaultCategories = ['백신', '외용제', '성장클리닉 주사약'].map((categoryName, index) => ({
    clinic_id: clinicId,
    name: categoryName,
    sort_order: index,
  }));
  await supabase.from('categories').insert(defaultCategories);

  await ensureCurrentClinicId(supabase, user.id);
  redirect('/dashboard');
}

export default async function SetupPage({ searchParams }: { searchParams: { error?: string } }) {
  const { error } = searchParams;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: existingMemberships } = await supabase.from('clinic_members').select('clinic_id').eq('user_id', user.id).limit(1);
  if (existingMemberships?.length) redirect('/dashboard');

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">처음 설정</h1>
        <p className="mt-2 text-sm text-slate-600">
          병의원 이름을 입력하면 기본 카테고리(백신/외용제/성장클리닉 주사약)가 자동으로 만들어집니다.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="status">
          {error}
        </div>
      ) : null}

      <form action={createClinicAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="name">
            병의원 이름
          </label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            id="name"
            name="name"
            required
            placeholder="예) ○○의원"
          />
        </div>

        <button
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
          type="submit"
        >
          시작하기
        </button>
      </form>
    </div>
  );
}
