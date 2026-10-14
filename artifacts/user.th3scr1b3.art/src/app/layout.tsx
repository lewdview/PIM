import type { Metadata } from 'next';
import Script from 'next/script';
import { Anton, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Same type stack as pim.th3scr1b3.art/launch: Anton display, Space Grotesk body, JetBrains Mono labels.
const anton = Anton({
  variable: '--font-anton',
  subsets: ['latin'],
  weight: '400',
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'th3scr1b3 // Identity Hub',
  description: 'One login for every th3scr1b3.art layer, plus everything you have played, heard and pulled across the ecosystem.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${anton.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
        {children}
        {/* th3scr1b3 ecosystem bar: shared layer switcher. Layers live in https://th3scr1b3.art/ecosystem.json */}
        <Script src="https://th3scr1b3.art/ecosystem-bar.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
