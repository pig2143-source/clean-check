import './globals.css'

export const metadata = {
  title: '潔淨打卡',
  description: '每日清潔拍照與主管審核',
  manifest: '/manifest.json',
  themeColor: '#138a4b'
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
