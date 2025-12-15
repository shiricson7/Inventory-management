import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCurrentClinicId } from '@/lib/clinic';
import { redirect } from 'next/navigation';

function getString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function addCategoryAction(formData: FormData) {
  'use server';
  const name = getString(formData.get('name'));
  if (!name) redirect('/categories?error=' + encodeURIComponent('카테고리 이름을 입력해주세요.'));

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { error } = await supabase.from('categories').insert({ clinic_id: clinicId, name, sort_order: 999 });
  if (error) redirect('/categories?error=' + encodeURIComponent('추가에 실패했어요. 같은 이름이 이미 있는지 확인해주세요.'));

  redirect('/categories');
}

async function archiveCategoryAction(formData: FormData) {
  'use server';
  const categoryId = getString(formData.get('category_id'));
  if (!categoryId) redirect('/categories');

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { error } = await supabase.from('categories').update({ is_archived: true }).eq('id', categoryId).eq('clinic_id', clinicId);
  if (error) redirect('/categories?error=' + encodeURIComponent('삭제(보관)에 실패했어요.'));
  redirect('/categories');
}

export default async function CategoriesPage({
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

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { data: categories } = await supabase
    .from('categories')
    .select('id,name,sort_order')
    .eq('clinic_id', clinicId)
    .eq('is_archived', false)
    .order('sort_order')
    .order('name');

  return (
    <div>
      <h1 className="pageTitle">카테고리</h1>

      {error ? (
        <div className="panel" style={{ padding: 12, borderColor: '#fecaca', background: '#fef2f2', marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div className="grid2">
        <div className="panel" style={{ padding: 14 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>카테고리 추가</h2>
          <form action={addCategoryAction}>
            <label className="label" htmlFor="name">
              이름
            </label>
            <input className="input" id="name" name="name" placeholder="예) 소모품" required />
            <div style={{ height: 12 }} />
            <button className="btn btnPrimary" type="submit">
              추가
            </button>
          </form>
        </div>

        <div className="panel" style={{ padding: 14 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>현재 카테고리</h2>
          {(categories?.length ?? 0) === 0 ? (
            <div className="muted">카테고리가 없습니다.</div>
          ) : (
            <table className="table" aria-label="카테고리 목록">
              <thead>
                <tr>
                  <th>이름</th>
                  <th style={{ width: 140 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {(categories ?? []).map((c) => (
                  <tr key={c.id as string}>
                    <td style={{ fontWeight: 650 }}>{c.name as string}</td>
                    <td>
                      <form action={archiveCategoryAction}>
                        <input type="hidden" name="category_id" value={c.id as string} />
                        <button className="btn btnDanger" type="submit">
                          삭제(보관)
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="help">실제 삭제 대신 “보관” 처리합니다. (데이터 보호)</div>
        </div>
      </div>
    </div>
  );
}
