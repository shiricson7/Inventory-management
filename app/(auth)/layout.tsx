export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}

