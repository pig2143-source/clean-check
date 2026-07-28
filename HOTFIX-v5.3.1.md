# DP Clean v5.3.1 Hotfix

修正首頁登入後發生 client-side exception。

原因：`canManage` 在宣告前即被使用，觸發 JavaScript Temporal Dead Zone 錯誤。

修正：將 `const canManage = profile.role === 'manager'` 移到任務篩選之前。
