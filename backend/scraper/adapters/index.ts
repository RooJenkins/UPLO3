/**
 * Brand Adapters Index
 *
 * Centralized export of all brand-specific scraper adapters
 */

import BaseAdapter from './BaseAdapter';
import GenericAdapter from './GenericAdapter';
import ZaraAdapter from './ZaraAdapter';
import HMAdapter from './HMAdapter';
import NikeAdapter from './NikeAdapter';
import ASOSAdapter from './ASOSAdapter';

// Export all adapters
export {
  BaseAdapter,
  GenericAdapter,
  ZaraAdapter,
  HMAdapter,
  NikeAdapter,
  ASOSAdapter
};

// Brand adapter factory
export function createAdapter(brand: string): BaseAdapter {
  const normalizedBrand = brand.toLowerCase().trim();

  switch (normalizedBrand) {
    case 'zara':
      return new ZaraAdapter();
    case 'h&m':
    case 'hm':
    case 'handm':
      return new HMAdapter();
    case 'nike':
      return new NikeAdapter();
    case 'asos':
      return new ASOSAdapter();
    case 'generic':
    default:
      return new GenericAdapter();
  }
}

// Get list of supported brands
export function getSupportedBrands(): string[] {
  return ['zara', 'h&m', 'nike', 'asos', 'generic'];
}

// Check if brand is supported
export function isBrandSupported(brand: string): boolean {
  const normalizedBrand = brand.toLowerCase().trim();
  return getSupportedBrands().includes(normalizedBrand) ||
         normalizedBrand === 'hm' ||
         normalizedBrand === 'handm';
}

export default {
  createAdapter,
  getSupportedBrands,
  isBrandSupported,
  BaseAdapter,
  GenericAdapter,
  ZaraAdapter,
  HMAdapter,
  NikeAdapter,
  ASOSAdapter
};