// MongoDB Collection Comparison Helpers

export interface ComparisonReport {
    metadata: {
        sourceConnection: string;
        targetConnection: string;
        sourceCollection: string;
        targetCollection: string;
        timestamp: string;
        sourceCount: number;
        targetCount: number;
    };
    onlyInSource: any[];
    onlyInTarget: any[];
    differences: {
        documentId: string;
        fields: {
            fieldPath: string;
            sourceValue: any;
            targetValue: any;
        }[];
    }[];
    summary: {
        totalInSource: number;
        totalInTarget: number;
        onlyInSourceCount: number;
        onlyInTargetCount: number;
        modifiedCount: number;
        identicalCount: number;
    };
}

/**
 * Recursively compares two objects and returns field-level differences
 */
type ChangeType = 'changed' | 'added' | 'removed' | 'arrayDiff' | 'changed-default';

interface FieldDifference {
    id?: string;
    fieldPath?: string;
    changeType?: ChangeType;
    sourceValue?: any;
    targetValue?: any;
    arrayDiff?: {
        added?: any[];
        removed?: any[];
        changed?: { index: number; from: any; to: any }[];
    };
}

export const getFieldDifferences = (
    key: string,
    keyFields: string[],
    source: Record<string, any>,
    target: Record<string, any>,
    path: string = '',
    isRoot: boolean = false
): FieldDifference[] => {
    const differences: FieldDifference[] = [];
    const allKeys = new Set([...Object.keys(source || {}), ...Object.keys(target || {})]);

    if (isRoot) {
        const nocheckFields = ['_id', 'id', '__v', '_createdAt', '_updatedAt', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'modifiedAt', 'modified_at', key, ...keyFields];

        // Exclude key fields from diffing
        for (const kf of nocheckFields) {
            allKeys.delete(kf);

            if (kf === '_id' || kf === 'id') {
                delete source?.[kf];
                delete target?.[kf];
            }
        }
    }

    for (const key of allKeys) {
        const currentPath = path ? `${path}.${key}` : key;
        const sourceVal = source?.[key];
        const targetVal = target?.[key];
        const sourceValJSON = sourceVal ? JSON.stringify(sourceVal) : sourceVal;
        const targetValJSON = targetVal ? JSON.stringify(targetVal) : targetVal;

        // Helper: deep equality
        const areEqual = (a: any, b: any): boolean => {
            if (a === b) return true;
            if (a == null || b == null) return a === b;
            if (typeof a !== typeof b) return false;
            try {
                return JSON.stringify(a) === JSON.stringify(b);
            } catch {
                return false;
            }
        };

        // FOCUS: Missing in target (removed) - PRIORITY
        if (sourceVal !== undefined && targetVal === undefined) {
            differences.push({
                fieldPath: currentPath,
                changeType: 'removed',
                sourceValue: sourceVal,
                targetValue: undefined,
            });
            continue;
        }

        if (sourceVal === undefined && targetVal !== undefined) {
            differences.push({
                fieldPath: currentPath,
                changeType: 'added',
                sourceValue: undefined,
                targetValue: targetVal,
            });
            continue;
        }

        if (Array.isArray(sourceVal) && sourceVal.length === 0 && !targetVal || (Array.isArray(targetVal) && targetVal.length === 0 && !sourceVal)) {
            // [] vs null difference
            continue;
        }

        // Skip: Added in target (not our focus)
        if (sourceVal === undefined && targetVal !== undefined) {
            // Don't report fields that exist in target but not source
            continue;
        }


        // Case 3: Both exist - check for differences
        if (sourceVal !== undefined && targetVal !== undefined) {
            // Arrays: focus on what's missing from target
            if (Array.isArray(sourceVal) && Array.isArray(targetVal)) {
                const removed: any[] = [];

                // Check what exists in source but not in target
                for (const sourceItem of sourceVal) {
                    const foundInTarget = targetVal.some(targetItem => areEqual(sourceItem, targetItem));
                    if (!foundInTarget) {
                        removed.push(sourceItem);
                    }
                }

                if (removed.length > 0) {
                    differences.push({
                        fieldPath: currentPath,
                        changeType: 'arrayDiff',
                        sourceValue: sourceVal,
                        targetValue: targetVal,
                        arrayDiff: {
                            removed,
                        },
                    });
                }
                continue;
            }

            // Objects: show as changed if different
            if (
                typeof sourceVal === 'object' &&
                sourceVal !== null &&
                typeof targetVal === 'object' &&
                targetVal !== null &&
                !Array.isArray(sourceVal) &&
                !Array.isArray(targetVal) && sourceValJSON !== targetValJSON
            ) {
                differences.push({
                    fieldPath: currentPath,
                    changeType: 'changed',
                    sourceValue: sourceVal,
                    targetValue: targetVal,
                });
                continue;
            }


            // Primitive: only report if values differ (target is missing the correct value)
            if (sourceValJSON !== targetValJSON) {
                differences.push({
                    fieldPath: currentPath,
                    changeType: 'changed-default',
                    sourceValue: sourceVal,
                    targetValue: targetVal,
                });
            }
        }
    }

    return differences;
};


/**
 * Compares two MongoDB collections and returns a detailed report
 */
export const compareCollections = async (
    sourceUrl: string,
    targetUrl: string,
    sourceCol: string,
    targetCol: string,
    sourceEnv: string,
    targetEnv: string,
    keyFields: string[]
): Promise<ComparisonReport> => {
    // Fetch documents from both collections
    const sourceMap: Map<string, Record<string, any>> = await window.mongo.getDocuments(sourceUrl, sourceCol, keyFields);
    const targetMap: Map<string, Record<string, any>> = await window.mongo.getDocuments(targetUrl, targetCol, keyFields);
    //const sourceValues = Array.from(sourceMap.values());
    //const targetValues = Array.from(targetMap.values());

    const onlyInSource: any[] = [];
    const onlyInTarget: any[] = [];
    const differences: any[] = [];
    let identicalCount = 0;


    for (const obj of sourceMap) {
        const [key, sourceDoc] = obj;
        const targetDoc = targetMap.get(key);
        if (!targetDoc) {
            //debugger;
            onlyInSource.push(sourceDoc);
        } else {
            const fieldDiffs = getFieldDifferences(key, keyFields, sourceDoc, targetDoc, '', true);
            if (fieldDiffs.length > 0) {
                differences.push({
                    documentId: sourceDoc._id || sourceDoc.id,
                    key,
                    fields: fieldDiffs,
                    sourceDoc,
                    targetDoc
                });
            } else {
                identicalCount++;
            }
        }
    }

    // Find documents only in target
    for (const [id, targetDoc] of targetMap) {
        if (!sourceMap.has(id)) {
            onlyInTarget.push(targetDoc);
        }
    }

    return {
        metadata: {
            sourceConnection: sourceEnv,
            targetConnection: targetEnv,
            sourceCollection: sourceCol,
            targetCollection: targetCol,
            timestamp: new Date().toISOString(),
            sourceCount: sourceMap.size,
            targetCount: targetMap.size
        },
        onlyInSource,
        onlyInTarget,
        differences,
        summary: {
            totalInSource: sourceMap.size,
            totalInTarget: targetMap.size,
            onlyInSourceCount: onlyInSource.length,
            onlyInTargetCount: onlyInTarget.length,
            modifiedCount: differences.length,
            identicalCount
        }
    };
};

/**
 * Downloads a comparison report as a JSON file
 */
export const downloadComparisonReport = (
    report: ComparisonReport,
    sourceEnv: string,
    targetEnv: string
): void => {
    const jsonString = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison-${sourceEnv}-${targetEnv}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
