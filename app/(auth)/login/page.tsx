import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function getString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function signInAction(formData: FormData) {
  'use server';
  const email = getString(formData.get('email'));
  const password = getString(formData.get('password'));
  const next = getString(formData.get('next')) || '/';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent('로그인에 실패했어요. 이메일/비밀번호를 확인해주세요.')}`);

  redirect(next);
}

async function signUpAction(formData: FormData) {
  'use server';
  const email = getString(formData.get('email'));
  const password = getString(formData.get('password'));

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent('회원가입에 실패했어요. 다른 이메일을 사용해보세요.')}`);

  redirect(`/login?message=${encodeURIComponent('회원가입이 완료됐어요. 로그인 해주세요.')}`);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string; next?: string };
}) {
  const { error, message, next } = searchParams;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h1 className="pageTitle">병의원 재고관리 로그인</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        이메일/비밀번호로 로그인합니다.
      </p>

      {error ? (
        <div className="panel" style={{ padding: 12, borderColor: '#fecaca', background: '#fef2f2', marginBottom: 12 }}>
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="panel" style={{ padding: 12, borderColor: '#bbf7d0', background: '#f0fdf4', marginBottom: 12 }}>
          {message}
        </div>
      ) : null}

      <div className="grid2">
        <form action={signInAction} className="panel" style={{ padding: 14 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>로그인</h2>
          <input type="hidden" name="next" value={next || '/'} />
          <label className="label" htmlFor="email">
            이메일
          </label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />

          <div style={{ height: 10 }} />
          <label className="label" htmlFor="password">
            비밀번호
          </label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />

          <div style={{ height: 12 }} />
          <button className="btn btnPrimary" type="submit" style={{ width: '100%' }}>
            로그인
          </button>
        </form>

        <form action={signUpAction} className="panel" style={{ padding: 14 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>회원가입</h2>
          <label className="label" htmlFor="su_email">
            이메일
          </label>
          <input className="input" id="su_email" name="email" type="email" required autoComplete="email" />

          <div style={{ height: 10 }} />
          <label className="label" htmlFor="su_password">
            비밀번호
          </label>
          <input
            className="input"
            id="su_password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
          />
          <div className="help">내부 사용이라면 간단한 비밀번호도 가능하지만, 최소 8자 권장입니다.</div>

          <div style={{ height: 12 }} />
          <button className="btn" type="submit" style={{ width: '100%' }}>
            회원가입
          </button>
        </form>
      </div>
    </div>
  );
}
