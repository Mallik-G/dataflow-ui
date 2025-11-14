import { useEffect } from 'react';
import Canvas from './components/Canvas';
import { useCanvasStore } from './stores/canvasStore';
import { sampleNodes, sampleEdges } from './utils/sampleData';

function App() {
  const { setNodes, setEdges } = useCanvasStore();

  useEffect(() => {
    // Load sample data on mount
    setNodes(sampleNodes);
    setEdges(sampleEdges);
  }, [setNodes, setEdges]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas />
    </div>
  );
}

export default App;
