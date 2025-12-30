import React from 'react';
import { TextNode } from './TextNode';
import { ImageNode } from './ImageNode';
import { AiProcessorNode } from './AiProcessorNode';

interface AppRunnerProps {
  node: any;
  onUpdate: (id: string, data: any) => void;
  allNodes: any[];    // Adăugăm asta
  setNodes: any;      // Adăugăm asta
}

export const AppRunner = ({ node, onUpdate, allNodes, setNodes }: AppRunnerProps) => {
  switch (node.data.type) {
    case 'ai-process':
      return <AiProcessorNode allNodes={allNodes} setNodes={setNodes} />;
    
    case 'hypothesis':
      return <ImageNode node={node} onUpdate={onUpdate} />;
    
    case 'intent':
    default:
      return <TextNode node={node} onUpdate={onUpdate} />;
  }
};