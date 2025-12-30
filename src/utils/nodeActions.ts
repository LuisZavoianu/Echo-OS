// src/utils/nodeActions.ts
import { v4 as uuidv4 } from 'uuid';

export const handleCreateFolder = (
  nodes: any[],
  setNodes: Function,
  selectedNodeId: string | null,
  setSelectedNode: Function
) => {
  if (!selectedNodeId) {
    alert("Selectează un nod mai întâi!");
    return;
  }

  const targetNode = nodes.find(n => n.id === selectedNodeId);
  if (!targetNode) return;

  const folderNode = {
    id: uuidv4(),
    type: 'folder',
    position: { x: targetNode.position.x + 50, y: targetNode.position.y + 50 },
    size: { width: 300, height: 400 },
    zIndex: Math.max(...nodes.map(n => n.zIndex || 0)) + 1,
    data: {
      label: "Arhivă Nouă",
      type: 'folder',
      containedNodes: [targetNode], // Punem nodul curent în folder
      status: 'idle'
    }
  };

  // Scoatem nodul original și adăugăm folderul
  setNodes((prev: any[]) => [
    ...prev.filter(n => n.id !== selectedNodeId),
    folderNode
  ]);
  
  setSelectedNode(null);
};