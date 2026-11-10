import React from 'react';

export function GreenCard({ text, pick }) {
  return (
    <div className="w-80 h-96 bg-emerald-700 text-white p-8 rounded-2xl shadow-2xl flex flex-col justify-between border-4 border-emerald-500 font-sans select-none">
      <div className="text-xs font-black tracking-widest uppercase opacity-80">
        JUDGY PROMPT
      </div>
      
      <div className="text-2xl font-extrabold leading-snug tracking-wide my-auto text-emerald-50">
        {text}
      </div>
      
      <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest opacity-90 pt-4 border-t border-emerald-600/60">
        <span>CORE PACK</span>
        <span>PICK {pick || 1}</span>
      </div>
    </div>
  );
}

export function PurpleCard({ text, selected, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`w-52 h-72 bg-zinc-900 text-white p-6 rounded-xl shadow-xl flex flex-col justify-between border-2 cursor-pointer transition-all duration-200 select-none ${
        selected 
          ? 'border-emerald-400 ring-4 ring-emerald-500/40 -translate-y-2 bg-zinc-800' 
          : 'border-zinc-700 hover:border-purple-500 hover:-translate-y-1'
      }`}
    >
      <div className="text-[10px] font-bold tracking-wider uppercase text-purple-400 opacity-60">
        JUDGY
      </div>
      
      <div className="text-base font-bold leading-snug text-zinc-100 my-auto">
        {text}
      </div>
      
      <div className="text-[9px] font-black uppercase tracking-widest text-right text-zinc-600">
        RESPONSE
      </div>
    </div>
  );
}