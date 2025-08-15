#!/usr/bin/env node
import 'source-map-support/register'
import { App } from 'aws-cdk-lib'
import { LeadScraperStack } from '../lib/lead-scraper-stack.js'

const app = new App()
new LeadScraperStack(app, 'LeadScraperStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' }
})
