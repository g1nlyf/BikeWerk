import * as crypto from 'crypto';
import { FinalJson } from '../types';

export const generateContentHash = (item: Partial<FinalJson>): string => {
    const str = `${item.sourceAdId || ''}|${item.brand || ''}|${item.model || ''}|${item.price ?? ''}|${item.sellerName || ''}|${item.location || ''}`;
    return crypto.createHash('md5').update(str).digest('hex');
};

// This function would interface with DB to check existence
// Since we don't have the DB layer fully wired in this file, we define the interface.
export interface DedupService {
    isDuplicate(id: string, contentHash: string): Promise<boolean>;
    shouldUpdate(existingId: string, newConfidence: number): Promise<boolean>;
}
