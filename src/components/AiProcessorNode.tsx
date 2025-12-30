import React, { useState } from 'react';
import { Sparkles, Brain, Loader2, Zap } from 'lucide-react';
import { analyzeTextLocally } from '../core/localAi';

export const AiProcessorNode = ({ allNodes, setNodes }: any) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  const processWithAI = async () => {
    const source = allNodes.find((n: any) => n.data.type === 'intent' && n.data.content);
    const target = allNodes.find((n: any) => n.data.type === 'hypothesis');

    if (!source || !target) return alert("Ai nevoie de un nod Writer și unul Studio!");

    setStatus('loading');
    try {
      const result = await analyzeTextLocally(source.data.content);
      
      // Logica de "Generare" vizuală bazată pe sentimentul AI
      const isPositive = result.label === 'POSITIVE';
      const style = isPositive ? 'vibrant,light,peaceful' : 'dark,cinematic,dramatic';
      const randomId = Math.floor(Math.random() * 1000);
      
      const newImageUrl = `https://loremflickr.com/800/600/${style}/all?lock=${randomId}`;

      setNodes((prev: any[]) => prev.map(n => 
        n.id === target.id ? { ...n, data: { ...n.data, imageUrl: newImageUrl } } : n
      ));
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error(err);
      setStatus('idle');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className={`w-20 h-20 rounded-2xl mb-4 flex items-center justify-center transition-all duration-500 ${
        status === 'loading' ? 'bg-pink-500/20 animate-spin' : 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10'
      }`}>
        {status === 'loading' ? <Loader2 className="text-pink-500" /> : <Brain className="text-indigo-400" size={40} />}
      </div>
      
      <h3 className="text-white font-bold text-xs tracking-widest mb-1 uppercase">Local Neuro-Engine</h3>
      <p className="text-[9px] text-white/30 mb-6 uppercase tracking-tighter leading-none">Powered by DistilBERT</p>

      <button 
        onClick={processWithAI}
        disabled={status === 'loading'}
        className={`w-full py-3 rounded-xl font-bold text-[10px] tracking-[0.2em] transition-all ${
          status === 'loading' 
            ? 'bg-white/5 text-white/20' 
            : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20 active:scale-95'
        }`}
      >
        {status === 'loading' ? 'PROCESSING...' : status === 'done' ? 'COMPLETE' : 'EXECUTE AI PIPELINE'}
      </button>
    </div>
  );
};