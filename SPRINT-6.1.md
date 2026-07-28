# DP Clean Sprint 6.1

本版完成 AI 照片分析核心：

- 照片上傳後自動呼叫 OpenAI Vision
- 油污、水漬、垃圾／雜物辨識
- 0 至 100 分清潔評分
- 結果寫入 Supabase
- 主管審核畫面顯示 AI 結果
- AI 失敗或等待中可手動重新分析
- 加入逾時、權限與回傳格式檢查
- 提供 `/api/ai/analyze` GET 健康檢查

部署前需先執行 `supabase/upgrade-v6.0.sql`，並在 Vercel 設定 `OPENAI_API_KEY`。
