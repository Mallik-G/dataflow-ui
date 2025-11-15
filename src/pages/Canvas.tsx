import { useEffect } from 'react';
import CanvasComponent from '../components/Canvas';
import { useCanvasStore } from '../stores/canvasStore';
import { generateLineageView } from '../utils/lineageGenerator';
import { generateDataflowView } from '../utils/dataflowGenerator';

const Canvas = () => {
  const {
    setNodes,
    setEdges,
    viewMode,
    selectedCatalogObject,
    selectedDataFlowId,
    upstreamLevels,
    downstreamLevels,
  } = useCanvasStore();

  useEffect(() => {
    if (viewMode === 'lineage' && selectedCatalogObject) {
      const { nodes, edges } = generateLineageView(
        selectedCatalogObject,
        upstreamLevels,
        downstreamLevels
      );
      setNodes(nodes);
      setEdges(edges);
    } else if (viewMode === 'dataflow' && selectedDataFlowId) {
      const { nodes, edges } = generateDataflowView(selectedDataFlowId);
      setNodes(nodes);
      setEdges(edges);
    } else {
      // Clear canvas when nothing is selected
      setNodes([]);
      setEdges([]);
    }
  }, [
    viewMode,
    selectedCatalogObject,
    selectedDataFlowId,
    upstreamLevels,
    downstreamLevels,
    setNodes,
    setEdges,
  ]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <CanvasComponent />
    </div>
  );
};

export default Canvas;
