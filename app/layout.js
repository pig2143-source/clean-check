import './globals.css'

export const metadata = {
  title: '潔淨打卡 Clean Check',
  description: '每日清潔拍照、主管審核與歷史紀錄',
  manifest: '/manifest.json',
  themeColor: '#117a43',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '潔淨打卡' }
}

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }) {
  return <html lang="zh-Hant"><body>{children}</body></html>
}
