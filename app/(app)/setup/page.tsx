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

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .insert({ name, created_by: user.id })
    .select('id')
    .single();
  if (clinicError) redirect('/setup?error=' + encodeURIComponent('병의원 생성에 실패했어요.'));

  const clinicId = clinic.id as string;

  const { error: memberError } = await supabase.from('clinic_members').insert({ clinic_id: clinicId, user_id: user.id, role: 'owner' });
  if (memberError) redirect('/setup?error=' + encodeURIComponent('멤버 생성에 실패했어요.'));

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, current_clinic_id: clinicId }, { onConflict: 'user_id' });
  if (profileError) redirect('/setup?error=' + encodeURIComponent('프로필 저장에 실패했어요.'));

  const defaultCategories = ['백신', '외용제', '성장클리닉 주사약'].map((categoryName, index) => ({
    clinic_id: clinicId,
    name: categoryName,
    sort_order: index,
  }));
  await supabase.from('categories').insert(defaultCategories);

  await ensureCurrentClinicId(supabase, user.id);
  redirect('/dashboard');
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const { error } = searchParams;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h1 className="pageTitle">처음 설정</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        병의원 이름을 입력하면 기본 카테고리(백신/외용제/성장클리닉 주사약)가 자동으로 만들어집니다.
      </p>

      {error ? (
        <div className="panel" style={{ padding: 12, borderColor: '#fecaca', background: '#fef2f2', marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <form action={createClinicAction}>
        <label className="label" htmlFor="name">
          병의원 이름
        </label>
        <input className="input" id="name" name="name" required placeholder="예) ○○의원" />

        <div style={{ height: 12 }} />
        <button className="btn btnPrimary" type="submit">
          시작하기
        </button>
      </form>
    </div>
  );
}
