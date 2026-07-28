# 潔淨打卡 Clean Check v4

完整版包含：

1. 員工／主管登入與角色權限
2. 手機拍照上傳、送審、合格與退回重做
3. 主管員工帳號管理：新增、編輯、角色、停用、重設密碼、刪除
4. 清潔項目管理：新增、編輯、排序、啟用、停用、刪除
5. App 內即時報表：今日／本週／本月、完成率、每日趨勢、員工排行、項目品質
6. CSV 報表匯出（Excel 可直接開啟）
7. PWA 手機主畫面安裝

## Vercel 環境變數

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（只可放在 Vercel，禁止放入前端或 GitHub）

## 升級

既有 v3 使用者直接覆蓋專案即可。`supabase/upgrade-v4.sql` 僅增加報表查詢索引，可重複安全執行。
