import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { OutfitItem } from '@/providers/FeedProvider';

interface ClothingItemCardProps {
  item: OutfitItem;
  compact?: boolean; // For smaller displays
}

export function ClothingItemCard({ item, compact = false }: ClothingItemCardProps) {
  const { name, brand, price, availability } = item;
  const [logoError, setLogoError] = useState(false);

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      {/* Brand Logo and Name - Horizontal Layout */}
      <View style={styles.brandRow}>
        <View style={styles.brandCircle}>
          {!logoError && brand.logo ? (
            <Image
              source={{ uri: brand.logo }}
              style={styles.brandLogoImage}
              resizeMode="contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <Text style={styles.brandIcon}>{brand.logoText || brand.name.charAt(0)}</Text>
          )}
        </View>
        <Text style={styles.brandText}>{brand.name}</Text>
      </View>

      {/* Product Name */}
      <Text style={[styles.productTitle, compact && styles.compactProductTitle]} numberOfLines={2}>
        {name}
      </Text>

      {/* Price */}
      <View style={styles.priceRow}>
        <Text style={styles.currentPrice}>{price.formatted}</Text>
        {price.isOnSale && price.original && (
          <Text style={styles.originalPrice}>${price.original}.99</Text>
        )}
      </View>

      {/* Availability Info */}
      {!compact && (
        <Text style={styles.availabilityText}>
          {availability.colors.length} color{availability.colors.length !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 180,
    maxWidth: 220,
  },
  compactContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 160,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  brandIcon: {
    fontSize: 10,
    color: '#000',
    fontWeight: 'bold',
  },
  brandLogoImage: {
    width: 16,
    height: 16,
  },
  brandText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  productTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
    lineHeight: 22,
  },
  compactProductTitle: {
    fontSize: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  currentPrice: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  originalPrice: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  availabilityText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '400',
  },
});