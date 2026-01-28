import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { DoodleTabBar } from '../../src/components/DoodleTabBar';
import { theme } from '../../src/config/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <DoodleTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Hide default tab styles since we replace the bar
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="moods"
        options={{
          title: 'Moods',
        }}
      />
      <Tabs.Screen
        name="date-nights"
        options={{
          title: 'Dates',
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: 'Games',
        }}
      />
      <Tabs.Screen
        name="manifestations"
        options={{
          title: 'Goals',
          href: null,
        }}
      />
      <Tabs.Screen
        name="gentle-days"
        options={{
          title: 'Gentle',
          href: null,
        }}
      />
    </Tabs>
  );
}

