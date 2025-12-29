import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Zap, FileText, Music, Code, Globe, Sparkles, Maximize2, Trash2, Copy } from 'lucide-react';

// Types
interface Position { x: number; y: number; }
interface Size { width: number; height: number; }

interface NodeContent {
  text?: string;
  url?: string;
  code?: string;
  output?: string;
}

interface Node {
  id: string;
  type: 'block-editor' | 'media-node' | 'code-capsule' | 'web-portal' | 'note';
  position: Position;
  size: Size;
  content: NodeContent;
  zIndex: number;
}

interface Pipe {
  id: string;
  from: string;
  to: string;
}

interface ContextMenu {
  show: boolean;
  position: Position;
  nodeId: string | null;
}

// Utility: Calculate line path for pipes
const calculatePipePath = (from: Position, to: Position): string => {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
};

// Component: Base Node Header
const NodeHeader: React.FC<{
  node: Node;
  onConnect: (e: React.MouseEvent) => void;
  onDelete: () => void;
}> = ({ node, onConnect, onDelete }) => {
  const icons = {
    note: <FileText size={16} />,
    'media-node': <Music size={16} />,
    'code-capsule': <Code size={16} />,
    'block-editor': <FileText size={16} />,
    'web-portal': <Globe size={16} />
  };

  const titles = {
    note: 'Note',
    'media-node': 'Media',
    'code-capsule': 'Code',
    'block-editor': 'Editor',
    'web-portal': 'Web'
  };

  return (
    <div className="node-header bg-gradient-to-r from-purple-500 to-blue-500 p-2 flex items-center justify-between cursor-move">
      <div className="flex items-center gap-2 text-white">
        {icons[node.type]}
        <span className="text-sm font-semibold">{titles[node.type]}</span>
      </div>
      <div className="flex gap-1">
        <button
          onClick={onConnect}
          className="w-6 h-6 bg-white/20 hover:bg-white/40 rounded flex items-center justify-center transition-colors"
          title="Connect"
        >
          <Zap size={14} />
        </button>
        <button
          onClick={onDelete}
          className="w-6 h-6 bg-white/20 hover:bg-red-500 rounded flex items-center justify-center transition-colors"
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// Component: Note Node
const NoteContent: React.FC<{
  content: NodeContent;
  onChange: (content: NodeContent) => void;
}> = ({ content, onChange }) => (
  <textarea
    className="w-full h-full resize-none border-none outline-none p-3 bg-yellow-50"
    value={content.text || ''}
    onChange={(e) => onChange({ ...content, text: e.target.value })}
    placeholder="Write a note..."
    onClick={(e) => e.stopPropagation()}
  />
);

// Component: Code Capsule Node
const CodeContent: React.FC<{
  content: NodeContent;
  onChange: (content: NodeContent) => void;
  onExecute: () => void;
}> = ({ content, onChange, onExecute }) => (
  <div className="flex flex-col h-full">
    <textarea
      className="flex-1 resize-none border-none outline-none p-3 font-mono text-sm bg-gray-900 text-green-400"
      value={content.code || ''}
      onChange={(e) => onChange({ ...content, code: e.target.value })}
      placeholder="// Write JavaScript code here\n// Use 'return' to output results"
      onClick={(e) => e.stopPropagation()}
    />
    <div className="border-t border-gray-300 p-2 flex items-center justify-between bg-gray-50">
      <button
        onClick={onExecute}
        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors"
      >
        ▶ Execute
      </button>
      {content.output && (
        <span className="text-xs text-gray-600 truncate ml-2">Output: {content.output}</span>
      )}
    </div>
  </div>
);

// Component: Web Portal Node
const WebPortalContent: React.FC<{
  content: NodeContent;
  onChange: (content: NodeContent) => void;
}> = ({ content, onChange }) => {
  const [inputUrl, setInputUrl] = useState(content.url || '');

  return (
    <div className="flex flex-col h-full">
      <input
        type="text"
        className="w-full p-2 text-sm border-b border-gray-300 outline-none"
        placeholder="https://example.com"
        value={inputUrl}
        onChange={(e) => setInputUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            let url = inputUrl;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
              url = 'https://' + url;
            }
            onChange({ ...content, url });
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1 bg-white relative overflow-hidden">
        {content.url ? (
          <iframe
            src={content.url}
            className="w-full h-full border-none"
            title="Web Portal"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Globe size={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Enter a URL and press Enter</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Component: Media Node
const MediaContent: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="relative">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center animate-pulse">
        <Music className="text-white" size={40} />
      </div>
      <div className="absolute inset-0 w-24 h-24 rounded-full bg-purple-500 animate-ping opacity-20"></div>
    </div>
  </div>
);

// Main Component
const EchoOS: React.FC = () => {
  // Canvas state
  const [viewport, setViewport] = useState<Position>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });

  // Nodes state
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'welcome',
      type: 'note',
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 },
      content: { text: 'Welcome to EchoOS!\n\nPress "+" to create new nodes.\n\nUse your mouse to navigate the infinite space.\n\nRight-click nodes for more options.' },
      zIndex: 1
    }
  ]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [resizingNode, setResizingNode] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ size: Size; mouse: Position } | null>(null);

  // Pipes state
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [connectingPipe, setConnectingPipe] = useState<{ from: string; pos: Position } | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ show: false, position: { x: 0, y: 0 }, nodeId: null });
  const [maxZIndex, setMaxZIndex] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedNodes = localStorage.getItem('echo_nodes');
    const savedPipes = localStorage.getItem('echo_pipes');
    
    if (savedNodes) {
      try {
        setNodes(JSON.parse(savedNodes));
      } catch (e) {
        console.error("Eroare la încărcarea nodurilor:", e);
      }
    }
    
    if (savedPipes) {
      try {
        setPipes(JSON.parse(savedPipes));
      } catch (e) {
        console.error("Eroare la încărcarea pipes:", e);
      }
    }
  }, []); 

  useEffect(() => {
    localStorage.setItem('echo_nodes', JSON.stringify(nodes));
    localStorage.setItem('echo_pipes', JSON.stringify(pipes));
  }, [nodes, pipes]);


  // Canvas handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      const newZoom = Math.min(Math.max(0.1, zoom + delta), 3);
      setZoom(newZoom);
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

    if (connectingPipe) {
      setConnectingPipe({
        ...connectingPipe,
        pos: { x: e.clientX, y: e.clientY }
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNode(null);
    setResizingNode(null);
    setResizeStart(null);
    setConnectingPipe(null);
  };

  // Node management
  const createNode = (type: Node['type']) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: {
        x: (-viewport.x / zoom) + 200,
        y: (-viewport.y / zoom) + 200
      },
      size: type === 'media-node' ? { width: 200, height: 200 } : { width: 350, height: 300 },
      content: {},
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
    setPipes(pipes.filter(p => p.from !== id && p.to !== id));
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

  // Pipe management
  const startConnecting = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectingPipe({ from: nodeId, pos: { x: e.clientX, y: e.clientY } });
  };

  const finishConnecting = (toNodeId: string) => {
    if (connectingPipe && connectingPipe.from !== toNodeId) {
      const newPipe: Pipe = {
        id: `pipe-${Date.now()}`,
        from: connectingPipe.from,
        to: toNodeId
      };
      setPipes([...pipes, newPipe]);
      executePipe(connectingPipe.from, toNodeId);
    }
    setConnectingPipe(null);
  };

  const executePipe = (fromId: string, toId: string) => {
    const fromNode = nodes.find(n => n.id === fromId);
    const toNode = nodes.find(n => n.id === toId);

    if (fromNode && toNode) {
      // Code execution: Code -> Any node
      if (fromNode.type === 'code-capsule' && fromNode.content.code) {
        try {
          const userCode = new Function(fromNode.content.code);
          const result = userCode();
          
          updateNode(fromId, {
            content: { ...fromNode.content, output: String(result) }
          });
          
          if (toNode.type === 'note') {
            updateNode(toId, {
              content: { ...toNode.content, text: (toNode.content.text || '') + `\n> Result: ${result}` }
            });
          }
        } catch (err: any) {
          updateNode(fromId, {
            content: { ...fromNode.content, output: `Error: ${err.message}` }
          });
        }
      }
      
      // Data transfer: Note -> Code
      if (fromNode.type === 'note' && toNode.type === 'code-capsule') {
        updateNode(toId, {
          content: { ...toNode.content, code: `// Data from note "${fromId}"\n${toNode.content.code || ''}` }
        });
      }
    }
  };

  const executeCode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.type === 'code-capsule' && node.content.code) {
      try {
        const userCode = new Function(node.content.code);
        const result = userCode();
        updateNode(nodeId, {
          content: { ...node.content, output: String(result) }
        });
      } catch (err: any) {
        updateNode(nodeId, {
          content: { ...node.content, output: `Error: ${err.message}` }
        });
      }
    }
  };

  // Search and commands
  const handleSearch = () => {
    const query = searchQuery.toLowerCase();

    if (query.includes('create') || query.includes('new')) {
      if (query.includes('note')) createNode('note');
      else if (query.includes('code')) createNode('code-capsule');
      else if (query.includes('editor')) createNode('block-editor');
      else if (query.includes('media') || query.includes('music')) createNode('media-node');
      else if (query.includes('web') || query.includes('portal')) createNode('web-portal');
    } else if (query.includes('organize') || query.includes('arrange')) {
      autoOrganize();
    } else if (query.includes('clear') || query.includes('delete all')) {
      if (window.confirm('Delete all nodes?')) {
        setNodes([]);
        setPipes([]);
      }
    }

    setSearchQuery('');
  };

  const autoOrganize = () => {
    let x = 50;
    let y = 50;
    const spacing = 50;

    const organized = [...nodes].sort((a, b) => a.type.localeCompare(b.type));
    organized.forEach((node) => {
      updateNode(node.id, { position: { x, y } });
      x += node.size.width + spacing;
      if (x > 1200) {
        x = 50;
        y += 350;
      }
    });
  };

  // Context menu
  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      position: { x: e.clientX, y: e.clientY },
      nodeId
    });
  };

  // Render node
  const renderNode = (node: Node) => {
    return (
      <div
        key={node.id}
        className={`absolute bg-white rounded-lg shadow-2xl border-2 ${
          selectedNode === node.id ? 'border-blue-500' : 'border-gray-200'
        } overflow-hidden transition-shadow hover:shadow-3xl`}
        style={{
          left: `${node.position.x}px`,
          top: `${node.position.y}px`,
          width: `${node.size.width}px`,
          height: `${node.size.height}px`,
          zIndex: node.zIndex
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          setSelectedNode(node.id);
          bringToFront(node.id);
          if (e.target === e.currentTarget || (e.target as HTMLElement).className.includes('node-header')) {
            setDraggedNode(node.id);
            setDragOffset({
              x: (e.clientX - viewport.x) / zoom - node.position.x,
              y: (e.clientY - viewport.y) / zoom - node.position.y
            });
          }
        }}
        onContextMenu={(e) => handleContextMenu(e, node.id)}
      >
        <NodeHeader
          node={node}
          onConnect={(e) => startConnecting(node.id, e)}
          onDelete={() => deleteNode(node.id)}
        />

        <div className="h-[calc(100%-40px)] overflow-hidden">
          {node.type === 'note' && (
            <NoteContent
              content={node.content}
              onChange={(content) => updateNode(node.id, { content })}
            />
          )}
          {node.type === 'block-editor' && (
            <NoteContent
              content={node.content}
              onChange={(content) => updateNode(node.id, { content })}
            />
          )}
          {node.type === 'code-capsule' && (
            <CodeContent
              content={node.content}
              onChange={(content) => updateNode(node.id, { content })}
              onExecute={() => executeCode(node.id)}
            />
          )}
          {node.type === 'web-portal' && (
            <WebPortalContent
              content={node.content}
              onChange={(content) => updateNode(node.id, { content })}
            />
          )}
          {node.type === 'media-node' && <MediaContent />}
        </div>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize hover:bg-blue-300 rounded-tl transition-colors"
          onMouseDown={(e) => {
            e.stopPropagation();
            setResizingNode(node.id);
            setResizeStart({
              size: { ...node.size },
              mouse: { x: e.clientX, y: e.clientY }
            });
          }}
        >
          <Maximize2 size={12} className="opacity-40" />
        </div>

        {/* Connection point */}
        <div
          className="absolute bottom-2 right-12 w-4 h-4 bg-blue-500 rounded-full cursor-pointer hover:scale-125 transition-transform shadow-lg"
          onMouseDown={(e) => startConnecting(node.id, e)}
          onMouseUp={() => connectingPipe && finishConnecting(node.id)}
        />
      </div>
    );
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden relative">
      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white/10 backdrop-blur-xl rounded-full px-5 py-3 flex items-center gap-3 border border-white/20 shadow-2xl">
          <Search className="text-white/60" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder='Try "create a note" or "organize"...'
            className="bg-transparent border-none outline-none text-white placeholder-white/40 w-96 text-sm"
          />
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
          <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-2xl p-2 w-56 border border-gray-100">
            <button onClick={() => createNode('note')} className="w-full text-left px-4 py-2 hover:bg-blue-50 rounded-lg flex items-center gap-3 transition-colors">
              <FileText size={18} className="text-yellow-600" /> <span className="font-medium">Note</span>
            </button>
            <button onClick={() => createNode('block-editor')} className="w-full text-left px-4 py-2 hover:bg-blue-50 rounded-lg flex items-center gap-3 transition-colors">
              <FileText size={18} className="text-blue-600" /> <span className="font-medium">Block Editor</span>
            </button>
            <button onClick={() => createNode('code-capsule')} className="w-full text-left px-4 py-2 hover:bg-blue-50 rounded-lg flex items-center gap-3 transition-colors">
              <Code size={18} className="text-green-600" /> <span className="font-medium">Code Capsule</span>
            </button>
            <button onClick={() => createNode('media-node')} className="w-full text-left px-4 py-2 hover:bg-blue-50 rounded-lg flex items-center gap-3 transition-colors">
              <Music size={18} className="text-pink-600" /> <span className="font-medium">Media Node</span>
            </button>
            <button onClick={() => createNode('web-portal')} className="w-full text-left px-4 py-2 hover:bg-blue-50 rounded-lg flex items-center gap-3 transition-colors">
              <Globe size={18} className="text-indigo-600" /> <span className="font-medium">Web Portal</span>
            </button>
            <hr className="my-2 border-gray-200" />
            <button onClick={autoOrganize} className="w-full text-left px-4 py-2 hover:bg-purple-50 rounded-lg flex items-center gap-3 text-purple-600 transition-colors">
              <Sparkles size={18} /> <span className="font-medium">Auto-Organize</span>
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.show && (
        <div
          className="absolute bg-white rounded-lg shadow-2xl p-2 w-48 z-50 border border-gray-100"
          style={{ left: contextMenu.position.x, top: contextMenu.position.y }}
        >
          <button
            onClick={() => {
              if (contextMenu.nodeId) duplicateNode(contextMenu.nodeId);
              setContextMenu({ show: false, position: { x: 0, y: 0 }, nodeId: null });
            }}
            className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
          >
            <Copy size={16} /> Duplicate
          </button>
          <button
            onClick={() => {
              if (contextMenu.nodeId) deleteNode(contextMenu.nodeId);
              setContextMenu({ show: false, position: { x: 0, y: 0 }, nodeId: null });
            }}
            className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 rounded flex items-center gap-2"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      )}

      {/* Info Panel */}
      <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-xl rounded-xl px-4 py-3 text-white/90 text-sm z-50 shadow-xl border border-white/10">
        <div className="font-semibold">Zoom: {(zoom * 100).toFixed(0)}% | Nodes: {nodes.length} | Pipes: {pipes.length}</div>
        <div className="text-xs text-white/60 mt-1">
          Scroll to pan | Ctrl+Scroll to zoom | Drag to move | Right-click for options
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
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
            `,
            backgroundSize: `${50 * zoom}px ${50 * zoom}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`
          }}
        />

        {/* Pipes SVG */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full">
          {pipes.map(pipe => {
            const fromNode = nodes.find(n => n.id === pipe.from);
            const toNode = nodes.find(n => n.id === pipe.to);
            if (!fromNode || !toNode) return null;

            const from = {
              x: (fromNode.position.x + fromNode.size.width / 2) * zoom + viewport.x,
              y: (fromNode.position.y + fromNode.size.height / 2) * zoom + viewport.y
            };
            const to = {
              x: (toNode.position.x + toNode.size.width / 2) * zoom + viewport.x,
              y: (toNode.position.y + toNode.size.height / 2) * zoom + viewport.y
            };

            return (
              <path
                key={pipe.id}
                d={calculatePipePath(from, to)}
                stroke="url(#gradient)"
                strokeWidth="3"
                fill="none"
                className="drop-shadow-lg"
              />
            );
          })}
          {connectingPipe && (() => {
            const fromNode = nodes.find(n => n.id === connectingPipe.from);
            if (!fromNode) return null;
            const from = {
              x: (fromNode.position.x + fromNode.size.width / 2) * zoom + viewport.x,
              y: (fromNode.position.y + fromNode.size.height / 2) * zoom + viewport.y
            };
            return (
              <path
                d={calculatePipePath(from, connectingPipe.pos)}
                stroke="#60a5fa"
                strokeWidth="3"
                strokeDasharray="8,4"
                fill="none"
              />
            );
          })()}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Nodes */}
        <div
          className="absolute"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          {nodes.map(renderNode)}
        </div>
      </div>
    </div>
  );
};

export default EchoOS;