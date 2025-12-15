import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCurrentClinicId } from '@/lib/clinic';
import { redirect } from 'next/navigation';

type Category = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  unit: string;
  reorder_threshold: number;
  category: Category | null;
};

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);

  const [{ data: categories }, { data: items }, { data: stocks }] = await Promise.all([
    supabase.from('categories').select('id,name').eq('clinic_id', clinicId).eq('is_archived', false).order('sort_order'),
    supabase
      .from('items')
      .select('id,name,unit,reorder_threshold,category:categories(id,name)')
      .eq('clinic_id', clinicId)
      .eq('is_archived', false)
      .order('name'),
    supabase.from('item_stock').select('item_id,stock').eq('clinic_id', clinicId),
  ]);

  const stockByItemId = new Map<string, number>();
  for (const row of stocks ?? []) stockByItemId.set(row.item_id as string, toNumber(row.stock));

  const enrichedItems: Array<Item & { stock: number; isLow: boolean }> = (items ?? []).map((it) => {
    const stock = stockByItemId.get(it.id as string) ?? 0;
    const threshold = toNumber(it.reorder_threshold);
    const isLow = threshold > 0 && stock <= threshold;
    return { ...(it as Item), stock, isLow };
  });

  const lowStock = enrichedItems.filter((i) => i.isLow).slice(0, 10);

  const totalByCategoryId = new Map<string, number>();
  for (const item of enrichedItems) {
    const categoryId = item.category?.id;
    if (!categoryId) continue;
    totalByCategoryId.set(categoryId, (totalByCategoryId.get(categoryId) ?? 0) + item.stock);
  }

  const chartRows = (categories ?? []).map((c) => ({
    id: c.id as string,
    label: c.name as string,
    value: totalByCategoryId.get(c.id as string) ?? 0,
  }));
  const maxValue = Math.max(1, ...chartRows.map((r) => r.value));

  return (
    <div>
      <h1 className="pageTitle">대시보드</h1>

      <div className="grid3" style={{ marginBottom: 12 }}>
        <div className="panel" style={{ padding: 14 }}>
          <div className="muted">등록된 품목</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{enrichedItems.length}</div>
        </div>
        <div className="panel" style={{ padding: 14 }}>
          <div className="muted">재고 경고(기준 이하)</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{enrichedItems.filter((i) => i.isLow).length}</div>
        </div>
        <div className="panel" style={{ padding: 14 }}>
          <div className="muted">카테고리</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{(categories ?? []).length}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel" style={{ padding: 14 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>카테고리별 재고(간단 그래프)</h2>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            전체 흐름을 보기 위한 요약입니다. 품목별 단위가 달라도 참고용으로 확인하세요.
          </div>
          <div>
            {chartRows.map((row) => {
              const width = Math.round((row.value / maxValue) * 100);
              return (
                <div key={row.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 650 }}>{row.label}</div>
                    <div className="muted">{row.value}</div>
                  </div>
                  <div className="panel" style={{ height: 12, overflow: 'hidden' }}>
                    <div style={{ width: `${width}%`, height: '100%', background: 'var(--primary)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>재고 경고</h2>
            <Link href="/items" className="muted">
              품목에서 설정/확인 →
            </Link>
          </div>
          <div className="help" style={{ marginTop: 6 }}>
            기준 재고(경고 설정) 이하로 내려가면 표시됩니다.
          </div>

          <div style={{ height: 10 }} />
          {lowStock.length === 0 ? (
            <div className="muted">현재 경고 품목이 없습니다.</div>
          ) : (
            <table className="table" aria-label="재고 경고 품목">
              <thead>
                <tr>
                  <th>품목</th>
                  <th>현재</th>
                  <th>기준</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 650 }}>{item.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {item.category?.name ?? '미분류'}
                      </div>
                    </td>
                    <td>
                      <span className="badge badgeDanger">
                        {item.stock} {item.unit}
                      </span>
                    </td>
                    <td>
                      {item.reorder_threshold} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

