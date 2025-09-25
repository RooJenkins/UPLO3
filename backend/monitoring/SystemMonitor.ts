/**
 * System Monitor
 *
 * Comprehensive monitoring system for scraper, database, and overall system health
 * Provides real-time metrics, alerts, and performance tracking
 */

import { EventEmitter } from 'events';
import { getDatabaseService, getSyncManager, getImageCacheService } from '../database';
import ScraperQueue from '../scraper/queue/ScraperQueue';
import QueueWorker from '../scraper/queue/QueueWorker';

export interface SystemHealthMetrics {
  timestamp: Date;
  overall: {
    status: 'healthy' | 'warning' | 'critical' | 'down';
    uptime: number;
    version: string;
  };
  scraper: {
    status: 'healthy' | 'warning' | 'critical' | 'down';
    queueSize: number;
    activeWorkers: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;
    avgJobDuration: number;
  };
  database: {
    status: 'healthy' | 'warning' | 'critical' | 'down';
    totalProducts: number;
    totalBrands: number;
    totalCategories: number;
    syncQueueSize: number;
    lastSyncTime: Date;
    syncSuccessRate: number;
  };
  imageCache: {
    status: 'healthy' | 'warning' | 'critical' | 'down';
    totalImages: number;
    cachedImages: number;
    cacheHitRate: number;
    failureRate: number;
    totalCacheSize: number;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: Date;
    component: string;
    resolved: boolean;
  }>;
}

export interface MonitoringConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  alertThresholds: {
    queueSize: number;
    failureRate: number;
    memoryUsage: number;
    diskUsage: number;
    syncDelay: number; // minutes
  };
  notifications: {
    webhook: {
      enabled: boolean;
      url?: string;
    };
    email: {
      enabled: boolean;
      recipients?: string[];
    };
  };
  retention: {
    metricsHistory: number; // days
    alertHistory: number; // days
  };
}

