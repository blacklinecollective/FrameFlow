export const metadata = { title: "FrameFlow" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet" />
        <style>{`* { margin: 0; padding: 0; box-sizing: border-box; } body { overflow: hidden; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
