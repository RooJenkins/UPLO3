import { Redirect } from 'expo-router';
import { useUser } from '@/providers/UserProvider';

export default function IndexScreen() {
  const { isOnboarded, isLoading } = useUser();

  if (isLoading) {
    return null; // Let splash screen handle loading
  }

  if (!isOnboarded) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(main)/feed" />;
}