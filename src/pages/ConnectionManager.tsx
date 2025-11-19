import { useState, useEffect } from 'react';
import './ConnectionManager.css';

interface ConnectionManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onConnectionsUpdated: () => void;
}

export default function ConnectionManager({ isOpen, onClose, onConnectionsUpdated }: ConnectionManagerProps) {
    const [connections, setConnections] = useState<Record<string, string>>({});
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadConnections();
        }
    }, [isOpen]);

    const loadConnections = async () => {
        try {
            const settings = await window.settings.read();
            setConnections(settings.connections || {});
        } catch (err: any) {
            setError('Failed to load connections: ' + err.message);
        }
    };

    const handleAddConnection = async () => {
        if (!newName.trim() || !newUrl.trim()) {
            setError('Both name and URL are required');
            return;
        }

        if (connections[newName]) {
            setError('A connection with this name already exists');
            return;
        }

        const updatedConnections = {
            ...connections,
            [newName]: newUrl
        };

        try {
            const result = await window.settings.write({ connections: updatedConnections });
            if (result.success) {
                setConnections(updatedConnections);
                setNewName('');
                setNewUrl('');
                setError('');
                onConnectionsUpdated();
            } else {
                setError('Failed to save connection: ' + result.error);
            }
        } catch (err: any) {
            setError('Failed to save connection: ' + err.message);
        }
    };

    const handleRemoveConnection = async (name: string) => {
        const updatedConnections = { ...connections };
        delete updatedConnections[name];

        try {
            const result = await window.settings.write({ connections: updatedConnections });
            if (result.success) {
                setConnections(updatedConnections);
                setError('');
                onConnectionsUpdated();
            } else {
                setError('Failed to remove connection: ' + result.error);
            }
        } catch (err: any) {
            setError('Failed to remove connection: ' + err.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Manage MongoDB Connections</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        backgroundColor: '#edf2f7',
                        borderRadius: '6px',
                        marginBottom: '20px',
                        fontSize: '13px',
                        color: '#4a5568'
                    }}>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0 }}
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <span>Connections are saved to <code style={{
                            backgroundColor: '#cbd5e0',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '12px',
                            fontFamily: 'monospace'
                        }}>~/.omnimongo/settings.json</code></span>
                    </div>

                    {error && (
                        <div className="error-banner">
                            {error}
                        </div>
                    )}

                    {/* Add New Connection */}
                    <div className="add-connection-section">
                        <h3>Add New Connection</h3>
                        <div className="connection-form">
                            <div className="form-row">
                                <input
                                    type="text"
                                    placeholder="Connection Name (e.g., localhost)"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="connection-input"
                                />
                            </div>
                            <div className="form-row">
                                <input
                                    type="text"
                                    placeholder="MongoDB URL (e.g., mongodb://localhost:27017/mydb)"
                                    value={newUrl}
                                    onChange={(e) => setNewUrl(e.target.value)}
                                    className="connection-input"
                                />
                            </div>
                            <button onClick={handleAddConnection} className="add-button">
                                Add Connection
                            </button>
                        </div>
                    </div>

                    {/* Existing Connections */}
                    <div className="connections-list-section">
                        <h3>Existing Connections</h3>
                        {Object.keys(connections).length === 0 ? (
                            <p className="no-connections">No connections configured</p>
                        ) : (
                            <div className="connections-list">
                                {Object.entries(connections).map(([name, url]) => (
                                    <div key={name} className="connection-item">
                                        <div className="connection-info">
                                            <strong>{name}</strong>
                                            <span className="connection-url">{url}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveConnection(name)}
                                            className="remove-button"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="close-modal-button">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
