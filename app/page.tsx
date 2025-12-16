import { Navbar } from "@/components/Navbar";
import { NFTDisplay } from "@/components/NFTDisplay";
import { MintSection } from "@/components/MintSection";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#1a1b26]">
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px),
            linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      ></div>

      <Navbar />

      <main className="grow flex items-center justify-center px-4 py-8 md:py-12 pt-24 md:pt-32 relative z-10 min-h-screen">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-4 md:gap-12 items-start">
          {/* Desktop NFT Display */}
          <div className="hidden md:flex justify-center order-2 md:order-1 sticky top-32 h-[calc(100vh-10rem)] items-center">
            <NFTDisplay />
          </div>

          {/* Mobile NFT Display */}
          <div className="flex md:hidden justify-center order-1 md:order-1 mb-2">
            <NFTDisplay className="scale-90 sm:scale-100" />
          </div>

          {/* Mint Section */}
          <MintSection />
        </div>
      </main>
    </div>
  );
}

