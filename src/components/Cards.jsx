import React, { useState } from 'react';

// Helper to isolate numbers so Childos doesn't render Eastern Arabic numerals (٣)
function renderFormattedText(text) {
  if (!text) return null;
  const parts = text.split(/(\d+)/);
  return parts.map((part, index) => {
    if (/^\d+$/.test(part)) {
      return (
        <span 
          key={index} 
          style={{ 
            fontFamily: 'system-ui, -apple-system, sans-serif', 
            WebkitTextStroke: '0px transparent',
            fontSize: 'inherit' 
          }}
          className="inline-block px-1 text-black font-sans font-black"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export function GreenCard({ text }) {
  const bgPath = `${import.meta.env.BASE_URL}green-card-bg.png`;

  return (
    <div 
      className="card relative flex flex-col justify-center items-center select-none shrink-0 rounded-3xl shadow-xl overflow-hidden p-6"
      style={{ 
        width: '440px', 
        minWidth: '440px',
        minHeight: '300px',
        height: 'auto',
        backgroundImage: `url("${bgPath}")`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        colorScheme: 'light'
      }}
    >
      <style>{`
        .green-card-text {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}</style>

      {/* Center Topic Text Only */}
      <div className="relative z-10 flex items-center justify-center py-4 px-6 text-center w-full">
        <span 
          className="font-childos green-card-text font-black leading-tight tracking-tight break-words whitespace-normal w-full block"
          style={{ fontSize: '2.5rem', color: '#000000' }}
        >
          {renderFormattedText(text)}
        </span>
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
        isSelected ? 'ring-4 ring-emerald-400 scale-105 shadow-2xl' : 'hover:scale-105'
      }`}
    />
  );
}

export function PurpleCard({ text, jp, selected, selectionIndex, onClick }) {
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
        width: '340px',
        minHeight: '240px',
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        colorScheme: 'light'
      }}
      className={`card cursor-pointer transition-all duration-200 select-none rounded-2xl shrink-0 p-6 ${
        selected 
          ? 'ring-4 ring-emerald-400 scale-105 shadow-[0_0_30px_rgba(16,185,129,0.6)]' 
          : 'hover:scale-105 shadow-lg'
      }`}
    >
      <style>{`
        .purple-card-text {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}</style>

      {/* Selection Order Badge (if selected in multi-pick) */}
      {selected && selectionIndex !== undefined && (
        <div 
          style={{ position: 'absolute', top: '10px', left: '10px' }}
          className="z-20 bg-emerald-400 text-black font-black w-8 h-8 rounded-full border-3 border-black flex items-center justify-center text-base shadow-lg animate-bounce"
          style={{ fontFamily: "'Childos Arabic', system-ui, sans-serif" }}
        >
          {selectionIndex + 1}
        </div>
      )}

      {/* Top Bar: Scaled-up JP/EN Toggle Badge */}
      <div style={{ position: 'absolute', top: '10px', right: '10px' }} className="z-20 font-sans">
        {jp && (
          <button
            type="button"
            onClick={toggleJp}
            className={`text-base font-black px-4 py-1.5 rounded-full border-3 border-black shadow-lg transition-transform duration-150 active:scale-95 ${
              showJp 
                ? 'bg-purple-600 text-yellow-300 border-black' 
                : 'bg-yellow-400 text-black hover:bg-yellow-300'
            }`}
            style={{
              fontFamily: "'Childos Arabic', system-ui, sans-serif",
              WebkitTextStroke: '0.75px #000',
            }}
          >
            {showJp ? 'EN' : 'JP'}
          </button>
        )}
      </div>
      
      {/* Center Text Area */}
      <div className="text-center px-4 z-10 w-full py-2">
        <span 
          className="font-childos purple-card-text font-bold tracking-tight leading-snug break-words whitespace-normal block w-full"
          style={{ fontSize: '2rem' }}
        >
          {renderFormattedText(text)}
        </span>
        
        {showJp && jp && (
          <div 
            style={{ color: '#4c1d95', WebkitTextFillColor: '#4c1d95' }}
            className="mt-3 text-sm font-black bg-yellow-300/95 border-2 border-purple-900 px-3.5 py-1 rounded-lg shadow-md inline-block font-sans"
          >
            {jp}
          </div>
        )}
      </div>
    </div>
  );
}