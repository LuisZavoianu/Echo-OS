import React from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Image as ImageIcon, 
  Folder, 
  Brain, 
  Wand2, 
  Settings 
} from 'lucide-react';

interface DockItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}

const DockItem = ({ icon, label, onClick, color }: DockItemProps) => (
  <motion.button
    whileHover={{ 
      y: -15, 
      scale: 1.2,
      transition: { type: "spring", stiffness: 300 } 
    }}
    onClick={onClick}
    className="relative group flex flex-col items-center"
  >
    <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-white/10 backdrop-blur-md px-2 py-1 rounded text-xs text-white border border-white/20">
      {label}
    </div>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl border border-white/20 bg-gradient-to-br ${color} backdrop-blur-lg`}>
      {icon}
    </div>
  </motion.button>
);

interface DockProps {
  onCreateNode: (type: any) => void;
}

export const Dock = ({ onCreateNode }: DockProps) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-4 px-6 py-4 bg-black/20 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <DockItem 
          icon={<FileText size={24} />} 
          label="Writer" 
          color="from-blue-500/40 to-blue-600/40" 
          onClick={() => onCreateNode('intent')} 
        />
        <DockItem 
          icon={<ImageIcon size={24} />} 
          label="Studio" 
          color="from-purple-500/40 to-purple-600/40" 
          onClick={() => onCreateNode('hypothesis')} 
        />
        <DockItem 
          icon={<Folder size={24} />} 
          label="Folder" 
          color="from-amber-500/40 to-amber-600/40" 
          onClick={() => onCreateNode('memory')} 
        />
<div className="w-px h-8 bg-white/10 mx-2" />
        <DockItem 
          icon={<Wand2 size={24} />} 
          label="AI Magic" 
          color="from-pink-500/40 to-pink-600/40" 
          // Schimbăm alert-ul cu funcția care creează nodul de procesare
          onClick={() => onCreateNode('ai-process')} 
        />
        <DockItem 
          icon={<Brain size={24} />} 
          label="Insights" 
          color="from-emerald-500/40 to-emerald-600/40" 
          onClick={() => alert('Opening Brain Analytics...')} 
        />
        <DockItem 
          icon={<Settings size={24} />} 
          label="Settings" 
          color="from-gray-500/40 to-gray-600/40" 
          onClick={() => alert('Settings Panel')} 
        />
      </motion.div>
    </div>
  );
};