import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

let client: Client;

try {
  client = new Client({
    node: env.ELASTICSEARCH_URL,
    maxRetries: 3,
    requestTimeout: 5000,
    // v9 client sends `compatible-with=9` headers that ES 8.x rejects.
    // Disabling the meta header makes it use plain application/json instead.
    enableMetaHeader: false,
  });
} catch (error) {
  console.error('Failed to initialize Elasticsearch client:', error);
}


const INDEX_NAME = 'emails';

export const initElasticsearch = async () => {
  if (!client) return;
  try {
    const exists = await client.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await (client.indices.create as any)({
        index: INDEX_NAME,
        mappings: {
          properties: {
            emailId: { type: 'keyword' },
            userId: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            sender: { type: 'text' },
            recipient: { type: 'text' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' }
          }
        }
      });
      console.log(`Elasticsearch index '${INDEX_NAME}' created.`);
    }
  } catch (error) {
    console.error('Elasticsearch initialization failed:', error);
    // Do not crash the app if ES is unavailable
  }
};

export const indexEmail = async (doc: any) => {
  if (!client) return;
  try {
    await (client.index as any)({
      index: INDEX_NAME,
      id: doc.emailId, // Use the DB id as the ES id
      document: doc
    });
  } catch (error) {
    console.error(`Failed to index email ${doc.emailId}:`, error);
  }
};

export const searchEmails = async (userId: string, query: string) => {
  if (!client) return [];
  try {
    const result = await (client.search as any)({
      index: INDEX_NAME,
      query: {
        bool: {
          must: [
            { term: { userId } },
            {
              multi_match: {
                query,
                fields: ['recipient', 'subject', 'body', 'sender']
              }
            }
          ]
        }
      }
    });
    
    // @ts-ignore
    return result.hits.hits.map(hit => hit._source);
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
};
