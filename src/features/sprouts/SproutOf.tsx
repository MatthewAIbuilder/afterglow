import type { ComponentProps } from 'react';
import type { Artist } from '../../data/models';
import { useCatalog } from '../../state/catalog';
import { artistLook } from './artistLook';
import { Sprout } from './Sprout';
import type { SproutArtist } from './sprouts';

/**
 * A sprout as it should look: a kind, or an artist's (their look from the
 * catalogue, or from just their name when this phone doesn't know them).
 */
export function SproutOf({ artist, ...props }: Omit<ComponentProps<typeof Sprout>, 'artist'> & { artist?: SproutArtist }) {
  const catalog = useCatalog();
  const known: Pick<Artist, 'id' | 'name' | 'sound' | 'color'> | undefined = artist ? (catalog.artist(artist.id) ?? { id: artist.id, name: artist.name, sound: {} }) : undefined;
  return <Sprout {...props} artist={known ? artistLook(known) : undefined} stage={known ? 3 : props.stage} />;
}
