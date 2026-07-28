# 潔淨打卡 Clean Check v3

本版包含：

1. 主管後台
2. 員工帳號管理：新增、編輯、角色、停用、啟用、重設密碼、刪除
3. 清潔項目管理：新增、編輯、啟用、停用、排序、刪除

## Vercel 環境變數

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` 僅可放在 Vercel，不可放入 GitHub，也不可加上 `NEXT_PUBLIC_`。

## Supabase

在 SQL Editor 執行：

`supabase/upgrade-v3.sql`

## 部署

將本資料夾內所有檔案覆蓋上傳到 GitHub。Vercel 會自動重新部署。主管登入後，底部點「管理」，即可切換「員工管理」與「清潔項目」。
