# X402X NFT Mint

基于 Next.js + React + Tailwind + wagmi + viem + bun 构建的 BSC 链上像素艺术 NFT 铸造平台。

## 技术栈

- **Next.js 14** - React 框架（App Router）
- **React 18** - UI 库
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **wagmi** - React Hooks for Ethereum
- **viem** - 类型安全的以太坊库
- **bun** - 快速包管理器和运行时

## 项目结构

```
x402x/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 主页
│   ├── providers.tsx      # Wagmi 和 React Query 提供者
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   ├── Navbar.tsx        # 导航栏（钱包连接）
│   ├── NFTDisplay.tsx    # NFT 展示组件
│   └── MintSection.tsx   # 铸造功能组件
├── config/               # 配置文件
│   └── wagmi.ts         # Wagmi 配置
├── public/              # 静态资源
│   └── nft-placeholder.png
└── package.json
```

## 安装和运行

### 使用 bun（推荐）

```bash
# 安装依赖
bun install

# 开发模式
bun dev

# 构建生产版本
bun build

# 启动生产服务器
bun start
```

### 使用 npm/yarn

```bash
# 安装依赖
npm install
# 或
yarn install

# 开发模式
npm run dev
# 或
yarn dev

# 构建生产版本
npm run build
# 或
yarn build
```

访问 `http://localhost:3000` 查看应用。

## 环境变量

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

## 功能特性

- ✅ 钱包连接（MetaMask, WalletConnect, 注入式钱包）
- ✅ BSC 网络支持
- ✅ NFT 铸造界面
- ✅ 实时铸造状态
- ✅ 像素艺术风格 UI
- ✅ 响应式设计

## 配置说明

### 智能合约配置

在 `components/MintSection.tsx` 中配置你的智能合约：

```typescript
const CONTRACT_ADDRESS = "0x..." as `0x${string}`;
const CONTRACT_ABI = [...]; // 你的合约 ABI
```

### 网络配置

在 `config/wagmi.ts` 中可以添加或修改支持的网络。

## 开发

### 添加新组件

在 `components/` 目录下创建新的 `.tsx` 文件。

### 样式定制

- 全局样式：`app/globals.css`
- Tailwind 配置：`tailwind.config.ts`
- 自定义工具类在 `globals.css` 的 `@layer utilities` 中定义

## 注意事项

1. **合约地址和 ABI**：需要在实际部署前更新 `MintSection.tsx` 中的合约信息
2. **图片资源**：确保 `public/nft-placeholder.png` 存在
3. **WalletConnect**：需要配置 WalletConnect Project ID
4. **网络**：默认支持 BSC 主网和测试网

## 后续开发

- [ ] 添加后端 API 集成
- [ ] 实现 NFT 元数据获取
- [ ] 添加用户 NFT 展示页面
- [ ] 实现批量铸造功能
- [ ] 添加交易历史记录

## 许可证

MIT
