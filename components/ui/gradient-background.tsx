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
      {/* Base - deep warm charcoal */}
      <div 
        className="absolute inset-0"
        style={{
          background: `oklch(0.13 0.005 60)`,
        }}
      />
      
      {/* Subtle ambient glow - top left */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.20 0.02 60 / 0.5) 0%, transparent 70%)",
          top: "-20%",
          left: "-10%",
          filter: "blur(80px)",
        }}
      />
      
      {/* Subtle ambient glow - bottom right */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.18 0.015 75 / 0.4) 0%, transparent 70%)",
          bottom: "-10%",
          right: "-5%",
          filter: "blur(60px)",
        }}
      />
      
      {/* Very subtle noise texture for depth */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Subtle vignette for depth */}
      <div 
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 0%, oklch(0.10 0.005 60 / 0.3) 100%)",
        }}
      />
    </div>
  )
}
