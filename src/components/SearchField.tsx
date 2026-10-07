import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { color, radius, space, type } from '../theme/tokens';
import { GlassFill } from './LiquidGlass';
import { CloseIcon, SearchIcon } from './TabIcons';
import { t } from '../i18n';

/** A Liquid Glass search field with a clear button. `label` is what screen readers hear. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  /** Return (Enter on a keyboard): e.g. open the first result. */
  onSubmit?: () => void;
}) {
  return (
    <View style={styles.search}>
      <GlassFill radius={radius.md} tint={0.3} />
      <SearchIcon color={color.moonFaint} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.moonFaint}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        keyboardAppearance="dark"
        selectionColor={color.glow}
        accessibilityLabel={label}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={t('Clear the search')}
 hitSlop={10}>
          <CloseIcon color={color.moonDim} size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
  },
  // In a browser the field you're in shows the site's soft focus glow (public/index.html).
  input: { ...type.body, flex: 1, color: color.moon, paddingVertical: 0 },
});
