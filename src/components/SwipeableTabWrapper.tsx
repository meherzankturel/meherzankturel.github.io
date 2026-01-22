import React, { useRef, useEffect } from 'react';
import { PanResponder, View, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

interface SwipeableTabWrapperProps {
  children: React.ReactNode;
  tabIndex: number;
  totalTabs: number;
  enabled?: boolean; // Allow disabling gesture when modals are open
}

export function SwipeableTabWrapper({ children, tabIndex, totalTabs, enabled = true }: SwipeableTabWrapperProps) {
  const router = useRouter();
  const segments = useSegments();

  // Use refs for everything to ensure PanResponder (created once) always has latest values
  const routerRef = useRef(router);
  const segmentsRef = useRef(segments);
  const tabIndexRef = useRef(tabIndex);
  const totalTabsRef = useRef(totalTabs);
  const startX = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    routerRef.current = router;
    segmentsRef.current = segments;
    tabIndexRef.current = tabIndex;
    totalTabsRef.current = totalTabs;
  }, [router, segments, tabIndex, totalTabs]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const hasEnoughMovement = Math.abs(gestureState.dx) > 15;
        return isHorizontal && hasEnoughMovement;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Highly sensitive horizontal capture to beat ScrollView
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        const hasEnoughMovement = Math.abs(gestureState.dx) > 10;
        return isHorizontal && hasEnoughMovement;
      },
      onPanResponderGrant: (evt) => {
        startX.current = evt.nativeEvent.pageX;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx, dy } = gestureState;

        // Final check for horizontal swipe
        const isHorizontal = Math.abs(dx) > Math.abs(dy);
        if (!isHorizontal) return;

        // Sensitivity thresholds
        const swipeThreshold = 30;
        const velocityThreshold = 0.2;

        const swipeRight = dx > swipeThreshold || vx > velocityThreshold;
        const swipeLeft = dx < -swipeThreshold || vx < -velocityThreshold;

        let targetTabIndex: number | null = null;
        const currentIndex = tabIndexRef.current;
        const total = totalTabsRef.current;

        if (swipeRight) {
          // Swipe Right (Move finger L -> R) -> Go to PREVIOUS tab
          if (currentIndex > 0) {
            targetTabIndex = currentIndex - 1;
          }
          // Stop at first tab - no wrap around
        } else if (swipeLeft) {
          // Swipe Left (Move finger R -> L) -> Go to NEXT tab
          if (currentIndex < total - 1) {
            targetTabIndex = currentIndex + 1;
          }
          // Stop at last tab - no wrap around
        }

        if (targetTabIndex !== null) {
          const routes = [
            '/(tabs)/',           // Home (index 0)
            '/(tabs)/moods',      // Moods (index 1)
            '/(tabs)/date-nights', // Date Nights (index 2)
            '/(tabs)/games',      // Games (index 3)
            '/(tabs)/manifestations', // Manifestations (index 4)
          ];
          const targetRoute = routes[targetTabIndex];

          if (targetRoute) {
            console.log(`[SWIPE] Navigating from ${currentIndex} to ${targetTabIndex} via ${targetRoute}`);
            routerRef.current.replace(targetRoute as any);
          }
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => { },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

