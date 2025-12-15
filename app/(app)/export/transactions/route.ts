import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCurrentClinicId } from '@/lib/clinic';
import { toCsv } from '@/lib/csv';

function formatType(type: string): string {
  if (type === 'in') return '입고';
  if (type === 'out') return '출고';
  if (type === 'adjust') return '조정';
  return type;
}

function toDateStringKst(iso: string): string {
  const d = new Date(iso);
  const yyyy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(d);
  const mm = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', month: '2-digit' }).format(d);
  const dd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', day: '2-digit' }).format(d);
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const clinicId = await ensureCurrentClinicId(supabase, user.id);
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = supabase
    .from('inventory_transactions')
    .select('type,qty,memo,occurred_at,item:items(name,unit)')
    .eq('clinic_id', clinicId)
    .order('occurred_at', { ascending: true });

  if (from) query = query.gte('occurred_at', new Date(`${from}T00:00:00+09:00`).toISOString());
  if (to) query = query.lte('occurred_at', new Date(`${to}T23:59:59+09:00`).toISOString());

  const { data: txns, error } = await query;
  if (error) return new Response('Export failed', { status: 500 });

  const headers = ['날짜', '품목', '유형', '수량', '단위', '메모'];
  const rows = (txns ?? []).map((t) => {
    const item = (t as any).item;
    return [
      toDateStringKst(t.occurred_at as string),
      String(item?.name ?? ''),
      formatType(String(t.type)),
      String(t.qty ?? ''),
      String(item?.unit ?? ''),
      String(t.memo ?? ''),
    ];
  });

  const csv = toCsv(headers, rows);
  const filename = `inventory_transactions_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

