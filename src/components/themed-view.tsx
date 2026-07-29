import { View, type ViewProps } from 'react-native';

import { Colors, type ColorToken } from '@/constants/theme';

export type ThemedViewProps = ViewProps & {
  /** Background color token. Defaults to the app background (`ink`). */
  background?: ColorToken;
};

export function ThemedView({ style, background = 'ink', ...rest }: ThemedViewProps) {
  return <View style={[{ backgroundColor: Colors[background] }, style]} {...rest} />;
}
