import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCurrentClinicId } from '@/lib/clinic';
import { toCsv } from '@/lib/csv';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const clinicId = await ensureCurrentClinicId(supabase, user.id);

  const [{ data: categories }, { data: items }, { data: stocks }] = await Promise.all([
    supabase.from('categories').select('id,name').eq('clinic_id', clinicId).eq('is_archived', false),
    supabase
      .from('items')
      .select('id,name,unit,reorder_threshold,category_id')
      .eq('clinic_id', clinicId)
      .eq('is_archived', false),
    supabase.from('item_stock').select('item_id,stock').eq('clinic_id', clinicId),
  ]);

  const categoryNameById = new Map<string, string>();
  for (const c of categories ?? []) categoryNameById.set(c.id as string, c.name as string);

  const stockByItemId = new Map<string, number>();
  for (const row of stocks ?? []) stockByItemId.set(row.item_id as string, toNumber(row.stock));

  const headers = ['카테고리', '품목', '현재재고', '단위', '경고기준(이하)'];
  const rows = (items ?? [])
    .map((it) => {
      const stock = stockByItemId.get(it.id as string) ?? 0;
      const categoryName = categoryNameById.get(it.category_id as string) ?? '';
      return [
        categoryName,
        String(it.name ?? ''),
        String(stock),
        String(it.unit ?? ''),
        String(it.reorder_threshold ?? 0),
      ];
    })
    .sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1], 'ko-KR'));

  const csv = toCsv(headers, rows);
  const filename = `current_stock_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