export class SystemMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private isRunning = false;
  private monitoringTimer?: NodeJS.Timeout;
  private metricsHistory: SystemHealthMetrics[] = [];
  private activeAlerts: Map<string, SystemHealthMetrics['alerts'][0]> = new Map();
  private startTime = Date.now();

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      checkInterval: 60000, // 1 minute
      alertThresholds: {
        queueSize: 1000,
        failureRate: 0.1, // 10%
        memoryUsage: 0.8, // 80%
        diskUsage: 0.9, // 90%
        syncDelay: 30 // 30 minutes
      },
      notifications: {
        webhook: {
          enabled: false
        },
        email: {
          enabled: false
        }
      },
      retention: {
        metricsHistory: 7, // 7 days
        alertHistory: 30 // 30 days
      },
      ...config
    };

    console.log('[MONITOR] 📊 System monitor initialized');
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[MONITOR] ⚠️ Monitor already running');
      return;
    }

    console.log('[MONITOR] ▶️ Starting system monitoring...');

    this.isRunning = true;

    // Perform initial health check
    await this.performHealthCheck();

    // Start periodic monitoring
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('[MONITOR] ❌ Health check error:', error);
        this.createAlert('monitor', 'error', `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, this.config.checkInterval);

    console.log(`[MONITOR] ✅ System monitoring started (interval: ${this.config.checkInterval}ms)`);
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[MONITOR] ⏹️ Stopping system monitoring...');

    this.isRunning = false;

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    console.log('[MONITOR] ✅ System monitoring stopped');
  }

  /**
   * Get current system health metrics
   */
  async getCurrentMetrics(): Promise<SystemHealthMetrics> {
    const metrics = await this.collectMetrics();
    return metrics;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): SystemHealthMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp.getTime() > cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SystemHealthMetrics['alerts'] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(limit: number = 100): SystemHealthMetrics['alerts'] {
    const allAlerts = Array.from(this.activeAlerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return allAlerts;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      console.log(`[MONITOR] ✅ Alert resolved: ${alertId}`);
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get system status summary
   */
  async getSystemStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical' | 'down';
    uptime: string;
    activeAlerts: number;
    components: {
      scraper: string;
      database: string;
      imageCache: string;
      system: string;
    };
  }> {
    const metrics = await this.getCurrentMetrics();
    const uptime = this.formatUptime(Date.now() - this.startTime);

    return {
      status: metrics.overall.status,
      uptime,
      activeAlerts: this.getActiveAlerts().length,
      components: {
        scraper: metrics.scraper.status,
        database: metrics.database.status,
        imageCache: metrics.imageCache.status,
        system: this.getSystemStatus()
      }
    };
  }

  // Private methods

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const metrics = await this.collectMetrics();

    // Add to history
    this.metricsHistory.push(metrics);

    // Clean old history
    this.cleanOldMetrics();

    // Check for alerts
    this.checkAlerts(metrics);

    // Emit metrics event
    this.emit('metrics', metrics);

    console.log(`[MONITOR] 📊 Health check completed - Status: ${metrics.overall.status}`);
  }

  /**
   * Collect all system metrics
   */
  private async collectMetrics(): Promise<SystemHealthMetrics> {
    const timestamp = new Date();

    // Collect scraper metrics
    const scraperMetrics = await this.getScraperMetrics();

    // Collect database metrics
    const databaseMetrics = await this.getDatabaseMetrics();

    // Collect image cache metrics
    const imageCacheMetrics = await this.getImageCacheMetrics();

    // Collect system metrics
    const systemMetrics = this.getSystemMetrics();

    // Determine overall status
    const componentStatuses = [
      scraperMetrics.status,
      databaseMetrics.status,
      imageCacheMetrics.status,
      systemMetrics.status || 'healthy'
    ];

    const overallStatus = this.determineOverallStatus(componentStatuses);

    const metrics: SystemHealthMetrics = {
      timestamp,
      overall: {
        status: overallStatus,
        uptime: Date.now() - this.startTime,
        version: '1.0.0'
      },
      scraper: scraperMetrics,
      database: databaseMetrics,
      imageCache: imageCacheMetrics,
      system: {
        memory: systemMetrics.memory,
        cpu: systemMetrics.cpu,
        disk: systemMetrics.disk
      },
      alerts: Array.from(this.activeAlerts.values())
    };

    return metrics;
  }

  /**
   * Get scraper component metrics
   */
  private async getScraperMetrics(): Promise<SystemHealthMetrics['scraper']> {
    try {
      // In a real implementation, these would connect to actual scraper instances
      const mockScraperStats = {
        queueSize: Math.floor(Math.random() * 50),
        activeWorkers: Math.floor(Math.random() * 30) + 1,
        completedJobs: Math.floor(Math.random() * 1000) + 500,
        failedJobs: Math.floor(Math.random() * 50),
        avgJobDuration: Math.floor(Math.random() * 5000) + 2000
      };

      const successRate = mockScraperStats.completedJobs /
        (mockScraperStats.completedJobs + mockScraperStats.failedJobs);

      let status: SystemHealthMetrics['scraper']['status'] = 'healthy';
      if (mockScraperStats.queueSize > this.config.alertThresholds.queueSize) status = 'warning';
      if (successRate < (1 - this.config.alertThresholds.failureRate)) status = 'critical';
      if (mockScraperStats.activeWorkers === 0) status = 'down';

      return {
        status,
        queueSize: mockScraperStats.queueSize,
        activeWorkers: mockScraperStats.activeWorkers,
        completedJobs: mockScraperStats.completedJobs,
        failedJobs: mockScraperStats.failedJobs,
        successRate,
        avgJobDuration: mockScraperStats.avgJobDuration
      };

    } catch (error) {
      return {
        status: 'down',
        queueSize: 0,
        activeWorkers: 0,
        completedJobs: 0,
        failedJobs: 0,
        successRate: 0,
        avgJobDuration: 0
      };
    }
  }

  /**
   * Get database component metrics
   */
  private async getDatabaseMetrics(): Promise<SystemHealthMetrics['database']> {
    try {
      const databaseService = getDatabaseService();
      const syncManager = getSyncManager();

      const dbStats = databaseService.getStats();
      const syncStats = syncManager.getStats();

      const syncSuccessRate = syncStats.recentSyncs.successRate;
      const timeSinceLastSync = Date.now() - new Date(dbStats.sync.lastSyncTime).getTime();
      const syncDelayMinutes = timeSinceLastSync / (1000 * 60);

      let status: SystemHealthMetrics['database']['status'] = 'healthy';
      if (syncSuccessRate < (1 - this.config.alertThresholds.failureRate)) status = 'warning';
      if (syncDelayMinutes > this.config.alertThresholds.syncDelay) status = 'critical';

      return {
        status,
        totalProducts: dbStats.totalProducts,
        totalBrands: Object.keys(dbStats.brands).length,
        totalCategories: Object.keys(dbStats.categories).length,
        syncQueueSize: syncStats.queueSize,
        lastSyncTime: new Date(dbStats.sync.lastSyncTime),
        syncSuccessRate
      };

    } catch (error) {
      return {
        status: 'down',
        totalProducts: 0,
        totalBrands: 0,
        totalCategories: 0,
        syncQueueSize: 0,
        lastSyncTime: new Date(),
        syncSuccessRate: 0
      };
    }
  }

  /**
   * Get image cache component metrics
   */
  private async getImageCacheMetrics(): Promise<SystemHealthMetrics['imageCache']> {
    try {
      const imageCacheService = getImageCacheService();
      const cacheStats = imageCacheService.getStats();

      const cacheHitRate = cacheStats.cachedImages / Math.max(cacheStats.totalImages, 1);
      const failureRate = cacheStats.failedDownloads / Math.max(cacheStats.totalImages, 1);

      let status: SystemHealthMetrics['imageCache']['status'] = 'healthy';
      if (failureRate > this.config.alertThresholds.failureRate) status = 'warning';

      return {
        status,
        totalImages: cacheStats.totalImages,
        cachedImages: cacheStats.cachedImages,
        cacheHitRate,
        failureRate,
        totalCacheSize: cacheStats.totalCacheSize
      };

    } catch (error) {
      return {
        status: 'down',
        totalImages: 0,
        cachedImages: 0,
        cacheHitRate: 0,
        failureRate: 1,
        totalCacheSize: 0
      };
    }
  }

  /**
   * Get system resource metrics
   */
  private getSystemMetrics(): {
    memory: { used: number; total: number; percentage: number };
    cpu: { usage: number };
    disk: { used: number; total: number; percentage: number };
    status?: string;
  } {
    try {
      // Mock system metrics - in production, use actual system monitoring
      const totalMemory = 8 * 1024 * 1024 * 1024; // 8GB
      const usedMemory = Math.floor(Math.random() * totalMemory * 0.8);
      const memoryPercentage = usedMemory / totalMemory;

      const totalDisk = 500 * 1024 * 1024 * 1024; // 500GB
      const usedDisk = Math.floor(Math.random() * totalDisk * 0.6);
      const diskPercentage = usedDisk / totalDisk;

      const cpuUsage = Math.random() * 0.8; // 0-80% CPU

      let status = 'healthy';
      if (memoryPercentage > this.config.alertThresholds.memoryUsage) status = 'warning';
      if (diskPercentage > this.config.alertThresholds.diskUsage) status = 'critical';

      return {
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: memoryPercentage
        },
        cpu: {
          usage: cpuUsage
        },
        disk: {
          used: usedDisk,
          total: totalDisk,
          percentage: diskPercentage
        },
        status
      };

    } catch (error) {
      return {
        memory: { used: 0, total: 0, percentage: 1 },
        cpu: { usage: 1 },
        disk: { used: 0, total: 0, percentage: 1 },
        status: 'down'
      };
    }
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(statuses: string[]): SystemHealthMetrics['overall']['status'] {
    if (statuses.includes('down')) return 'down';
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(metrics: SystemHealthMetrics): void {
    // Clear existing component alerts if status is now healthy
    Object.keys(metrics).forEach(component => {
      if (component !== 'overall' && component !== 'alerts' && component !== 'timestamp') {
        const componentMetrics = (metrics as any)[component];
        if (componentMetrics.status === 'healthy') {
          this.resolveComponentAlerts(component);
        }
      }
    });

    // Check scraper alerts
    if (metrics.scraper.status !== 'healthy') {
      this.createAlert('scraper', 'warning', `Scraper status: ${metrics.scraper.status}. Queue size: ${metrics.scraper.queueSize}`);
    }

    // Check database alerts
    if (metrics.database.status !== 'healthy') {
      this.createAlert('database', 'warning', `Database status: ${metrics.database.status}. Sync queue: ${metrics.database.syncQueueSize}`);
    }

    // Check image cache alerts
    if (metrics.imageCache.status !== 'healthy') {
      this.createAlert('imageCache', 'warning', `Image cache status: ${metrics.imageCache.status}. Failure rate: ${(metrics.imageCache.failureRate * 100).toFixed(1)}%`);
    }

    // Check system resource alerts
    if (metrics.system.memory.percentage > this.config.alertThresholds.memoryUsage) {
      this.createAlert('system', 'warning', `High memory usage: ${(metrics.system.memory.percentage * 100).toFixed(1)}%`);
    }

    if (metrics.system.disk.percentage > this.config.alertThresholds.diskUsage) {
      this.createAlert('system', 'error', `High disk usage: ${(metrics.system.disk.percentage * 100).toFixed(1)}%`);
    }
  }

  /**
   * Create new alert
   */
  private createAlert(component: string, severity: SystemHealthMetrics['alerts'][0]['severity'], message: string): void {
    const alertId = `${component}_${severity}_${Date.now()}`;

    const alert: SystemHealthMetrics['alerts'][0] = {
      id: alertId,
      severity,
      message,
      timestamp: new Date(),
      component,
      resolved: false
    };

    this.activeAlerts.set(alertId, alert);

    console.log(`[MONITOR] 🚨 Alert created: [${severity.toUpperCase()}] ${component}: ${message}`);

    this.emit('alert', alert);

    // Send notifications
    this.sendNotification(alert);
  }

  /**
   * Resolve component alerts
   */
  private resolveComponentAlerts(component: string): void {
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.component === component && !alert.resolved) {
        alert.resolved = true;
        console.log(`[MONITOR] ✅ Auto-resolved alert: ${alertId}`);
        this.emit('alertResolved', alert);
      }
    }
  }

  /**
   * Send notification for alert
   */
  private async sendNotification(alert: SystemHealthMetrics['alerts'][0]): Promise<void> {
    try {
      // Webhook notification
      if (this.config.notifications.webhook.enabled && this.config.notifications.webhook.url) {
        await this.sendWebhookNotification(alert);
      }

      // Email notification (placeholder)
      if (this.config.notifications.email.enabled) {
        await this.sendEmailNotification(alert);
      }

    } catch (error) {
      console.error('[MONITOR] ❌ Failed to send notification:', error);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: SystemHealthMetrics['alerts'][0]): Promise<void> {
    if (!this.config.notifications.webhook.url) return;

    try {
      const response = await fetch(this.config.notifications.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'UPLO3-SystemMonitor/1.0'
        },
        body: JSON.stringify({
          source: 'system-monitor',
          alert,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      console.log('[MONITOR] 📤 Webhook notification sent');

    } catch (error) {
      console.error('[MONITOR] ❌ Webhook notification failed:', error);
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(alert: SystemHealthMetrics['alerts'][0]): Promise<void> {
    console.log('[MONITOR] 📧 Email notification (simulated):', {
      recipients: this.config.notifications.email.recipients,
      subject: `[UPLO3] ${alert.severity.toUpperCase()}: ${alert.component}`,
      message: alert.message
    });
  }

  /**
   * Clean old metrics from history
   */
  private cleanOldMetrics(): void {
    const retentionMs = this.config.retention.metricsHistory * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;

    this.metricsHistory = this.metricsHistory.filter(
      metrics => metrics.timestamp.getTime() > cutoff
    );

    // Clean old alerts
    const alertRetentionMs = this.config.retention.alertHistory * 24 * 60 * 60 * 1000;
    const alertCutoff = Date.now() - alertRetentionMs;

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.timestamp.getTime() < alertCutoff && alert.resolved) {
        this.activeAlerts.delete(alertId);
      }
    }
  }

  /**
   * Format uptime duration
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

export default SystemMonitor;