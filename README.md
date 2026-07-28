# DP Clean Enterprise v5.0

大埔鐵板燒屏東民生店專用清潔管理系統。

## 功能
- 員工與主管登入
- 每日清潔任務與照片上傳
- 主管審核、退回重做
- 歷史紀錄
- 員工與清潔項目管理
- 今日／本週／本月即時報表
- CSV（Excel 可開啟）匯出
- DP Clean 品牌登入頁、App Icon 與 PWA
- 記住帳號與忘記密碼

## 部署
保留原 Vercel 環境變數：
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY

本版沿用 v4 資料表，不需新增 SQL。若尚未執行先前升級，請依序執行 `supabase/upgrade-v2.sql`、`upgrade-v3.sql`、`upgrade-v4.sql`。
