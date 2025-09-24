import { View, Text } from 'react-native';
import { Cloud, CloudOff } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

interface TrpcStatusProps {
  style?: any;
}

export function TrpcStatus({ style }: TrpcStatusProps) {
  // Test tRPC connection
  const helloQuery = trpc.example.hello.useQuery(
    { name: 'Status Check' },
    {
      retry: 1,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
    }
  );

  if (helloQuery.isLoading) {
    return (
      <View style={[style, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
        <Cloud size={16} color="#ffa500" />
        <Text style={{ color: '#ffa500', fontSize: 12 }}>Testing...</Text>
      </View>
    );
  }
  
  if (helloQuery.isError) {
    return (
      <View style={[style, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
        <CloudOff size={16} color="#ff6b6b" />
        <Text style={{ color: '#ff6b6b', fontSize: 12 }}>Offline</Text>
      </View>
    );
  }
  
  if (helloQuery.isSuccess) {
    return (
      <View style={[style, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
        <Cloud size={16} color="#4ecdc4" />
        <Text style={{ color: '#4ecdc4', fontSize: 12 }}>Online</Text>
      </View>
    );
  }
  
  return null;
}
