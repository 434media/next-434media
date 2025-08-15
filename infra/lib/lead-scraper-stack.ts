import { Duration, Stack, StackProps, CfnOutput } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { Function, Runtime, Architecture, Code } from 'aws-cdk-lib/aws-lambda'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'
import { Rule, Schedule, RuleTargetInput } from 'aws-cdk-lib/aws-events'
import { SqsQueue } from 'aws-cdk-lib/aws-events-targets'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

export interface LeadScraperStackProps extends StackProps {
  enableNightly?: boolean
}

export class LeadScraperStack extends Stack {
  constructor(scope: Construct, id: string, props?: LeadScraperStackProps) {
    super(scope, id, props)

    const neonSecret = Secret.fromSecretNameV2(this, 'NeonDbSecret', 'prod/leadapp/NEON_DATABASE_URL')
    const airtableSecret = Secret.fromSecretNameV2(this, 'AirtableKey', 'prod/leadapp/AIRTABLE_API_KEY')

    const dlq = new Queue(this, 'LeadScrapeDLQ', {
      queueName: 'lead-scrape-dlq',
      retentionPeriod: Duration.days(14)
    })

    const queue = new Queue(this, 'LeadScrapeQueue', {
      queueName: 'lead-scrape-jobs',
      visibilityTimeout: Duration.seconds(120),
      deadLetterQueue: { maxReceiveCount: 3, queue: dlq }
    })

    const worker = new Function(this, 'ScrapeWorkerFn', {
      functionName: 'lead-scrape-worker',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(60),
      memorySize: 1024,
      code: Code.fromAsset('lambda/dist'), // build lambda code first
      handler: 'index.handler',
      environment: {
        NEON_DB_SECRET_NAME: neonSecret.secretName,
        AIRTABLE_API_SECRET_NAME: airtableSecret.secretName,
        LEAD_SCRAPE_QUEUE_URL: queue.queueUrl
      }
    })

    worker.addEventSource(new SqsEventSource(queue, { batchSize: 1 }))

    neonSecret.grantRead(worker)
    airtableSecret.grantRead(worker)

    worker.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [neonSecret.secretArn, airtableSecret.secretArn]
    }))

    if (props?.enableNightly) {
      const nightly = new Rule(this, 'NightlyEnrichment', {
        schedule: Schedule.cron({ minute: '0', hour: '3' })
      })
      nightly.addTarget(new SqsQueue(queue, {
        message: RuleTargetInput.fromText(JSON.stringify({ version: 1, jobType: 'nightly-enrichment' }))
      }))
    }

    new CfnOutput(this, 'QueueUrl', { value: queue.queueUrl })
    new CfnOutput(this, 'WorkerFunctionName', { value: worker.functionName })
  }
}
