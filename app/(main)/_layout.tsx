import { Stack } from 'expo-router';
import { useUser } from '@/providers/UserProvider';
import { Redirect } from 'expo-router';

export default function MainLayout() {
  const { isOnboarded, isLoading } = useUser();

  if (isLoading) {
    return null; // Let splash screen handle loading
  }

  if (!isOnboarded) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="feed" />
    </Stack>
  );
}