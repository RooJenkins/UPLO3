import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function LoadingCard() {
  const sparkleRotation = useRef(new Animated.Value(0)).current;
  const shimmerTranslateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  useEffect(() => {
    // Sparkle rotation animation
    const sparkleAnimation = Animated.loop(
      Animated.timing(sparkleRotation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    // Shimmer animation
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerTranslateX, {
        toValue: SCREEN_WIDTH,
        duration: 1500,
        useNativeDriver: true,
      })
    );

    sparkleAnimation.start();
    shimmerAnimation.start();

    return () => {
      sparkleAnimation.stop();
      shimmerAnimation.stop();
    };
  }, [sparkleRotation, shimmerTranslateX]);

  const sparkleRotationInterpolate = sparkleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        style={styles.gradient}
      >
        {/* Shimmer effect */}
        <Animated.View
          style={[
            styles.shimmer,
            {
              transform: [{ translateX: shimmerTranslateX }],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shimmerGradient}
          />
        </Animated.View>

        {/* Loading content */}
        <View style={styles.loadingContent}>
          <Animated.View
            style={[
              styles.sparkleContainer,
              {
                transform: [{ rotate: sparkleRotationInterpolate }],
              },
            ]}
          >
            <Sparkles size={48} color="#fff" />
          </Animated.View>
          
          <View style={styles.textContainer}>
            <View style={styles.loadingBar} />
            <View style={[styles.loadingBar, styles.loadingBarShort]} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shimmerGradient: {
    flex: 1,
    width: SCREEN_WIDTH * 0.3,
  },
  loadingContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  sparkleContainer: {
    marginBottom: 32,
  },
  textContainer: {
    alignItems: 'center',
    gap: 12,
  },
  loadingBar: {
    height: 4,
    width: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  loadingBarShort: {
    width: 120,
  },
});