export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-10">
        <div className="flex w-full items-center justify-end">
          <a
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100"
            href="/logout"
          >
            로그아웃
          </a>
        </div>
        <div className="flex w-full flex-1 items-center justify-center">{children}</div>
      </div>
    </div>
  );
}
