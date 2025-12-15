import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '병의원 재고관리',
  description: '소규모 병의원용 재고관리 앱',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

