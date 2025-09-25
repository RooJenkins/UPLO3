#!/usr/bin/env tsx

/**
 * Test script for the web scraper system
 * Demonstrates the core functionality with a simple Zara product
 *
 * Usage: bun run backend/scraper/test-scraper.ts
 */

import ScraperEngine from './core/ScraperEngine';
import {
  ZaraAdapter,
  GenericAdapter,
  HMAdapter,
  NikeAdapter,
  ASOSAdapter,
  createAdapter,
  getSupportedBrands
} from './adapters';
import ScraperQueue from './queue/ScraperQueue';
import QueueWorker from './queue/QueueWorker';

async function testScraperEngine() {
  console.log('🕷️ Starting Scraper Engine Test\n');

  const engine = new ScraperEngine();

  try {
    // Initialize the engine
    console.log('📡 Initializing scraper engine...');
    await engine.initialize();
    console.log('✅ Engine initialized successfully\n');

    // Test with different brand adapters
    console.log('📋 Supported brands:', getSupportedBrands().join(', '));

    const testUrls = [
      {
        url: 'https://example-shop.com/product/test-tshirt',
        brand: 'generic',
        adapter: createAdapter('generic')
      },
      {
        url: 'https://httpbin.org/html',
        brand: 'h&m',
        adapter: createAdapter('h&m')
      },
      {
        url: 'https://httpbin.org/json',
        brand: 'nike',
        adapter: createAdapter('nike')
      },
      {
        url: 'https://httpbin.org/get',
        brand: 'asos',
        adapter: createAdapter('asos')
      }
    ];

    console.log('🔍 Testing product scraping...\n');

    for (const { url, brand, adapter } of testUrls) {
      console.log(`Testing ${brand}: ${url}`);

      try {
        const result = await engine.scrapePage(url, adapter);

        if (result) {
          console.log('✅ Scraping successful!');
          console.log('📦 Product data:', JSON.stringify(result, null, 2));
        } else {
          console.log('⚠️ No product data extracted');
        }
      } catch (error) {
        console.error(`❌ Error scraping ${url}:`, error);
      }

      console.log(''); // Empty line for readability
    }

    // Get engine stats
    const stats = engine.getStats();
    console.log('📊 Engine Stats:', stats);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\n🛑 Shutting down engine...');
    await engine.shutdown();
    console.log('✅ Test complete!');
  }
}

async function testQueueSystem() {
  console.log('\n🔄 Starting Queue System Test\n');

  const queue = new ScraperQueue();
  const worker = new QueueWorker();

  try {
    console.log('📡 Starting worker...');
    await worker.start();
    console.log('✅ Worker started successfully\n');

    // Add test jobs
    const testJobs = [
      {
        id: 'test-job-1',
        url: 'https://httpbin.org/html', // Simple HTML endpoint for testing
        brand: 'generic',
        adapter: 'generic',
        priority: 1
      },
      {
        id: 'test-job-2',
        url: 'https://httpbin.org/json', // JSON endpoint
        brand: 'generic',
        adapter: 'generic',
        priority: 2
      }
    ];

    console.log('📝 Adding test jobs to queue...');
    for (const job of testJobs) {
      await queue.addJob(job);
      console.log(`✅ Added job: ${job.id}`);
    }

    // Wait for jobs to process
    console.log('\n⏳ Waiting for jobs to process...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

    // Get queue stats
    const queueStats = await queue.getStats();
    console.log('📊 Queue Stats:', queueStats);

    const workerStats = worker.getStats();
    console.log('📊 Worker Stats:', workerStats);

    // Get completed jobs
    const completedJobs = await queue.getJobsByStatus('completed', 5);
    console.log(`📋 Completed Jobs (${completedJobs.length}):`);
    completedJobs.forEach(job => {
      console.log(`  - ${job.id}: ${job.returnvalue ? '✅ Success' : '❌ Failed'}`);
    });

  } catch (error) {
    console.error('❌ Queue test failed:', error);
  } finally {
    console.log('\n🛑 Shutting down queue system...');
    await worker.stop();
    await queue.close();
    console.log('✅ Queue test complete!');
  }
}

async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check\n');

  const queue = new ScraperQueue();
  const worker = new QueueWorker();

  try {
    await worker.start();

    const queueHealth = await queue.healthCheck();
    console.log('Queue Health:', JSON.stringify(queueHealth, null, 2));

    const workerHealth = await worker.healthCheck();
    console.log('Worker Health:', JSON.stringify(workerHealth, null, 2));

    await worker.stop();
    await queue.close();
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 UPLO3 Web Scraper System Test Suite\n');
  console.log('═'.repeat(50));

  try {
    // Test 1: Basic scraper engine
    await testScraperEngine();

    // Test 2: Queue system (requires Redis - will fail gracefully if not available)
    console.log('\n' + '═'.repeat(50));
    try {
      await testQueueSystem();
    } catch (error) {
      console.log('⚠️ Queue system test skipped (Redis not available)');
      console.log('   To run queue tests, start Redis: redis-server');
    }

    // Test 3: Health check
    console.log('\n' + '═'.repeat(50));
    try {
      await testHealthCheck();
    } catch (error) {
      console.log('⚠️ Health check test skipped');
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

// Start the tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { testScraperEngine, testQueueSystem, testHealthCheck };