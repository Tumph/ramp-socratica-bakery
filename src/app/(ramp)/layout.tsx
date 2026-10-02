import type { Metadata } from "next";
import { RampConfigProvider } from "@/components/ramp/RampConfigProvider";
import "./ramp.css";

export const metadata: Metadata = {
  title: "Ramp",
  description: "Workshop card simulator for Socratica Bakery Supply.",
};

export default function RampLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RampConfigProvider>{children}</RampConfigProvider>
      </body>
    </html>
  );
}
