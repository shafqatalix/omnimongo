export { };

declare global {
    interface Window {
        electronAPI: {
            executeQuery: (environment: string, query: string) => Promise<{
                success: boolean;
                data?: any[];
                rowsAffected?: number[];
                columns?: any;
                error?: string;
            }>;
        };
        mongo: {
            getCollections: (url: string) => Promise<string[]>;
            getDocuments: (url: string, collectionName: string, keyFields: string[]) => Promise<Map<string, Record<string, any>>>;
        };
        settings: {
            read: () => Promise<{
                connections: Record<string, string>;
            }>;
            write: (settings: {
                connections: Record<string, string>;
            }) => Promise<{ success: boolean; error?: string }>;
        };
    }
}
