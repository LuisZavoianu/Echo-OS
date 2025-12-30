import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Search, Plus, Zap, Brain, Target, HelpCircle, CheckCircle, AlertTriangle, 
  Activity, Sparkles, Eye, Trash2, Copy, Download, Upload, Maximize2, 
  Minimize2, Save, Clock, Layers, Grid, Filter, Command, Undo, Redo,
  FolderPlus, FileText, Image, Code, Mic, Folder, ExternalLink, Terminal
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type NodeType = 'intent' | 'hypothesis' | 'decision' | 'memory' | 'conflict' | 'note' | 'image' | 'code' | 'voice'| 'folder' | 'kernel-script';
type NodeStatus = 'idle' | 'processing' | 'validated' | 'error';
type ViewMode = 'canvas' | 'minimap' | 'both';

interface Position { x: number; y: number; }
interface Size { width: number; height: number; }

interface EchoNodeData {
  label: string;
  type: NodeType;
  content: string;
  status: NodeStatus;
  imageUrl?: string;
  codeLanguage?: string;
  audioUrl?: string;
  metadata?: {
    confidence?: number;
    impact?: 'high' | 'medium' | 'low';
    timestamp: number;
    tags?: string[];
    color?: string;
  };
}

interface Node {
  id: string;
  position: Position;
  size: Size;
  data: EchoNodeData;
  zIndex: number;
}

interface Edge {
  id: string;
  from: string;
  to: string;
  validated: boolean;
  label?: string;
}

interface ContextMenu {
  show: boolean;
  position: Position;
  nodeId: string | null;
}

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const runKernelScript = (scriptCode: string) => {
  try {
    const runtime = new Function(
      'nodes', 
      'setNodes', 
      'edges', 
      'setEdges', 
      'createNode', 
      'nodeTypeConfig', // Injectăm și configurarea pentru dimensiuni default
      scriptCode
    );

    // Rulăm runtime-ul trecându-i referințele corecte
    runtime(nodes, setNodes, edges, setEdges, createNode, nodeTypeConfig);
    
    console.log("OS: Script executed successfully.");
  } catch (error) {
    console.error("Kernel Panic:", error);
  }
};

const calculatePipePath = (from: Position, to: Position): string => {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const offset = Math.min(Math.abs(dx), Math.abs(dy)) * 0.5;
  
  return `M ${from.x} ${from.y} C ${from.x + offset} ${from.y}, ${to.x - offset} ${to.y}, ${to.x} ${to.y}`;
};

const calculateCognitiveLoad = (nodeCount: number, edgeCount: number): number => {
  return (nodeCount * 2) + (edgeCount * 1.5);
};

const getLoadColor = (load: number): string => {
  if (load < 20) return 'text-green-400';
  if (load < 50) return 'text-yellow-400';
  return 'text-red-400';
};

const getLoadBg = (load: number): string => {
  if (load < 20) return 'bg-green-500/20';
  if (load < 50) return 'bg-yellow-500/20';
  return 'bg-red-500/20';
};

const detectConflicts = (nodes: Node[], edges: Edge[]): string[] => {
  const conflicts: string[] = [];
  const conflictKeywords = [
    ['cheap', 'expensive', 'premium', 'budget', 'costly'],
    ['fast', 'slow', 'quick', 'delayed', 'rapid'],
    ['simple', 'complex', 'easy', 'difficult', 'complicated'],
    ['secure', 'risky', 'unsafe', 'vulnerable', 'dangerous'],
    ['agree', 'disagree', 'conflict', 'oppose'],
    ['increase', 'decrease', 'reduce', 'grow', 'shrink']
  ];

  edges.forEach(edge => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (fromNode && toNode) {
      const fromContent = fromNode.data.content.toLowerCase();
      const toContent = toNode.data.content.toLowerCase();
      
      conflictKeywords.forEach(keywords => {
        const fromMatches = keywords.filter(kw => fromContent.includes(kw));
        const toMatches = keywords.filter(kw => toContent.includes(kw));
        
        if (fromMatches.length > 0 && toMatches.length > 0) {
          if (fromMatches[0] !== toMatches[0]) {
            conflicts.push(edge.id);
          }
        }
      });
    }
  });
  
  return conflicts;
};

const exportToJSON = (nodes: Node[], edges: Edge[]): string => {
  return JSON.stringify({ 
    version: '1.0',
    timestamp: Date.now(),
    nodes, 
    edges 
  }, null, 2);
};

const generateNodeId = (): string => `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const generateEdgeId = (): string => `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================================================
// NODE TYPE CONFIGURATIONS
// ============================================================================

const nodeTypeConfig: Record<NodeType, { 
  icon: React.ReactNode; 
  color: string; 
  bgGradient: string;
  borderColor: string;
  defaultSize: Size;
}> = {
  intent: {
    icon: <Target size={16} />,
    color: 'text-blue-400',
    bgGradient: 'from-blue-500/10 to-blue-600/5',
    borderColor: 'border-blue-500/30',
    defaultSize: { width: 300, height: 250 }
  },
  hypothesis: {
    icon: <HelpCircle size={16} />,
    color: 'text-purple-400',
    bgGradient: 'from-purple-500/10 to-purple-600/5',
    borderColor: 'border-purple-500/30',
    defaultSize: { width: 350, height: 300 }
  },
  decision: {
    icon: <CheckCircle size={16} />,
    color: 'text-green-400',
    bgGradient: 'from-green-500/10 to-green-600/5',
    borderColor: 'border-green-500/30',
    defaultSize: { width: 300, height: 250 }
  },
  memory: {
    icon: <Brain size={16} />,
    color: 'text-amber-400',
    bgGradient: 'from-amber-500/10 to-amber-600/5',
    borderColor: 'border-amber-500/30',
    defaultSize: { width: 300, height: 250 }
  },
  conflict: {
    icon: <AlertTriangle size={16} />,
    color: 'text-red-400',
    bgGradient: 'from-red-500/10 to-red-600/5',
    borderColor: 'border-red-500/30',
    defaultSize: { width: 300, height: 250 }
  },
  note: {
    icon: <FileText size={16} />,
    color: 'text-yellow-400',
    bgGradient: 'from-yellow-500/10 to-yellow-600/5',
    borderColor: 'border-yellow-500/30',
    defaultSize: { width: 280, height: 220 }
  },
  folder: { 
    color: 'text-yellow-400', 
    borderColor: 'border-yellow-500/50', 
    bgGradient: 'from-yellow-500/10 to-orange-500/10',
    icon: <Folder size={18} />
  },
  image: {
    icon: <Image size={16} />,
    color: 'text-pink-400',
    bgGradient: 'from-pink-500/10 to-pink-600/5',
    borderColor: 'border-pink-500/30',
    defaultSize: { width: 320, height: 280 }
  },
  "kernel-script": {
    icon: <Terminal size={18} />,
    color: 'text-green-500',
    bgGradient: 'from-green-900/20 to-black',
    label: 'Kernel Script'
  },
  code: {
    icon: <Code size={16} />,
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-500/10 to-cyan-600/5',
    borderColor: 'border-cyan-500/30',
    defaultSize: { width: 400, height: 350 }
  },
  voice: {
    icon: <Mic size={16} />,
    color: 'text-orange-400',
    bgGradient: 'from-orange-500/10 to-orange-600/5',
    borderColor: 'border-orange-500/30',
    defaultSize: { width: 250, height: 180 }
  },
};

