import type { Metadata } from 'next';
import Script from 'next/script';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'th3scr1b3 // Identity Matrix & Analytics Hub',
  description: 'Cryptographic identity vault and aggregated listening & gaming analytics for the th3scr1b3 ecosystem.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${jetbrainsMono.variable}`}>
        {children}
        {/* th3scr1b3 ecosystem bar: shared layer switcher. Layers live in https://th3scr1b3.art/ecosystem.json */}
        <Script src="https://th3scr1b3.art/ecosystem-bar.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
