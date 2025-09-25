import { chromium, Browser, BrowserContext, Page, LaunchOptions } from 'playwright';
import UserAgent from 'user-agents';
import { PQueue } from 'p-queue';

// Anti-detection configuration
const STEALTH_CONFIG = {
  // Random viewport sizes for realistic fingerprinting
  viewports: [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1280, height: 720 },
  ],
  // Common screen configurations
  screens: [
    { deviceScaleFactor: 1, colorDepth: 24 },
    { deviceScaleFactor: 1.5, colorDepth: 24 },
    { deviceScaleFactor: 2, colorDepth: 24 },
  ],
  // Randomize browser locale
  locales: ['en-US', 'en-GB', 'en-CA', 'en-AU'],
  // Timezone randomization
  timezones: [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
  ]
};

export interface ScrapingJob {
  id: string;
  url: string;
  brand: string;
  adapter: string;
  priority: number;
  maxRetries?: number;
  retryCount?: number;
  metadata?: Record<string, any>;
}

export interface ScrapedProduct {
  externalId: string;
  name: string;
  description?: string;
  brand: string;
  category: string;
  subcategory?: string;
  basePrice: number;
  salePrice?: number;
  currency: string;
  images: Array<{ url: string; alt?: string }>;
  variants: Array<{
    color: string;
    size: string;
    sku: string;
    available: boolean;
    stockQuantity: number;
    price?: number;
  }>;
  materials?: string[];
  careInstructions?: string[];
  tags: string[];
  gender?: string;
  season?: string;
  url: string;
}

export class ScraperEngine {
  private browser: Browser | null = null;
  private queue: PQueue;
  private isRunning: boolean = false;
  private currentContexts: Map<string, BrowserContext> = new Map();
  private rateLimiter: Map<string, number> = new Map(); // Domain -> last request time
  private requestCounts: Map<string, number> = new Map(); // Domain -> requests per hour

  constructor() {
    this.queue = new PQueue({
      concurrency: 3, // Limit concurrent browsers
      interval: 1000,  // Rate limiting interval
      intervalCap: 5   // Max 5 requests per second
    });
  }

