import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { theme } from '../../../config/theme';

interface TabOption {
    id: string;
    label: string;
}

interface DoodleTabSwitcherProps {
    tabs: TabOption[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export const DoodleTabSwitcher: React.FC<DoodleTabSwitcherProps> = ({
    tabs,
    activeTab,
    onTabChange
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.background}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => onTabChange(tab.id)}
                            style={[
                                styles.tab,
                                isActive && styles.activeTab
                            ]}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.tabText,
                                isActive && styles.activeTabText
                            ]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: theme.spacing.lg,
        marginBottom: theme.spacing.lg,
    },
    background: {
        flexDirection: 'row',
        backgroundColor: '#F0F0F0',
        borderRadius: 30,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        // Slight organic rotation
        transform: [{ rotate: '-1deg' }],
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 26,
    },
    activeTab: {
        backgroundColor: '#fff',
        ...theme.shadows.sm,
        borderWidth: 1.5,
        borderColor: theme.colors.text,
    },
    tabText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: theme.colors.text,
        fontWeight: 'bold',
    }
});
