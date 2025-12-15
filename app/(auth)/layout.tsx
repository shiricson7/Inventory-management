export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container" style={{ maxWidth: 520, paddingTop: 40 }}>
      {children}
    </div>
  );
}

