import './globals.css'

export const metadata = {
  title: 'DP Clean｜大埔鐵板燒 屏東民生店',
  description: '大埔鐵板燒屏東民生店清潔管理系統',
  manifest: '/manifest.json',
  icons: { icon: '/dp-clean-logo.svg', apple: '/dp-clean-logo.svg' },
  themeColor: '#0b382a',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'DP Clean' }
}

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }) {
  return <html lang="zh-Hant"><body>{children}</body></html>
}