const statusConfig: Record<NodeStatus, { color: string; label: string }> = {
  idle: { color: 'bg-gray-500', label: 'Idle' },
  processing: { color: 'bg-blue-500 animate-pulse', label: 'Processing' },
  validated: { color: 'bg-green-500', label: 'Validated' },
  error: { color: 'bg-red-500', label: 'Error' }
};

// ============================================================================
// TOAST COMPONENT
// ============================================================================

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  useEffect(() => {
    toasts.forEach(toast => {
      const timer = setTimeout(() => onRemove(toast.id), 3000);
      return () => clearTimeout(timer);
    });
  }, [toasts, onRemove]);

  const getToastColor = (type: Toast['type']) => {
    switch(type) {
      case 'success': return 'border-green-500/50 bg-green-500/10';
      case 'error': return 'border-red-500/50 bg-red-500/10';
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/10';
      default: return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  return (
    <div className="fixed top-20 right-4 z-[60] space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`backdrop-blur-xl rounded-xl px-4 py-3 border ${getToastColor(toast.type)} shadow-xl animate-in slide-in-from-right`}
        >
          <p className="text-white text-sm">{toast.message}</p>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// MINIMAP COMPONENT
// ============================================================================

const MiniMap: React.FC<{
  nodes: Node[];
  viewport: Position;
  zoom: number;
  onViewportChange: (pos: Position) => void;
}> = ({ nodes, viewport, zoom, onViewportChange }) => {
  const minimapSize = { width: 200, height: 150 };
  const scale = 0.1;

  return (
    <div className="absolute bottom-20 right-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
      <div className="p-2 border-b border-white/10 text-xs text-white/60 font-semibold">Map</div>
      <div 
        className="relative bg-slate-950/50"
        style={{ width: minimapSize.width, height: minimapSize.height }}
      >
{nodes.map(node => (
          <div
            key={node.id}
            className="absolute bg-blue-500/50 rounded-sm"
            style={{
              // Adăugăm ?. și || 0 pentru siguranță
              left: (node.position?.x || 0) * scale,
              top: (node.position?.y || 0) * scale,
              // Aici era eroarea ta: dacă size lipsește, pune 100 default
              width: (node.size?.width || 100) * scale,
              height: (node.size?.height || 80) * scale
            }}
          />
        ))}
        <div
          className="absolute border-2 border-white/50 rounded"
          style={{
            left: -viewport.x * scale,
            top: -viewport.y * scale,
            width: window.innerWidth * scale / zoom,
            height: window.innerHeight * scale / zoom
          }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// NODE COMPONENT
// ============================================================================

const NodeComponent: React.FC<{
  node: Node;
  selected: boolean;
  multiSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent, offset: Position) => void;
  onConnect: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onContentChange: (content: string) => void;
  onLabelChange: (label: string) => void;
  onExtract: (folderId: string, childId: string) => void;
  onRunScript: () => void;
  isConflicted: boolean;
}> = ({ 
  node, 
  selected, 
  multiSelected,
  onSelect, 
  onDragStart, 
  onConnect, 
  onContextMenu, 
  onResizeStart, 
  onContentChange, 
  onLabelChange, 
  onExtract,
  onRunScript,
  isConflicted 
}) => {
  const config = nodeTypeConfig[node.data.type];
  const statusCfg = statusConfig[node.data.status];
  
  return (
    <div
      className={`absolute backdrop-blur-xl rounded-[24px] border transition-all duration-300 overflow-hidden
        ${selected ? 'shadow-[0_0_30px_rgba(59,130,246,0.5)] border-blue-500/70 ring-2 ring-blue-400/50' : 
          multiSelected ? 'shadow-[0_0_20px_rgba(139,92,246,0.4)] border-purple-500/60' :
          'shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]'}
        ${isConflicted ? 'border-red-500/70 shadow-[0_0_40px_rgba(239,68,68,0.6)] animate-pulse' : config.borderColor}
        bg-gradient-to-br ${config.bgGradient} bg-white/5 hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.4)]`}
style={{
        left: `${node.position?.x ?? 0}px`,
        top: `${node.position?.y ?? 0}px`,
        width: `${node.size?.width ?? 350}px`, 
        height: `${node.size?.height ?? 400}px`,
        zIndex: node.zIndex ?? 1
      }}
      onMouseDown={(e) => {
        onSelect(e);
        const target = e.target as HTMLElement;
        const isHeader = target.closest('.node-header') !== null;
        const isBackground = target === e.currentTarget;
        
        if (isBackground || isHeader) {
          onDragStart(e, {
            x: e.clientX - node.position.x,
            y: e.clientY - node.position.y
          });
        }
      }}
      onContextMenu={onContextMenu}
    >
      {/* Header */}
      <div className={`node-header p-3 flex items-center justify-between cursor-move border-b border-white/10 bg-gradient-to-r ${config.bgGradient}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`${config.color} flex-shrink-0`}>
            {config.icon}
          </div>
          <input
            type="text"
            value={node.data.label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm font-semibold flex-1 min-w-0"
            onClick={(e) => e.stopPropagation()}
            placeholder="Node label..."
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${statusCfg.color}`} title={statusCfg.label} />
          <button
            onClick={onConnect}
            className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
            title="Create connection"
          >
            <Zap size={14} className="text-white/80" />
          </button>
        </div>
      </div>



      
{/* Content */}
<div className="p-4 h-[calc(100%-60px)] overflow-auto custom-scrollbar">
  {/* RANDARE PENTRU FOLDER */}
  {node.data.type === 'folder' && (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[10px] text-white/30 uppercase tracking-tighter font-mono">
          Object Registry ({node.data.children?.length || 0})
        </span>
      </div>
      
      <div className="grid gap-2">
        {node.data.children?.map((child) => {
          // Folosim nodeTypeConfig (numele corect al variabilei tale)
          const childConfig = nodeTypeConfig[child.data.type as keyof typeof nodeTypeConfig] || nodeTypeConfig.note;
          
          return (
            <div 
              key={child.id}
              className="group flex items-center gap-3 p-2.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-200"
            >
              <div className={`${childConfig.color}`}>
                {childConfig.icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/80 truncate">
                  {child.data.label || 'Untitled Node'}
                </div>
                <div className="text-[10px] text-white/30 truncate capitalize">
                  {child.data.type}
                </div>
              </div>
              <button
  onClick={(e) => {
    e.stopPropagation();
    onExtract(node.id, child.id);
  }}
  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-all"
  title="Extract from folder"
>
  <ExternalLink size={14} /> 
</button>
            </div>
          );
        })}
      </div>

      {(!node.data.children || node.data.children.length === 0) && (
        <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-2xl">
          <p className="text-xs text-white/20">Folder is empty</p>
        </div>
      )}
    </div>
  )}

    {node.data.type === 'kernel-script' && (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[10px] text-green-500 uppercase tracking-tighter font-mono animate-pulse">
          ◈ Kernel Runtime Active
        </span>
      </div>
      
      <textarea
        value={node.data.content}
        onChange={(e) => onContentChange(e.target.value)}
        spellCheck={false}
        className="flex-1 min-h-[120px] w-full p-3 bg-black/40 font-mono text-[11px] text-green-400 border border-green-900/20 rounded-xl focus:outline-none focus:border-green-500/40 resize-none custom-scrollbar shadow-inner"
        placeholder="// Enter system instructions..."
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRunScript(); 
        }}
        className="group relative w-full py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl transition-all duration-300 active:scale-[0.98]"
      >
        <div className="flex items-center justify-center gap-2">
          <Zap size={14} className="text-green-500 fill-green-500/20" />
          <span className="text-green-500 text-[10px] font-bold tracking-[0.2em] uppercase">
            Execute Kernel
          </span>
        </div>
      </button>
    </div>
  )}

  {/* RANDARE PENTRU TEXT (Restul tipurilor) */}
  {['intent', 'hypothesis', 'decision', 'memory', 'conflict', 'note'].includes(node.data.type) && (
    <textarea
      value={node.data.content}
      onChange={(e) => onContentChange(e.target.value)}
      className="w-full h-full resize-none bg-transparent border-none outline-none text-white/90 text-sm placeholder-white/30 leading-relaxed font-sans"
      placeholder={`Enter ${node.data.type} details...`}
      onClick={(e) => e.stopPropagation()}
    />
  )}

        {/* Image node */}
        {node.data.type === 'image' && (
          <div className="h-full flex flex-col gap-2">
            {node.data.imageUrl ? (
              <img src={node.data.imageUrl} alt="Node" className="w-full h-40 object-cover rounded-lg" />
            ) : (
              <div className="w-full h-40 bg-white/5 rounded-lg flex items-center justify-center">
                <Image className="text-white/30" size={32} />
              </div>
            )}
            <input
              type="text"
              value={node.data.imageUrl || ''}
              onChange={(e) => onContentChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80 text-xs outline-none"
              placeholder="Image URL..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Code node */}
        {node.data.type === 'code' && (
          <div className="h-full flex flex-col gap-2">
            <select
              value={node.data.codeLanguage || 'javascript'}
              onChange={(e) => onLabelChange(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="typescript">TypeScript</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
            </select>
            <textarea
              value={node.data.content}
              onChange={(e) => onContentChange(e.target.value)}
              className="flex-1 resize-none bg-slate-950/50 border border-white/10 rounded-lg p-3 text-green-400 text-xs font-mono outline-none"
              placeholder="// Write code here..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Voice node */}
        {node.data.type === 'voice' && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center">
              <Mic className="text-orange-400" size={28} />
            </div>
            <textarea
              value={node.data.content}
              onChange={(e) => onContentChange(e.target.value)}
              className="w-full flex-1 resize-none bg-transparent border-none outline-none text-white/80 text-xs text-center"
              placeholder="Voice transcription..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        
        {/* Metadata */}
        {node.data.metadata && (
          <div className="mt-4 pt-2 border-t border-white/10 text-[10px] text-white/40 space-y-1 font-mono uppercase tracking-widest">
            {node.data.metadata.confidence !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300" 
                    style={{ width: `${node.data.metadata.confidence * 100}%` }}
                  />
                </div>
                <span>{(node.data.metadata.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
            {node.data.metadata.impact && (
              <div className={`inline-block px-2 py-0.5 rounded border ${
                node.data.metadata.impact === 'high' ? 'border-red-500/30 bg-red-500/10 text-red-400' : 
                node.data.metadata.impact === 'medium' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' :
                'border-blue-500/30 bg-blue-500/10 text-blue-400'
              }`}>
                Impact: {node.data.metadata.impact}
              </div>
            )}
            {node.data.metadata.tags && node.data.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {node.data.metadata.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-white/50">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity"
        onMouseDown={onResizeStart}
      >
        <div className="w-full h-full border-r-2 border-b-2 border-white/50 rounded-br" />
      </div>

      {/* Connection point */}
      <div
        className="absolute bottom-3 right-10 w-3 h-3 bg-blue-500 rounded-full cursor-pointer hover:scale-150 transition-transform shadow-lg shadow-blue-500/50"
        onMouseDown={onConnect}
        title="Drag to connect"
      />
    </div>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

const EchoOS: React.FC = () => {
  // State
  const [nodes, setNodes] = useState<Node[]>(() => {
    const saved = localStorage.getItem('echo-os-nodes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load nodes:', e);
      }
    }
    return [{
      id: 'welcome',
      position: { x: 100, y: 100 },
      size: { width: 320, height: 240 },
      data: {
        label: '🎉 Welcome to EchoOS',
        type: 'intent',
        content: 'Welcome to your Exocortex!\n\n✨ Features:\n• Create nodes (Ctrl+N)\n• Connect ideas\n• AI expansion\n• Conflict detection\n• Multi-select (Shift+Click)\n• Export/Import\n• Undo/Redo (Ctrl+Z/Y)',
        status: 'validated',
        metadata: { 
          timestamp: Date.now(),
          tags: ['welcome', 'guide']
        }
      },
      zIndex: 1
    }];
  });

  const [edges, setEdges] = useState<Edge[]>(() => {
    const saved = localStorage.getItem('echo-os-edges');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load edges:', e);
      }
    }
    return [];
  });
  const runKernelScript = (code: string) => {
  try {
    // Creăm funcția executabilă
    // Îi dăm acces la tot ce are nevoie un OS: noduri, legături și funcțiile de update
    const runner = new Function(
      'nodes', 
      'setNodes', 
      'edges', 
      'setEdges', 
      'updateNode',
      'maxZIndex',
      code
    );

    // O executăm trecându-i variabilele reale din starea aplicației
    runner(nodes, setNodes, edges, setEdges, updateNode, maxZIndex);
    
    console.log("Kernel: Execution successful");
  } catch (err) {
    console.error("Kernel Panic: Script error", err);
    alert("Script error: " + err);
  }
};
  const extractFromFolder = (folderId: string, childId: string) => {
    setNodes(prevNodes => {
      const folder = prevNodes.find(n => n.id === folderId);
      if (!folder || !folder.data.children) return prevNodes;

      const childToExtract = folder.data.children.find(c => c.id === childId);
      if (!childToExtract) return prevNodes;

      // Creăm nodul care "iese" din folder
      const extractedNode: Node = {
        ...childToExtract,
        position: { 
          x: folder.position.x + folder.size.width + 40, 
          y: folder.position.y 
        },
        zIndex: maxZIndex + 1
      };

      // Scoatem copilul din lista folderului și adăugăm nodul nou pe canvas
      const updatedNodes = prevNodes.map(n => {
        if (n.id === folderId) {
          return {
            ...n,
            data: {
              ...n.data,
              children: n.data.children?.filter(c => c.id !== childId)
            }
          };
        }
        return n;
      });

      return [...updatedNodes, extractedNode];
    });

    setMaxZIndex(prev => prev + 1);
  };

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [viewport, setViewport] = useState<Position>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [resizingNode, setResizingNode] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ size: Size; mouse: Position } | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectingPos, setConnectingPos] = useState<Position | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ show: false, position: { x: 0, y: 0 }, nodeId: null });
  const [maxZIndex, setMaxZIndex] = useState(1);
  const [conflictedEdges, setConflictedEdges] = useState<string[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [autoSaving, setAutoSaving] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast management
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // History management
  const saveToHistory = useCallback(() => {
    const newState = { nodes: [...nodes], edges: [...edges] };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newState]);
    setHistoryIndex(prev => prev + 1);
  }, [nodes, edges, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
      addToast('Undone', 'info');
    }
  }, [history, historyIndex, addToast]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
      addToast('Redone', 'info');
    }
  }, [history, historyIndex, addToast]);

  // Auto-save
  useEffect(() => {
    setAutoSaving(true);
    const timer = setTimeout(() => {
      localStorage.setItem('echo-os-nodes', JSON.stringify(nodes));
      localStorage.setItem('echo-os-edges', JSON.stringify(edges));
      setAutoSaving(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  // Conflict detection
  useEffect(() => {
    const conflicts = detectConflicts(nodes, edges);
    setConflictedEdges(conflicts);
    if (conflicts.length > 0 && conflictedEdges.length === 0) {
      addToast(`⚠️ ${conflicts.length} conflict(s) detected!`, 'warning');
    }
  }, [nodes, edges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New node
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNode('note');
      }
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Delete: Delete selected nodes
      if (e.key === 'Delete' && selectedNodes.size > 0) {
        e.preventDefault();
        deleteSelectedNodes();
      }
      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedNodes(new Set(nodes.map(n => n.id)));
      }
      // Escape: Deselect all
      if (e.key === 'Escape') {
        setSelectedNodes(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, selectedNodes, undo, redo]);

  // Canvas handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      setZoom(Math.min(Math.max(0.1, zoom + delta), 3));
    } else {
      setViewport({
        x: viewport.x - e.deltaX,
        y: viewport.y - e.deltaY
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setContextMenu({ show: false, position: { x: 0, y: 0 }, nodeId: null });
    if (e.button === 1 || (e.button === 0 && e.target === canvasRef.current)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setViewport({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }

    if (draggedNode) {
      if (selectedNodes.has(draggedNode) && selectedNodes.size > 1) {
        // Multi-node drag
        const deltaX = ((e.clientX - viewport.x) / zoom - dragOffset.x);
        const deltaY = ((e.clientY - viewport.y) / zoom - dragOffset.y);
        const draggedNodeData = nodes.find(n => n.id === draggedNode);
        if (draggedNodeData) {
          const dx = deltaX - draggedNodeData.position.x;
          const dy = deltaY - draggedNodeData.position.y;
          
          setNodes(nodes.map(n => 
            selectedNodes.has(n.id) 
              ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
              : n
          ));
        }
      } else {
        updateNode(draggedNode, {
          position: {
            x: (e.clientX - viewport.x) / zoom - dragOffset.x,
            y: (e.clientY - viewport.y) / zoom - dragOffset.y
          }
        });
      }
    }

    if (resizingNode && resizeStart) {
      const node = nodes.find(n => n.id === resizingNode);
      if (node) {
        const deltaX = (e.clientX - resizeStart.mouse.x) / zoom;
        const deltaY = (e.clientY - resizeStart.mouse.y) / zoom;
        updateNode(resizingNode, {
          size: {
            width: Math.max(200, resizeStart.size.width + deltaX),
            height: Math.max(150, resizeStart.size.height + deltaY)
          }
        });
      }
    }

    if (connectingFrom) {
      setConnectingPos({ x: e.clientX, y: e.clientY });
    }
  };

const handleMouseUp = (e: React.MouseEvent) => {
    if (draggedNode) {
      const movingNode = nodes.find(n => n.id === draggedNode);
      
      if (movingNode) {
        const targetNode = nodes.find(n => 
          n.id !== movingNode.id &&
          e.clientX > n.position.x + viewport.x &&
          e.clientX < n.position.x + viewport.x + n.size.width &&
          e.clientY > n.position.y + viewport.y &&
          e.clientY < n.position.y + viewport.y + n.size.height
        );

        if (targetNode) {
          createFolder(movingNode.id, targetNode.id);
        }
      }
    }

    setIsPanning(false);
    setDraggedNode(null);
    setResizingNode(null);
    setResizeStart(null);
    setConnectingFrom(null);
    setConnectingPos(null);
  };
  const createFolder = (sourceId: string, targetId: string) => {
  const sourceNode = nodes.find(n => n.id === sourceId);
  const targetNode = nodes.find(n => n.id === targetId);

  if (!sourceNode || !targetNode) return;

  // Dacă ținta este deja un folder, adăugăm în el
  if (targetNode.data.type === 'folder') {
    setNodes(prev => prev.map(n => {
      if (n.id === targetId) {
        return {
          ...n,
          data: {
            ...n.data,
            children: [...(n.data.children || []), sourceNode]
          }
        };
      }
      return n;
    }).filter(n => n.id !== sourceId));
    
    // addToast("Added to folder", "success"); // Activează dacă ai Toast
  } else {
    // Altfel, creăm un folder nou
    const newFolder: Node = {
      id: `folder-${Date.now()}`,
      position: { ...targetNode.position },
      size: { width: 320, height: 250 },
      zIndex: maxZIndex + 1,
      data: {
        label: 'New Group',
        type: 'folder',
        content: '',
        status: 'validated',
        children: [targetNode, sourceNode]
      }
    };

    setNodes(prev => [...prev.filter(n => n.id !== sourceId && n.id !== targetId), newFolder]);
    setMaxZIndex(prev => prev + 1);
  }
};


  // Node management
  const createNode = (type: NodeType) => {
    saveToHistory();
    const config = nodeTypeConfig[type];
    const newNode: Node = {
      id: generateNodeId(),
      position: { x: (-viewport.x / zoom) + 200, y: (-viewport.y / zoom) + 200 },
      size: config.defaultSize || { width: 350, height: 400 },
      data: {
        label: type.charAt(0).toUpperCase() + type.slice(1),
        type,
        content: '',
        status: 'idle',
        metadata: {
          timestamp: Date.now(),
          confidence: type === 'hypothesis' ? 0.5 : undefined,
          impact: type === 'decision' ? 'low' : undefined
        }
      },
      zIndex: maxZIndex + 1
    };
    setNodes([...nodes, newNode]);
    setMaxZIndex(maxZIndex + 1);
    setShowMenu(false);
    addToast(`Created ${type} node`, 'success');
  };

  const updateNode = (id: string, updates: Partial<Node>) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const deleteNode = (id: string) => {
    saveToHistory();
    setNodes(nodes.filter(n => n.id !== id));
    setEdges(edges.filter(e => e.from !== id && e.to !== id));
    addToast('Node deleted', 'info');
  };

  const deleteSelectedNodes = () => {
    if (selectedNodes.size === 0) return;
    saveToHistory();
    setNodes(nodes.filter(n => !selectedNodes.has(n.id)));
    setEdges(edges.filter(e => !selectedNodes.has(e.from) && !selectedNodes.has(e.to)));
    addToast(`Deleted ${selectedNodes.size} node(s)`, 'info');
    setSelectedNodes(new Set());
  };

  const duplicateNode = (id: string) => {
    saveToHistory();
    const node = nodes.find(n => n.id === id);
    if (node) {
      const newNode = {
        ...node,
        id: generateNodeId(),
        position: { x: node.position.x + 30, y: node.position.y + 30 },
        zIndex: maxZIndex + 1
      };
      setNodes([...nodes, newNode]);
      setMaxZIndex(maxZIndex + 1);
      addToast('Node duplicated', 'success');
    }
  };

  const bringToFront = (id: string) => {
    const newZIndex = maxZIndex + 1;
    updateNode(id, { zIndex: newZIndex });
    setMaxZIndex(newZIndex);
  };

  // Edge management
  const startConnecting = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectingFrom(nodeId);
    setConnectingPos({ x: e.clientX, y: e.clientY });
  };

  const finishConnection = (toId: string) => {
    if (connectingFrom && connectingFrom !== toId) {
      saveToHistory();
      const newEdge: Edge = {
        id: generateEdgeId(),
        from: connectingFrom,
        to: toId,
        validated: false
      };
      setEdges([...edges, newEdge]);
      addToast('Connection created', 'success');
    }
  };

  // AI Functions
  const expandIntent = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    saveToHistory();
    updateNode(nodeId, { data: { ...node.data, status: 'processing' } });
    addToast('Expanding node with AI...', 'info');

    setTimeout(() => {
      const newNodes: Node[] = [
        {
          id: generateNodeId(),
          position: { x: node.position.x + 400, y: node.position.y - 120 },
          size: { width: 300, height: 220 },
          data: {
            label: 'Sub-goal 1',
            type: 'hypothesis',
            content: `Breaking down: ${node.data.content.slice(0, 60)}...\n\nPotential approach to consider.`,
            status: 'idle',
            metadata: { confidence: 0.75, timestamp: Date.now(), tags: ['ai-generated'] }
          },
          zIndex: maxZIndex + 1
        },
        {
          id: generateNodeId(),
          position: { x: node.position.x + 400, y: node.position.y + 120 },
          size: { width: 300, height: 220 },
          data: {
            label: 'Sub-goal 2',
            type: 'hypothesis',
            content: 'Alternative approach:\n\nConsider different perspective.',
            status: 'idle',
            metadata: { confidence: 0.65, timestamp: Date.now(), tags: ['ai-generated'] }
          },
          zIndex: maxZIndex + 2
        }
      ];

      setNodes([...nodes, ...newNodes]);
      setEdges([
        ...edges,
        { id: generateEdgeId(), from: nodeId, to: newNodes[0].id, validated: false },
        { id: generateEdgeId(), from: nodeId, to: newNodes[1].id, validated: false }
      ]);
      setMaxZIndex(maxZIndex + 2);
      updateNode(nodeId, { data: { ...node.data, status: 'validated' } });
      addToast('Node expanded successfully!', 'success');
    }, 1500);
  };

  const generateInsights = () => {
    const typeCounts: Record<string, number> = {};
    nodes.forEach(n => {
      typeCounts[n.data.type] = (typeCounts[n.data.type] || 0) + 1;
    });
    
    const insights: string[] = [
      `📊 Graph Overview`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Total Nodes: ${nodes.length}`,
      `Total Connections: ${edges.length}`,
      ``,
      `📈 Node Distribution:`,
      ...Object.entries(typeCounts).map(([k,v]) => `  • ${k}: ${v}`),
      ``
    ];
    
    if (conflictedEdges.length > 0) {
      insights.push(`⚠️  Conflicts Detected: ${conflictedEdges.length}`);
      insights.push('');
    }
    
    const cogLoad = calculateCognitiveLoad(nodes.length, edges.length);
    const loadStatus = cogLoad < 20 ? '✅ Optimal' : cogLoad < 50 ? '⚡ Moderate' : '🔥 High - Consider organizing';
    insights.push(`🧠 Cognitive Load: ${cogLoad.toFixed(1)}`);
    insights.push(`   Status: ${loadStatus}`);
    
    return insights.join('\n');
  };

  // Import/Export
  const handleExport = () => {
    const json = exportToJSON(nodes, edges);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `echoos-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Graph exported successfully!', 'success');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        saveToHistory();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        addToast('Graph imported successfully!', 'success');
      } catch (err) {
        addToast('Failed to import graph', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Search
  const handleSearch = () => {
    const q = searchQuery.toLowerCase();
    
    // Create node commands
    if (q.includes('create') || q.includes('new')) {
      Object.keys(nodeTypeConfig).forEach(type => {
        if (q.includes(type)) {
          createNode(type as NodeType);
          setSearchQuery('');
          return;
        }
      });
    }
    
    // Action commands
    if (q.includes('expand') && selectedNodes.size === 1) {
      expandIntent(Array.from(selectedNodes)[0]);
      setSearchQuery('');
    } else if (q.includes('insights') || q.includes('explain')) {
      setShowInsights(true);
      setSearchQuery('');
    } else if (q.includes('export')) {
      handleExport();
      setSearchQuery('');
    } else if (q.includes('clear')) {
      if (window.confirm('Clear all nodes and edges?')) {
        saveToHistory();
        setNodes([]);
        setEdges([]);
        setSearchQuery('');
      }
    }
  };

  // Filter nodes
  const filteredNodes = filterQuery 
    ? nodes.filter(n => 
        n.data.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
        n.data.content.toLowerCase().includes(filterQuery.toLowerCase()) ||
        n.data.type.includes(filterQuery.toLowerCase())
      )
    : nodes;

  const cogLoad = calculateCognitiveLoad(nodes.length, edges.length);

  return (
    <div className="w-full h-screen bg-slate-950 overflow-hidden relative">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white/5 backdrop-blur-xl rounded-full px-5 py-3 flex items-center gap-3 border border-white/10 shadow-2xl">
          <Search className="text-white/60" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder='Try "create note" | "expand" | "insights" | "export"'
            className="bg-transparent border-none outline-none text-white placeholder-white/30 w-96 text-sm"
          />
          <Command className="text-white/40" size={16} />
        </div>
      </div>

      {/* Left Toolbar */}
      <div className="absolute top-4 left-4 z-50 space-y-2">
        {/* Cognitive Load */}
        <div className={`backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/10 shadow-xl ${getLoadBg(cogLoad)}`}>
          <div className="flex items-center gap-3">
            <Activity className={`${getLoadColor(cogLoad)}`} size={20} />
            <div>
              <div className={`text-sm font-semibold ${getLoadColor(cogLoad)}`}>
                {cogLoad.toFixed(1)}
              </div>
              <div className="text-xs text-white/50">
                {cogLoad < 20 ? 'Optimal' : cogLoad < 50 ? 'Moderate' : 'High'}
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl px-3 py-2 border border-white/10 shadow-xl">
          <div className="flex items-center gap-2">
            <Filter className="text-white/60" size={16} />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter..."
              className="bg-transparent border-none outline-none text-white text-xs w-24 placeholder-white/30"
            />
          </div>
        </div>

        {/* History Controls */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-2 border border-white/10 shadow-xl flex gap-1">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="text-white" size={16} />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="text-white" size={16} />
          </button>
        </div>
      </div>

      {/* Right Toolbar */}
      <div className="absolute top-4 right-4 z-50 space-y-2">
        {/* Auto-save indicator */}
        {autoSaving && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl px-3 py-2 border border-white/10 shadow-xl flex items-center gap-2">
            <Save className="text-green-400 animate-pulse" size={16} />
            <span className="text-xs text-white/60">Saving...</span>
          </div>
        )}

        {/* Main Menu */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110"
        >
          <Plus className="text-white" size={24} />
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-2 w-64 border border-white/10 max-h-[600px] overflow-y-auto">
            <div className="text-xs text-white/40 px-4 py-2 font-semibold uppercase tracking-wider">Create Node</div>
            <button onClick={() => createNode('intent')} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors">
              <Target size={18} className="text-blue-400" /> Intent
            </button>
            <button onClick={() => createNode('hypothesis')} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors">
              <HelpCircle size={18} className="text-purple-400" /> Hypothesis
            </button>
            <button onClick={() => createNode('decision')} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors">
              <CheckCircle size={18} className="text-green-400" /> Decision
            </button>
            <button onClick={() => createNode('memory')} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors">
              <Brain size={18} className="text-amber-400" /> Memory
            </button>
            <button onClick={() => createNode('conflict')} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors">
              <AlertTriangle size={18} className="text-red-400" /> Conflict
            </button>
            <button onClick={() => createNode('note')} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors">
              <FileText size={18} className="text-yellow-400" /> Note
            </button>
            <button onClick={() => createNode('image')} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors">
              <Image size={18} className="text-pink-400" /> Image
            </button>
            <button onClick={() => createNode('code')} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors">
              <Code size={18} className="text-cyan-400" /> Code
            </button>
            <button onClick={() => createNode('voice')} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors">
              <Mic size={18} className="text-orange-400" /> Voice
            </button>
            
            <hr className="my-2 border-white/10" />
            <div className="text-xs text-white/40 px-4 py-2 font-semibold uppercase tracking-wider">Actions</div>
            
            <button 
              onClick={() => {
                if (selectedNodes.size === 1) {
                  expandIntent(Array.from(selectedNodes)[0]);
                  setShowMenu(false);
                } else {
                  addToast('Select one node to expand', 'warning');
                }
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-purple-400 transition-colors"
            >
              <Sparkles size={18} /> Expand with AI
            </button>
            <button onClick={() => { setShowInsights(true); setShowMenu(false); }} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-blue-400 transition-colors">
              <Eye size={18} /> View Insights
            </button>
            <button onClick={() => { handleExport(); setShowMenu(false); }} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-green-400 transition-colors">
              <Download size={18} /> Export Graph
            </button>
            <button onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-cyan-400 transition-colors">
              <Upload size={18} /> Import Graph
            </button>
            
            <hr className="my-2 border-white/10" />
            <div className="text-xs text-white/40 px-4 py-2 font-semibold uppercase tracking-wider">View</div>
            
            <button 
              onClick={() => { 
                setViewMode(viewMode === 'both' ? 'canvas' : 'both'); 
                setShowMenu(false); 
              }} 
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-white transition-colors"
            >
              {viewMode === 'both' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              {viewMode === 'both' ? 'Hide Minimap' : 'Show Minimap'}
            </button>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Insights Panel */}
      {showInsights && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowInsights(false)}>
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 max-w-2xl w-full mx-4 border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Brain className="text-blue-400" />
              Graph Insights
            </h2>
            <pre className="text-white/80 text-sm whitespace-pre-wrap font-mono bg-black/30 p-4 rounded-xl max-h-96 overflow-y-auto">
              {generateInsights()}
            </pre>
            <button
              onClick={() => setShowInsights(false)}
              className="mt-4 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.show && (
        <div
          className="absolute bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl p-2 w-52 z-50 border border-white/10"
          style={{ left: contextMenu.position.x, top: contextMenu.position.y }}
        >
          <button
            onClick={() => {
              if (contextMenu.nodeId) expandIntent(contextMenu.nodeId);
              setContextMenu({ show: false, position: { x: 0, y: 0 }, nodeId: null });
            }}
            className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg flex items-center gap-2 text-white text-sm"
          >
            <Sparkles size={16} className="text-purple-400" /> Expand with AI
          </button>
          <button
            onClick={() => {
              if (contextMenu.nodeId) duplicateNode(contextMenu.nodeId);
              setContextMenu({ show: false, position: { x: 0, y: 0 }, nodeId: null });
            }}
            className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg flex items-center gap-2 text-white text-sm"
          >
            <Copy size={16} /> Duplicate
          </button>
          <button
            onClick={() => {
              if (contextMenu.nodeId) {
                const node = nodes.find(n => n.id === contextMenu.nodeId);
                if (node) bringToFront(contextMenu.nodeId);
              }
              setContextMenu({ show: false, position: { x: 0, y: 0 }, nodeId: null });
            }}
            className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg flex items-center gap-2 text-white text-sm"
          >
            <Layers size={16} /> Bring to Front
          </button>
          <hr className="my-1 border-white/10" />
          <button
            onClick={() => {
              if (contextMenu.nodeId) deleteNode(contextMenu.nodeId);
              setContextMenu({ show: false, position: { x: 0, y: 0 }, nodeId: null });
            }}
            className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 rounded-lg flex items-center gap-2 text-sm"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      )}

      {/* Info Panel */}
      <div className="absolute bottom-4 left-4 bg-white/5 backdrop-blur-xl rounded-2xl px-4 py-3 text-white/80 text-sm z-50 border border-white/10 space-y-1">
        <div className="font-semibold flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            {nodes.length}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
            {edges.length}
          </div>
          {conflictedEdges.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
              {conflictedEdges.length}
            </div>
          )}
        </div>
        <div className="text-xs text-white/50">
          {selectedNodes.size > 0 && `${selectedNodes.size} selected | `}
          Scroll: Pan | Ctrl+Scroll: Zoom
        </div>
        <div className="text-xs text-white/40">
          Ctrl+N: New | Ctrl+Z: Undo | Del: Delete
        </div>
      </div>

      {/* Minimap */}
      {(viewMode === 'both' || viewMode === 'minimap') && (
        <MiniMap
          nodes={nodes}
          viewport={viewport}
          zoom={zoom}
          onViewportChange={setViewport}
        />
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="w-full h-full relative cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: `${50 * zoom}px ${50 * zoom}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`
          }}
        />

        {/* Edges SVG */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full">
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="conflict-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {edges.map(edge => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const from = {
              x: (fromNode.position.x + fromNode.size.width / 2) * zoom + viewport.x,
              y: (fromNode.position.y + fromNode.size.height / 2) * zoom + viewport.y
            };
            const to = {
              x: (toNode.position.x + toNode.size.width / 2) * zoom + viewport.x,
              y: (toNode.position.y + toNode.size.height / 2) * zoom + viewport.y
            };

            const isConflicted = conflictedEdges.includes(edge.id);

            return (
              <g key={edge.id}>
                <path
                  d={calculatePipePath(from, to)}
                  stroke={isConflicted ? 'url(#conflict-gradient)' : 'url(#edge-gradient)'}
                  strokeWidth={isConflicted ? 4 : 2}
                  fill="none"
                  className={isConflicted ? 'animate-pulse' : ''}
                  filter={isConflicted ? 'url(#glow)' : undefined}
                />
                {edge.label && (
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2}
                    fill="white"
                    fontSize="10"
                    className="pointer-events-none"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
          
          {connectingFrom && connectingPos && (() => {
            const fromNode = nodes.find(n => n.id === connectingFrom);
            if (!fromNode) return null;
            const from = {
              x: (fromNode.position.x + fromNode.size.width / 2) * zoom + viewport.x,
              y: (fromNode.position.y + fromNode.size.height / 2) * zoom + viewport.y
            };
            return (
              <path
                d={calculatePipePath(from, connectingPos)}
                stroke="#60a5fa"
                strokeWidth="3"
                strokeDasharray="8,4"
                fill="none"
                className="animate-pulse"
              />
            );
          })()}
        </svg>

        {/* Nodes */}
        <div
          className="absolute"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          {filteredNodes.map(node => (
            <NodeComponent
              key={node.id}
              node={node}
              selected={selectedNodes.has(node.id) && selectedNodes.size === 1}
              multiSelected={selectedNodes.has(node.id) && selectedNodes.size > 1}
              onSelect={(e) => {
                if (e.shiftKey) {
                  setSelectedNodes(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(node.id)) {
                      newSet.delete(node.id);
                    } else {
                      newSet.add(node.id);
                    }
                    return newSet;
                  });
                } else {
                  setSelectedNodes(new Set([node.id]));
                  bringToFront(node.id);
                }
              }}
              onDragStart={(e, offset) => {
                setDraggedNode(node.id);
                setDragOffset(offset);
              }}
              onConnect={(e) => startConnecting(node.id, e)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  show: true,
                  position: { x: e.clientX, y: e.clientY },
                  nodeId: node.id
                });
              }}
              onResizeStart={(e) => {
                e.stopPropagation();
                setResizingNode(node.id);
                setResizeStart({
                  size: { ...node.size },
                  mouse: { x: e.clientX, y: e.clientY }
                });
              }}
              onContentChange={(content) => {
                updateNode(node.id, {
                  data: { ...node.data, content }
                });
              }}
              onLabelChange={(label) => {
                updateNode(node.id, {
                  data: { ...node.data, label }
                });

              }}
              onRunScript={() => runKernelScript(node.data.content)}
              onExtract={extractFromFolder}
              isConflicted={edges.some(e => 
                (e.from === node.id || e.to === node.id) && conflictedEdges.includes(e.id)
              )}
            />
          ))}
          
          
          {/* Connection target zones */}
          {connectingFrom && nodes.filter(n => n.id !== connectingFrom).map(node => (
            <div
              key={`target-${node.id}`}
              className="absolute border-2 border-blue-400 rounded-[24px] pointer-events-auto cursor-pointer animate-pulse"
              style={{
                left: `${node.position.x - 10}px`,
                top: `${node.position.y - 10}px`,
                width: `${node.size.width + 20}px`,
                height: `${node.size.height + 20}px`,
                zIndex: 9999
              }}
              onMouseUp={() => finishConnection(node.id)}
            />
          ))}
        </div>
        
        <Dock 
          createNode={createNode} 
          onFolderClick={() => createNode('kernel-script')} 
        />
        {showInsights && <Insights nodes={nodes} edges={edges} />}
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        
        
      </div>
    </div>   
  );        
};      

const Dock: React.FC<{ 
  createNode: (type: NodeType) => void; 
  onFolderClick: () => void; 
}> = ({ createNode, onFolderClick }) => {
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-4 px-6 py-3 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4">
      <button 
        onClick={() => createNode('note')} 
        className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/70 hover:text-white"
      >
        <Plus size={20} />
      </button>
      
      <button 
        onClick={() => createNode('intent')} 
        className="p-2 hover:bg-white/10 rounded-xl transition-all text-blue-400"
      >
        <Target size={20} />
      </button>

      <button 
        onClick={() => createNode('kernel-script')} 
        className="p-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl transition-all group"
        title="Create Kernel Script"
      >
        <Terminal size={20} className="text-green-500 group-hover:scale-110 transition-transform" />
      </button>

      <div className="w-px h-6 bg-white/10 mx-1" /> {/* Separator */}

      <div className="w-px h-6 bg-white/10 mx-2" />

      <button className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/40">
        <Download size={20} />
      </button>
    </div>
  );
};

const Insights: React.FC<{ nodes: Node[]; edges: Edge[] }> = ({ nodes, edges }) => {
  const load = calculateCognitiveLoad(nodes.length, edges.length);
  const createFolder = (sourceNodeId: string | null, targetNodeId?: string) => {
  if (!sourceNodeId) {
    addToast("Select a node first to group it", "info");
    return;
  }

  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  if (!sourceNode) return;

  const newFolderId = `folder-${Date.now()}`;
  
  // Dacă avem un target (din drag & drop), folosim poziția target-ului
  // Dacă nu (din butonul Dock), punem folderul lângă sursă
  const targetNode = targetNodeId ? nodes.find(n => n.id === targetNodeId) : null;
  const position = targetNode ? { ...targetNode.position } : { x: sourceNode.position.x + 50, y: sourceNode.position.y + 50 };

  const newFolder: Node = {
    id: newFolderId,
    position,
    size: { width: 320, height: 250 },
    zIndex: maxZIndex + 1,
    data: {
      label: 'New Folder',
      type: 'folder', // Asigură-te că 'folder' este în tipurile tale
      content: '',
      status: 'validated',
      children: targetNode ? [targetNode, sourceNode] : [sourceNode]
    }
  };

  const idsToRemove = targetNode ? [sourceNodeId, targetNodeId] : [sourceNodeId];
  setNodes(prev => [...prev.filter(n => !idsToRemove.includes(n.id)), newFolder]);
  setMaxZIndex(prev => prev + 1);
  addToast("Folder created", "success");
};

const extractFromFolder = (folderId: string, childId: string) => {
  const folder = nodes.find(n => n.id === folderId);
  if (!folder || !folder.data.children) return;

  const childToExtract = folder.data.children.find(c => c.id === childId);
  if (!childToExtract) return;

  // 1. Punem nodul extras înapoi pe canvas, lângă folder
  const extractedNode = {
    ...childToExtract,
    position: { x: folder.position.x + 50, y: folder.position.y + 50 },
    zIndex: maxZIndex + 1
  };

  // 2. Actualizăm folderul eliminând copilul din listă
  setNodes(prev => {
    const updatedNodes = prev.map(n => {
      if (n.id === folderId) {
        return {
          ...n,
          data: {
            ...n.data,
            children: n.data.children?.filter(c => c.id !== childId)
          }
        };
      }
      return n;
    });
    return [...updatedNodes, extractedNode];
  });
  
  setMaxZIndex(prev => prev + 1);
  addToast("Node extracted from folder", "info");
};
  
  return (
    <div className="fixed top-24 left-6 w-64 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl z-50">
      <div className="flex items-center gap-2 mb-4 text-blue-400">
        <Activity size={18} />
        <h3 className="font-bold text-sm uppercase tracking-wider">Cognitive Load</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/50">Current Stress</span>
            <span className={getLoadColor(load)}>{load.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getLoadBg(load).replace('20', '100')}`}
              style={{ width: `${Math.min(load, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-xl p-2 border border-white/5">
            <div className="text-[10px] text-white/40 uppercase">Nodes</div>
            <div className="text-lg font-bold text-white">{nodes.length}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/5">
            <div className="text-[10px] text-white/40 uppercase">Edges</div>
            <div className="text-lg font-bold text-white">{edges.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EchoOS;
        
      