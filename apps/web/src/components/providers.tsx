"use client";

import { MiniAppProvider } from "@/contexts/miniapp-context";
import FrameWalletProvider from "@/contexts/frame-wallet-context";
import { XMTPProvider } from "@/contexts/xmtp-context";
import dynamic from "next/dynamic";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false }
);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErudaProvider>
      <FrameWalletProvider>
        <XMTPProvider>
          <MiniAppProvider addMiniAppOnLoad={true}>{children}</MiniAppProvider>
        </XMTPProvider>
      </FrameWalletProvider>
    </ErudaProvider>
  );
}
