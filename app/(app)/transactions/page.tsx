import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCurrentClinicId } from '@/lib/clinic';
import { redirect } from 'next/navigation';

function getString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toIntStrict(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toKstIsoForDate(date: string): string {
  // date: YYYY-MM-DD
  return new Date(`${date}T09:00:00`).toISOString();
}

async function addTransactionAction(formData: FormData) {
  'use server';
  const itemId = getString(formData.get('item_id'));
  const type = getString(formData.get('type')) as 'in' | 'out' | 'adjust';
  const qtyRaw = getString(formData.get('qty'));
  const memo = getString(formData.get('memo'));
  const occurredDate = getString(formData.get('occurred_date'));

  if (!itemId) redirect('/transactions?error=' + encodeURIComponent('품목을 선택해주세요.'));
  if (!['in', 'out', 'adjust'].includes(type)) redirect('/transactions?error=' + encodeURIComponent('유형을 선택해주세요.'));

  const qty = toIntStrict(qtyRaw);
  if (qty === null || qty === 0) redirect('/transactions?error=' + encodeURIComponent('수량을 숫자로 입력해주세요. (0은 불가)'));
  if ((type === 'in' || type === 'out') && qty < 0) redirect('/transactions?error=' + encodeURIComponent('입고/출고는 양수로 입력해주세요.'));

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clinicId = await ensureCurrentClinicId(supabase, user.id);

  const occurred_at = occurredDate ? toKstIsoForDate(occurredDate) : new Date().toISOString();
  const { error } = await supabase.from('inventory_transactions').insert({
    clinic_id: clinicId,
    item_id: itemId,
    type,
    qty,
    memo: memo || null,
    occurred_at,
    created_by: user.id,
  });
  if (error) redirect('/transactions?error=' + encodeURIComponent('저장에 실패했어요.'));

  redirect('/transactions');
}

async function deleteTransactionAction(formData: FormData) {
  'use server';
  const txnId = getString(formData.get('txn_id'));
  if (!txnId) redirect('/transactions');

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const clinicId = await ensureCurrentClinicId(supabase, user.id);

  const { error } = await supabase.from('inventory_transactions').delete().eq('id', txnId).eq('clinic_id', clinicId);
  if (error) redirect('/transactions?error=' + encodeURIComponent('삭제에 실패했어요.'));

  redirect('/transactions');
}

function formatType(type: string): string {
  if (type === 'in') return '입고';
  if (type === 'out') return '출고';
  if (type === 'adjust') return '조정';
  return type;
}

export default async function TransactionsPage({
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
  const [{ data: items }, { data: txns }] = await Promise.all([
    supabase.from('items').select('id,name,unit').eq('clinic_id', clinicId).eq('is_archived', false).order('name'),
    supabase
      .from('inventory_transactions')
      .select('id,type,qty,memo,occurred_at,item:items(name,unit)')
      .eq('clinic_id', clinicId)
      .order('occurred_at', { ascending: false })
      .limit(50),
  ]);

  const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="pageTitle">입출고</h1>
        <Link className="btn" href="/export/transactions">
          엑셀/CSV 내보내기
        </Link>
      </div>

      {error ? (
        <div className="panel" style={{ padding: 12, borderColor: '#fecaca', background: '#fef2f2', marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div className="panel" style={{ padding: 14, marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>기록 추가</h2>
        <form action={addTransactionAction} className="grid3">
          <div>
            <label className="label" htmlFor="item_id">
              품목
            </label>
            <select className="input" id="item_id" name="item_id" required defaultValue="">
              <option value="" disabled>
                선택하세요
              </option>
              {(items ?? []).map((it) => (
                <option key={it.id as string} value={it.id as string}>
                  {it.name as string}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="type">
              유형
            </label>
            <select className="input" id="type" name="type" required defaultValue="out">
              <option value="in">입고</option>
              <option value="out">출고</option>
              <option value="adjust">조정(±가능)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="qty">
              수량
            </label>
            <input className="input" id="qty" name="qty" type="number" required placeholder="예) 10" />
          </div>
          <div>
            <label className="label" htmlFor="occurred_date">
              날짜(선택)
            </label>
            <input className="input" id="occurred_date" name="occurred_date" type="date" />
          </div>
          <div>
            <label className="label" htmlFor="memo">
              메모(선택)
            </label>
            <input className="input" id="memo" name="memo" placeholder="예) 유효기간/거래처" />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="btn btnPrimary" type="submit" style={{ width: '100%' }}>
              저장
            </button>
          </div>
        </form>
        <div className="help">입고/출고는 양수로 입력합니다. 조정은 -3 처럼 음수도 가능합니다.</div>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>최근 기록(최대 50개)</h2>
        {(txns?.length ?? 0) === 0 ? (
          <div className="muted">기록이 없습니다.</div>
        ) : (
          <table className="table" aria-label="최근 입출고 기록">
            <thead>
              <tr>
                <th>날짜</th>
                <th>품목</th>
                <th>유형</th>
                <th>수량</th>
                <th>메모</th>
                <th style={{ width: 120 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {(txns ?? []).map((t) => {
                const itemName = (t as any).item?.name ?? '';
                const unit = (t as any).item?.unit ?? '개';
                const occurredAt = new Date(t.occurred_at as string);
                return (
                  <tr key={t.id as string}>
                    <td>{dateFormatter.format(occurredAt)}</td>
                    <td style={{ fontWeight: 650 }}>{itemName}</td>
                    <td>{formatType(t.type as string)}</td>
                    <td>
                      {t.qty as number} {unit}
                    </td>
                    <td className="muted">{(t.memo as string) || ''}</td>
                    <td>
                      <form action={deleteTransactionAction}>
                        <input type="hidden" name="txn_id" value={t.id as string} />
                        <button className="btn btnDanger" type="submit">
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="help">잘못 입력한 기록은 삭제 후 다시 입력해주세요.</div>
      </div>
    </div>
  );
}
