"use client"

import { useEffect, useState } from "react"

export const GradientBackground = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient layer */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 40%, oklch(0.55 0.18 45 / 0.4), transparent 50%),
            radial-gradient(ellipse 60% 60% at 80% 20%, oklch(0.5 0.15 280 / 0.3), transparent 50%),
            radial-gradient(ellipse 70% 50% at 60% 80%, oklch(0.45 0.2 250 / 0.25), transparent 50%),
            oklch(0.12 0 0)
          `,
        }}
      />
      
      {/* Animated floating orbs */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full blur-3xl"
        style={{
          background: "oklch(0.55 0.2 40 / 0.3)",
          top: "10%",
          left: "-10%",
          animation: "float 20s ease-in-out infinite",
        }}
      />
      
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
        style={{
          background: "oklch(0.5 0.18 280 / 0.25)",
          top: "50%",
          right: "-15%",
          animation: "float 25s ease-in-out infinite reverse",
        }}
      />
      
      <div 
        className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
        style={{
          background: "oklch(0.55 0.22 250 / 0.2)",
          bottom: "10%",
          left: "30%",
          animation: "float 18s ease-in-out infinite",
          animationDelay: "-5s",
        }}
      />

      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Vignette effect */}
      <div 
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, oklch(0.08 0 0 / 0.4) 100%)",
        }}
      />
    </div>
  )
}

