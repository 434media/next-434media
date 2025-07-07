"use client"

export function FloatingElements() {
  return (
    <>
      {/* Enhanced floating elements with better animations */}
      <div className="absolute top-1/4 left-1/4 w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-500 rounded-full animate-float-slow opacity-20 shadow-lg"></div>
      <div className="absolute top-3/4 left-1/3 w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full animate-float-medium opacity-25 shadow-lg"></div>
      <div className="absolute top-1/2 right-1/4 w-6 h-6 bg-gradient-to-br from-cyan-400 to-cyan-500 rounded-full animate-float-fast opacity-30 shadow-lg"></div>
      <div className="absolute bottom-1/4 right-1/3 w-7 h-7 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full animate-float-slow opacity-20 shadow-lg"></div>

      {/* Additional geometric shapes */}
      <div className="absolute top-1/3 left-1/2 w-4 h-4 bg-gradient-to-br from-cyan-300 to-cyan-400 rotate-45 animate-float-medium opacity-15 shadow-md"></div>
      <div className="absolute bottom-1/3 left-1/5 w-5 h-5 bg-gradient-to-br from-yellow-300 to-yellow-400 rotate-12 animate-float-fast opacity-25 shadow-md"></div>

      {/* Subtle light rays */}
      <div className="absolute top-0 left-1/4 w-px h-32 bg-gradient-to-b from-cyan-400/30 to-transparent animate-pulse"></div>
      <div className="absolute top-0 right-1/3 w-px h-24 bg-gradient-to-b from-yellow-400/30 to-transparent animate-pulse delay-1000"></div>

      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { 
            transform: translateY(0) translateX(0) rotate(0deg) scale(1); 
          }
          25% { 
            transform: translateY(-20px) translateX(10px) rotate(90deg) scale(1.1); 
          }
          50% { 
            transform: translateY(-30px) translateX(15px) rotate(180deg) scale(0.9); 
          }
          75% { 
            transform: translateY(-15px) translateX(5px) rotate(270deg) scale(1.05); 
          }
        }
        @keyframes float-medium {
          0%, 100% { 
            transform: translateY(0) translateX(0) rotate(0deg) scale(1); 
          }
          33% { 
            transform: translateY(-15px) translateX(-10px) rotate(-120deg) scale(1.15); 
          }
          66% { 
            transform: translateY(-25px) translateX(-5px) rotate(-240deg) scale(0.85); 
          }
        }
        @keyframes float-fast {
          0%, 100% { 
            transform: translateY(0) translateX(0) rotate(0deg) scale(1); 
          }
          50% { 
            transform: translateY(-10px) translateX(8px) rotate(180deg) scale(1.2); 
          }
        }
        .animate-float-slow {
          animation: float-slow 15s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 10s ease-in-out infinite;
        }
        .animate-float-fast {
          animation: float-fast 7s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}
