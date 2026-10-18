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
import GiveSproutScreen from '../give-sprout';
import SproutScreen from '../sprout/[id]';
import FindScreen from '../find/[code]';
import HuntScreen from '../hunt/[id]';
import SendSetTimesScreen from '../send-set-times/[id]';
import SendScreen from '../send';
import StickerSheetScreen from '../sticker-sheet';
import GardenScreen from '../garden';
import GardenVisitScreen from '../garden-visit';
import KandiMakeScreen from '../kandi-make';
import KandiCodeScreen from '../kandi/[id]';
import SharedCardScreen from '../card/[id]';
import CollectionScreen from '../collection';
import AddFriendScreen from '../add/[handle]';
import AccountScreen from '../account';
import CameraScreen from '../camera';
import ArtistScreen from '../artist/[id]';
import SoundGuideScreen from '../sound-guide/[tag]';
import DiscoverFocusScreen from '../discover-focus';
import FestivalScreen from '../festival/[id]';
import ShowScreen from '../show/[id]';
import ShowsScreen from '../shows';
import MemoriesScreen from '../memories';
import MemoryScreen from '../memory/[id]';
import MemoryTagScreen from '../memory-tag';
import MusicScreen from '../music';
import MusicAuthReturn from '../music-auth';
import NotificationsScreen from '../notifications';
import PeopleScreen from '../people';
import FollowsScreen from '../follows/[handle]';
import LikesScreen from '../likes/[id]';
import PlaceVideosScreen from '../videos/[id]';
import CommentsScreen from '../comments/[id]';
import GoingScreen from '../going/[id]';
import CrewScreen from '../crew/[id]';
import CrewInviteScreen from '../crew-invite/[id]';
import CrewChatScreen from '../crew-chat/[id]';
import FestivalWeekScreen from '../festival-week/[id]';
import PlanCardScreen from '../plan-card/[id]';
import RecapScreen from '../recap/[id]';
import PickArtistsScreen from '../pick-artists';
import ThisOrThatScreen from '../this-or-that';
import CompareScreen from '../compare';
import FestivalMapScreen from '../festival-map';
import FestivalCalendarScreen from '../festival-calendar';
import QuestsScreen from '../quests';
import SecretsScreen from '../secrets';
import WhatsNewScreen from '../whats-new';
import PrepScreen from '../prep/[id]';
import StayScreen from '../stay/[id]';
import YourArtistsScreen from '../your-artists';
import SettingsScreen from '../settings';
import CareScreen from '../care';
import TrailScreen from '../trail';
import CheckInScreen from '../check-in';
import FriendsScreen from '../friends';
import TonightScreen from '../tonight';
import StartCrewScreen from '../start-crew';
import CrewStoryScreen from '../crew-story';
import YearScreen from '../year/[year]';
import PosterScreen from '../poster/[id]';
import ProfileEditScreen from '../profile-edit';
import BackdropScreen from '../backdrop';
import ThemesScreen from '../themes';
import RequestScreen from '../request';
import SavedScreen from '../saved';
import SearchScreen from '../search';
import LegalScreen from '../legal/[doc]';
import SharedMemoryScreen from '../shared/[id]';
import SoundScopeScreen from '../sound-scope';
import TuneScreen from '../tune/[id]';
import BadgeScreen from '../badge/[id]';
import BadgeCardScreen from '../badge-card/[id]';
import AdminScreen from '../admin';
import TotemScreen from '../totem';
import SwitchAccountScreen from '../switch-account';
import SupportScreen from '../support';
import OrgScreen from '../org/[id]';
import StudioScreen from '../studio';
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
  'give-sprout': GiveSproutScreen,
  'sprout/[id]': SproutScreen,
  'find/[code]': FindScreen,
  'hunt/[id]': HuntScreen,
  'send-set-times/[id]': SendSetTimesScreen,
  send: SendScreen,
  'sticker-sheet': StickerSheetScreen,
  garden: GardenScreen,
  'garden-visit': GardenVisitScreen,
  'kandi-make': KandiMakeScreen,
  'kandi/[id]': KandiCodeScreen,
  'card/[id]': SharedCardScreen,
  collection: CollectionScreen,
  'add/[handle]': AddFriendScreen,
  'artist/[id]': ArtistScreen,
  'sound-guide/[tag]': SoundGuideScreen,
  'festival/[id]': FestivalScreen,
  'show/[id]': ShowScreen,
  shows: ShowsScreen,
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
  'festival-map': FestivalMapScreen,
  'festival-calendar': FestivalCalendarScreen,
  quests: QuestsScreen,
  secrets: SecretsScreen,
  'whats-new': WhatsNewScreen,
  'prep/[id]': PrepScreen,
  'stay/[id]': StayScreen,
  'your-artists': YourArtistsScreen,
  settings: SettingsScreen,
  care: CareScreen,
  trail: TrailScreen,
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
  backdrop: BackdropScreen,
  themes: ThemesScreen,
  'u/[handle]': PublicProfileScreen,
  'badge/[id]': BadgeScreen,
  'badge-card/[id]': BadgeCardScreen,
  admin: AdminScreen,
  totem: TotemScreen,
  'switch-account': SwitchAccountScreen,
  support: SupportScreen,
  'org/[id]': OrgScreen,
  studio: StudioScreen,
  people: PeopleScreen,
  search: SearchScreen,
  'legal/[doc]': LegalScreen,
  'follows/[handle]': FollowsScreen,
  'likes/[id]': LikesScreen,
  'videos/[id]': PlaceVideosScreen,
  'comments/[id]': CommentsScreen,
  'going/[id]': GoingScreen,
  'crew/[id]': CrewScreen,
  'crew-invite/[id]': CrewInviteScreen,
  'crew-chat/[id]': CrewChatScreen,
  'festival-week/[id]': FestivalWeekScreen,
};

export const renderApp = (initialUrl: string) => renderRouter(APP_ROUTES, { initialUrl });

/** Open one of a page's tabs ("Lineup", "Info") by the start of its name. */
export async function showTab(app: { getByRole: (role: 'tab', opts: { name: RegExp }) => unknown }, label: string) {
  await fireEvent.press(app.getByRole('tab', { name: new RegExp(`^${label}`) }) as never);
}
