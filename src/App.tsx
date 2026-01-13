import { Whiteboard } from './components/Whiteboard';
import { Toolbar } from './components/Toolbar';
import { ShapeToolbar } from './components/ShapeToolbar';
import { PdfViewer } from './components/PdfViewer';
import FloatingStopwatch from './components/Stopwatch';
import Ruler from './components/tabs/Ruler';
import Triangle45 from './components/tabs/Triangle45';
import Triangle60 from './components/tabs/Triangle60';
import NumberLine from './components/tabs/NumberLine';
import { useWhiteboardStore } from './store/useWhiteboardStore';


function App() {
  const { showRuler, showTriangle45, showTriangle60, showProtractor, showNumberLine } = useWhiteboardStore();
  
  return (
    <div className="relative w-full h-screen overflow-hidden">
      <Toolbar />
      <ShapeToolbar />
      <PdfViewer />
      <FloatingStopwatch />
      {showRuler && <Ruler />}
      {showTriangle45 && <Triangle45 />}
      {showTriangle60 && <Triangle60 />}
      {showNumberLine && <NumberLine />}
      <Whiteboard />
    </div>
  );
}

export default App;
