import { renderRouter } from 'expo-router/testing-library';
import RootLayout from '../_layout';
import TabsLayout from '../(tabs)/_layout';
import DiscoverScreen from '../(tabs)/index';
import FestivalsScreen from '../(tabs)/festivals';
import LineupScreen from '../(tabs)/lineup';
import ProfileScreen from '../(tabs)/profile';
import SoundScreen from '../(tabs)/sound';
import AccountScreen from '../account';
import ArtistScreen from '../artist/[id]';
import DiscoverFocusScreen from '../discover-focus';
import FestivalScreen from '../festival/[id]';
import MemoriesScreen from '../memories';
import MemoryScreen from '../memory/[id]';
import MemoryTagScreen from '../memory-tag';
import MusicScreen from '../music';
import MusicAuthReturn from '../music-auth';
import NotificationsScreen from '../notifications';
import PeopleScreen from '../people';
import FollowsScreen from '../follows/[handle]';
import LikesScreen from '../likes/[id]';
import GoingScreen from '../going/[id]';
import PlanCardScreen from '../plan-card/[id]';
import PosterScreen from '../poster/[id]';
import ProfileEditScreen from '../profile-edit';
import RequestScreen from '../request';
import SavedScreen from '../saved';
import SharedMemoryScreen from '../shared/[id]';
import SoundScopeScreen from '../sound-scope';
import TuneScreen from '../tune/[id]';
import PublicProfileScreen from '../u/[handle]';
import WelcomeScreen from '../welcome';
import YourSoundScreen from '../your-sound';

/** Every route in the app, the way Expo Router lays them out, for screen tests. */
export const APP_ROUTES = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': DiscoverScreen,
  '(tabs)/sound': SoundScreen,
  '(tabs)/festivals': FestivalsScreen,
  '(tabs)/lineup': LineupScreen,
  '(tabs)/profile': ProfileScreen,
  'artist/[id]': ArtistScreen,
  'festival/[id]': FestivalScreen,
  'poster/[id]': PosterScreen,
  saved: SavedScreen,
  welcome: WelcomeScreen,
  'tune/[id]': TuneScreen,
  'discover-focus': DiscoverFocusScreen,
  notifications: NotificationsScreen,
  'your-sound': YourSoundScreen,
  request: RequestScreen,
  'sound-scope': SoundScopeScreen,
  'plan-card/[id]': PlanCardScreen,
  music: MusicScreen,
  'music-auth': MusicAuthReturn,
  'memory-tag': MemoryTagScreen,
  memories: MemoriesScreen,
  'memory/[id]': MemoryScreen,
  'shared/[id]': SharedMemoryScreen,
  account: AccountScreen,
  'profile-edit': ProfileEditScreen,
  'u/[handle]': PublicProfileScreen,
  people: PeopleScreen,
  'follows/[handle]': FollowsScreen,
  'likes/[id]': LikesScreen,
  'going/[id]': GoingScreen,
};

export const renderApp = (initialUrl: string) => renderRouter(APP_ROUTES, { initialUrl });
