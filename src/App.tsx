import { Whiteboard } from './components/Whiteboard';
import { Toolbar } from './components/Toolbar';
import { ShapeToolbar } from './components/ShapeToolbar';
import { PdfViewer } from './components/PdfViewer';
import FloatingStopwatch from './components/Stopwatch';


function App() {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      <Toolbar />
      <ShapeToolbar />
      <PdfViewer />
      <FloatingStopwatch />
      <Whiteboard />
    </div>
  );
}

export default App;
