import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ShoppingCart, ExternalLink } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFeed } from '@/providers/FeedProvider';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OutfitDetailScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const { feed } = useFeed();
  
  const entry = feed.find(item => item.id === entryId);

  if (!entry) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Outfit not found</Text>
      </View>
    );
  }

  const handleBuyItem = (item: any) => {
    // TODO: Implement buy functionality
    console.log('Buy item:', item);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'transparent']}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.back()}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Shop this look</Text>
            <View style={styles.placeholder} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: entry.imageUrl }} style={styles.outfitImage} />
        
        <View style={styles.infoSection}>
          <Text style={styles.styleTitle}>{entry.metadata.style}</Text>
          <Text style={styles.occasionText}>Perfect for {entry.metadata.occasion}</Text>
          
          <View style={styles.colorsContainer}>
            <Text style={styles.sectionTitle}>Colors</Text>
            <View style={styles.colorsList}>
              {entry.metadata.colors.map((color, index) => (
                <View
                  key={index}
                  style={[styles.colorChip, { backgroundColor: color }]}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Items in this outfit</Text>
          {entry.items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemBrand}>{item.brand}</Text>
                <Text style={styles.itemPrice}>{item.price}</Text>
              </View>
              
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.buyButton}
                  onPress={() => handleBuyItem(item)}
                >
                  <ShoppingCart size={16} color="#fff" />
                  <Text style={styles.buyButtonText}>Add to Cart</Text>
                </TouchableOpacity>
                
                {item.buyUrl && (
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => handleBuyItem(item)}
                  >
                    <ExternalLink size={16} color="#667eea" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  outfitImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.3,
    backgroundColor: '#f5f5f5',
  },
  infoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  styleTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  occasionText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textTransform: 'capitalize',
  },
  colorsContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  colorsList: {
    flexDirection: 'row',
    gap: 8,
  },
  colorChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemsSection: {
    padding: 20,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  linkButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSpacing: {
    height: 40,
  },
  errorText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
});