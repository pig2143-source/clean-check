# DP Clean v6.1.2 AI Environment Diagnostic Hotfix

## 修正內容

- AI API 強制使用 Node.js 動態執行，不快取健康檢查結果。
- 每次請求時重新讀取伺服器環境變數。
- `/api/ai/analyze` 顯示必要環境變數是否存在，但不顯示任何密鑰內容。
- 顯示 Vercel 執行環境、區域與部署 Commit 前八碼，方便確認是否測到最新部署。
- AI 分析失敗時回傳明確錯誤代碼 `OPENAI_API_KEY_MISSING`。
- API Key 與模型值會自動移除前後空白。

## 部署後驗證

開啟：

`https://你的網域/api/ai/analyze`

成功讀取金鑰時應看到：

```json
{
  "configured": true,
  "env": {
    "OPENAI_API_KEY": true
  }
}
```

若仍為 `false`，代表該 Production Deployment 沒有取得環境變數，並非 AI 程式判斷錯誤。請刪除並重新建立 `OPENAI_API_KEY`，再由 main 分支建立新的部署，不要只重新部署舊快照。
