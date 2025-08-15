import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
const secretsClient = new SecretsManagerClient({});
let cachedSecrets = null;
async function getSecret(name) {
    const res = await secretsClient.send(new GetSecretValueCommand({ SecretId: name }));
    return res.SecretString || '';
}
async function loadSecrets() {
    if (cachedSecrets)
        return cachedSecrets;
    const neon = await getSecret(process.env.NEON_DB_SECRET_NAME);
    const airtable = await getSecret(process.env.AIRTABLE_API_SECRET_NAME);
    cachedSecrets = { NEON_DATABASE_URL: neon, AIRTABLE_API_KEY: airtable };
    return cachedSecrets;
}
async function runJob(msg) {
    const secrets = await loadSecrets();
    console.log('Running job', { msg });
    if (msg.jobType === 'nightly-enrichment') {
        // Placeholder: perform enrichment
        return;
    }
    if (msg.jobType === 'scrape' || msg.urls) {
        // TODO: replicate scraping logic in a shareable lib
        // For now just log.
        console.log('Would scrape urls', msg.urls);
    }
}
export const handler = async (event) => {
    for (const record of event.Records) {
        try {
            const msg = JSON.parse(record.body);
            await runJob(msg);
        }
        catch (e) {
            console.error('Job failed', e);
            throw e; // Let SQS retry
        }
    }
};
