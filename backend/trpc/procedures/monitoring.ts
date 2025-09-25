/**
 * Monitoring tRPC Procedures
 *
 * API endpoints for system monitoring, health checks, and alerting
 */

import { z } from 'zod';
import { publicProcedure } from '../context';
import { getSystemMonitor } from '../../monitoring';

export const monitoringProcedures = {
  // Get current system health metrics
  getSystemHealth: publicProcedure.query(async () => {
    console.log('[MONITORING API] 📊 Getting current system health');

    try {
      const monitor = getSystemMonitor();
      const metrics = await monitor.getCurrentMetrics();

      return {
        success: true,
        data: {
          ...metrics,
          timestamp: metrics.timestamp.toISOString(),
          alerts: metrics.alerts.map(alert => ({
            ...alert,
            timestamp: alert.timestamp.toISOString()
          }))
        }
      };
    } catch (error) {
      console.error('[MONITORING API] ❌ Error getting system health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }),

  // Get system status summary
  getSystemStatus: publicProcedure.query(async () => {
    console.log('[MONITORING API] 🏥 Getting system status summary');

    try {
      const monitor = getSystemMonitor();
      const status = await monitor.getSystemStatus();

      return {
        success: true,
        data: status
      };
    } catch (error) {
      console.error('[MONITORING API] ❌ Error getting system status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed'
      };
    }
  }),

  // Get metrics history
  getMetricsHistory: publicProcedure
    .input(z.object({
      hours: z.number().min(1).max(168).default(24) // Max 1 week
    }))
    .query(async ({ input }) => {
      console.log(`[MONITORING API] 📈 Getting metrics history for ${input.hours} hours`);

      try {
        const monitor = getSystemMonitor();
        const history = monitor.getMetricsHistory(input.hours);

        const formattedHistory = history.map(metrics => ({
          ...metrics,
          timestamp: metrics.timestamp.toISOString(),
          alerts: metrics.alerts.map(alert => ({
            ...alert,
            timestamp: alert.timestamp.toISOString()
          }))
        }));

        return {
          success: true,
          data: formattedHistory,
          count: formattedHistory.length,
          timeRange: {
            hours: input.hours,
            from: formattedHistory.length > 0 ? formattedHistory[0].timestamp : null,
            to: formattedHistory.length > 0 ? formattedHistory[formattedHistory.length - 1].timestamp : null
          }
        };
      } catch (error) {
        console.error('[MONITORING API] ❌ Error getting metrics history:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'History retrieval failed'
        };
      }
    }),

  // Get active alerts
  getActiveAlerts: publicProcedure.query(async () => {
    console.log('[MONITORING API] 🚨 Getting active alerts');

    try {
      const monitor = getSystemMonitor();
      const alerts = monitor.getActiveAlerts();

      const formattedAlerts = alerts.map(alert => ({
        ...alert,
        timestamp: alert.timestamp.toISOString()
      }));

      return {
        success: true,
        data: formattedAlerts,
        count: formattedAlerts.length
      };
    } catch (error) {
      console.error('[MONITORING API] ❌ Error getting active alerts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Alert retrieval failed'
      };
    }
  }),

  // Get all alerts (including resolved)
  getAllAlerts: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(100)
    }))
    .query(async ({ input }) => {
      console.log(`[MONITORING API] 📋 Getting all alerts (limit: ${input.limit})`);

      try {
        const monitor = getSystemMonitor();
        const alerts = monitor.getAllAlerts(input.limit);

        const formattedAlerts = alerts.map(alert => ({
          ...alert,
          timestamp: alert.timestamp.toISOString()
        }));

        // Group by status
        const activeAlerts = formattedAlerts.filter(a => !a.resolved);
        const resolvedAlerts = formattedAlerts.filter(a => a.resolved);

        // Group by severity
        const alertsBySeverity = formattedAlerts.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          success: true,
          data: formattedAlerts,
          summary: {
            total: formattedAlerts.length,
            active: activeAlerts.length,
            resolved: resolvedAlerts.length,
            bySeverity: alertsBySeverity
          }
        };
      } catch (error) {
        console.error('[MONITORING API] ❌ Error getting all alerts:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Alert retrieval failed'
        };
      }
    }),

  // Resolve an alert
  resolveAlert: publicProcedure
    .input(z.object({
      alertId: z.string().min(1)
    }))
    .mutation(async ({ input }) => {
      console.log(`[MONITORING API] ✅ Resolving alert: ${input.alertId}`);

      try {
        const monitor = getSystemMonitor();
        const resolved = monitor.resolveAlert(input.alertId);

        if (resolved) {
          return {
            success: true,
            message: `Alert ${input.alertId} resolved successfully`
          };
        } else {
          return {
            success: false,
            error: `Alert ${input.alertId} not found or already resolved`
          };
        }
      } catch (error) {
        console.error('[MONITORING API] ❌ Error resolving alert:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Alert resolution failed'
        };
      }
    }),

  // Get component-specific metrics
  getComponentMetrics: publicProcedure
    .input(z.object({
      component: z.enum(['scraper', 'database', 'imageCache', 'system']),
      timeRange: z.number().min(1).max(168).default(24)
    }))
    .query(async ({ input }) => {
      console.log(`[MONITORING API] 🔧 Getting ${input.component} metrics for ${input.timeRange} hours`);

      try {
        const monitor = getSystemMonitor();
        const history = monitor.getMetricsHistory(input.timeRange);

        // Extract component-specific data
        const componentData = history.map(metrics => ({
          timestamp: metrics.timestamp.toISOString(),
          data: (metrics as any)[input.component],
          overallStatus: metrics.overall.status
        }));

        // Calculate component statistics
        const statuses = componentData.map(d => d.data.status);
        const statusCounts = statuses.reduce((acc, status) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          success: true,
          component: input.component,
          data: componentData,
          statistics: {
            dataPoints: componentData.length,
            timeRange: input.timeRange,
            statusDistribution: statusCounts,
            currentStatus: componentData.length > 0 ? componentData[componentData.length - 1].data.status : 'unknown'
          }
        };
      } catch (error) {
        console.error('[MONITORING API] ❌ Error getting component metrics:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Component metrics retrieval failed'
        };
      }
    }),

  // Get performance trends
  getPerformanceTrends: publicProcedure
    .input(z.object({
      timeRange: z.number().min(1).max(168).default(24)
    }))
    .query(async ({ input }) => {
      console.log(`[MONITORING API] 📊 Getting performance trends for ${input.timeRange} hours`);

      try {
        const monitor = getSystemMonitor();
        const history = monitor.getMetricsHistory(input.timeRange);

        if (history.length === 0) {
          return {
            success: true,
            data: {
              scraperTrends: { successRate: [], avgJobDuration: [], queueSize: [] },
              databaseTrends: { syncSuccessRate: [], totalProducts: [], queueSize: [] },
              imageCacheTrends: { cacheHitRate: [], failureRate: [], totalImages: [] },
              systemTrends: { memoryUsage: [], cpuUsage: [], diskUsage: [] }
            },
            timeRange: input.timeRange
          };
        }

        // Extract trends
        const scraperTrends = {
          successRate: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.scraper.successRate })),
          avgJobDuration: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.scraper.avgJobDuration })),
          queueSize: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.scraper.queueSize }))
        };

        const databaseTrends = {
          syncSuccessRate: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.database.syncSuccessRate })),
          totalProducts: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.database.totalProducts })),
          queueSize: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.database.syncQueueSize }))
        };

        const imageCacheTrends = {
          cacheHitRate: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.imageCache.cacheHitRate })),
          failureRate: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.imageCache.failureRate })),
          totalImages: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.imageCache.totalImages }))
        };

        const systemTrends = {
          memoryUsage: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.system.memory.percentage })),
          cpuUsage: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.system.cpu.usage })),
          diskUsage: history.map(h => ({ timestamp: h.timestamp.toISOString(), value: h.system.disk.percentage }))
        };

        return {
          success: true,
          data: {
            scraperTrends,
            databaseTrends,
            imageCacheTrends,
            systemTrends
          },
          timeRange: input.timeRange,
          dataPoints: history.length
        };
      } catch (error) {
        console.error('[MONITORING API] ❌ Error getting performance trends:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Trends retrieval failed'
        };
      }
    }),

  // Get alert statistics
  getAlertStatistics: publicProcedure
    .input(z.object({
      timeRange: z.number().min(1).max(720).default(168) // Default 1 week, max 30 days
    }))
    .query(async ({ input }) => {
      console.log(`[MONITORING API] 📈 Getting alert statistics for ${input.timeRange} hours`);

      try {
        const monitor = getSystemMonitor();
        const allAlerts = monitor.getAllAlerts(1000); // Get many alerts

        // Filter by time range
        const cutoff = Date.now() - (input.timeRange * 60 * 60 * 1000);
        const recentAlerts = allAlerts.filter(alert => alert.timestamp.getTime() > cutoff);

        // Group by component
        const alertsByComponent = recentAlerts.reduce((acc, alert) => {
          acc[alert.component] = (acc[alert.component] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Group by severity
        const alertsBySeverity = recentAlerts.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Calculate resolution stats
        const resolvedAlerts = recentAlerts.filter(a => a.resolved);
        const activeAlerts = recentAlerts.filter(a => !a.resolved);

        // Calculate average resolution time for resolved alerts
        const avgResolutionTime = resolvedAlerts.length > 0
          ? resolvedAlerts.reduce((sum, alert) => {
              // Approximate resolution time (this would be better with actual resolution timestamps)
              return sum + (60 * 60 * 1000); // Assume 1 hour average
            }, 0) / resolvedAlerts.length
          : 0;

        return {
          success: true,
          data: {
            total: recentAlerts.length,
            active: activeAlerts.length,
            resolved: resolvedAlerts.length,
            resolutionRate: recentAlerts.length > 0 ? (resolvedAlerts.length / recentAlerts.length) : 0,
            avgResolutionTimeMs: avgResolutionTime,
            byComponent: alertsByComponent,
            bySeverity: alertsBySeverity
          },
          timeRange: input.timeRange
        };
      } catch (error) {
        console.error('[MONITORING API] ❌ Error getting alert statistics:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Alert statistics retrieval failed'
        };
      }
    })
};

export { monitoringProcedures };