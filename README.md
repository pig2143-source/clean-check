# 潔淨打卡 Clean Check

單店每日清潔管理 App，使用 Next.js + Supabase。

## 已完成

- Email／密碼登入
- 員工、主管角色
- 每日清潔清單
- 手機拍照或相簿上傳
- 清潔照片存入 Supabase Storage
- 主管審核：合格／需重做
- 歷史紀錄
- 手機版介面與 PWA manifest

## 1. Supabase

你目前已建立以下資料表：

- `profiles`
- `cleaning_tasks`
- `cleaning_submissions`

第一次建立新專案時，可在 Supabase SQL Editor 執行：

`supabase/schema.sql`

已經執行過的人，不要重複執行舊版腳本。

## 2. 環境變數

在 Vercel 專案的 Environment Variables 新增：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

連線資訊可從 Supabase 專案上方的 `Connect` 找到。

請勿把 `service_role` 或 secret key 放進前端或 GitHub。

## 3. 上傳 GitHub

把本資料夾內的所有檔案上傳到 GitHub repository 根目錄。上傳後首頁應直接看見：

- `app`
- `lib`
- `public`
- `supabase`
- `package.json`

不要只上傳 ZIP，也不要多包一層資料夾。

## 4. 部署 Vercel

1. 登入 Vercel
2. Add New → Project
3. Import Git Repository → `clean-check`
4. 加入兩個環境變數
5. Deploy

## 5. 本機執行

```bash
npm install
npm run dev
```

開啟 `http://localhost:3000`。

## 帳號角色

Authentication 建立使用者後，`profiles` 必須有相同 UUID：

```sql
insert into public.profiles (id, display_name, role)
values ('AUTH_USER_UUID', '員工姓名', 'staff');
```

主管使用：

```sql
insert into public.profiles (id, display_name, role)
values ('AUTH_USER_UUID', '店長', 'manager');
```

`role` 只能是 `staff` 或 `manager`。
