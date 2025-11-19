import { contextBridge, ipcRenderer } from 'electron';

export type QueryResult = {
    success: boolean;
    data?: any[];
    rowsAffected?: number[];
    columns?: any;
    error?: string;
};

console.log('Preload script is running...');


contextBridge.exposeInMainWorld('mongo', {
    getCollections: (url: string): Promise<string[]> => {

        console.log('preload:ts: Requesting collections for URL:', url);
        return ipcRenderer.invoke('mongo:get-collections', url);
    },
    getDocuments: (url: string, collectionName: string, keyFields: string[]): Promise<Map<string, Record<string, any>>> => {
        console.log('preload:ts: Requesting documents for:', url, collectionName);
        return ipcRenderer.invoke('mongo:get-documents', url, collectionName, keyFields);
    }
});

contextBridge.exposeInMainWorld('settings', {
    read: () => {
        return ipcRenderer.invoke('settings:read');
    },
    write: (settings: any) => {
        return ipcRenderer.invoke('settings:write', settings);
    }
});




console.log('electronAPI exposed to window');
