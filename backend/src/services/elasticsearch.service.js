"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchEmails = exports.indexEmail = exports.initElasticsearch = void 0;
const elasticsearch_1 = require("@elastic/elasticsearch");
const env_1 = require("../config/env");
let client;
try {
    client = new elasticsearch_1.Client({
        node: env_1.env.ELASTICSEARCH_URL,
        maxRetries: 3,
        requestTimeout: 5000,
        // v9 client sends `compatible-with=9` headers that ES 8.x rejects.
        // Disabling the meta header makes it use plain application/json instead.
        enableMetaHeader: false,
    });
}
catch (error) {
    console.error('Failed to initialize Elasticsearch client:', error);
}
const INDEX_NAME = 'emails';
const initElasticsearch = async () => {
    if (!client)
        return;
    try {
        const exists = await client.indices.exists({ index: INDEX_NAME });
        if (!exists) {
            await client.indices.create({
                index: INDEX_NAME,
                body: {
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
                }
            });
            console.log(`Elasticsearch index '${INDEX_NAME}' created.`);
        }
    }
    catch (error) {
        console.error('Elasticsearch initialization failed:', error);
        // Do not crash the app if ES is unavailable
    }
};
exports.initElasticsearch = initElasticsearch;
const indexEmail = async (doc) => {
    if (!client)
        return;
    try {
        await client.index({
            index: INDEX_NAME,
            id: doc.emailId, // Use the DB id as the ES id
            body: doc
        });
    }
    catch (error) {
        console.error(`Failed to index email ${doc.emailId}:`, error);
    }
};
exports.indexEmail = indexEmail;
const searchEmails = async (userId, query) => {
    if (!client)
        return [];
    try {
        const result = await client.search({
            index: INDEX_NAME,
            body: {
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
            }
        });
        // @ts-ignore
        return result.hits.hits.map(hit => hit._source);
    }
    catch (error) {
        console.error('Search failed:', error);
        return [];
    }
};
exports.searchEmails = searchEmails;
//# sourceMappingURL=elasticsearch.service.js.map