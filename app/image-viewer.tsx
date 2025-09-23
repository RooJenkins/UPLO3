import React, { useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { X, Download, Share } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewerScreen() {
  const { imageUrl } = useLocalSearchParams<{ imageUrl: string }>();
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      scale.setOffset((scale as any)._value);
      translateX.setOffset((translateX as any)._value);
      translateY.setOffset((translateY as any)._value);
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.numberActiveTouches === 2) {
        // Pinch to zoom
        const distance = Math.sqrt(
          Math.pow(gestureState.dx, 2) + Math.pow(gestureState.dy, 2)
        );
        const scaleValue = Math.max(0.5, Math.min(3, 1 + distance / 200));
        scale.setValue(scaleValue);
      } else {
        // Pan
        translateX.setValue(gestureState.dx);
        translateY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: () => {
      scale.flattenOffset();
      translateX.flattenOffset();
      translateY.flattenOffset();

      // Reset if zoomed out too much
      if ((scale as any)._value < 1) {
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        ]).start();
      }
    },
  });

  const handleDownload = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    // TODO: Implement download functionality
    console.log('Download image:', imageUrl);
  };

  const handleShare = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    // TODO: Implement share functionality
    console.log('Share image:', imageUrl);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <X size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
          >
            <Share size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDownload}
          >
            <Download size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.imageContainer} {...panResponder.panHandlers}>
        <Animated.Image
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            {
              transform: [
                { scale },
                { translateX },
                { translateY },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});