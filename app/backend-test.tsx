import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { testTrpcConnection } from '@/lib/trpc';
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
      const result = await testTrpcConnection();
      addResult(`Connection test result: ${result ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      addResult(`Connection test error: ${error}`);
    }
    
    setIsLoading(false);
  };

  const testTrpcHi = async () => {
    setIsLoading(true);
    addResult('Testing tRPC hi procedure...');
    
    try {
      // Use the vanilla client for testing
      const { vanillaTrpcClient } = await import('@/lib/trpc');
      const result = await vanillaTrpcClient.example.hi.query({ name: 'test' });
      addResult(`tRPC hi result: ${JSON.stringify(result)}`);
    } catch (error) {
      addResult(`tRPC hi error: ${error}`);
    }
    
    setIsLoading(false);
  };

  const testOutfitGenerate = async () => {
    setIsLoading(true);
    addResult('Testing outfit generation...');
    
    try {
      // Use a small test base64 image (1x1 pixel)
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      // Use the vanilla client for testing
      const { vanillaTrpcClient } = await import('@/lib/trpc');
      const result = await vanillaTrpcClient.outfit.generate.mutate({
        prompt: 'casual outfit',
        userImageBase64: testImage,
        outfitId: 'test-outfit'
      });
      
      addResult(`Outfit generation result: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      addResult(`Outfit generation error: ${error}`);
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