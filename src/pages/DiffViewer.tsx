import { useState, useEffect } from 'react';
import { VirtualDiffViewer, } from 'virtual-react-json-diff';
import { DifferOptions, InlineDiffOptions } from 'json-diff-kit';
interface DiffViewerProps {
    connections: Record<string, string>;
}

export default function DiffViewer({ connections }: DiffViewerProps) {
    const [environments, setEnvironments] = useState<string[]>([]);
    const [sourceEnvironment, setSourceEnvironment] = useState<string>('');
    const [targetEnvironment, setTargetEnvironment] = useState<string>('');
    const [sourceCollection, setSourceCollection] = useState<string>('');
    const [targetCollection, setTargetCollection] = useState<string>('');
    const [sourceCollections, setSourceCollections] = useState<string[]>([]);
    const [targetCollections, setTargetCollections] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [loadingSourceCollections, setLoadingSourceCollections] = useState<boolean>(false);
    const [loadingTargetCollections, setLoadingTargetCollections] = useState<boolean>(false);
    const [sourceData, setSourceData] = useState<any[]>([]);
    const [targetData, setTargetData] = useState<any[]>([]);
    const [error, setError] = useState<string>('');
    const [showDiff, setShowDiff] = useState<boolean>(false);
    const [documentCount, setDocumentCount] = useState<{ source: number; target: number }>({ source: 0, target: 0 });
    const [keyFields, setKeyFields] = useState<string>();
    const [diffStats, setDiffStats] = useState<{ added: number; removed: number; modified: number }>({ added: 0, removed: 0, modified: 0 });
    const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(0);
    const [showConfigDialog, setShowConfigDialog] = useState<boolean>(false);
    const [diffConfig, setDiffConfig] = useState<DifferOptions>({
        detectCircular: true,
        maxDepth: 999,
        showModifications: false,
        arrayDiffMethod: "lcs",
        compareKey: 'id',
        ignoreCase: false,
        recursiveEqual: false,
    });
    const [inlineDiffConfig, setInlineDiffConfig] = useState<InlineDiffOptions>({
        mode: 'word',
        wordSeparator: ' ',
    });

    // Update environments when connections change
    useEffect(() => {
        const envs = Object.keys(connections);
        setEnvironments(envs);
    }, [connections]);

    const loadCollections = async (environment: string, isSource: boolean) => {
        if (isSource) {
            setLoadingSourceCollections(true);
        } else {
            setLoadingTargetCollections(true);
        }

        try {
            const url = connections[environment];
            if (isSource) {
                const collections = await window.mongo.getCollections(url);
                setSourceCollections(collections);
            } else {
                const collections = await window.mongo.getCollections(url);
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

    const handleCompare = async () => {
        if (!sourceCollection || !targetCollection) {
            setError('Please select collections from both source and target');
            return;
        }

        if (sourceEnvironment === targetEnvironment && sourceCollection === targetCollection) {
            setError('Cannot compare a collection to itself. Please select different collections or connections.');
            return;
        }

        setLoading(true);
        setError('');
        setShowDiff(false);

        try {
            const sourceUrl = connections[sourceEnvironment];
            const targetUrl = connections[targetEnvironment];

            // Parse keyFields from comma-separated string to array
            const keyFieldsArray = keyFields?.split(',').map(f => f.trim()).filter(f => f.length > 0) ?? [];
            const array = keyFieldsArray.length > 0 ? keyFieldsArray : ['_id', 'id'] // default to ['_id'] if empty
            // Fetch documents from both collections
            const sourceMap = await window.mongo.getDocuments(sourceUrl, sourceCollection, array);
            const targetMap = await window.mongo.getDocuments(targetUrl, targetCollection, array);

            // Convert maps to arrays
            const sourceArray: any = [];// Array.from(sourceMap.values());
            const targetArray: any = [];// Array.from(targetMap.values());
            for (const [key, doc] of sourceMap) {
                const { id, _id, ...rest } = doc;
                const updated: any = { id: key, ...rest };
                sourceArray.push(updated);
            }
            for (const [key, doc] of targetMap) {
                const { id, _id, ...rest } = doc;
                const updated: any = { id: key, ...rest };
                targetArray.push(updated);
            }
            sourceArray.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
            targetArray.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));

            setDocumentCount({ source: sourceArray.length, target: targetArray.length });

            // Calculate diff statistics at id level
            const sourceIds = new Set(sourceArray.map((doc: any) => doc.id));
            const targetIds = new Set(targetArray.map((doc: any) => doc.id));

            const added = targetArray.filter((doc: any) => !sourceIds.has(doc.id)).length;
            const removed = sourceArray.filter((doc: any) => !targetIds.has(doc.id)).length;

            // Count modified documents (exist in both but have differences)
            let modified = 0;
            for (const sourceDoc of sourceArray) {
                const targetDoc = targetArray.find((d: any) => d.id === sourceDoc.id);
                if (targetDoc && JSON.stringify(sourceDoc) !== JSON.stringify(targetDoc)) {
                    modified++;
                }
            }

            setDiffStats({ added, removed, modified });

            // Sort arrays by _id for better diff alignment
            const sortByKey = (arr: any[]) => arr.sort((a, b) => {
                const aKey = String(a._id || '');
                const bKey = String(b._id || '');
                return aKey.localeCompare(bKey);
            });

            const sortedSource = sortByKey([...sourceArray]);
            const sortedTarget = sortByKey([...targetArray]);

            // Store as JSON objects for virtual-react-json-diff
            setSourceData(sortedSource);
            setTargetData(sortedTarget);
            setShowDiff(true);
            setLoading(false);
        } catch (error: any) {
            setError(error.message || 'Failed to compare collections');
            setLoading(false);
        }
    };

    return (
        <div className="mongodb-section">
            {/* Selection Section */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                {/* Source Section */}
                <div style={{ flex: 1, padding: '20px', background: '#f7fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#2d3748' }}>Source</h3>

                    <div className="form-group">
                        <label htmlFor="source-environment">Connection:</label>
                        <select
                            id="source-environment"
                            value={sourceEnvironment}
                            onChange={(e) => {
                                setSourceEnvironment(e.target.value);
                                setSourceCollection('');
                            }}
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
                            onChange={(e) => {
                                setTargetEnvironment(e.target.value);
                                setTargetCollection('');
                            }}
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

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                    onClick={handleCompare}
                    disabled={loading || !sourceCollection || !targetCollection}
                    className="run-button"
                >
                    {loading ? 'Comparing...' : 'Compare'}
                </button>

                <button
                    onClick={() => setShowConfigDialog(true)}
                    style={{
                        padding: '10px',
                        //backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px'
                    }}
                    title="Configure diff options"
                >
                    <svg width="800px" height="800px" viewBox="0 0 512 512" version="1.1">
                        <g id="Layer_1" />
                        <g id="Layer_2">
                            <g>
                                <path className="st0" d="M471.46,212.99l-42.07-7.92c-3.63-12.37-8.58-24.3-14.79-35.64l24.16-35.37c4.34-6.35,3.54-14.9-1.9-20.34    l-38.58-38.58c-5.44-5.44-13.99-6.24-20.34-1.9L342.57,97.4c-11.34-6.21-23.27-11.16-35.64-14.78l-7.92-42.07    c-1.42-7.56-8.03-13.04-15.72-13.04h-54.57c-7.69,0-14.3,5.48-15.72,13.04l-7.92,42.07c-12.37,3.63-24.3,8.58-35.64,14.78    l-35.37-24.16c-6.35-4.34-14.9-3.54-20.34,1.9l-38.58,38.58c-5.44,5.44-6.24,13.98-1.9,20.34l24.16,35.37    c-6.21,11.34-11.16,23.27-14.79,35.64l-42.07,7.92c-7.56,1.42-13.04,8.03-13.04,15.72v54.57c0,7.69,5.48,14.3,13.04,15.72    l42.07,7.92c3.63,12.37,8.58,24.3,14.79,35.64l-24.16,35.37c-4.34,6.35-3.54,14.9,1.9,20.34l38.58,38.58    c5.44,5.44,13.99,6.24,20.34,1.9l35.37-24.16c11.34,6.21,23.27,11.16,35.64,14.79l7.92,42.07c1.42,7.56,8.03,13.04,15.72,13.04    h54.57c7.69,0,14.3-5.48,15.72-13.04l7.92-42.07c12.37-3.63,24.3-8.58,35.64-14.79l35.37,24.16c6.35,4.34,14.9,3.54,20.34-1.9    l38.58-38.58c5.44-5.44,6.24-13.98,1.9-20.34l-24.16-35.37c6.21-11.34,11.16-23.27,14.79-35.64l42.07-7.92    c7.56-1.42,13.04-8.03,13.04-15.72v-54.57C484.5,221.02,479.02,214.42,471.46,212.99z M452.5,270.01l-38.98,7.34    c-6.25,1.18-11.21,5.94-12.63,12.14c-3.69,16.02-10,31.25-18.77,45.25c-3.37,5.39-3.24,12.26,0.35,17.51l22.39,32.78l-19.82,19.82    l-32.78-22.39c-5.25-3.59-12.12-3.73-17.51-0.35c-14.01,8.77-29.24,15.08-45.25,18.77c-6.2,1.43-10.96,6.38-12.14,12.63    l-7.34,38.98h-28.03l-7.34-38.98c-1.18-6.25-5.94-11.21-12.14-12.63c-16.02-3.69-31.24-10-45.25-18.77    c-5.39-3.37-12.26-3.24-17.51,0.35l-32.78,22.39l-19.82-19.82l22.39-32.78c3.59-5.25,3.72-12.12,0.35-17.51    c-8.77-14.01-15.08-29.24-18.77-45.25c-1.43-6.2-6.38-10.96-12.63-12.14l-38.98-7.34v-28.03l38.98-7.34    c6.25-1.18,11.21-5.94,12.63-12.14c3.69-16.02,10-31.25,18.77-45.25c3.37-5.39,3.24-12.26-0.35-17.51l-22.39-32.78l19.82-19.82    l32.78,22.39c5.25,3.58,12.12,3.72,17.51,0.35c14.01-8.77,29.24-15.08,45.25-18.77c6.2-1.43,10.96-6.38,12.14-12.63l7.34-38.98    h28.03l7.34,38.98c1.18,6.25,5.94,11.21,12.14,12.63c16.02,3.69,31.24,10,45.25,18.77c5.39,3.37,12.26,3.24,17.51-0.35    l32.78-22.39l19.82,19.82l-22.39,32.78c-3.59,5.25-3.72,12.12-0.35,17.51c8.77,14.01,15.08,29.24,18.77,45.25    c1.43,6.2,6.38,10.96,12.63,12.14l38.98,7.34V270.01z" />
                                <path className="st0" d="M256,148.26c-59.41,0-107.74,48.33-107.74,107.74c0,59.41,48.33,107.74,107.74,107.74    S363.74,315.41,363.74,256C363.74,196.59,315.41,148.26,256,148.26z M256,331.74c-41.76,0-75.74-33.98-75.74-75.74    c0-41.76,33.98-75.74,75.74-75.74s75.74,33.98,75.74,75.74C331.74,297.76,297.76,331.74,256,331.74z" />
                            </g>
                        </g>
                    </svg>
                </button>
            </div>
            {/* Error Message */}
            {error && (
                <div className="error-message" style={{ marginTop: '20px' }}>
                    <h3>Error</h3>
                    <p>{error}</p>
                </div>
            )}

            {/* Diff Viewer Section */}
            {showDiff && (
                <div style={{ marginTop: '30px' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '15px'
                    }}>
                        <h2 style={{ margin: 0 }}>
                            Comparison Results
                            <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '10px' }}>
                                ({documentCount.source} docs in source, {documentCount.target} docs in target)
                            </span>
                        </h2>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {/* Stats */}
                            <div style={{
                                display: 'flex',
                                gap: '15px',
                                fontSize: '14px',
                                padding: '8px 16px',
                                backgroundColor: '#f0fdf4',
                                borderRadius: '6px',
                                border: '1px solid #10b981'
                            }}>
                                <span style={{ color: '#059669', fontWeight: '500' }}>
                                    Added: {diffStats.added}
                                </span>
                                <span style={{ color: '#dc2626', fontWeight: '500' }}>
                                    Removed: {diffStats.removed}
                                </span>
                                <span style={{ color: '#ea580c', fontWeight: '500' }}>
                                    Modified: {diffStats.modified}
                                </span>
                            </div>

                            {/* Navigation buttons */}
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                    onClick={() => setCurrentSearchIndex(Math.max(0, currentSearchIndex - 1))}
                                    disabled={currentSearchIndex === 0}
                                    style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: currentSearchIndex === 0 ? 'not-allowed' : 'pointer',
                                        opacity: currentSearchIndex === 0 ? 0.5 : 1,
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                    title="Previous change"
                                >
                                    ← Prev
                                </button>
                                <button
                                    onClick={() => setCurrentSearchIndex(currentSearchIndex + 1)}
                                    style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                    title="Next change"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        backgroundColor: '#fff'
                    }}>
                        <VirtualDiffViewer
                            oldValue={sourceData}
                            newValue={targetData}
                            height={600}
                            leftTitle={`Source: ${sourceEnvironment} - ${sourceCollection}`}
                            rightTitle={`Target: ${targetEnvironment} - ${targetCollection}`}
                            showLineCount={true}
                            showObjectCountStats={true}
                            searchTerm=""
                            onSearchMatch={(index) => setCurrentSearchIndex(index)}
                            differOptions={diffConfig}
                            inlineDiffOptions={inlineDiffConfig}
                        />
                    </div>
                </div>
            )}

            {/* Configuration Dialog */}
            {showConfigDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '24px',
                        width: '90%',
                        maxWidth: '600px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Diff Configuration</h2>
                            <button
                                onClick={() => setShowConfigDialog(false)}
                                style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#6b7280'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Detect Circular */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={diffConfig.detectCircular}
                                        onChange={(e) => setDiffConfig({ ...diffConfig, detectCircular: e.target.checked })}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <span>Detect Circular References</span>
                                </label>
                                <small style={{ color: '#6b7280', marginLeft: '26px', display: 'block' }}>
                                    Detect and handle circular object references
                                </small>
                            </div>

                            {/* Max Depth */}
                            <div className="form-group">
                                <label htmlFor="maxDepth">Max Depth:</label>
                                <input
                                    type="number"
                                    id="maxDepth"
                                    value={diffConfig.maxDepth}
                                    onChange={(e) => setDiffConfig({ ...diffConfig, maxDepth: parseInt(e.target.value) || 999 })}
                                    min="1"
                                    max="9999"
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px'
                                    }}
                                />
                                <small style={{ color: '#6b7280', display: 'block', marginTop: '4px' }}>
                                    Maximum depth for object comparison (1-9999)
                                </small>
                            </div>

                            {/* Show Modifications */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={diffConfig.showModifications}
                                        onChange={(e) => setDiffConfig({ ...diffConfig, showModifications: e.target.checked })}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <span>Show Modifications</span>
                                </label>
                                <small style={{ color: '#6b7280', marginLeft: '26px', display: 'block' }}>
                                    Display modified values separately
                                </small>
                            </div>

                            {/* Array Diff Method */}
                            <div className="form-group">
                                <label htmlFor="arrayDiffMethod">Array Diff Method:</label>
                                <select
                                    id="arrayDiffMethod"
                                    value={diffConfig.arrayDiffMethod}
                                    onChange={(e) => setDiffConfig({ ...diffConfig, arrayDiffMethod: e.target.value as any })}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <option value="normal">Normal</option>
                                    <option value="lcs">LCS (Longest Common Subsequence)</option>
                                    <option value="unorder-lcs">Unordered LCS</option>
                                    <option value="compare-key">Compare by Key</option>
                                    <option value="unorder-normal">Unordered Normal</option>
                                </select>
                                <small style={{ color: '#6b7280', display: 'block', marginTop: '4px' }}>
                                    Algorithm for comparing arrays
                                </small>
                            </div>

                            {/* Compare Key */}
                            <div className="form-group">
                                <label htmlFor="compareKey">Compare Key:</label>
                                <input
                                    type="text"
                                    id="compareKey"
                                    value={diffConfig.compareKey || ''}
                                    onChange={(e) => setDiffConfig({ ...diffConfig, compareKey: e.target.value })}
                                    placeholder="e.g., id, _id"
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px'
                                    }}
                                />
                                <small style={{ color: '#6b7280', display: 'block', marginTop: '4px' }}>
                                    Key field for array comparison (used with 'Compare by Key' method)
                                </small>
                            </div>

                            {/* Ignore Case */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={diffConfig.ignoreCase}
                                        onChange={(e) => setDiffConfig({ ...diffConfig, ignoreCase: e.target.checked })}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <span>Ignore Case</span>
                                </label>
                                <small style={{ color: '#6b7280', marginLeft: '26px', display: 'block' }}>
                                    Perform case-insensitive comparison
                                </small>
                            </div>

                            {/* Recursive Equal */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={diffConfig.recursiveEqual}
                                        onChange={(e) => setDiffConfig({ ...diffConfig, recursiveEqual: e.target.checked })}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <span>Recursive Equal</span>
                                </label>
                                <small style={{ color: '#6b7280', marginLeft: '26px', display: 'block' }}>
                                    Use deep equality check for objects
                                </small>
                            </div>

                            {/* Divider */}
                            <div style={{ borderTop: '1px solid #e5e7eb', margin: '8px 0' }}></div>

                            {/* Inline Diff Mode */}
                            <div className="form-group">
                                <label htmlFor="inlineDiffMode">Inline Diff Method:</label>
                                <select
                                    id="inlineDiffMode"
                                    value={inlineDiffConfig.mode || 'word'}
                                    onChange={(e) => setInlineDiffConfig({ ...inlineDiffConfig, mode: e.target.value as 'char' | 'word' })}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <option value="char">Character-based</option>
                                    <option value="word">Word-based</option>
                                </select>
                                <small style={{ color: '#6b7280', display: 'block', marginTop: '4px' }}>
                                    How to highlight differences within modified lines
                                </small>
                            </div>

                            {/* Word Separator */}
                            <div className="form-group">
                                <label htmlFor="wordSeparator">Word Separator:</label>
                                <input
                                    type="text"
                                    id="wordSeparator"
                                    value={inlineDiffConfig.wordSeparator || ' '}
                                    onChange={(e) => setInlineDiffConfig({ ...inlineDiffConfig, wordSeparator: e.target.value })}
                                    placeholder="Space"
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px'
                                    }}
                                />
                                <small style={{ color: '#6b7280', display: 'block', marginTop: '4px' }}>
                                    Separator character(s) for word-based diff (default: space)
                                </small>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setDiffConfig({
                                        detectCircular: true,
                                        maxDepth: 999,
                                        showModifications: false,
                                        arrayDiffMethod: "lcs",
                                        compareKey: 'id',
                                        ignoreCase: false,
                                        recursiveEqual: false,
                                    });
                                    setInlineDiffConfig({
                                        mode: 'word',
                                        wordSeparator: ' ',
                                    });
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#f3f4f6',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Reset to Defaults
                            </button>
                            <button
                                onClick={() => setShowConfigDialog(false)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}
                            >
                                Apply & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}