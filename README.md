# 소규모 병의원 재고관리 (Supabase + Next.js)

백신/외용제/성장클리닉 주사약 등 병의원 재고를 **입출고 기록 기반으로 자동 합산**하고, **재고 경고(기준 이하)** 및 **CSV(엑셀) 내보내기**를 제공하는 간단한 앱입니다.

## 주요 기능

- 로그인(외부 노출 방지): Supabase Auth (이메일/비밀번호)
- 카테고리/품목 추가 및 보관(삭제 대신 아카이브)
- 입고/출고/조정 기록
- 대시보드 요약 + 간단 그래프
- 재고 경고(품목별 “경고 기준 이하”)
- CSV 내보내기
  - 입출고 내역: `/export/transactions`
  - 현재 재고: `/export/current-stock`

## 기술 스택

- Next.js (App Router) + React
- Supabase (Auth, Postgres, RLS)

## Supabase 설정

1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/0001_init.sql` 실행
3. Authentication 설정
   - 내부 앱이면 이메일 확인(Email confirmations)을 끄면 운영이 편합니다.

## 로컬 실행

1. 환경변수 설정
   - `.env.local` 생성 후 아래 값 입력

```bash
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

2. 의존성 설치 및 실행

```bash
npm install
npm run dev
```

3. 최초 로그인 후 `/setup`에서 병의원 이름을 입력하면 기본 카테고리(백신/외용제/성장클리닉 주사약)가 생성됩니다.

## 배포(클라우드)

가장 간단한 방법은 Vercel 배포입니다.

- Vercel에 레포 연결
- Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 등록
- Deploy

