// src/hooks/useFolderLogic.ts

export const useFolderLogic = (nodes, setNodes, setSelectedNode) => {
  const createFolder = (selectedNodeId) => {
    if (!selectedNodeId) return alert("Selectează un nod pentru a începe!");

    // Momentan, pentru că ai selecție simplă, facem folder dintr-un singur nod
    // sau putem implementa aici logica de a "aduna" nodurile vecine
    const targetNode = nodes.find(n => n.id === selectedNodeId);
    if (!targetNode) return;

    const folderId = crypto.randomUUID();

    const folderNode = {
      id: folderId,
      type: 'folder',
      position: { ...targetNode.position },
      size: { width: 300, height: 400 },
      zIndex: Math.max(...nodes.map(n => n.zIndex || 0)) + 1,
      data: {
        label: "Archive",
        type: 'folder',
        containedNodes: [targetNode], 
        status: 'idle'
      }
    };

    setNodes((prev: any[]) => [
      ...prev.filter(n => n.id !== selectedNodeId),
      folderNode
    ]);
    setSelectedNode(null);
  };

  return { createFolder };
};