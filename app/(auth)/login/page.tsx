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
  const next = getString(formData.get('next')) || '/';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent('회원가입에 실패했어요. 다른 이메일을 사용해보세요.')}&next=${encodeURIComponent(next)}`);

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect(`/login?message=${encodeURIComponent('회원가입이 완료됐어요. 로그인 해주세요.')}&next=${encodeURIComponent(next)}`);

  redirect(next);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string; next?: string };
}) {
  const { error, message, next } = searchParams;

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">병의원 재고관리</h1>
        <p className="mt-2 text-sm text-slate-600">이메일/비밀번호로 로그인합니다.</p>
      </div>

      {(error || message) && (
        <div
          className={[
            'mb-4 rounded-2xl border p-3 text-sm',
            error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
          ].join(' ')}
          role="status"
        >
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form action={signInAction} className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">로그인</h2>
            <p className="mt-1 text-xs text-slate-600">기존 계정으로 바로 시작하세요.</p>
          </div>

          <input type="hidden" name="next" value={next || '/'} />

          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            이메일
          </label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
          />

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              비밀번호
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <button
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
            type="submit"
          >
            로그인
          </button>
        </form>

        <form action={signUpAction} className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">회원가입</h2>
            <p className="mt-1 text-xs text-slate-600">처음이라면 계정을 생성하세요.</p>
          </div>

          <input type="hidden" name="next" value={next || '/'} />

          <label className="block text-sm font-medium text-slate-700" htmlFor="su_email">
            이메일
          </label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            id="su_email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
          />

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700" htmlFor="su_password">
              비밀번호
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              id="su_password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="최소 8자"
            />
            <p className="mt-2 text-xs text-slate-600">내부 사용이라면 간단한 비밀번호도 가능하지만, 최소 8자 권장입니다.</p>
          </div>

          <button
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
            type="submit"
          >
            회원가입
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">로그인 후 처음 1회는 병의원 정보를 설정합니다.</p>
    </div>
  );
}
