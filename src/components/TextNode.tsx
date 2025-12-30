import React from 'react';
import { Type, AlignLeft } from 'lucide-react';

export const TextNode = ({ node, onUpdate }: any) => {
  const wordCount = node.data.content.trim() ? node.data.content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2 text-white/30 text-[10px] font-bold tracking-tighter">
          <Type size={12} /> WRITER MODE
        </div>
        <div className="text-[10px] text-white/20">{wordCount} WORDS</div>
      </div>
      <textarea
        className="flex-1 bg-transparent text-white/80 outline-none resize-none border-none p-0 text-sm leading-relaxed"
        placeholder="Începe să scrii..."
        value={node.data.content}
        onChange={(e) => onUpdate(node.id, { ...node.data, content: e.target.value })}
      />
    </div>
  );
};