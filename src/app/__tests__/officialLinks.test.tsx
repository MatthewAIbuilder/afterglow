import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { Festival } from '../../data/models';
import { OfficialLinks } from '../../features/festivals/OfficialLinks';

const fest = (links?: Festival['links']) => ({ id: 'f', name: 'F Fest', dates: '', location: '', lineup: [], days: [], stages: [], links }) as unknown as Festival;

describe('official links on a festival page', () => {
  it('opens the festival’s own tickets page and site', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const view = await render(<OfficialLinks festival={fest({ tickets: 'https://t.example.com', website: 'https://example.com' })} over={false} />);
    await fireEvent.press(view.getByLabelText('Get tickets for F Fest on the official site'));
    await fireEvent.press(view.getByLabelText('F Fest official site'));
    expect(open.mock.calls.map((c) => c[0])).toEqual(['https://t.example.com', 'https://example.com']);
    open.mockRestore();
  });

  it('no tickets once it’s over; nothing without links', async () => {
    const over = await render(<OfficialLinks festival={fest({ tickets: 'https://t.example.com', website: 'https://example.com' })} over />);
    expect(over.queryByText('Get tickets ↗')).toBeNull();
    expect(over.getByText('Official site ↗')).toBeTruthy();
    const none = await render(<OfficialLinks festival={fest()} over={false} />);
    expect(none.toJSON()).toBeNull();
  });
});

describe('partner links on a festival page', () => {
  it('shows places to stay and says it may earn a commission', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const view = await render(<OfficialLinks festival={fest({ stay: 'https://stay.example.com' })} over={false} />);
    await fireEvent.press(view.getByLabelText('Places to stay near F Fest. Opens in your browser.'));
    expect(open).toHaveBeenCalledWith('https://stay.example.com');
    expect(view.getByText(/may earn a commission/)).toBeTruthy();
    open.mockRestore();
  });

  it('no notice for plain official links, nothing to stay once it’s over', async () => {
    const plain = await render(<OfficialLinks festival={fest({ tickets: 'https://t.example.com' })} over={false} />);
    expect(plain.queryByText(/commission/)).toBeNull();
    const over = await render(<OfficialLinks festival={fest({ stay: 'https://stay.example.com', website: 'https://example.com' })} over />);
    expect(over.queryByText('Places to stay ↗')).toBeNull();
    expect(over.queryByText(/commission/)).toBeNull();
  });
});
