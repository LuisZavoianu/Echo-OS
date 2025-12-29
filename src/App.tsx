import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Zap, Brain, Target, HelpCircle, CheckCircle, AlertTriangle, Activity, Sparkles, Eye, Trash2, Copy } from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type NodeType = 'intent' | 'hypothesis' | 'decision' | 'memory' | 'conflict';
type NodeStatus = 'idle' | 'processing' | 'validated' | 'error';

interface Position { x: number; y: number; }
interface Size { width: number; height: number; }

interface EchoNodeData {
  label: string;
  type: NodeType;
  content: string;
  status: NodeStatus;
  metadata?: {
    confidence?: number;
    impact?: 'high' | 'low';
    timestamp: number;
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
}

interface ContextMenu {
  show: boolean;
  position: Position;
  nodeId: string | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const calculatePipePath = (from: Position, to: Position): string => {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
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

// Simple conflict detection based on keywords
const detectConflicts = (nodes: Node[], edges: Edge[]): string[] => {
  const conflicts: string[] = [];
  const conflictKeywords = [
    ['cheap', 'expensive', 'premium', 'budget'],
    ['fast', 'slow', 'quick', 'delayed'],
    ['simple', 'complex', 'easy', 'difficult'],
    ['secure', 'risky', 'unsafe', 'vulnerable']
  ];

  edges.forEach(edge => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (fromNode && toNode) {
      const fromContent = fromNode.data.content.toLowerCase();
      const toContent = toNode.data.content.toLowerCase();
      
      conflictKeywords.forEach(keywords => {
        const fromHas = keywords.some(kw => fromContent.includes(kw));
        const toHas = keywords.some(kw => toContent.includes(kw));
        
        if (fromHas && toHas) {
          const fromWords = keywords.filter(kw => fromContent.includes(kw));
          const toWords = keywords.filter(kw => toContent.includes(kw));
          
          if (fromWords[0] !== toWords[0]) {
            conflicts.push(edge.id);
          }
        }
      });
    }
  });
  
  return conflicts;
};

// ============================================================================
// NODE TYPE CONFIGURATIONS
// ============================================================================

const nodeTypeConfig: Record<NodeType, { 
  icon: React.ReactNode; 
  color: string; 
  bgGradient: string;
  borderColor: string;
}> = {
  intent: {
    icon: <Target size={16} />,
    color: 'text-blue-400',
    bgGradient: 'from-blue-500/10 to-blue-600/5',
    borderColor: 'border-blue-500/30'
  },
  hypothesis: {
    icon: <HelpCircle size={16} />,
    color: 'text-purple-400',
    bgGradient: 'from-purple-500/10 to-purple-600/5',
    borderColor: 'border-purple-500/30'
  },
  decision: {
    icon: <CheckCircle size={16} />,
    color: 'text-green-400',
    bgGradient: 'from-green-500/10 to-green-600/5',
    borderColor: 'border-green-500/30'
  },
  memory: {
    icon: <Brain size={16} />,
    color: 'text-amber-400',
    bgGradient: 'from-amber-500/10 to-amber-600/5',
    borderColor: 'border-amber-500/30'
  },
  conflict: {
    icon: <AlertTriangle size={16} />,
    color: 'text-red-400',
    bgGradient: 'from-red-500/10 to-red-600/5',
    borderColor: 'border-red-500/30'
  }
};

const statusConfig: Record<NodeStatus, { color: string; label: string }> = {
  idle: { color: 'bg-gray-500', label: 'Idle' },
  processing: { color: 'bg-blue-500 animate-pulse', label: 'Processing' },
  validated: { color: 'bg-green-500', label: 'Validated' },
  error: { color: 'bg-red-500', label: 'Error' }
};

// ============================================================================
// COMPONENTS
// ============================================================================

const NodeComponent: React.FC<{
  node: Node;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent, offset: Position) => void;
  onConnect: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onContentChange: (content: string) => void;
  onLabelChange: (label: string) => void;
  isConflicted: boolean;
}> = ({ node, selected, onSelect, onDragStart, onConnect, onContextMenu, onResizeStart, onContentChange, onLabelChange, isConflicted }) => {
  const config = nodeTypeConfig[node.data.type];
  const statusCfg = statusConfig[node.data.status];
  
  return (
    <div
      className={`absolute backdrop-blur-xl rounded-[24px] border transition-all duration-300 overflow-hidden
        ${selected ? 'shadow-[0_0_30px_rgba(59,130,246,0.4)] border-blue-500/50' : 'shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]'}
        ${isConflicted ? 'border-red-500/70 shadow-[0_0_40px_rgba(239,68,68,0.5)]' : config.borderColor}
        bg-gradient-to-br ${config.bgGradient} bg-white/5`}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${node.size.width}px`,
        height: `${node.size.height}px`,
        zIndex: node.zIndex
      }}
      onMouseDown={(e) => {
        onSelect();
        if (e.target === e.currentTarget || (e.target as HTMLElement).className.includes('node-header')) {
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
        <div className="flex items-center gap-2">
          <div className={config.color}>
            {config.icon}
          </div>
          <input
            type="text"
            value={node.data.label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm font-semibold w-32"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusCfg.color}`} title={statusCfg.label} />
          <button
            onClick={onConnect}
            className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
          >
            <Zap size={14} className="text-white/80" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 h-[calc(100%-60px)] overflow-auto">
        <textarea
          value={node.data.content}
          onChange={(e) => onContentChange(e.target.value)}
          className="w-full h-full resize-none bg-transparent border-none outline-none text-white/90 text-sm placeholder-white/30"
          placeholder="Enter your thoughts..."
          onClick={(e) => e.stopPropagation()}
        />
        
        {node.data.metadata && (
          <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50 space-y-1">
            {node.data.metadata.confidence !== undefined && (
              <div>Confidence: {(node.data.metadata.confidence * 100).toFixed(0)}%</div>
            )}
            {node.data.metadata.impact && (
              <div className={`inline-block px-2 py-0.5 rounded ${
                node.data.metadata.impact === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                Impact: {node.data.metadata.impact}
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
        className="absolute bottom-3 right-10 w-3 h-3 bg-blue-500 rounded-full cursor-pointer hover:scale-150 transition-transform shadow-lg"
        onMouseDown={onConnect}
      />
    </div>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

const EchoOS: React.FC = () => {
  // Load from storage
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
      size: { width: 300, height: 200 },
      data: {
        label: 'Welcome',
        type: 'intent',
        content: 'Welcome to EchoOS Exocortex!\n\nThis is your external brain. Create nodes to organize thoughts, detect conflicts, and expand ideas with AI.',
        status: 'idle',
        metadata: { timestamp: Date.now() }
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

  const [viewport, setViewport] = useState<Position>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [resizingNode, setResizingNode] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ size: Size; mouse: Position } | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectingPos, setConnectingPos] = useState<Position | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ show: false, position: { x: 0, y: 0 }, nodeId: null });
  const [maxZIndex, setMaxZIndex] = useState(1);
  const [conflictedEdges, setConflictedEdges] = useState<string[]>([]);
  const [showInsights, setShowInsights] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Save to storage
  useEffect(() => {
    localStorage.setItem('echo-os-nodes', JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem('echo-os-edges', JSON.stringify(edges));
  }, [edges]);

  // Detect conflicts
  useEffect(() => {
    const conflicts = detectConflicts(nodes, edges);
    setConflictedEdges(conflicts);
  }, [nodes, edges]);

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
      updateNode(draggedNode, {
        position: {
          x: (e.clientX - viewport.x) / zoom - dragOffset.x,
          y: (e.clientY - viewport.y) / zoom - dragOffset.y
        }
      });
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

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNode(null);
    setResizingNode(null);
    setResizeStart(null);
    setConnectingFrom(null);
    setConnectingPos(null);
  };

  // Node management
  const createNode = (type: NodeType) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      position: { x: (-viewport.x / zoom) + 200, y: (-viewport.y / zoom) + 200 },
      size: { width: 300, height: 250 },
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
  };

  const updateNode = (id: string, updates: Partial<Node>) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const deleteNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
    setEdges(edges.filter(e => e.from !== id && e.to !== id));
  };

  const duplicateNode = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (node) {
      const newNode = {
        ...node,
        id: `node-${Date.now()}`,
        position: { x: node.position.x + 30, y: node.position.y + 30 },
        zIndex: maxZIndex + 1
      };
      setNodes([...nodes, newNode]);
      setMaxZIndex(maxZIndex + 1);
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
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        from: connectingFrom,
        to: toId,
        validated: false
      };
      setEdges([...edges, newEdge]);
    }
  };

  // AI Functions
  const expandIntent = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    updateNode(nodeId, { data: { ...node.data, status: 'processing' } });

    // Simulate AI expansion
    setTimeout(() => {
      const newNodes: Node[] = [
        {
          id: `node-${Date.now()}-1`,
          position: { x: node.position.x + 350, y: node.position.y - 100 },
          size: { width: 280, height: 200 },
          data: {
            label: 'Sub-goal 1',
            type: 'hypothesis',
            content: `Breaking down: ${node.data.content.slice(0, 50)}...`,
            status: 'idle',
            metadata: { confidence: 0.7, timestamp: Date.now() }
          },
          zIndex: maxZIndex + 1
        },
        {
          id: `node-${Date.now()}-2`,
          position: { x: node.position.x + 350, y: node.position.y + 100 },
          size: { width: 280, height: 200 },
          data: {
            label: 'Sub-goal 2',
            type: 'hypothesis',
            content: 'Alternative approach to consider',
            status: 'idle',
            metadata: { confidence: 0.6, timestamp: Date.now() }
          },
          zIndex: maxZIndex + 2
        }
      ];

      setNodes([...nodes, ...newNodes]);
      setEdges([
        ...edges,
        { id: `edge-${Date.now()}-1`, from: nodeId, to: newNodes[0].id, validated: false },
        { id: `edge-${Date.now()}-2`, from: nodeId, to: newNodes[1].id, validated: false }
      ]);
      setMaxZIndex(maxZIndex + 2);
      updateNode(nodeId, { data: { ...node.data, status: 'validated' } });
    }, 1500);
  };

  const generateInsights = () => {
    const insights: string[] = [];
    
    // Count node types
    const typeCounts: Record<string, number> = {};
    nodes.forEach(n => {
      typeCounts[n.data.type] = (typeCounts[n.data.type] || 0) + 1;
    });
    
    insights.push(`Graph contains ${nodes.length} nodes and ${edges.length} connections.`);
    insights.push(`Node distribution: ${Object.entries(typeCounts).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
    
    if (conflictedEdges.length > 0) {
      insights.push(`⚠️ ${conflictedEdges.length} potential conflicts detected!`);
    }
    
    const cogLoad = calculateCognitiveLoad(nodes.length, edges.length);
    insights.push(`Cognitive load: ${cogLoad.toFixed(1)} ${cogLoad < 20 ? '(Optimal)' : cogLoad < 50 ? '(Moderate)' : '(High - consider organizing)'}`);
    
    return insights.join('\n\n');
  };

  // Search commands
  const handleSearch = () => {
    const q = searchQuery.toLowerCase();
    if (q.includes('intent')) createNode('intent');
    else if (q.includes('hypothesis')) createNode('hypothesis');
    else if (q.includes('decision')) createNode('decision');
    else if (q.includes('memory')) createNode('memory');
    else if (q.includes('conflict')) createNode('conflict');
    else if (q.includes('expand') && selectedNode) expandIntent(selectedNode);
    else if (q.includes('insights') || q.includes('explain')) setShowInsights(true);
    else if (q.includes('clear')) {
      if (window.confirm('Clear all nodes and edges?')) {
        setNodes([]);
        setEdges([]);
      }
    }
    setSearchQuery('');
  };

  const cogLoad = calculateCognitiveLoad(nodes.length, edges.length);

  return (
    <div className="w-full h-screen bg-slate-950 overflow-hidden relative">
      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white/5 backdrop-blur-xl rounded-full px-5 py-3 flex items-center gap-3 border border-white/10 shadow-2xl">
          <Search className="text-white/60" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder='Try "create intent" or "expand" or "insights"...'
            className="bg-transparent border-none outline-none text-white placeholder-white/30 w-96 text-sm"
          />
        </div>
      </div>

      {/* Cognitive Load Monitor */}
      <div className={`absolute top-4 left-4 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/10 shadow-xl z-50 ${getLoadBg(cogLoad)}`}>
        <div className="flex items-center gap-3">
          <Activity className={`${getLoadColor(cogLoad)}`} size={20} />
          <div>
            <div className={`text-sm font-semibold ${getLoadColor(cogLoad)}`}>
              Load: {cogLoad.toFixed(1)}
            </div>
            <div className="text-xs text-white/50">
              {cogLoad < 20 ? 'Optimal' : cogLoad < 50 ? 'Moderate' : 'High'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Menu */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110"
        >
          <Plus className="text-white" size={24} />
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-2 w-56 border border-white/10">
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
            <hr className="my-2 border-white/10" />
            <button onClick={() => selectedNode && expandIntent(selectedNode)} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-purple-400 transition-colors">
              <Sparkles size={18} /> Expand Selected
            </button>
            <button onClick={() => setShowInsights(true)} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 text-blue-400 transition-colors">
              <Eye size={18} /> View Insights
            </button>
          </div>
        )}
      </div>

      {/* Insights Panel */}
      {showInsights && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowInsights(false)}>
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 max-w-2xl w-full mx-4 border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Brain className="text-blue-400" />
              Graph Insights
            </h2>
            <pre className="text-white/80 text-sm whitespace-pre-wrap font-mono bg-black/30 p-4 rounded-xl">
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
          className="absolute bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl p-2 w-48 z-50 border border-white/10"
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
      <div className="absolute bottom-4 left-4 bg-white/5 backdrop-blur-xl rounded-2xl px-4 py-3 text-white/80 text-sm z-50 border border-white/10">
        <div className="font-semibold">
          Nodes: {nodes.length} | Edges: {edges.length} | Conflicts: {conflictedEdges.length}
        </div>
        <div className="text-xs text-white/50 mt-1">
          Scroll: Pan | Ctrl+Scroll: Zoom | Right-click: Options
        </div>
      </div>

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
              <path
                key={edge.id}
                d={calculatePipePath(from, to)}
                stroke={isConflicted ? 'url(#conflict-gradient)' : 'url(#edge-gradient)'}
                strokeWidth={isConflicted ? 4 : 2}
                fill="none"
                className={`drop-shadow-lg ${isConflicted ? 'animate-pulse' : ''}`}
              />
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
                strokeWidth="2"
                strokeDasharray="8,4"
                fill="none"
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
          {nodes.map(node => (
            <NodeComponent
              key={node.id}
              node={node}
              selected={selectedNode === node.id}
              onSelect={() => {
                setSelectedNode(node.id);
                bringToFront(node.id);
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
      </div>
    </div>
  );
};

export default EchoOS;