  /**
   * Initialize the scraper engine with stealth browser
   */
  async initialize(): Promise<void> {
    console.log('[SCRAPER] 🚀 Initializing stealth scraper engine...');

    try {
      // Launch browser with anti-detection settings
      this.browser = await chromium.launch({
        headless: true, // Use true for production, false for debugging
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          // Anti-automation detection
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-field-trial-config',
          '--disable-back-forward-cache',
          '--disable-ipc-flooding-protection',
          // Disable automation flags
          '--no-default-browser-check',
          '--no-pings',
          '--password-store=basic',
          '--use-mock-keychain',
        ] as string[],
      } as LaunchOptions);

      this.isRunning = true;
      console.log('[SCRAPER] ✅ Scraper engine initialized successfully');
    } catch (error) {
      console.error('[SCRAPER] ❌ Failed to initialize scraper:', error);
      throw error;
    }
  }

  /**
   * Create a new stealth browser context with randomized fingerprint
   */
  async createStealthContext(domain: string): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    // Generate random user agent
    const userAgent = new UserAgent();
    const randomViewport = STEALTH_CONFIG.viewports[Math.floor(Math.random() * STEALTH_CONFIG.viewports.length)];
    const randomScreen = STEALTH_CONFIG.screens[Math.floor(Math.random() * STEALTH_CONFIG.screens.length)];
    const randomLocale = STEALTH_CONFIG.locales[Math.floor(Math.random() * STEALTH_CONFIG.locales.length)];
    const randomTimezone = STEALTH_CONFIG.timezones[Math.floor(Math.random() * STEALTH_CONFIG.timezones.length)];

    console.log(`[SCRAPER] 🎭 Creating stealth context for ${domain}:`, {
      userAgent: userAgent.toString().substring(0, 50) + '...',
      viewport: randomViewport,
      locale: randomLocale,
      timezone: randomTimezone
    });

    const context = await this.browser.newContext({
      userAgent: userAgent.toString(),
      viewport: randomViewport,
      deviceScaleFactor: randomScreen.deviceScaleFactor,
      colorScheme: 'light',
      locale: randomLocale,
      timezoneId: randomTimezone,
      // Permissions
      permissions: [],
      // Additional headers
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': `${randomLocale.toLowerCase()},en;q=0.9`,
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    // Add realistic JavaScript overrides to avoid detection
    await context.addInitScript(() => {
      // Override the navigator.webdriver flag
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override the navigator.plugins array
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Mock chrome runtime
      (window as any).chrome = {
        runtime: {},
      };

      // Add realistic connection info
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 1.5,
          saveData: false
        }),
      });
    });

    this.currentContexts.set(domain, context);
    return context;
  }

  /**
   * Apply rate limiting per domain
   */
  private async applyRateLimit(domain: string): Promise<void> {
    const now = Date.now();
    const lastRequest = this.rateLimiter.get(domain) || 0;
    const hourlyRequests = this.requestCounts.get(domain) || 0;

    // Reset hourly counter
    if (now - lastRequest > 3600000) { // 1 hour
      this.requestCounts.set(domain, 0);
    }

    // Check hourly limits (max 100 requests per hour per domain)
    if (hourlyRequests >= 100) {
      const waitTime = 3600000 - (now - lastRequest);
      console.log(`[SCRAPER] ⏳ Rate limit exceeded for ${domain}, waiting ${Math.round(waitTime / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Apply minimum delay between requests (3-8 seconds)
    const minDelay = 3000 + Math.random() * 5000;
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest;
      console.log(`[SCRAPER] 🛑 Applying rate limit delay for ${domain}: ${Math.round(delay / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.rateLimiter.set(domain, Date.now());
    this.requestCounts.set(domain, hourlyRequests + 1);
  }

  /**
   * Simulate human-like behavior on a page
   */
  async simulateHumanBehavior(page: Page): Promise<void> {
    // Random delay before interacting
    await page.waitForTimeout(500 + Math.random() * 2000);

    // Simulate realistic scrolling
    const scrollSteps = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, 200 + Math.random() * 300);
      });
      await page.waitForTimeout(500 + Math.random() * 1500);
    }

    // Random mouse movements (optional)
    try {
      await page.mouse.move(
        Math.random() * 800,
        Math.random() * 600
      );
      await page.waitForTimeout(100 + Math.random() * 500);
    } catch (error) {
      // Ignore mouse movement errors
    }
  }

  /**
   * Scrape a single URL with full anti-detection
   */
  async scrapePage(url: string, adapter: any): Promise<ScrapedProduct | null> {
    const domain = new URL(url).hostname;

    try {
      // Apply rate limiting
      await this.applyRateLimit(domain);

      // Get or create context for this domain
      let context = this.currentContexts.get(domain);
      if (!context) {
        context = await this.createStealthContext(domain);
      }

      const page = await context.newPage();

      // Set up page event handlers
      page.on('response', response => {
        if (response.status() === 403 || response.status() === 429) {
          console.warn(`[SCRAPER] ⚠️ Blocked response ${response.status()} from ${url}`);
        }
      });

      console.log(`[SCRAPER] 🔍 Scraping: ${url}`);

      // Navigate with retry logic
      let navigationSuccess = false;
      let retries = 0;
      const maxRetries = 3;

      while (!navigationSuccess && retries < maxRetries) {
        try {
          await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
          });
          navigationSuccess = true;
        } catch (error) {
          retries++;
          console.warn(`[SCRAPER] ⚠️ Navigation attempt ${retries} failed:`, error);
          if (retries < maxRetries) {
            await page.waitForTimeout(2000 * retries); // Exponential backoff
          } else {
            throw error;
          }
        }
      }

      // Simulate human behavior
      await this.simulateHumanBehavior(page);

      // Wait for content to load
      await page.waitForTimeout(2000 + Math.random() * 3000);

      // Use adapter to extract product data
      const productData = await adapter.extractProduct(page);

      await page.close();

      if (productData) {
        console.log(`[SCRAPER] ✅ Successfully scraped product: ${productData.name}`);
        return productData;
      } else {
        console.warn(`[SCRAPER] ⚠️ No product data found at: ${url}`);
        return null;
      }

    } catch (error) {
      console.error(`[SCRAPER] ❌ Error scraping ${url}:`, error);
      return null;
    }
  }

  /**
   * Add a scraping job to the queue
   */
  async addJob(job: ScrapingJob): Promise<void> {
    this.queue.add(async () => {
      console.log(`[SCRAPER] 📝 Processing job ${job.id} for ${job.brand}`);

      try {
        // Load appropriate adapter
        const AdapterClass = await this.loadAdapter(job.adapter);
        const adapter = new AdapterClass();

        const result = await this.scrapePage(job.url, adapter);

        if (result) {
          // TODO: Send to database sync service
          console.log(`[SCRAPER] 💾 Product data ready for database sync:`, result.name);
          return result;
        }
      } catch (error) {
        console.error(`[SCRAPER] ❌ Job ${job.id} failed:`, error);

        // Retry logic
        if ((job.retryCount || 0) < (job.maxRetries || 3)) {
          job.retryCount = (job.retryCount || 0) + 1;
          console.log(`[SCRAPER] 🔄 Retrying job ${job.id}, attempt ${job.retryCount}`);
          await new Promise(resolve => setTimeout(resolve, 5000 * job.retryCount)); // Exponential backoff
          await this.addJob(job);
        }
      }
    }, { priority: job.priority });
  }

  /**
   * Load brand-specific adapter dynamically
   */
  private async loadAdapter(adapterName: string): Promise<any> {
    try {
      const adapterPath = `../adapters/${adapterName}Adapter`;
      const AdapterModule = await import(adapterPath);
      return AdapterModule.default || AdapterModule[`${adapterName}Adapter`];
    } catch (error) {
      console.warn(`[SCRAPER] ⚠️ Adapter ${adapterName} not found, using generic adapter`);
      const GenericAdapter = await import('../adapters/GenericAdapter');
      return GenericAdapter.default;
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueSize: this.queue.size,
      pending: this.queue.pending,
      running: this.isRunning,
      activeContexts: this.currentContexts.size,
      rateLimiters: this.rateLimiter.size
    };
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    console.log('[SCRAPER] 🛑 Shutting down scraper engine...');

    this.isRunning = false;

    // Close all contexts
    for (const [domain, context] of this.currentContexts) {
      try {
        await context.close();
        console.log(`[SCRAPER] ✅ Closed context for ${domain}`);
      } catch (error) {
        console.error(`[SCRAPER] ❌ Error closing context for ${domain}:`, error);
      }
    }
    this.currentContexts.clear();

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[SCRAPER] ✅ Browser closed');
    }

    // Clear queue
    this.queue.clear();
    console.log('[SCRAPER] ✅ Scraper engine shutdown complete');
  }
}

export default ScraperEngine;