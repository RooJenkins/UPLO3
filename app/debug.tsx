import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useState } from 'react';

export default function DebugScreen() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testHealthCheck = async () => {
    addLog('Testing health check...');
    try {
      const response = await fetch('/api/');
      addLog(`Health check status: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        addLog(`Health check response: ${JSON.stringify(data)}`);
      } else {
        const text = await response.text();
        addLog(`Health check error: ${text}`);
      }
    } catch (error) {
      addLog(`Health check failed: ${error}`);
    }
  };

  const testTrpcDirect = async () => {
    addLog('Testing tRPC direct...');
    try {
      const url = '/api/trpc/example.hello';
      addLog(`Testing URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "0": {
            "json": { "name": "DirectTest" }
          }
        })
      });
      
      addLog(`tRPC status: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        addLog(`tRPC response: ${JSON.stringify(data)}`);
      } else {
        const text = await response.text();
        addLog(`tRPC error: ${text}`);
      }
    } catch (error) {
      addLog(`tRPC failed: ${error}`);
    }
  };

  const checkCurrentUrl = () => {
    if (typeof window !== 'undefined') {
      addLog(`Current URL: ${window.location.href}`);
      addLog(`Origin: ${window.location.origin}`);
      addLog(`Pathname: ${window.location.pathname}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Screen</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={checkCurrentUrl}>
          <Text style={styles.buttonText}>Check URL</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testHealthCheck}>
          <Text style={styles.buttonText}>Test Health</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testTrpcDirect}>
          <Text style={styles.buttonText}>Test tRPC</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearLogs}>
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </ScrollView>
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
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 10,
  },
  logText: {
    color: '#0F0',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
});
