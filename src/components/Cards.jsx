import React, { useState } from 'react';

export function GreenCard({ text, pick, pack }) {
  return (
    <div 
      className="relative flex flex-col justify-between select-none shrink-0 rounded-3xl shadow-xl overflow-hidden bg-[#b2ec9b] p-6 font-childos"
      style={{ 
        width: '360px', 
        height: '240px',
        minWidth: '360px',
        minHeight: '240px'
      }}
    >
      {/* Background Image Layer */}
      <div 
        className="absolute inset-0 z-0 bg-contain bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url('/green-card-bg.png')` }}
      />

      {/* Top Bar Metadata */}
      <div className="relative z-10 flex justify-between items-center text-[11px] font-black tracking-wider text-black px-4 pt-1">
        <span>JUDGY PROMPT</span>
        <span>{pack || 'CORE'}</span>
      </div>

      {/* Center Topic Text */}
      <div className="relative z-10 flex items-center justify-center my-auto px-10 text-center">
        <span className="text-base font-black text-black leading-snug tracking-tight">
          {text}
        </span>
      </div>

      {/* Bottom Bar Metadata */}
      <div className="relative z-10 flex justify-between items-center text-[11px] font-black tracking-wider text-black px-4 pb-1">
        <span>CORE PACK</span>
        <span>PICK {pick || 3}</span>
      </div>
    </div>
  );
}

export function PurpleCard({ text, jp, selected, onClick }) {
  const [showJp, setShowJp] = useState(false);

  const toggleJp = (e) => {
    e.stopPropagation();
    setShowJp((prev) => !prev);
  };

  return (
    <div 
      onClick={onClick}
      style={{ 
        backgroundImage: `url('/purple-card-bg.png')`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        width: '288px',
        height: '208px',
        minWidth: '288px',
        minHeight: '208px',
        maxWidth: '288px',
        maxHeight: '288px',
        display: 'grid',
        placeItems: 'center',
        position: 'relative'
      }}
      className={`cursor-pointer transition-all duration-200 select-none rounded-2xl shadow-lg shrink-0 p-4 font-childos ${
        selected 
          ? 'ring-4 ring-emerald-500 scale-105 shadow-2xl' 
          : 'hover:scale-105'
      }`}
    >
      {/* Scoped style tag to force absolute black text inside this specific card */}
      <style>{`
        .purple-card-text {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}</style>

      {/* Top Bar: JP Toggle Button */}
      <div style={{ position: 'absolute', top: '12px', right: '12px' }} className="z-20">
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
      <div className="text-center px-6 z-10 w-full">
        <span 
          className="purple-card-text text-sm font-black tracking-tight leading-snug break-words block"
        >
          {text}
        </span>
        
        {showJp && jp && (
          <div 
            style={{ color: '#581c87', WebkitTextFillColor: '#581c87' }}
            className="mt-1 text-[11px] font-bold bg-white/95 border border-purple-300 px-2 py-0.5 rounded shadow-sm inline-block"
          >
            {jp}
          </div>
        )}
      </div>
    </div>
  );
}