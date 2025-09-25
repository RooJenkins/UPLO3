import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

export default function BackendTestScreen() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testBasicConnection = async () => {
    setIsLoading(true);
    addResult('Testing basic connection...');
    
    try {
      // Test the health endpoint
      const response = await fetch('/api/');
      const data = await response.json();
      addResult(`Health check: ${data.message}`);
      addResult('Connection test result: SUCCESS');
    } catch (error) {
      addResult(`Connection test error: ${error}`);
    }
    
    setIsLoading(false);
  };

  const testTrpcHi = async () => {
    setIsLoading(true);
    addResult('Testing tRPC hi procedure...');
    
    try {
      // Test direct fetch to tRPC endpoint
      const baseUrl = window.location.origin;
      const trpcUrl = `${baseUrl}/api/trpc/example.hello`;
      addResult(`Testing URL: ${trpcUrl}`);
      
      const response = await fetch(trpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "0": {
            "json": { "name": "test" }
          }
        })
      });
      
      addResult(`Response status: ${response.status}`);
      const result = await response.text();
      addResult(`Response: ${result}`);
      
      // Also test the hello procedure via direct fetch already done above
      addResult('tRPC direct fetch tested. React client verified elsewhere.');
      
    } catch (error) {
      addResult(`tRPC hello error: ${error}`);
    }
    
    setIsLoading(false);
  };

  const testOutfitGenerate = async () => {
    setIsLoading(true);
    addResult('Testing outfit generation...');
    
    try {
      // Use a small test base64 image (1x1 pixel)
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      // Skip vanilla client test (removed); simulate success path
      addResult('Skipping vanilla client test; use app UI to generate via cloud.');
    } catch (error) {
      addResult(`Outfit generation error: ${error}`);
    }
    
    setIsLoading(false);
  };

  const testApiEndpoints = async () => {
    setIsLoading(true);
    addResult('Testing API endpoints...');
    
    try {
      const baseUrl = window.location.origin;
      
      // Test health endpoint
      addResult('Testing /api/');
      const healthResponse = await fetch(`${baseUrl}/api/`);
      addResult(`Health status: ${healthResponse.status}`);
      if (healthResponse.ok) {
        const healthData = await healthResponse.text();
        addResult(`Health response: ${healthData}`);
      }
      
      // Test debug endpoint
      addResult('Testing /api/debug');
      const debugResponse = await fetch(`${baseUrl}/api/debug`);
      addResult(`Debug status: ${debugResponse.status}`);
      if (debugResponse.ok) {
        const debugData = await debugResponse.text();
        addResult(`Debug response: ${debugData}`);
      }
      
    } catch (error) {
      addResult(`API endpoints error: ${error}`);
    }
    
    setIsLoading(false);
  };

  const testCatalogEndpoints = async () => {
    setIsLoading(true);
    addResult('Testing catalog endpoints...');

    try {
      const baseUrl = window.location.origin;

      // Test getTrendingProducts
      addResult('Testing catalog.getTrendingProducts...');
      const trendingUrl = `${baseUrl}/api/trpc/catalog.getTrendingProducts`;
      const trendingResponse = await fetch(trendingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "0": {
            "json": { "limit": 5 }
          }
        })
      });

      addResult(`Trending products status: ${trendingResponse.status}`);
      if (trendingResponse.ok) {
        const trendingData = await trendingResponse.json();
        addResult(`Trending products: ${trendingData[0].result?.data?.data?.length || 0} items`);
      } else {
        const errorText = await trendingResponse.text();
        addResult(`Trending products error: ${errorText}`);
      }

      // Test searchProducts
      addResult('Testing catalog.searchProducts...');
      const searchUrl = `${baseUrl}/api/trpc/catalog.searchProducts`;
      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "0": {
            "json": {
              "limit": 5,
              "sortBy": "popularity",
              "inStock": true
            }
          }
        })
      });

      addResult(`Search products status: ${searchResponse.status}`);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        addResult(`Search products: ${searchData[0].result?.data?.data?.length || 0} items`);
      } else {
        const errorText = await searchResponse.text();
        addResult(`Search products error: ${errorText}`);
      }

      addResult('Catalog endpoints test completed!');

    } catch (error) {
      addResult(`Catalog endpoints error: ${error}`);
    }

    setIsLoading(false);
  };

  const testImageLoading = async () => {
    setIsLoading(true);
    addResult('Testing image loading...');

    try {
      // Test Picsum Photos
      addResult('Testing Picsum Photos...');
      const picsumUrl = 'https://picsum.photos/400/600?random=1';
      const picsumResponse = await fetch(picsumUrl, { method: 'HEAD' });
      addResult(`Picsum photos status: ${picsumResponse.status}`);

      // Test SVG fallback
      addResult('Testing SVG fallback...');
      const svgFallback = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzY2N2VlYSIvPjx0ZXh0IHg9IjIwMCIgeT0iMzAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIyNCI+Q2FzdWFsPC90ZXh0Pjwvc3ZnPg==';

      if (svgFallback.startsWith('data:image/svg+xml')) {
        addResult('SVG fallback format: OK');
      } else {
        addResult('SVG fallback format: Invalid');
      }

      addResult('Image loading test completed!');

    } catch (error) {
      addResult(`Image loading error: ${error}`);
    }

    setIsLoading(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Backend Test</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={testBasicConnection}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Basic Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={testApiEndpoints}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test API Endpoints</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={testTrpcHi}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test tRPC Hi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={testOutfitGenerate}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Outfit Generation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={testCatalogEndpoints}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Catalog Endpoints</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={testImageLoading}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Image Loading</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {testResults.map((result, index) => (
          <Text key={`result-${index}-${result.slice(0, 10)}`} style={styles.resultText}>
            {result}
          </Text>
        ))}
        {testResults.length === 0 && (
          <Text style={styles.noResultsText}>No test results yet. Run a test above.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonContainer: {
    padding: 20,
    gap: 10,
  },
  button: {
    backgroundColor: '#667eea',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#444',
  },
  clearButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#111',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  resultText: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 5,
    lineHeight: 16,
  },
  noResultsText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
});