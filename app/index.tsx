import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { AnimatedSplashScreen } from '../src/components/AnimatedSplashScreen';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (loading || showSplash) return;

    // If user is authenticated, redirect to tabs
    if (user) {
      router.replace('/(tabs)');
    } else {
      // If not authenticated, redirect to login
      router.replace('/(auth)/login');
    }
  }, [user, loading, router, showSplash]);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  // Show animated splash screen
  if (showSplash) {
    return (
      <AnimatedSplashScreen 
        onAnimationComplete={handleSplashComplete}
        duration={2500}
      />
    );
  }

  // Show splash while checking auth (after animated splash)
  return (
    <AnimatedSplashScreen duration={0} />
  );
}
