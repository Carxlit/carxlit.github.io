import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Punto Ciego - Redacción Autónoma",
  description: "Panel de la redacción autónoma de Punto Ciego: radar de noticias, cola omnicanal y salud de canales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}

