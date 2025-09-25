import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Cpu, Zap, Database, Gauge, Target, RotateCw, Shield, AlertTriangle } from 'lucide-react-native';

interface LoadingStatsProps {
  stats: {
    queueLength: number;
    processing: number;
    cached: number;
    preloaded: number;
    busyWorkers: number;
    totalWorkers: number;
    efficiency: number;
    bufferHealth?: number;
    distanceFromEnd?: number;
    continuousEnabled?: boolean;
  };
  scrollVelocity: number;
  style?: any;
  systemHealth?: {
    circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    queueSize: number;
    maxQueueSize: number;
    queueHealth: string;
    apiFailureRate: string;
    recentRequests: number;
    recentFailures: number;
  };
}

export function LoadingStats({ stats, scrollVelocity, style, systemHealth }: LoadingStatsProps) {
  const efficiencyColor = stats.efficiency > 0.8 ? '#4ECDC4' : stats.efficiency > 0.5 ? '#FFB347' : '#FF6B6B';
  const velocityColor = Math.abs(scrollVelocity) > 2 ? '#4ECDC4' : '#9CA3AF';
  const bufferHealthColor = (stats.bufferHealth || 0) > 80 ? '#4ECDC4' : (stats.bufferHealth || 0) > 50 ? '#FFB347' : '#FF6B6B';
  const distanceColor = (stats.distanceFromEnd || 0) < 10 ? '#FF6B6B' : (stats.distanceFromEnd || 0) < 30 ? '#FFB347' : '#4ECDC4';

  // 🚨 SYSTEM HEALTH COLORS
  const circuitBreakerColor = systemHealth?.circuitBreakerState === 'OPEN' ? '#FF6B6B' :
                             systemHealth?.circuitBreakerState === 'HALF_OPEN' ? '#FFB347' : '#4ECDC4';
  const queueHealthColor = parseFloat(systemHealth?.queueHealth || '100') > 80 ? '#4ECDC4' :
                          parseFloat(systemHealth?.queueHealth || '100') > 50 ? '#FFB347' : '#FF6B6B';

  return (
    <View style={[styles.container, style]}>
      {/* Workers Status */}
      <View style={styles.statRow}>
        <Cpu size={14} color="#9CA3AF" />
        <Text style={styles.statLabel}>Workers</Text>
        <Text style={styles.statValue}>
          {stats.busyWorkers}/{stats.totalWorkers}
        </Text>
      </View>

      {/* Efficiency */}
      <View style={styles.statRow}>
        <Zap size={14} color={efficiencyColor} />
        <Text style={styles.statLabel}>Efficiency</Text>
        <Text style={[styles.statValue, { color: efficiencyColor }]}>
          {(stats.efficiency * 100).toFixed(0)}%
        </Text>
      </View>

      {/* Cache Status */}
      <View style={styles.statRow}>
        <Database size={14} color="#9CA3AF" />
        <Text style={styles.statLabel}>Cached</Text>
        <Text style={styles.statValue}>
          {stats.cached}
        </Text>
      </View>

      {/* Buffer Health */}
      {stats.bufferHealth !== undefined && (
        <View style={styles.statRow}>
          <Target size={14} color={bufferHealthColor} />
          <Text style={styles.statLabel}>Buffer</Text>
          <Text style={[styles.statValue, { color: bufferHealthColor }]}>
            {stats.bufferHealth.toFixed(0)}%
          </Text>
        </View>
      )}

      {/* Distance from End */}
      {stats.distanceFromEnd !== undefined && (
        <View style={styles.statRow}>
          <Gauge size={14} color={distanceColor} />
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={[styles.statValue, { color: distanceColor }]}>
            {stats.distanceFromEnd}
          </Text>
        </View>
      )}

      {/* 🚨 EMERGENCY SYSTEM STATUS */}
      {systemHealth && (
        <>
          {/* Circuit Breaker Status */}
          <View style={styles.statRow}>
            {systemHealth.circuitBreakerState === 'OPEN' ? (
              <AlertTriangle size={14} color={circuitBreakerColor} />
            ) : (
              <Shield size={14} color={circuitBreakerColor} />
            )}
            <Text style={styles.statLabel}>API</Text>
            <Text style={[styles.statValue, { color: circuitBreakerColor }]}>
              {systemHealth.circuitBreakerState === 'OPEN' ? 'DOWN' :
               systemHealth.circuitBreakerState === 'HALF_OPEN' ? 'TEST' : 'OK'}
            </Text>
          </View>

          {/* Queue Health */}
          <View style={styles.statRow}>
            <Gauge size={14} color={queueHealthColor} />
            <Text style={styles.statLabel}>Queue</Text>
            <Text style={[styles.statValue, { color: queueHealthColor }]}>
              {systemHealth.queueHealth}
            </Text>
          </View>

          {/* API Failure Rate */}
          {parseFloat(systemHealth.apiFailureRate) > 0 && (
            <View style={styles.statRow}>
              <Text style={[styles.queueIndicator, {
                color: parseFloat(systemHealth.apiFailureRate) > 50 ? '#FF6B6B' : '#FFB347'
              }]}>
                Fail: {systemHealth.apiFailureRate}
              </Text>
            </View>
          )}
        </>
      )}

      {/* Queue Length */}
      {stats.queueLength > 0 && (
        <View style={styles.statRow}>
          <Text style={[styles.queueIndicator, {
            color: stats.queueLength > 25 ? '#FF6B6B' : '#FFB347'
          }]}>
            Q:{stats.queueLength}
          </Text>
        </View>
      )}

      {/* Continuous Generation Status */}
      {stats.continuousEnabled && (
        <View style={styles.statRow}>
          <RotateCw
            size={12}
            color="#4ECDC4"
            style={stats.processing > 0 ? styles.spinning : {}}
          />
          <Text style={[styles.statLabel, { color: '#4ECDC4' }]}>Continuous</Text>
        </View>
      )}

      {/* Processing Indicator */}
      {stats.processing > 0 && (
        <View style={[styles.processingDot, { backgroundColor: '#4ECDC4' }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 8,
    gap: 4,
    minWidth: 120,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    flex: 1,
    fontWeight: '500',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  queueIndicator: {
    color: '#FFB347',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  processingDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  spinning: {
    // Note: React Native doesn't support CSS animations,
    // but the rotation effect suggests activity
    opacity: 0.8,
  },
});