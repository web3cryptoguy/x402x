"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from "wagmi";
import { mainnet } from "wagmi/chains";
import { metaMask, injected } from "wagmi/connectors";
import { Wallet } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

declare global {
  interface Window {
    okxwallet?: any;
  }
}

// Check if device is mobile
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Check if in MetaMask in-app browser
function isInMetaMaskBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.ethereum?.isMetaMask && window.ethereum?.isMetaMask);
}

// Check if in OKX in-app browser
function isInOkxBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const w: any = window as any;
  // 常见 OKX 内置浏览器标识（可按需扩展）
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('okx') || ua.includes('okxwallet')) return true;
  // 注入的 okxwallet provider 但没有 MetaMask 也可以认为是在 OKX 环境
  if (w.okxwallet && !w.ethereum?.isMetaMask) return true;
  return false;
}

// Check if OKX wallet is available
function isOKXWalletAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.okxwallet || (window as any).okxwallet?.ethereum);
}

// Get wallet name from connector
function getWalletName(connectorId: string | undefined, connectorName?: string): string {
  if (!connectorId) return 'Wallet';
  const id = connectorId.toLowerCase();
  const name = connectorName?.toLowerCase() || '';
  
  if (id.includes('metamask') || id.includes('io.metamask') || name.includes('metamask')) {
    return 'MetaMask';
  }
  if (id.includes('okx') || id.includes('okxwallet') || name.includes('okx')) {
    return 'OKX Wallet';
  }
  // Check actual providers
  if (typeof window !== 'undefined') {
    if ((window as any).okxwallet && !window.ethereum?.isMetaMask) {
      return 'OKX Wallet';
    }
    if (window.ethereum?.isMetaMask) {
      return 'MetaMask';
    }
  }
  return 'Wallet';
}

