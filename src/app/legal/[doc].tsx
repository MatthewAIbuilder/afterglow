import { router, useLocalSearchParams } from 'expo-router';
import { PageTitle } from '../../components/PageTitle';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon } from '../../components/TabIcons';
import { SHOP_LINKS } from '../../config/partners';
import { hasPartnerLinks } from '../../features/partners/partners';
import { useCatalog } from '../../state/catalog';
import { isLegalDoc, LEGAL_DOCS, legalDocument, legalPath, type LegalDoc } from '../../features/legal/documents';
import { color, space, type } from '../../theme/tokens';

const SHORT: Record<LegalDoc, string> = { privacy: 'Privacy', terms: 'Terms', guidelines: 'Community guidelines' };

/**
 * The Privacy Policy, Terms of Use or Community Guidelines (`/legal/privacy`,
 * `/legal/terms`, `/legal/guidelines`), the same words in the app and on the
 * website, with links between them at the bottom.
 */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const insets = useSafeAreaInsets();
  const id: LegalDoc = isLegalDoc(doc) ? doc : 'privacy';
  const catalog = useCatalog();
  const d = legalDocument(id, undefined, { partners: hasPartnerLinks(catalog.festivals, SHOP_LINKS) });

  return (
    <View style={styles.root}>
      <PageTitle title={d.title} />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl }}>
        <View style={styles.page}>
          <Text style={styles.title} accessibilityRole="header">
            {d.title}
          </Text>
          <Text style={styles.updated}>Last updated {d.updated}</Text>
          <Text style={styles.intro}>{d.intro}</Text>
          {d.sections.map((s, i) => (
            <View key={s.heading ?? i} style={styles.section}>
              {s.heading ? (
                <Text style={styles.heading} accessibilityRole="header">
                  {s.heading}
                </Text>
              ) : null}
              {s.paragraphs.map((p) => (
                <Text key={p} style={styles.body}>
                  {s.heading ? p : `• ${p}`}
                </Text>
              ))}
            </View>
          ))}
          <View style={styles.others}>
            {LEGAL_DOCS.filter((o) => o !== id).map((o) => (
              <Pressable key={o} onPress={() => router.replace(legalPath(o) as never)} accessibilityRole="link" hitSlop={8}>
                <Text style={styles.link}>{SHORT[o]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  // Readable line length on a computer; the full width on a phone.
  page: { width: '100%', maxWidth: 680, alignSelf: 'center' },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  updated: { ...type.caption, color: color.moonFaint, marginTop: space.xs },
  intro: { ...type.body, color: color.moon, marginTop: space.lg, lineHeight: 24 },
  section: { marginTop: space.xl, gap: space.sm },
  heading: { ...type.headline, color: color.moon },
  body: { ...type.body, color: color.moonDim, lineHeight: 23 },
  others: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl, marginTop: space.xxl },
  link: { ...type.label, color: color.glow },
});
