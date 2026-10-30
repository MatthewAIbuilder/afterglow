import { showActionSheet } from '../../lib/dialog';
import { setSaverMode, type SaverMode } from '../../state/batterySaver';
import { t } from '../../i18n';

export const SAVER_LABEL: Record<SaverMode, string> = { off: t('Off'), on: t('On'), auto: t('Automatic') };

/** Choose battery saver's mode: Off, On, or Automatic (below 30%). */
export function chooseSaver(current: SaverMode) {
  const modes: SaverMode[] = ['off', 'auto', 'on'];
  const options = [...modes.map((m) => (m === current ? `✓ ${SAVER_LABEL[m]}` : SAVER_LABEL[m])), t('Cancel')];
  showActionSheet(
    {
      title: t('Battery saver'),
      message: t('Does less to last longer: no next clip by itself, crew news and your spot less often, a rougher trail. Automatic turns it on below 30%.'),
      options,
      cancelButtonIndex: options.length - 1,
    },
    (i) => {
      const m = modes[i];
      if (m) setSaverMode(m);
    },
  );
}
