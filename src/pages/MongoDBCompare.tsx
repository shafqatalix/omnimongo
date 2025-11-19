import { useState, useEffect } from 'react';
import { compareCollections, downloadComparisonReport, ComparisonReport } from './comparisonHelpers';



interface QueryResult {
    success: boolean;
    data?: any;
    error?: string;
}

interface MongoDBCompareProps {
    connections: Record<string, string>;
    onConnectionsChange: () => void;
}

export default function MongoDBCompare({ connections }: MongoDBCompareProps) {
    const [environments, setEnvironments] = useState<string[]>([]);
    const [sourceEnvironment, setSourceEnvironment] = useState<string>('');
    const [targetEnvironment, setTargetEnvironment] = useState<string>('');
    const [sourceCollection, setSourceCollection] = useState<string>('');
    const [targetCollection, setTargetCollection] = useState<string>('');
    const [sourceCollections, setSourceCollections] = useState<string[]>([]);
    const [targetCollections, setTargetCollections] = useState<string[]>([]);
    const [result, setResult] = useState<QueryResult | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [loadingSourceCollections, setLoadingSourceCollections] = useState<boolean>(false);
    const [loadingTargetCollections, setLoadingTargetCollections] = useState<boolean>(false);
    const [comparisonReport, setComparisonReport] = useState<ComparisonReport | null>(null);
    const [showJsonViewer, setShowJsonViewer] = useState<boolean>(false);
    const [keyFields, setKeyFields] = useState<string>();

    // Update environments when connections change
    useEffect(() => {
        const envs = Object.keys(connections);
        setEnvironments(envs);

        // Don't set default environments - let user choose
    }, [connections]);
    const loadCollections = async (environment: string, isSource: boolean) => {
        if (isSource) {
            setLoadingSourceCollections(true);
        } else {
            setLoadingTargetCollections(true);
        }

        try {

            const url = connections[environment];
            //console.log('Loading collections from URL:', url, environment);
            if (isSource) {
                const collections = await window.mongo.getCollections(url);
                console.log(collections);
                setSourceCollections(collections);
            } else {
                const collections = await window.mongo.getCollections(url);
                console.log(collections);
                setTargetCollections(collections);
            }
        } catch (error: any) {
            console.error(`Failed to load collections for ${environment}:`, error);
            if (isSource) {
                setSourceCollections([]);
            } else {
                setTargetCollections([]);
            }
        } finally {
            if (isSource) {
                setLoadingSourceCollections(false);
            } else {
                setLoadingTargetCollections(false);
            }
        }
    };

    // Load collections on initial mount
    useEffect(() => {
        // Initial setup is done via connections prop changes
    }, []);

    // Load collections when environments are set
    useEffect(() => {
        if (sourceEnvironment && connections[sourceEnvironment]) {
            loadCollections(sourceEnvironment, true);
        }
    }, [sourceEnvironment, connections]);

    useEffect(() => {
        if (targetEnvironment && connections[targetEnvironment]) {
            loadCollections(targetEnvironment, false);
        }
    }, [targetEnvironment, connections]);

    const handleSourceEnvironmentChange = async (env: string) => {
        setSourceEnvironment(env);
        setSourceCollection('');
        // loadCollections will be triggered by useEffect when sourceEnvironment changes
    };

    const handleTargetEnvironmentChange = async (env: string) => {
        setTargetEnvironment(env);
        setTargetCollection('');
        // loadCollections will be triggered by useEffect when targetEnvironment changes
    };

    const handleCompare = async () => {
        if (!sourceCollection || !targetCollection) {
            setResult({
                success: false,
                error: 'Please select collections from both source and target'
            });
            return;
        }

        // Validation: Prevent comparing a collection to itself
        if (sourceEnvironment === targetEnvironment && sourceCollection === targetCollection) {
            setResult({
                success: false,
                error: 'Cannot compare a collection to itself. Please select different collections or connections.'
            });
            return;
        }

        setLoading(true);
        setResult(null);
        setComparisonReport(null);

        try {
            const sourceUrl = connections[sourceEnvironment];
            const targetUrl = connections[targetEnvironment];

            // Parse keyFields from comma-separated string to array
            const keyFieldsArray = keyFields?.split(',').map(f => f.trim()).filter(f => f.length > 0) ?? [];
            const array = keyFieldsArray.length > 0 ? keyFieldsArray : ['_id', 'id'] // default to ['_id'] if empty
            const report = await compareCollections(
                sourceUrl,
                targetUrl,
                sourceCollection,
                targetCollection,
                sourceEnvironment,
                targetEnvironment,
                array
            );
            setComparisonReport(report);

            setResult({
                success: true,
                data: {
                    sourceEnv: sourceEnvironment,
                    targetEnv: targetEnvironment,
                    sourceCollection,
                    targetCollection,
                    summary: report.summary
                }
            });
            setLoading(false);
        } catch (error: any) {
            setResult({
                success: false,
                error: error.message || 'Failed to compare collections'
            });
            setLoading(false);
        }
    };

    const downloadReport = () => {
        if (!comparisonReport) return;
        downloadComparisonReport(comparisonReport, sourceEnvironment, targetEnvironment);
    };

    return (
        <div className="tab-content">
            <div style={{ display: 'flex', gap: '20px', marginTop: '0px' }}>
                {/* Source Section */}
                <div style={{ flex: 1, padding: '20px', background: '#f7fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#2d3748' }}>Source</h3>

                    <div className="form-group">
                        <label htmlFor="source-environment">Connection:</label>
                        <select
                            id="source-environment"
                            value={sourceEnvironment}
                            onChange={(e) => handleSourceEnvironmentChange(e.target.value)}
                            className="environment-select"
                        >
                            <option value="">Select a connection</option>
                            {environments.map((env: string) => (
                                <option key={env} value={env}>{env}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="source-collection">Collection:</label>
                        <select
                            id="source-collection"
                            value={sourceCollection}
                            onChange={(e) => setSourceCollection(e.target.value)}
                            className="environment-select"
                            disabled={loadingSourceCollections || sourceCollections.length === 0}
                        >
                            <option value="">
                                {loadingSourceCollections ? 'Loading collections...' : 'Select a collection'}
                            </option>
                            {sourceCollections.map(col => (
                                <option key={col} value={col}>{col}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Target Section */}
                <div style={{ flex: 1, padding: '20px', background: '#f7fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#2d3748' }}>Target</h3>

                    <div className="form-group">
                        <label htmlFor="target-environment">Connection:</label>
                        <select
                            id="target-environment"
                            value={targetEnvironment}
                            onChange={(e) => handleTargetEnvironmentChange(e.target.value)}
                            className="environment-select"
                        >
                            <option value="">Select a connection</option>
                            {environments.map((env: string) => (
                                <option key={env} value={env}>{env}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="target-collection">Collection:</label>
                        <select
                            id="target-collection"
                            value={targetCollection}
                            onChange={(e) => setTargetCollection(e.target.value)}
                            className="environment-select"
                            disabled={loadingTargetCollections || targetCollections.length === 0}
                        >
                            <option value="">
                                {loadingTargetCollections ? 'Loading collections...' : 'Select a collection'}
                            </option>
                            {targetCollections.map(col => (
                                <option key={col} value={col}>{col}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '20px' }}>
                <div className="form-group">
                    <label htmlFor="key-fields">Key Fields (comma-separated):</label>
                    <input
                        type="text"
                        id="key-fields"
                        value={keyFields}
                        onChange={(e) => setKeyFields(e.target.value)}
                        placeholder="comma separated field names, e.g. _id,code (default is _id)"
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '14px',
                            border: '1px solid #10b981',
                            borderRadius: '4px',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#059669'}
                        onBlur={(e) => e.target.style.borderColor = '#10b981'}
                    />
                </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button
                    onClick={handleCompare}
                    disabled={loading || !sourceCollection || !targetCollection}
                    className="run-button"
                >
                    {loading ? 'Comparing...' : 'Compare Collections'}
                </button>
            </div>

            {/* Results Section */}
            <div className="results-section" style={{ marginTop: '30px' }}>
                <h2>Comparison Results</h2>
                {loading && <div className="loading">Comparing collections...</div>}

                {result && !result.success && (
                    <div className="error-message">
                        <h3>Error</h3>
                        <p>{result.error}</p>
                    </div>
                )}

                {result && result.success && result.data && comparisonReport && (
                    <div>
                        <div className="info-message" style={{ marginBottom: '15px' }}>
                            <p>
                                Comparing <strong>{result.data.sourceCollection}</strong> ({result.data.sourceEnv.toUpperCase()})
                                {' vs '}
                                <strong>{result.data.targetCollection}</strong> ({result.data.targetEnv.toUpperCase()})
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <button onClick={downloadReport} className="run-button" style={{ padding: '8px 16px', fontSize: '13px' }}>
                                📥 Download Report (JSON)
                            </button>
                            <button onClick={() => setShowJsonViewer(true)} className="run-button" style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: '#047857' }}>
                                👁 View JSON
                            </button>
                        </div>

                        {/* Summary Table */}
                        <div className="table-wrapper">
                            <table className="results-table">
                                <thead>
                                    <tr>
                                        <th>Metric</th>
                                        <th>Source ({result.data.sourceEnv.toUpperCase()})</th>
                                        <th>Target ({result.data.targetEnv.toUpperCase()})</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Total Documents</td>
                                        <td>{result.data.summary.totalInSource}</td>
                                        <td>{result.data.summary.totalInTarget}</td>
                                        <td>-</td>
                                    </tr>
                                    <tr>
                                        <td>Only in Source</td>
                                        <td colSpan={2}>{result.data.summary.onlyInSourceCount}</td>
                                        <td style={{ color: result.data.summary.onlyInSourceCount > 0 ? '#c53030' : '#2f855a' }}>
                                            {result.data.summary.onlyInSourceCount > 0 ? '⚠ Has differences' : '✓ None'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Only in Target</td>
                                        <td colSpan={2}>{result.data.summary.onlyInTargetCount}</td>
                                        <td style={{ color: result.data.summary.onlyInTargetCount > 0 ? '#c53030' : '#2f855a' }}>
                                            {result.data.summary.onlyInTargetCount > 0 ? '⚠ Has differences' : '✓ None'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Modified Documents</td>
                                        <td colSpan={2}>{result.data.summary.modifiedCount}</td>
                                        <td style={{ color: result.data.summary.modifiedCount > 0 ? '#c53030' : '#2f855a' }}>
                                            {result.data.summary.modifiedCount > 0 ? '⚠ Has differences' : '✓ None'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Identical Documents</td>
                                        <td colSpan={2}>{result.data.summary.identicalCount}</td>
                                        <td style={{ color: '#2f855a' }}>✓ Match</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* JSON Viewer Modal */}
            {showJsonViewer && comparisonReport && (
                <div className="modal-overlay" onClick={() => setShowJsonViewer(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90%', width: '1000px', maxHeight: '90vh' }}>
                        <div className="modal-header">
                            <h2>Comparison Report (JSON)</h2>
                            <button className="close-button" onClick={() => setShowJsonViewer(false)}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                            <pre style={{
                                backgroundColor: '#1e293b',
                                color: '#e2e8f0',
                                padding: '20px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                lineHeight: '1.6',
                                overflow: 'auto',
                                fontFamily: 'monospace'
                            }}>
                                {JSON.stringify(comparisonReport, null, 2)}
                            </pre>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowJsonViewer(false)} className="close-modal-button">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

