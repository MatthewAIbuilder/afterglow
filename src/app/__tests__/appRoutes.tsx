import { fireEvent, renderRouter } from 'expo-router/testing-library';
import RootLayout from '../_layout';
import TabsLayout from '../(tabs)/_layout';
import DiscoverScreen from '../(tabs)/index';
import FestivalsScreen from '../(tabs)/festivals';
import LineupScreen from '../(tabs)/lineup';
import ProfileScreen from '../(tabs)/profile';
import SoundScreen from '../(tabs)/sound';
import TogetherScreen from '../(tabs)/together';
import MyCodeScreen from '../my-code';
import ScanScreen from '../scan';
import AddFriendScreen from '../add/[handle]';
import AccountScreen from '../account';
import CameraScreen from '../camera';
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
import CommentsScreen from '../comments/[id]';
import GoingScreen from '../going/[id]';
import CrewScreen from '../crew/[id]';
import PlanCardScreen from '../plan-card/[id]';
import RecapScreen from '../recap/[id]';
import PickArtistsScreen from '../pick-artists';
import ThisOrThatScreen from '../this-or-that';
import CompareScreen from '../compare';
import PrepScreen from '../prep/[id]';
import YourArtistsScreen from '../your-artists';
import SettingsScreen from '../settings';
import CareScreen from '../care';
import CheckInScreen from '../check-in';
import FriendsScreen from '../friends';
import TonightScreen from '../tonight';
import StartCrewScreen from '../start-crew';
import CrewStoryScreen from '../crew-story';
import YearScreen from '../year/[year]';
import PosterScreen from '../poster/[id]';
import ProfileEditScreen from '../profile-edit';
import RequestScreen from '../request';
import SavedScreen from '../saved';
import SearchScreen from '../search';
import LegalScreen from '../legal/[doc]';
import SharedMemoryScreen from '../shared/[id]';
import SoundScopeScreen from '../sound-scope';
import TuneScreen from '../tune/[id]';
import BadgeScreen from '../badge/[id]';
import AdminScreen from '../admin';
import SupportScreen from '../support';
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
  '(tabs)/together': TogetherScreen,
  'my-code': MyCodeScreen,
  scan: ScanScreen,
  'add/[handle]': AddFriendScreen,
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
  'recap/[id]': RecapScreen,
  'pick-artists': PickArtistsScreen,
  'this-or-that': ThisOrThatScreen,
  compare: CompareScreen,
  'prep/[id]': PrepScreen,
  'your-artists': YourArtistsScreen,
  settings: SettingsScreen,
  care: CareScreen,
  'check-in': CheckInScreen,
  friends: FriendsScreen,
  tonight: TonightScreen,
  'start-crew': StartCrewScreen,
  'crew-story': CrewStoryScreen,
  'year/[year]': YearScreen,
  music: MusicScreen,
  'music-auth': MusicAuthReturn,
  'memory-tag': MemoryTagScreen,
  camera: CameraScreen,
  memories: MemoriesScreen,
  'memory/[id]': MemoryScreen,
  'shared/[id]': SharedMemoryScreen,
  account: AccountScreen,
  'profile-edit': ProfileEditScreen,
  'u/[handle]': PublicProfileScreen,
  'badge/[id]': BadgeScreen,
  admin: AdminScreen,
  support: SupportScreen,
  people: PeopleScreen,
  search: SearchScreen,
  'legal/[doc]': LegalScreen,
  'follows/[handle]': FollowsScreen,
  'likes/[id]': LikesScreen,
  'comments/[id]': CommentsScreen,
  'going/[id]': GoingScreen,
  'crew/[id]': CrewScreen,
};

export const renderApp = (initialUrl: string) => renderRouter(APP_ROUTES, { initialUrl });

/** Open one of a page's tabs ("Lineup", "Info") by the start of its name. */
export async function showTab(app: { getByRole: (role: 'tab', opts: { name: RegExp }) => unknown }, label: string) {
  await fireEvent.press(app.getByRole('tab', { name: new RegExp(`^${label}`) }) as never);
}
