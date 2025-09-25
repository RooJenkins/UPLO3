/**
 * Monitoring Module Index
 *
 * Centralized monitoring system for UPLO3 scraper infrastructure
 */

import SystemMonitor from './SystemMonitor';

// Global monitor instance
let globalMonitor: SystemMonitor | null = null;

/**
 * Get or create global monitor instance
 */
export function getSystemMonitor(): SystemMonitor {
  if (!globalMonitor) {
    globalMonitor = new SystemMonitor({
      enabled: true,
      checkInterval: 60000, // 1 minute
      alertThresholds: {
        queueSize: 500,
        failureRate: 0.15,
        memoryUsage: 0.85,
        diskUsage: 0.9,
        syncDelay: 30
      },
      notifications: {
        webhook: {
          enabled: process.env.MONITOR_WEBHOOK_ENABLED === 'true',
          url: process.env.MONITOR_WEBHOOK_URL
        },
        email: {
          enabled: process.env.MONITOR_EMAIL_ENABLED === 'true',
          recipients: process.env.MONITOR_EMAIL_RECIPIENTS?.split(',')
        }
      },
      retention: {
        metricsHistory: 7,
        alertHistory: 30
      }
    });
  }

  return globalMonitor;
}

/**
 * Initialize monitoring system
 */
export async function initializeMonitoring(): Promise<void> {
  console.log('[MONITORING] 🚀 Initializing monitoring system...');

  const monitor = getSystemMonitor();

  // Set up event listeners
  monitor.on('alert', (alert) => {
    console.log(`[MONITORING] 🚨 ALERT [${alert.severity.toUpperCase()}] ${alert.component}: ${alert.message}`);
  });

  monitor.on('alertResolved', (alert) => {
    console.log(`[MONITORING] ✅ RESOLVED: ${alert.id}`);
  });

  monitor.on('metrics', (metrics) => {
    if (metrics.overall.status !== 'healthy') {
      console.log(`[MONITORING] ⚠️ System status: ${metrics.overall.status}`);
    }
  });

  // Start monitoring
  await monitor.start();

  console.log('[MONITORING] ✅ Monitoring system initialized');
}

/**
 * Shutdown monitoring system
 */
export async function shutdownMonitoring(): Promise<void> {
  console.log('[MONITORING] 🛑 Shutting down monitoring system...');

  if (globalMonitor) {
    await globalMonitor.stop();
    globalMonitor = null;
  }

  console.log('[MONITORING] ✅ Monitoring system shut down');
}

export { SystemMonitor };
export * from './SystemMonitor';

export default {
  SystemMonitor,
  getSystemMonitor,
  initializeMonitoring,
  shutdownMonitoring
};