"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/config/wagmi";
import { useState, useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // 静默处理 MetaMask SDK 的自动连接错误（当使用其他钱包时）
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let errorMessage = '';
      
      // 尝试多种方式提取错误信息
      if (reason) {
        if (typeof reason === 'string') {
          errorMessage = reason;
        } else if (reason?.message) {
          errorMessage = reason.message;
        } else if (reason?.toString) {
          errorMessage = reason.toString();
        } else if (reason?.error?.message) {
          errorMessage = reason.error.message;
        }
      }
      
      const errorString = errorMessage.toLowerCase();
      const stackString = (reason?.stack || '').toLowerCase();
      
      // 静默处理 MetaMask SDK 的自动连接错误
      if (
        errorString.includes('failed to connect to metamask') ||
        errorString.includes('metamask extension not found') ||
        errorString.includes('metamask') ||
        stackString.includes('inpage.js') ||
        stackString.includes('metamask')
      ) {
        event.preventDefault();
        event.stopPropagation();
        // 只在开发环境输出调试信息
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Providers] Silenced MetaMask SDK auto-connect error (using other wallet)');
        }
        return false;
      }
    };

    const handleError = (event: ErrorEvent) => {
      const errorMessage = (event.message || event.error?.message || '').toLowerCase();
      const filename = (event.filename || '').toLowerCase();
      
      // 静默处理 MetaMask SDK 相关的错误
      if (
        errorMessage.includes('failed to connect to metamask') ||
        errorMessage.includes('metamask extension not found') ||
        filename.includes('inpage.js') ||
        filename.includes('metamask')
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Providers] Silenced MetaMask SDK error (using other wallet)');
        }
        return false;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

