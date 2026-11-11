import React, { useState } from 'react';

export function GreenCard({ text, pick, pack }) {
  const bgPath = `${import.meta.env.BASE_URL}green-card-bg.png`;

  return (
    <div 
      className="relative flex flex-col justify-between select-none shrink-0 rounded-3xl shadow-xl overflow-hidden p-6"
      style={{ 
        width: '360px', 
        minWidth: '360px',
        minHeight: '240px',
        height: 'auto',
        backgroundImage: `url("${bgPath}")`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        colorScheme: 'light' // Fixes PC dark mode text inversion
      }}
    >
      {/* Top Bar Metadata */}
      <div className="relative z-10 flex justify-between items-center text-[11px] font-black tracking-wider text-black px-4 pt-1 font-sans">
        <span>JUDGY PROMPT</span>
        <span>{pack || 'Classic'}</span>
      </div>

      {/* Center Topic Text */}
      <div className="relative z-10 flex items-center justify-center py-6 px-6 text-center my-auto">
        <span className="text-base sm:text-lg font-bold text-black leading-snug tracking-tight break-words">
          {text}
        </span>
      </div>

      {/* Bottom Bar Metadata */}
      <div className="relative z-10 flex justify-between items-center text-[11px] font-black tracking-wider text-black px-4 pb-1 font-sans">
        <span>CORE PACK</span>
        <span>PICK {pick || 3}</span>
      </div>
    </div>
  );
}

export function CardBack({ onClick, isSelected }) {
  const bgPath = `${import.meta.env.BASE_URL}cardback.png`;

  return (
    <div 
      onClick={onClick}
      style={{ 
        backgroundImage: `url("${bgPath}")`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        width: '288px',
        minHeight: '208px',
        height: '208px',
        colorScheme: 'light'
      }}
      className={`cursor-pointer transition-all duration-200 select-none rounded-2xl shadow-lg shrink-0 ${
        isSelected ? 'ring-4 ring-emerald-500 scale-105 shadow-2xl' : 'hover:scale-105'
      }`}
    />
  );
}

export function PurpleCard({ text, jp, selected, onClick }) {
  const [showJp, setShowJp] = useState(false);
  const bgPath = `${import.meta.env.BASE_URL}purple-card-bg.png`;

  const toggleJp = (e) => {
    e.stopPropagation();
    setShowJp((prev) => !prev);
  };

  return (
    <div 
      onClick={onClick}
      style={{ 
        backgroundImage: `url("${bgPath}")`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        width: '288px',
        minHeight: '208px',
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        colorScheme: 'light' // Fixes PC dark mode text inversion
      }}
      className={`cursor-pointer transition-all duration-200 select-none rounded-2xl shadow-lg shrink-0 p-5 ${
        selected 
          ? 'ring-4 ring-emerald-500 scale-105 shadow-2xl' 
          : 'hover:scale-105'
      }`}
    >
      <style>{`
        .purple-card-text {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}</style>

      {/* Top Bar: JP Toggle Button */}
      <div style={{ position: 'absolute', top: '12px', right: '12px' }} className="z-20 font-sans">
        {jp && (
          <button
            type="button"
            onClick={toggleJp}
            className={`text-[9px] font-black px-2 py-0.5 rounded shadow-sm transition-all ${
              showJp 
                ? 'bg-purple-600 text-white' 
                : 'bg-zinc-900 text-pink-200 hover:bg-zinc-800'
            }`}
          >
            {showJp ? 'EN' : 'JP'}
          </button>
        )}
      </div>
      
      {/* Center Text Area */}
      <div className="text-center px-4 z-10 w-full py-2">
        <span className="purple-card-text text-sm font-bold tracking-tight leading-snug break-words block">
          {text}
        </span>
        
        {showJp && jp && (
          <div 
            style={{ color: '#581c87', WebkitTextFillColor: '#581c87' }}
            className="mt-2 text-[11px] font-bold bg-white/95 border border-purple-300 px-2 py-0.5 rounded shadow-sm inline-block font-sans"
          >
            {jp}
          </div>
        )}
      </div>
    </div>
  );
}