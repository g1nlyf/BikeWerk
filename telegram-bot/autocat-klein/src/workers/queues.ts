import { Queue } from 'bullmq';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};

export const searchQueue = new Queue('search-pages', { 
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        }
    }
});
export const listingUrlQueue = new Queue('listing-urls', { 
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        }
    }
});
export const parseQueue = new Queue('parse-listings', { 
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        }
    }
});

export const closeQueues = async () => {
    await searchQueue.close();
    await listingUrlQueue.close();
    await parseQueue.close();
};
