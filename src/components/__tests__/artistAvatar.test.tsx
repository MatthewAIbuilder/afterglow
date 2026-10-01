import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { ArtistAvatar } from '../ArtistAvatar';

describe('ArtistAvatar', () => {
  it("draws a b2b as one circle with each artist's face, and a monogram for anyone without a photo", async () => {
    const view = await render(
      <ArtistAvatar
        size={60}
        artist={{
          id: 'sub-crank-x',
          name: 'SUBTRONICS B2B CRANKDAT B2B EXCISION',
          sound: {},
          members: [
            { name: 'SUBTRONICS', imageUrl: 'https://cdn.example/s.jpg' },
            { name: 'CRANKDAT', imageUrl: 'https://cdn.example/c.jpg' },
            { name: 'EXCISION' },
          ],
        }}
      />,
    );
    expect(view.getAllByTestId('avatar-photo')).toHaveLength(2);
    expect(view.getByText('E')).toBeTruthy();
  });

  it('keeps the usual photo when the artist has one', async () => {
    const view = await render(<ArtistAvatar size={60} artist={{ id: 'sub', name: 'SUBTRONICS', sound: {}, imageUrl: 'https://cdn.example/s.jpg' }} />);
    expect(view.getAllByTestId('avatar-photo')).toHaveLength(1);
    expect(view.getByText('S')).toBeTruthy();
  });
});
