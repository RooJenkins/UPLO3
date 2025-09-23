import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useBrands } from '@/providers/BrandProvider';

export default function BrandsScreen() {
  const {
    selectedBrands,
    availableBrands,
    toggleBrand,
    selectAllBrands,
    clearAllBrands,
    getBrandsByCategory,
  } = useBrands();

  const brandsByCategory = getBrandsByCategory();

  const renderBrand = ({ item }: { item: any }) => {
    const isSelected = selectedBrands.has(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.brandItem, isSelected && styles.brandItemSelected]}
        onPress={() => toggleBrand(item.id)}
      >
        <Text style={[styles.brandName, isSelected && styles.brandNameSelected]}>
          {item.name}
        </Text>
        {isSelected && <Check size={20} color="#667eea" />}
      </TouchableOpacity>
    );
  };

  const renderCategory = (category: string, brands: any[]) => (
    <View key={category} style={styles.categorySection}>
      <Text style={styles.categoryTitle}>{category}</Text>
      <FlatList
        data={brands}
        renderItem={renderBrand}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.brandRow}
        scrollEnabled={false}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <X size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Select Brands</Text>
        
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.back()}
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={selectAllBrands}
        >
          <Text style={styles.controlButtonText}>Select All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={clearAllBrands}
        >
          <Text style={styles.controlButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.selectedCount}>
        {selectedBrands.size} of {availableBrands.length} brands selected
      </Text>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {Object.entries(brandsByCategory).map(([category, brands]) =>
          renderCategory(category, brands)
        )}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  doneText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  controlButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  controlButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedCount: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  categorySection: {
    marginBottom: 32,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  brandRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brandItem: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  brandItemSelected: {
    backgroundColor: '#f0f4ff',
    borderColor: '#667eea',
  },
  brandName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  brandNameSelected: {
    color: '#667eea',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
});