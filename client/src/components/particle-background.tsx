// Star shape component
function StarShape({ size, className }: { size: number; className: string }) {
  const starSize = size * 4;
  return (
    <svg
      width={starSize}
      height={starSize}
      viewBox="0 0 24 24"
      className={className}
      style={{ 
        filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.5))',
      }}
    >
      <path
        d="M12 1 L16 8 L23 12 L16 16 L12 23 L8 16 L1 12 L8 8 Z"
        fill="url(#starGradient)"
        className="opacity-80"
      />
      <defs>
        <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(59, 130, 246)" />
          <stop offset="50%" stopColor="rgb(139, 92, 246)" />
          <stop offset="100%" stopColor="rgb(236, 72, 153)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function ParticleBackground() {
  const particles = [
    { size: 4, top: "20%", left: "10%", animation: "animate-float" },
    { size: 6, top: "60%", left: "80%", animation: "animate-float-delayed" },
    { size: 3, top: "40%", left: "25%", animation: "animate-float-slow" },
    { size: 5, top: "80%", left: "60%", animation: "animate-float" },
    { size: 2, top: "15%", left: "70%", animation: "animate-float-delayed" },
    { size: 4, top: "70%", left: "15%", animation: "animate-float-slow" },
    { size: 3, top: "30%", left: "90%", animation: "animate-float" },
    { size: 5, top: "90%", left: "30%", animation: "animate-float-delayed" },
    { size: 2, top: "45%", left: "5%", animation: "animate-float-slow" },
    { size: 4, top: "10%", left: "45%", animation: "animate-float" },
    { size: 3, top: "75%", left: "85%", animation: "animate-float-delayed" },
    { size: 6, top: "25%", left: "65%", animation: "animate-float-slow" },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Dynamic gradient background */}
      <div className="absolute inset-0 animate-gradient-shift opacity-80"></div>
      
      {/* Floating star particles */}
      {particles.map((particle, index) => (
        <div
          key={index}
          className={`absolute ${particle.animation}`}
          style={{
            top: particle.top,
            left: particle.left,
          }}
        >
          <StarShape 
            size={particle.size} 
            className="hover:scale-110 transition-transform duration-300" 
          />
        </div>
      ))}
      
      {/* Additional smaller star particles */}
      {particles.slice(0, 6).map((particle, index) => (
        <div
          key={`small-${index}`}
          className={`absolute ${particle.animation}`}
          style={{
            top: `${parseFloat(particle.top) + 10}%`,
            left: `${parseFloat(particle.left) + 5}%`,
            animationDelay: "1s",
          }}
        >
          <StarShape 
            size={particle.size * 0.7} 
            className="opacity-60 hover:scale-110 transition-transform duration-300" 
          />
        </div>
      ))}
    </div>
  );
}
