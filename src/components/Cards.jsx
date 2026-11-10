import React, { useState } from 'react';

export function GreenCard({ text, pick, pack }) {
  return (
    <div 
      style={{ width: '320px', height: '208px', minWidth: '320px', minHeight: '208px' }}
      className="bg-emerald-900 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between border-4 border-dashed border-emerald-400 select-none shrink-0"
    >
      <div className="flex justify-between items-center text-xs font-bold text-emerald-200">
        <span>JUDGY PROMPT</span>
        <span>{pack || 'CORE'}</span>
      </div>
      <div className="text-xl font-black text-center my-auto">
        {text}
      </div>
      <div className="flex justify-between items-center text-xs font-bold text-emerald-200">
        <span>CORE PACK</span>
        <span>PICK {pick || 1}</span>
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
      className={`cursor-pointer transition-all duration-200 select-none rounded-2xl shadow-lg shrink-0 p-4 ${
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
          className="purple-card-text text-xs font-black tracking-tight leading-snug break-words block"
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