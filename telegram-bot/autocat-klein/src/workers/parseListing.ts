import { Worker, Job } from 'bullmq';
import { pipeline } from '../lib/pipeline';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};

let counter = 0;
export const parseListingWorker = new Worker('parse-listings', async (job: Job) => {
    const { url } = job.data;
    counter += 1;
    console.log(`байк ${counter} - ссылка ${url}`);

    try {
        const result = await pipeline.processListing(url);
        
        if (!result.success) {
            throw new Error(`Pipeline failed for ${url}`);
        }

        return result;

    } catch (error: any) {
        console.error(`Error in parseListingWorker for ${url}:`, error.message);
        throw error;
    }
}, { connection, concurrency: 1 });
