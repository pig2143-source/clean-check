# DP Clean v6.0 AI 照片分析

## 功能
- 照片上傳後自動分析油污、水漬、垃圾/雜物
- AI 清潔評分 0–100
- 合格、人工確認、發現疑慮三種建議
- 照片品質判定與改善建議
- AI 結果顯示於員工提交頁與主管審核卡

## 必要設定
1. Supabase SQL Editor 執行 `supabase/upgrade-v6.0.sql`
2. Vercel Project Settings → Environment Variables 新增 `OPENAI_API_KEY`
3. 可選：`OPENAI_VISION_MODEL`，未設定時使用 `gpt-4.1-mini`
4. 重新部署

## 重要說明
AI 結果僅供主管輔助判讀，最終合格或退回仍由主管決定。
