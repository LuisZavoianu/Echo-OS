import React from 'react';
import { ImageIcon, Wand2 } from 'lucide-react';

export const ImageNode = ({ node, onUpdate }: any) => {
  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="relative h-40 rounded-lg overflow-hidden bg-black/40">
        <img 
          src={node.data.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400'} 
          className="w-full h-full object-cover opacity-80"
          alt="AI Studio Preview"
        />
        <div className="absolute top-2 left-2 bg-blue-500/80 text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1">
          <Wand2 size={10} /> AI GENERATED
        </div>
      </div>
      <textarea
        className="bg-white/5 rounded p-2 text-xs text-white/70 outline-none border-none resize-none"
        rows={2}
        placeholder="Prompt pentru AI..."
        value={node.data.content}
        onChange={(e) => onUpdate(node.id, { ...node.data, content: e.target.value })}
      />
    </div>
  );
};