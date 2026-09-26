import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Socratica Bakery Supply",
  description: "A Ramp Bill Pay workshop for bakery teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="siteHeader">
          <Link href="/" className="brand"><span>SB</span> Socratica Bakery Supply</Link>
          <nav><Link href="/">Supplier shop</Link><Link href="/admin">Admin</Link></nav>
        </header>
        {children}
      </body>
    </html>
  );
}
