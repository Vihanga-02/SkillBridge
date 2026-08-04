import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The tab bar is the app's one dark surface (§13.2). White-on-navy is 15.7:1 and
 * white-on-accent is 5.2:1, so the active pill stays readable — an accent icon
 * directly on navy would not have been.
 */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Ionicons
        name={name}
        size={sizes.iconMd}
        color={focused ? colors.inkInverse : colors.inkInverseMuted}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.inkInverse,
        tabBarInactiveTintColor: colors.inkInverseMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tabs.Screen
        name="discovery"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Learn',
          tabBarIcon: ({ focused }) => <TabIcon name="book" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ focused }) => <TabIcon name="chatbubbles" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.ink,
    borderTopWidth: 0,
  },
  tabLabel: {
    ...type.caption,
  },
  iconPill: {
    minWidth: sizes.touchMin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.accent,
  },
});
