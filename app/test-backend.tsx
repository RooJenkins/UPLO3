import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export default function TestBackend() {
  const [testResult, setTestResult] = useState<string>('');

  // Test tRPC connection
  const helloQuery = trpc.example.hello.useQuery(
    { name: 'Test User' },
    { enabled: false }
  );

  const testQuery = trpc.example.test.useQuery(undefined, { enabled: false });

  const runTests = async () => {
    setTestResult('Running tests...\n');
    
    try {
      // Test basic endpoint
      const response = await fetch('/api/');
      const data = await response.json();
      setTestResult(prev => prev + `✅ Health check: ${data.message}\n`);
    } catch (error) {
      setTestResult(prev => prev + `❌ Health check failed: ${error}\n`);
    }

    try {
      // Test tRPC hello
      const hello = await helloQuery.refetch();
      setTestResult(prev => prev + `✅ tRPC hello: ${hello.data?.greeting}\n`);
    } catch (error) {
      setTestResult(prev => prev + `❌ tRPC hello failed: ${error}\n`);
    }

    try {
      // Test tRPC test
      const test = await testQuery.refetch();
      setTestResult(prev => prev + `✅ tRPC test: ${test.data?.message}\n`);
    } catch (error) {
      setTestResult(prev => prev + `❌ tRPC test failed: ${error}\n`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Backend Test</Text>
      
      <TouchableOpacity style={styles.button} onPress={runTests}>
        <Text style={styles.buttonText}>Run Tests</Text>
      </TouchableOpacity>

      <Text style={styles.result}>{testResult}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  result: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 14,
  },
});
