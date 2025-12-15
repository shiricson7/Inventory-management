import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCurrentClinicId } from '@/lib/clinic';
import { redirect } from 'next/navigation';

function getString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toInt(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

async function addItemAction(formData: FormData) {
  'use server';
  const name = getString(formData.get('name'));
  const categoryId = getString(formData.get('category_id'));
  const unit = getString(formData.get('unit')) || '개';
  const thresholdRaw = getString(formData.get('reorder_threshold'));
  const threshold = thresholdRaw ? toInt(thresholdRaw) : 0;

  if (!name) redirect('/items?error=' + encodeURIComponent('품목 이름을 입력해주세요.'));
  if (!categoryId) redirect('/items?error=' + encodeURIComponent('카테고리를 선택해주세요.'));
  if (threshold === null || threshold < 0) redirect('/items?error=' + encodeURIComponent('경고 기준은 0 이상의 숫자여야 해요.'));

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { error } = await supabase.from('items').insert({
    clinic_id: clinicId,
    category_id: categoryId,
    name,
    unit,
    reorder_threshold: threshold ?? 0,
  });
  if (error) redirect('/items?error=' + encodeURIComponent('추가에 실패했어요. 같은 이름이 이미 있는지 확인해주세요.'));

  redirect('/items');
}

async function updateThresholdAction(formData: FormData) {
  'use server';
  const itemId = getString(formData.get('item_id'));
  const thresholdRaw = getString(formData.get('reorder_threshold'));
  const threshold = thresholdRaw ? toInt(thresholdRaw) : 0;
  if (!itemId) redirect('/items');
  if (threshold === null || threshold < 0) redirect('/items?error=' + encodeURIComponent('경고 기준은 0 이상의 숫자여야 해요.'));

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { error } = await supabase.from('items').update({ reorder_threshold: threshold ?? 0 }).eq('id', itemId).eq('clinic_id', clinicId);
  if (error) redirect('/items?error=' + encodeURIComponent('저장에 실패했어요.'));
  redirect('/items');
}

async function archiveItemAction(formData: FormData) {
  'use server';
  const itemId = getString(formData.get('item_id'));
  if (!itemId) redirect('/items');

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const { error } = await supabase.from('items').update({ is_archived: true }).eq('id', itemId).eq('clinic_id', clinicId);
  if (error) redirect('/items?error=' + encodeURIComponent('삭제(보관)에 실패했어요.'));
  redirect('/items');
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

export default async function ItemsPage({
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

  const [{ data: categories }, { data: items }, { data: stocks }] = await Promise.all([
    supabase.from('categories').select('id,name').eq('clinic_id', clinicId).eq('is_archived', false).order('sort_order').order('name'),
    supabase
      .from('items')
      .select('id,name,unit,reorder_threshold,category:categories(name)')
      .eq('clinic_id', clinicId)
      .eq('is_archived', false)
      .order('name'),
    supabase.from('item_stock').select('item_id,stock').eq('clinic_id', clinicId),
  ]);

  const stockByItemId = new Map<string, number>();
  for (const row of stocks ?? []) stockByItemId.set(row.item_id as string, toNumber(row.stock));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="pageTitle">품목</h1>
        <a className="btn" href="/export/current-stock">
          현재재고 내보내기
        </a>
      </div>
      <div className="muted" style={{ marginBottom: 12 }}>
        품목을 등록하고, 경고 기준(몇 개 이하이면 경고)을 설정하세요.
      </div>

      {error ? (
        <div className="panel" style={{ padding: 12, borderColor: '#fecaca', background: '#fef2f2', marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div className="panel" style={{ padding: 14, marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>품목 추가</h2>
        <form action={addItemAction} className="grid3">
          <div>
            <label className="label" htmlFor="category_id">
              카테고리
            </label>
            <select className="input" id="category_id" name="category_id" required defaultValue="">
              <option value="" disabled>
                선택하세요
              </option>
              {(categories ?? []).map((c) => (
                <option key={c.id as string} value={c.id as string}>
                  {c.name as string}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="name">
              품목명
            </label>
            <input className="input" id="name" name="name" placeholder="예) 독감 백신" required />
          </div>
          <div>
            <label className="label" htmlFor="unit">
              단위
            </label>
            <input className="input" id="unit" name="unit" placeholder="예) 바이알, 개" defaultValue="개" />
          </div>
          <div>
            <label className="label" htmlFor="reorder_threshold">
              경고 기준(이하)
            </label>
            <input className="input" id="reorder_threshold" name="reorder_threshold" type="number" min={0} defaultValue={0} />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="btn btnPrimary" type="submit" style={{ width: '100%' }}>
              추가
            </button>
          </div>
        </form>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>현재 품목</h2>
        {(items?.length ?? 0) === 0 ? (
          <div className="muted">품목이 없습니다.</div>
        ) : (
          <table className="table" aria-label="품목 목록">
            <thead>
              <tr>
                <th>품목</th>
                <th>현재재고</th>
                <th>경고기준</th>
                <th style={{ width: 240 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((it) => {
                const stock = stockByItemId.get(it.id as string) ?? 0;
                const threshold = toNumber(it.reorder_threshold);
                const isLow = threshold > 0 && stock <= threshold;
                return (
                  <tr key={it.id as string}>
                    <td>
                      <div style={{ fontWeight: 650 }}>{it.name as string}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {(it as any).category?.name ?? '미분류'}
                      </div>
                    </td>
                    <td>
                      {isLow ? (
                        <span className="badge badgeDanger">
                          {stock} {(it.unit as string) || '개'}
                        </span>
                      ) : (
                        <span className="badge">
                          {stock} {(it.unit as string) || '개'}
                        </span>
                      )}
                    </td>
                    <td>
                      <form action={updateThresholdAction} className="row" style={{ gap: 8 }}>
                        <input type="hidden" name="item_id" value={it.id as string} />
                        <input
                          className="input"
                          name="reorder_threshold"
                          type="number"
                          min={0}
                          defaultValue={threshold}
                          aria-label="경고 기준"
                          style={{ width: 120 }}
                        />
                        <button className="btn" type="submit">
                          저장
                        </button>
                      </form>
                    </td>
                    <td>
                      <form action={archiveItemAction}>
                        <input type="hidden" name="item_id" value={it.id as string} />
                        <button className="btn btnDanger" type="submit">
                          삭제(보관)
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="help">재고는 “입출고”에서 기록한 내용을 합산하여 계산합니다.</div>
      </div>
    </div>
  );
}
