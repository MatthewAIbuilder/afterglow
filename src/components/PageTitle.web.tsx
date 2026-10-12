import Head from 'expo-router/head';

/** The browser tab's title on the website ("EDC Orlando 2026 · Afterglow"). Phones use PageTitle.tsx. */
export function PageTitle({ title }: { title?: string }) {
  return (
    <Head>
      <title>{title ? `${title} · Afterglow` : 'Afterglow'}</title>
    </Head>
  );
}
