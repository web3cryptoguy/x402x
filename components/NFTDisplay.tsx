"use client";

import Image from "next/image";

interface NFTDisplayProps {
  className?: string;
}

export function NFTDisplay({ className = "" }: NFTDisplayProps) {
  return (
    <div className={`relative group ${className}`}>
      <div className="absolute -inset-4 bg-gradient-to-r from-yellow-400 to-orange-500 opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500"></div>
      <div className="relative inline-block animate-float shrink-0">
        <div className="bg-slate-800 border-4 border-black p-1 relative pixel-shadow z-10">
          <div className="border-t-4 border-l-4 border-white/10 border-b-4 border-r-4 border-black/50 p-3 sm:p-4 bg-slate-800">
            {/* Corner decorations */}
            <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-slate-600 border border-black shadow-[1px_1px_0_rgba(0,0,0,0.5)]"></div>
            <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-slate-600 border border-black shadow-[1px_1px_0_rgba(0,0,0,0.5)]"></div>
            <div className="absolute bottom-2 left-2 w-1.5 h-1.5 bg-slate-600 border border-black shadow-[1px_1px_0_rgba(0,0,0,0.5)]"></div>
            <div className="absolute bottom-2 right-2 w-1.5 h-1.5 bg-slate-600 border border-black shadow-[1px_1px_0_rgba(0,0,0,0.5)]"></div>
            
            {/* Top dots */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1">
              <div className="w-3 h-1 bg-black/50 rounded-full"></div>
              <div className="w-3 h-1 bg-black/50 rounded-full"></div>
              <div className="w-3 h-1 bg-black/50 rounded-full"></div>
            </div>

            {/* Image container */}
            <div className="relative bg-slate-900 border-4 border-black shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] overflow-hidden group-hover:shadow-[inset_0_0_30px_rgba(251,191,36,0.1)] transition-all duration-500">
              {/* Scanline effect */}
              <div
                className="absolute inset-0 pointer-events-none z-20 opacity-20 mix-blend-overlay"
                style={{
                  background: `linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
                    linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))`,
                  backgroundSize: "100% 2px, 3px 100%",
                }}
              ></div>
              <div className="absolute -top-[100%] -right-[100%] w-[200%] h-[200%] bg-gradient-to-b from-white/5 via-transparent to-transparent -rotate-45 pointer-events-none z-20"></div>
              
              <div className="w-[260px] h-[260px] sm:w-[300px] sm:h-[300px] relative bg-[#e5e5e5]">
                <Image
                  src="/nft-placeholder.png"
                  alt="X402X Mystery Box"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 640px) 260px, 300px"
                />
                <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.2)] pointer-events-none"></div>
              </div>
            </div>

            {/* Bottom status lights */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 items-center">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse delay-75 shadow-[0_0_8px_rgba(234,179,8,0.6)]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