export function Navbar() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const [connecting, setConnecting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isInMetaMask, setIsInMetaMask] = useState(false);
  const [isInOkx, setIsInOkx] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [isOKXAvailable, setIsOKXAvailable] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walletSelectorRef = useRef<HTMLDivElement>(null);
  const switchInProgressRef = useRef(false);
  const hasRequestedMainnetSwitchRef = useRef(false);

  // Detect device type and available wallets
  useEffect(() => {
    setIsMobile(isMobileDevice());
    setIsInMetaMask(isInMetaMaskBrowser());
    setIsInOkx(isInOkxBrowser());
    setIsOKXAvailable(isOKXWalletAvailable());
    setIsMounted(true);
  }, []);

  // Close wallet selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletSelectorRef.current && !walletSelectorRef.current.contains(event.target as Node)) {
        setShowWalletSelector(false);
      }
    };

    if (showWalletSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showWalletSelector]);

  // 连接状态变化时打印调试信息，并在「首次连接成功」时主动请求切换到以太坊主网
  useEffect(() => {
    console.log(
      "[Navbar] Connection status changed:",
      "isConnected =", isConnected,
      "chainId =", chainId,
      "mainnet.id =", mainnet.id
    );

    // 仅在「从未请求过切主网」且当前为已连接时，尝试一次 wallet_switchEthereumChain
    if (isConnected && !hasRequestedMainnetSwitchRef.current && !switchInProgressRef.current) {
      hasRequestedMainnetSwitchRef.current = true;
      switchInProgressRef.current = true;
      (async () => {
        try {
          console.log("[Navbar] Attempting to switch network to Ethereum mainnet via switchChain");
          await switchChain({ chainId: mainnet.id });
          console.log("[Navbar] switchChain to mainnet finished");
        } catch (error: any) {
          console.error("[Navbar] Failed to switch to Ethereum mainnet:", error);
        } finally {
          switchInProgressRef.current = false;
        }
      })();
    }
  }, [isConnected, chainId, switchChain]);

  // Listen to connection errors
  useEffect(() => {
    if (connectError && connecting && !isConnected) {
      setStatusError(
        `Connection failed: ${connectError.message}. If not connected after returning from wallet, please retry.`
      );
      setConnecting(false);
    }
  }, [connectError, connecting, isConnected]);

  // Listen to page visibility changes, check connection status when page regains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected && connecting) {
        // Page regained visibility and was connecting, check if connected
        setTimeout(() => {
          if (window.ethereum?.selectedAddress) {
            // Address detected, attempting to reconnect with MetaMask
            console.log('Page regained focus with address detected, attempting to reconnect...');
            if (!isConnected) {
              // If wagmi is not connected yet, attempt to reconnect with MetaMask
              try {
                connect({ 
                  connector: metaMask({
                    dappMetadata: {
                      name: 'x402x Dog',
                      url: 'https://x402x.dog',
                    },
                  })
                });
              } catch (error) {
                console.error('Reconnection error:', error);
                setConnecting(false);
              }
            } else {
              setConnecting(false);
            }
          } else if ((window as any).okxwallet?.selectedAddress) {
            // OKX wallet detected, attempt to reconnect
            console.log('Page regained focus with OKX address detected, attempting to reconnect...');
            if (!isConnected) {
              try {
                // Find OKX connector from available connectors
                const okxConnector = connectors.find(c => {
                  const id = c.id.toLowerCase();
                  return id.includes('okx') || id.includes('okxwallet');
                });
                if (okxConnector) {
                  connect({ connector: okxConnector });
                }
              } catch (error) {
                console.error('Reconnection error:', error);
                setConnecting(false);
              }
            } else {
              setConnecting(false);
            }
          } else {
            setConnecting(false);
          }
        }, 1500); // Give wallet some time to initialize
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isConnected, connecting, connect]);

  // Handle wallet connection with specific connector
  const handleConnectWallet = async (selectedConnector?: any) => {
    try {
      console.log('handleConnectWallet called with:', selectedConnector);
      
      if (!selectedConnector) {
        console.error('No connector provided');
        setStatusError('No wallet connector selected.');
        setShowWalletSelector(false);
        return;
      }
      
      setConnecting(true);
      setStatusError(null);
      
      // Determine which connector to use - create new instance like reference project
      let connectorToUse;
      const id = selectedConnector.id?.toLowerCase() || '';
      const name = selectedConnector.name?.toLowerCase() || '';
      
      console.log('Connector ID:', id, 'Name:', name);
      
        if (id.includes('metamask') || id.includes('io.metamask') || name.includes('metamask')) {
          // Create new MetaMask connector instance
          console.log('Using MetaMask connector');
          connectorToUse = metaMask({
            dappMetadata: {
              name: 'x402x Dog',
              url: 'https://x402x.dog',
            },
          });
        } else if (id.includes('okx') || id.includes('okxwallet') || name.includes('okx')) {
        // Use the selected OKX connector
        console.log('Using OKX connector');
        connectorToUse = selectedConnector;
      } else {
        console.log('Using provided connector as-is');
        connectorToUse = selectedConnector;
      }
      
      if (!connectorToUse) {
        console.error('Failed to create connector');
        setStatusError('No wallet available. Please install MetaMask or OKX Wallet.');
        setConnecting(false);
        setShowWalletSelector(false);
        return;
      }
      
      // Mobile-specific handling for MetaMask / OKX
      const isMetaMaskConnector = connectorToUse.id?.toLowerCase().includes('metamask') || 
                                  connectorToUse.id?.toLowerCase().includes('io.metamask');
      const isOkxConnector = connectorToUse.id?.toLowerCase().includes('okx') || 
                             connectorToUse.id?.toLowerCase().includes('okxwallet');
      if (isMobile && !isInMetaMask && isMetaMaskConnector) {
        setStatusError(
          'Please open this page in MetaMask app browser first'
        );
        setConnecting(false);
        setShowWalletSelector(false);
        return;
      }
      if (isMobile && !isInOkx && isOkxConnector) {
        setStatusError(
          'Please open this page in OKX Wallet in-app browser first.\n\n' +
          '检测到你使用的是移动端浏览器，请在 OKX 钱包内置浏览器中打开本页面后再连接钱包。'
        );
        setConnecting(false);
        setShowWalletSelector(false);
        return;
      }
      
      // 发起连接，不强制指定链 ID，交由后续自动切主网逻辑处理
      console.log('Connecting with connector (no explicit chainId):', connectorToUse);
      connect({ connector: connectorToUse });
      
      // Close window after a short delay to ensure connection has started
      setTimeout(() => {
        setShowWalletSelector(false);
      }, 200);
      
      // Clear previous timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      // Set timeout if connection fails
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnected) {
          setConnecting(false);
          // If on mobile and ethereum address detected, notify user may need to open in in-app browser
          if (isMobile && (window.ethereum?.selectedAddress || (window as any).okxwallet?.selectedAddress)) {
            setStatusError(
              'Wallet address detected but connection incomplete. Please ensure you are in the wallet app browser, then retry.'
            );
          } else {
            setStatusError(
              'Connection timeout. If not connected after returning from wallet, please retry.'
            );
          }
        }
      }, 15000);
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      setStatusError(
        `Connection error: ${error?.message || 'Unknown error'}`
      );
      setConnecting(false);
    }
  };

  // Clean up timeout timer
  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, []);

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      // Only show MetaMask and OKX wallets
      const availableWallets = getAvailableWallets();
      
      if (availableWallets.length > 1) {
        setShowWalletSelector(true);
      } else if (availableWallets.length === 1) {
        handleConnectWallet(availableWallets[0].connector);
      } else {
        setStatusError('No supported wallet found. Please install MetaMask or OKX Wallet.');
      }
    }
  };

  // Get available wallet connectors - only MetaMask and OKX
  const getAvailableWallets = () => {
    const available: any[] = [];
    const seenTypes = new Set<string>();
    
    connectors.forEach(c => {
      // 防御：有些连接器可能缺少 id 或 name，需跳过
      if (!c || !c.id) return;

      const id = c.id.toLowerCase();
      const name = c.name?.toLowerCase() || '';
      
      // Only allow MetaMask - check if we already have MetaMask
      if ((id.includes('metamask') || id.includes('io.metamask') || name.includes('metamask')) && !seenTypes.has('metamask')) {
        available.push({ connector: c, name: 'MetaMask', type: 'metamask' });
        seenTypes.add('metamask');
        return;
      }
      
      // Only allow OKX - check if we already have OKX
      if ((id.includes('okx') || id.includes('okxwallet') || name.includes('okx')) && !seenTypes.has('okx')) {
        available.push({ connector: c, name: 'OKX Wallet', type: 'okx' });
        seenTypes.add('okx');
        return;
      }
    });
    
    return available;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 w-full px-4 sm:px-8 py-6 flex justify-between items-center z-50 bg-[#1a1b26]/90 backdrop-blur-sm border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 border-4 border-black pixel-shadow"></div>
        <span className="font-press text-white text-lg sm:text-xl pixel-text-shadow tracking-widest hidden sm:block">
          x402x <span className="text-yellow-400">Dog</span>
        </span>
      </div>
      <div className="relative">
      <button
        onClick={handleConnect}
          disabled={connecting}
          className={`relative px-6 py-3 font-press text-xs sm:text-sm uppercase tracking-wider transition-all active:translate-y-1 active:shadow-none pixel-corners border-2 pixel-shadow border-black ${
            connecting
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : isConnected
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-[#60a5fa] text-white hover:bg-[#3b82f6]'
          }`}
      >
        <div className="flex items-center justify-center gap-2">
            {connecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="font-press">Connecting...</span>
              </>
            ) : (
              <>
          <Wallet className="w-4 h-4" />
          <span className="font-press">
            {isConnected
              ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
              : "Connect Wallet"}
          </span>
              </>
            )}
        </div>
      </button>
        
        {/* Wallet selector modal - rendered via portal for proper z-index */}
        {isMounted && showWalletSelector && !isConnected && typeof document !== 'undefined' ? createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md"
            onClick={(e) => {
              // Only close if clicking directly on the backdrop, not on the modal content
              if (e.target === e.currentTarget) {
                setShowWalletSelector(false);
              }
            }}
            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          >
            <div 
              ref={walletSelectorRef}
              className="relative bg-[#1a1b26] border-4 border-[#3b82f6] pixel-corners pixel-shadow w-full max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div className="bg-[#2a2b36] border-b-2 border-[#3b82f6] px-4 py-3 flex items-center justify-between">
                <h2 className="font-press text-white text-lg uppercase tracking-wider">
                  SELECT WALLET
                </h2>
                <button
                  onClick={() => setShowWalletSelector(false)}
                  className="text-white hover:text-gray-300 transition-colors font-press text-xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              
              {/* Wallet options */}
              <div className="p-4 space-y-2">
                {getAvailableWallets().map((wallet) => {
                  const isOKX = wallet.type === 'okx';
                  const isMetaMask = wallet.type === 'metamask';
                  return (
                    <button
                      key={wallet.connector.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Button clicked for wallet:', wallet.name, wallet.connector);
                        // Directly call handleConnectWallet
                        handleConnectWallet(wallet.connector);
                      }}
                      className="w-full flex items-center gap-4 px-4 py-3 bg-[#2a2b36] border-2 border-[#3b82f6] pixel-corners hover:bg-[#3a3b46] transition-colors text-left cursor-pointer"
                    >
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                        {isMetaMask ? (
                          <Image
                            src="/MetaMask.svg"
                            alt="MetaMask"
                            width={40}
                            height={40}
                            className="w-10 h-10"
                          />
                        ) : isOKX ? (
                          <Image
                            src="/OKX_wallet.svg"
                            alt="OKX Wallet"
                            width={40}
                            height={40}
                            className="w-10 h-10"
                          />
                        ) : null}
                      </div>
                      <span className="font-press text-white text-base uppercase">
                        {wallet.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        ) : null}
        
        {/* Error message */}
        {statusError && !isConnected && !connecting && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-red-50 border border-red-200 rounded-lg p-3 z-50">
            <p className="text-xs text-red-700 break-words">
              {statusError}
            </p>
            <p className="text-xs text-red-600 mt-2">
              If not connected after returning from wallet, please click the button to reconnect
            </p>
          </div>
        )}
      </div>
    </nav>
  );
}

