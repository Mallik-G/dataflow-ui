import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Canvas from './pages/Canvas';
import Observe from './pages/Observe';
import Deploy from './pages/Deploy';
import Promotions from './pages/Promotions';
import Connections from './pages/Connections';
import Glossary from './pages/Glossary';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/canvas" element={<Canvas />} />
          <Route path="/observe" element={<Observe />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
