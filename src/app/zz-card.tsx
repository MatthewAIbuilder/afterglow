import { View } from 'react-native';
import { artistLook } from '../features/sprouts/artistLook';
import { CollectibleCard } from '../features/sprouts/CollectibleCard';

export default function Z() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0814', flexDirection: 'row', flexWrap: 'wrap', gap: 20, padding: 20 }}>
      <CollectibleCard look={artistLook({ id: 'x', name: 'Some DJ', sound: { house: 1 } } as never)} artistName="Some DJ" owner="@maya" line="Filmed once" />
      <CollectibleCard look={artistLook({ id: 'rezz', name: 'REZZ', sound: {} } as never)} artistName="REZZ" tier={2} owner="@matt.raves" line="Filmed 7 times" />
      <CollectibleCard look={artistLook({ id: 'subtronics', name: 'SUBTRONICS', sound: {} } as never)} artistName="SUBTRONICS" tier={3} shiny owner="@matt.raves" line="Filmed 12 times" />
    </View>
  );
}
