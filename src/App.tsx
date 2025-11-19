import { useState, useEffect } from 'react';
import './App.css';
import MongoDB from './pages/MongoDBCompare';
import DiffViewer from './pages/DiffViewer';
import ConnectionManager from './pages/ConnectionManager';

type Tab = 'mongodb' | 'diffviewer';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('mongodb');
  const [connections, setConnections] = useState<Record<string, string>>({});
  const [isConnectionManagerOpen, setIsConnectionManagerOpen] = useState<boolean>(false);

  // Load connections from settings
  const loadConnections = async () => {
    try {
      const settings = await window.settings.read();
      setConnections(settings.connections || {});
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  return (
    <div className="app">
      <div className="container">
        <h1>OmniMongo</h1>
        <div style={{ marginBottom: '0px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setIsConnectionManagerOpen(true)}
            title="Manage MongoDB connections (saved to ~/.omnimongo/settings.json)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#10b981';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
            }}
          >
            <svg width="16px" height="16px" viewBox="0 0 48 48">
              <g id="Layer_2" data-name="Layer 2">
                <g id="invisible_box" data-name="invisible box">
                  <rect width="48" height="48" fill="none" />
                </g>
                <g id="Layer_6" data-name="Layer 6">
                  <g>
                    <path d="M25.6,25.6,22.2,29,19,25.8l3.4-3.4a2,2,0,0,0-2.8-2.8L16.2,23l-1.3-1.3a1.9,1.9,0,0,0-2.8,0l-3,3a9.8,9.8,0,0,0-3,7,9.1,9.1,0,0,0,1.8,5.6L4.6,40.6a1.9,1.9,0,0,0,0,2.8,1.9,1.9,0,0,0,2.8,0l3.2-3.2a10.1,10.1,0,0,0,5.9,1.9,10.2,10.2,0,0,0,7.1-2.9l3-3a2,2,0,0,0,.6-1.4,1.7,1.7,0,0,0-.6-1.4L25,31.8l3.4-3.4a2,2,0,0,0-2.8-2.8ZM20.8,36.4a6.1,6.1,0,0,1-8.5,0l-.4-.4a6.4,6.4,0,0,1-1.8-4.3,6,6,0,0,1,1.8-4.2l1.6-1.6,8.8,8.9Z" />
                    <path d="M43.4,4.6a1.9,1.9,0,0,0-2.8,0L37.2,8a10,10,0,0,0-13,.9l-3,3a2,2,0,0,0-.6,1.4,1.7,1.7,0,0,0,.6,1.4L32.9,26.4a1.9,1.9,0,0,0,2.8,0l3-2.9a9.9,9.9,0,0,0,2.9-7.1A10.4,10.4,0,0,0,40,10.9l3.4-3.5A1.9,1.9,0,0,0,43.4,4.6Zm-7.5,16-1.6,1.6-8.9-8.9L27,11.8a5.9,5.9,0,0,1,8.5,0l.4.3a6.3,6.3,0,0,1,1.7,4.3A5.9,5.9,0,0,1,35.9,20.6Z" />
                  </g>
                </g>
              </g>
            </svg>
            Connections
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div className="tabs">
            <button
              className={`tab-button ${activeTab === 'mongodb' ? 'active' : ''}`}
              onClick={() => setActiveTab('mongodb')}
            >
              Compare Collections
            </button>
            <button
              className={`tab-button ${activeTab === 'diffviewer' ? 'active' : ''}`}
              onClick={() => setActiveTab('diffviewer')}
            >
              Diff Viewer
            </button>
          </div>


        </div>

        {activeTab === 'mongodb' && <MongoDB connections={connections} onConnectionsChange={loadConnections} />}
        {activeTab === 'diffviewer' && <DiffViewer connections={connections} />}

        <ConnectionManager
          isOpen={isConnectionManagerOpen}
          onClose={() => setIsConnectionManagerOpen(false)}
          onConnectionsUpdated={loadConnections}
        />
      </div>
    </div>
  );
}

export default App;
