# DP Clean v5.1 部署步驟

## 本機測試

1. 解壓縮專案並進入 `clean-check-main` 資料夾。
2. 執行 `npm install`。
3. 建立 `.env.local`，填入既有 Supabase 環境變數：

```env
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的 Publishable Key
SUPABASE_SERVICE_ROLE_KEY=你的 Service Role Key
```

4. 執行 `npm run dev`。
5. 開啟 `http://localhost:3000`。

## GitHub 與 Vercel

1. 備份目前 GitHub 專案。
2. 將 ZIP 內 `clean-check-main` 的檔案覆蓋到 GitHub 專案根目錄。
3. Commit 並 Push。
4. Vercel 會自動重新部署。
5. 部署完成後測試登入、忘記密碼、員工頁與主管頁。

## 注意事項

- 不需要執行新的 Supabase SQL。
- 不要把 `.env.local` 上傳到 GitHub。
- `SUPABASE_SERVICE_ROLE_KEY` 只能放在 Vercel 伺服器環境變數，不可寫進前端程式。
