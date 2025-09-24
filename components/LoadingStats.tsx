import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Cpu, Zap, Database, Gauge } from 'lucide-react-native';

interface LoadingStatsProps {
  stats: {
    queueLength: number;
    processing: number;
    cached: number;
    preloaded: number;
    busyWorkers: number;
    totalWorkers: number;
    efficiency: number;
  };
  scrollVelocity: number;
  style?: any;
}

export function LoadingStats({ stats, scrollVelocity, style }: LoadingStatsProps) {
  const efficiencyColor = stats.efficiency > 0.8 ? '#4ECDC4' : stats.efficiency > 0.5 ? '#FFB347' : '#FF6B6B';
  const velocityColor = Math.abs(scrollVelocity) > 2 ? '#4ECDC4' : '#9CA3AF';

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

      {/* Scroll Velocity */}
      <View style={styles.statRow}>
        <Gauge size={14} color={velocityColor} />
        <Text style={styles.statLabel}>Speed</Text>
        <Text style={[styles.statValue, { color: velocityColor }]}>
          {Math.abs(scrollVelocity).toFixed(1)}
        </Text>
      </View>

      {/* Queue Length */}
      {stats.queueLength > 0 && (
        <View style={styles.statRow}>
          <Text style={styles.queueIndicator}>
            Q:{stats.queueLength}
          </Text>
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
});