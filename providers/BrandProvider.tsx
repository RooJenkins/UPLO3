import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import { useStorage } from './StorageProvider';

export interface Brand {
  id: string;
  name: string;
  category: string;
  logo?: string;
}

const BRAND_STORAGE_KEY = '@brand_preferences';

const AVAILABLE_BRANDS: Brand[] = [
  { id: '1', name: 'Nike', category: 'Athletic' },
  { id: '2', name: 'Adidas', category: 'Athletic' },
  { id: '3', name: 'Zara', category: 'Fashion' },
  { id: '4', name: 'H&M', category: 'Fashion' },
  { id: '5', name: 'Uniqlo', category: 'Basics' },
  { id: '6', name: 'Levi\'s', category: 'Denim' },
  { id: '7', name: 'Ralph Lauren', category: 'Luxury' },
  { id: '8', name: 'Tommy Hilfiger', category: 'Classic' },
  { id: '9', name: 'Calvin Klein', category: 'Modern' },
  { id: '10', name: 'Gap', category: 'Casual' },
];

export const [BrandProvider, useBrands] = createContextHook(() => {
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [availableBrands] = useState<Brand[]>(AVAILABLE_BRANDS);
  
  const { getItem, setItem } = useStorage();

  useEffect(() => {
    loadBrandPreferences();
  }, []);

  const loadBrandPreferences = async () => {
    try {
      const stored = await getItem(BRAND_STORAGE_KEY);
      if (stored) {
        const brandIds = JSON.parse(stored);
        if (Array.isArray(brandIds)) {
          setSelectedBrands(new Set(brandIds));
        }
      }
    } catch (error) {
      console.error('Failed to load brand preferences:', error);
    }
  };

  const saveBrandPreferences = async (brands: Set<string>) => {
    try {
      await setItem(BRAND_STORAGE_KEY, JSON.stringify(Array.from(brands)));
    } catch (error) {
      console.error('Failed to save brand preferences:', error);
    }
  };

  const toggleBrand = (brandId: string) => {
    const newSelection = new Set(selectedBrands);
    if (selectedBrands.has(brandId)) {
      newSelection.delete(brandId);
    } else {
      newSelection.add(brandId);
    }
    setSelectedBrands(newSelection);
    saveBrandPreferences(newSelection);
  };

  const selectAllBrands = () => {
    const allBrandIds = new Set(availableBrands.map(b => b.id));
    setSelectedBrands(allBrandIds);
    saveBrandPreferences(allBrandIds);
  };

  const clearAllBrands = () => {
    setSelectedBrands(new Set());
    saveBrandPreferences(new Set());
  };

  const getSelectedBrandNames = () => {
    return availableBrands
      .filter(brand => selectedBrands.has(brand.id))
      .map(brand => brand.name);
  };

  const getBrandsByCategory = () => {
    const categories: Record<string, Brand[]> = {};
    availableBrands.forEach(brand => {
      if (!categories[brand.category]) {
        categories[brand.category] = [];
      }
      categories[brand.category].push(brand);
    });
    return categories;
  };

  return {
    selectedBrands,
    availableBrands,
    toggleBrand,
    selectAllBrands,
    clearAllBrands,
    getSelectedBrandNames,
    getBrandsByCategory,
  };
});