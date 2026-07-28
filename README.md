# 潔淨打卡 Clean Check v2

這是可直接覆蓋既有 GitHub 專案的完整版。

## 已完成

- 員工與主管登入
- 主管也能執行今日清潔任務
- 點擊任務後直接拍照或選擇照片
- 照片上傳至 Supabase Storage
- 主管查看照片、審核合格或輸入退回原因
- 退回後重新拍照送審
- 今日完成率與狀態統計
- 歷史紀錄搜尋、篩選、照片預覽
- 主管新增、編輯、啟用、停用及刪除清潔項目
- 帳號名單
- PWA 手機桌面安裝

## 更新既有專案

1. 在 Supabase SQL Editor 新增查詢。
2. 貼上並執行 `supabase/upgrade-v2.sql`。
3. GitHub 專案根目錄選 Add file → Upload files。
4. 上傳本資料夾內全部檔案，覆蓋同名檔案。
5. Commit changes。
6. Vercel 會自動重新部署。

現有的 Vercel 環境變數不需要更改：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 安全提醒

前端只可使用 `sb_publishable_...`。不要把 `sb_secret_...` 放進 GitHub 或 `NEXT_PUBLIC_` 變數。
