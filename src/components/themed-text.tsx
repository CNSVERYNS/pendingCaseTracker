import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, type ColorToken, FontFamily } from '@/constants/theme';

export type ThemedTextType =
  | 'hero'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodyMedium'
  | 'label'
  | 'mono'
  | 'monoMedium';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  color?: ColorToken;
};

export function ThemedText({ style, type = 'body', color = 'paper', ...rest }: ThemedTextProps) {
  return <Text style={[{ color: Colors[color] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  hero: {
    fontFamily: FontFamily.serifLight,
    fontSize: 128,
    lineHeight: 128,
  },
  title: {
    fontFamily: FontFamily.serifRegular,
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: FontFamily.serifRegular,
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    fontFamily: FontFamily.sans,
    fontSize: 16,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  label: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  mono: {
    fontFamily: FontFamily.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  monoMedium: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 13,
    lineHeight: 18,
  },
});
