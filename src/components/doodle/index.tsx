import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../config/theme';

interface WobblyProps {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    rotate?: string;
    borderColor?: string;
    backgroundColor?: string;
    onPress?: () => void;
}

export const WobblySquare: React.FC<WobblyProps> = ({
    children,
    style,
    rotate = '-2deg',
    borderColor = theme.colors.primary,
    backgroundColor = '#fff',
    onPress
}) => {
    const Container = onPress ? TouchableOpacity : View;

    return (
        <Container
            onPress={onPress}
            style={[
                styles.wobblySquare,
                {
                    transform: [{ rotate }],
                    borderColor: borderColor,
                    backgroundColor: backgroundColor
                },
                style
            ]}
        >
            {children}
        </Container>
    );
};

export const WobblyCard: React.FC<WobblyProps> = ({
    children,
    style,
    borderColor = theme.colors.border,
    backgroundColor = '#fff',
    onPress
}) => {
    const Container = onPress ? TouchableOpacity : View;
    return (
        <Container
            onPress={onPress}
            style={[
                styles.wobblyCard,
                {
                    borderColor,
                    backgroundColor
                },
                style
            ]}
        >
            {children}
        </Container>
    );
};

export const WobblyCircle: React.FC<WobblyProps> = ({
    children,
    style,
    borderColor = theme.colors.text,
    backgroundColor = '#fff',
    onPress
}) => {
    const Container = onPress ? TouchableOpacity : View;
    return (
        <Container
            onPress={onPress}
            style={[
                styles.wobblyCircle,
                {
                    borderColor,
                    backgroundColor
                },
                style
            ]}
        >
            {children}
        </Container>
    );
};

const styles = StyleSheet.create({
    wobblySquare: {
        borderWidth: 2,
        borderRadius: 16,
        // Approximate organic shape
        borderTopLeftRadius: 20,
        borderTopRightRadius: 8,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 24,
        padding: 4,
    },
    wobblyCard: {
        borderWidth: 1.5,
        borderRadius: 24,
        // Card organic shape
        borderTopLeftRadius: 24,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    wobblyCircle: {
        borderWidth: 2,
        borderRadius: 999,
        // Organic circle
        borderTopLeftRadius: 60,
        borderTopRightRadius: 50,
        borderBottomLeftRadius: 55,
        borderBottomRightRadius: 45,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
