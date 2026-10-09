import type { SoundTag } from '../../data/models';
import { t } from '../../i18n';

/**
 * How an artist's collectible looks. Pure. A small glowing creature on a dark
 * round tile: the big names have a hand-made one inspired by their world (an
 * eye with tentacles, a phoenix, a lion), never their logos; everyone else
 * gets their sound's creature (a bass beast for dubstep, a moth for melodic
 * bass, a disco cat for house…) in their own colours, from their photo.
 */
export type Creature =
  | 'eye'
  | 'phoenix'
  | 'lion'
  | 'ghost'
  | 'pumpkin'
  | 'sheep'
  | 'twin'
  | 'astronaut'
  | 'rabbit'
  | 'spirit'
  | 'crystal'
  | 'skull'
  | 'serpent'
  | 'alien'
  | 'monster'
  | 'sloth'
  | 'reaper'
  | 'jelly'
  | 'beast'
  | 'bot'
  | 'wolf'
  | 'moth'
  | 'cat'
  | 'owl'
  | 'fox'
  | 'dragon'
  | 'bear'
  | 'wisp'
  // Festival places, for stickers (features/finds).
  | 'ferris'
  | 'rail'
  | 'sunrise'
  | 'lantern'
  | 'gnome'
  | 'confetti'
  | 'frog'
  // An organizer's own (features/organizers): Underground Alchemy's potion.
  | 'flask'
  // Signatures added later.
  | 'wobble'
  | 'patchbear'
  | 'thornskull'
  | 'trooper'
  | 'mammoth'
  | 'dino'
  | 'stagskull'
  | 'captain'
  | 'gladiator'
  | 'dreamcube'
  | 'paperplane'
  | 'icosa'
  | 'goggles'
  | 'hologram'
  | 'mousehead'
  | 'mallow'
  | 'hooded'
  | 'prism'
  | 'dove'
  | 'cake'
  | 'stainedglass'
  | 'chromemask'
  | 'discoball'
  | 'totem'
  | 'tent'
  | 'glowstick'
  | 'glowshroom'
  | 'bassbin'
  | 'campfire'
  | 'mainstage'
  | 'bubbles'
  | 'mixtape'
  | 'scarymonster'
  | 'desertsun'
  | 'wave'
  | 'titaniumheart'
  | 'gorgon'
  | 'nightmare'
  | 'gramophone'
  | 'trancestar'
  | 'hedgehog'
  | 'door'
  | 'stampede'
  | 'boombox'
  | 'tulip'
  | 'spaceman'
  | 'toucan'
  | 'hero'
  | 'gumbo'
  | 'balloon'
  | 'peeker'
  | 'croissant'
  | 'jackbox'
  | 'bat'
  | 'rose'
  | 'ufo'
  | 'nightlight'
  | 'alleycat'
  | 'monarch'
  | 'exclaim'
  | 'telescope'
  | 'cog'
  | 'songbird'
  | 'anvil'
  | 'lizard'
  | 'palm'
  | 'bomb'
  | 'sippycup'
  | 'parrot'
  | 'twoface'
  | 'xmark'
  | 'laserfox'
  | 'maze'
  | 'parcel'
  | 'biplane'
  | 'lime'
  | 'greenlight'
  | 'orange'
  | 'turnstile'
  | 'goose'
  | 'crown'
  | 'snowflake'
  | 'houseboat'
  | 'friday'
  | 'bouquet'
  | 'telephone'
  | 'palace'
  | 'notebook'
  | 'sharkfin'
  | 'record'
  | 'catmat'
  | 'clover'
  | 'cloud'
  | 'speedo'
  | 'pegasus'
  | 'raccoon'
  | 'icecream'
  | 'loaf'
  | 'saucepan'
  | 'robotskull'
  | 'conga'
  | 'convertible'
  | 'nighttape'
  | 'vault'
  | 'tumbleweed'
  | 'mic'
  | 'megaphone'
  | 'origami'
  | 'llama'
  | 'well'
  | 'kiwi'
  | 'mink'
  | 'crew'
  | 'spirograph'
  | 'cub'
  | 'snooze'
  | 'scooter'
  | 'kite'
  | 'strobe'
  | 'lighthouse'
  | 'sailboat'
  | 'portapotty'
  | 'refill'
  | 'charger'
  | 'fan'
  | 'silentdisco'
  | 'shuttle'
  | 'hammock'
  | 'foodtruck'
  | 'caretent'
  | 'lostfound'
  | 'pickup'
  | 'merch'
  | 'gates'
  | 'shower';

/** A creature's colours: its body (light, mid, deep), a second colour pair, its glowing details and the light around it. */
export type Palette = { light: string; mid: string; deep: string; alt: string; altDeep: string; accent: string; glow: string };

export type ArtistLook = {
  creature: Creature;
  palette: Palette;
  /** The colour that stands for it in the app (names, borders). */
  accent: string;
  /** Hand-made for this artist. */
  signature: boolean;
  /** Its name: "The Watcher". */
  name: string;
  /** One line on what it is: "A big eye with wriggling tentacles". */
  theme: string;
  /** A little extra: a crown, or fangs. */
  extra?: 'crown' | 'fangs';
};

type Spec = Omit<ArtistLook, 'signature' | 'accent'> & { accent?: string };

const P = (light: string, mid: string, deep: string, alt: string, altDeep: string, accent: string, glow: string): Palette => ({ light, mid, deep, alt, altDeep, accent, glow });

/** Hand-made collectibles, by folded artist name. */
const SIGNATURES: Record<string, Spec> = {
  subtronics: { creature: 'eye', palette: P('#F4FFE0', '#B6F05A', '#3F8F1A', '#C9A2FF', '#5B2BB0', '#B36BFF', '#9BE84E'), name: t('The Watcher'), theme: t('A big eye with wriggling tentacles') },
  illenium: { creature: 'phoenix', palette: P('#FFF3D6', '#FF9A4A', '#C2362A', '#FFE08A', '#FF5A2A', '#FFD36B', '#FF7A3D'), name: t('The Phoenix'), theme: t('A phoenix rising in flame through a starry night') },
  sevenlions: { creature: 'lion', palette: P('#FFF1C9', '#F2B84B', '#A8661C', '#FFB347', '#B8541A', '#FFE9A8', '#F2A23A'), name: t('The Lion'), theme: t('A lion with a glowing mane') },
  zedsdead: { creature: 'ghost', palette: P('#FFFFFF', '#DCD8F2', '#8C88B8', '#9BE84E', '#3E8F1A', '#B6FF6A', '#9BE84E'), name: t('The Ghost'), theme: t('A friendly ghost with glowing eyes') },
  ghengar: { creature: 'ghost', palette: P('#F1E8FF', '#A98CF0', '#4A2E8A', '#FF6AD5', '#7A1E6A', '#FF8AE0', '#A06BFF'), name: t('The Phantom'), theme: t('A grinning phantom'), extra: 'fangs' },
  rlgrime: { creature: 'pumpkin', palette: P('#FFD9A0', '#FF8A1F', '#A8400C', '#8FD65A', '#2E6A1E', '#FFE36B', '#FF8A1F'), name: t('The Lantern'), theme: t('A pumpkin lit from inside') },
  excision: { creature: 'dino', palette: P('#D08A64', '#7E3A28', '#3A1610', '#A9BEDF', '#2E4380', '#FF3B3B', '#4F86FF'), name: t('The Dinosaur'), theme: t('A dinosaur from outer space, roaring under a flying saucer') },
  svddendeath: { creature: 'stagskull', palette: P('#F2EBDD', '#C9BCA6', '#5A4C40', '#2A1E30', '#140E1C', '#FF2E3E', '#B0142A'), name: t('The Stag skull'), theme: t('A stag skull with great antlers, in a dark hooded robe') },
  voyd: { creature: 'stagskull', palette: P('#F2EBDD', '#C9BCA6', '#5A4C40', '#2A1E30', '#140E1C', '#FF2E3E', '#B0142A'), name: t('The Stag skull'), theme: t('A stag skull with great antlers, in a dark hooded robe') },
  liquidstranger: { creature: 'captain', palette: P('#C8FFB0', '#7ED46A', '#2E6A3A', '#5A6A8A', '#232A40', '#7FF5FF', '#8CFF7A'), name: t('The Captain'), theme: t('An alien captain at the controls of its ship') },
  kaiwachi: { creature: 'gladiator', palette: P('#F2F5FA', '#AEB8C8', '#3A4256', '#FF3EC8', '#8A1470', '#4AF0FF', '#FF3EC8'), name: t('The Gladiator'), theme: t('A chrome gladiator with a neon crest') },
  porterrobinson: { creature: 'dreamcube', palette: P('#FFF4FB', '#FFC2E2', '#7A5AC8', '#BDE6FF', '#6AA8E8', '#FFFFFF', '#FFB8E0'), name: t('The Dream cube'), theme: t('A soft pastel cube floating in a dream') },
  saidthesky: { creature: 'paperplane', palette: P('#FFFFFF', '#E4E8F8', '#9AA4D0', '#FFC6E0', '#A8D4FF', '#FFE9A8', '#C8B8FF'), name: t('The Paper plane'), theme: t('A paper plane gliding over pink and blue clouds') },
  odesza: { creature: 'icosa', palette: P('#FFF0B8', '#F2C04A', '#9A6A12', '#D8962A', '#6A4410', '#FFF6D8', '#FFC84A'), name: t('The Icosahedron'), theme: t('A golden twenty-sided shape, glowing') },
  rezz: { creature: 'goggles', palette: P('#E8D6CC', '#2A2236', '#120E1A', '#4A4458', '#1A1622', '#FF2A3A', '#FF2A3A'), name: t('The Hypnotist'), theme: t('Huge goggles with glowing red spirals') },
  ericprydz: { creature: 'hologram', palette: P('#E0FFFF', '#6AE8FF', '#1A6A8A', '#5A6478', '#262C3A', '#FFFFFF', '#6AE8FF'), name: t('The Hologram'), theme: t('An astronaut projected in light') },
  deadmau5: { creature: 'mousehead', palette: P('#FF8A9A', '#E8203A', '#7A0A1E', '#2A1A22', '#120A10', '#FFFFFF', '#FF4A5E'), name: t('The Mouse head'), theme: t('A big round mouse head with a wide grin') },
  marshmello: { creature: 'mallow', palette: P('#FFFFFF', '#ECE8F2', '#B8B0C8', '#1A1622', '#000000', '#FFB8D8', '#E8E0FF'), name: t('The Marshmallow'), theme: t('A soft marshmallow with a big grin') },
  alanwalker: { creature: 'hooded', palette: P('#C8D0E0', '#2E3340', '#12141C', '#0A0A10', '#000000', '#E8F4FF', '#8AB8FF'), name: t('The Hooded figure'), theme: t('Hood up, face masked, eyes glowing') },
  zedd: { creature: 'prism', palette: P('#FFFFFF', '#CFE6FF', '#5A7AB0', '#FFFFFF', '#8AB0E0', '#FFFFFF', '#B8D8FF'), name: t('The Prism'), theme: t('A glass prism splitting light into a rainbow') },
  steveaoki: { creature: 'cake', palette: P('#FFF4E0', '#FFB8D0', '#B85A8A', '#FFFFFF', '#E8D8F0', '#FFD24A', '#FF8AC0'), name: t('The Flying cake'), theme: t('A birthday cake flying through the air') },
  tchami: { creature: 'stainedglass', palette: P('#FFF2C8', '#4A3A58', '#120A18', '#7A5AC8', '#1E142C', '#FFD86B', '#B88AFF'), name: t('The Window'), theme: t('A stained-glass window lit from within') },
  wooli: { creature: 'mammoth', palette: P('#D9A877', '#9A6438', '#4E2C14', '#F6EBD2', '#CDB68C', '#FFE9B0', '#A9D4FF'), name: t('The Mammoth'), theme: t('A shaggy woolly mammoth with great curling tusks') },
  skrillex: { creature: 'scarymonster', palette: P('#E8FFD0', '#7CD84A', '#2A5A1A', '#E8E0FF', '#2A1A3A', '#FF4FD0', '#9CFF5A'), name: t('The Scary monster'), theme: t('A shaggy little monster with horns, nice sprites buzzing round it') },
  rufusdusol: { creature: 'desertsun', palette: P('#FFF0E0', '#5A8A5A', '#3A1E4A', '#8A5AA8', '#5A2A6A', '#FF8A4A', '#FFB86B'), name: t('The Desert sun'), theme: t('A saguaro standing before a huge sun going down over the dunes') },
  kaskade: { creature: 'wave', palette: P('#FFFFFF', '#3FB8E8', '#1A4A8A', '#FFC8E0', '#5A2A6A', '#FF9A6A', '#7FD8FF'), name: t('The Sunset wave'), theme: t('A wave curling over as the sun goes down') },
  davidguetta: { creature: 'titaniumheart', palette: P('#FFFFFF', '#C8D0DE', '#4A5268', '#8A92A8', '#2A2E3A', '#7FD3FF', '#D8E4FF'), name: t('The Titanium heart'), theme: t('A heart of polished titanium, bulletproof') },
  meduza: { creature: 'gorgon', palette: P('#E8FFE0', '#9AD8A0', '#2A5A3A', '#5AB86A', '#1E4A2A', '#FFD24A', '#7FE8A0'), name: t('The Gorgon'), theme: t('A gorgon with a head of little snakes, and a look that only makes you dance') },
  nghtmre: { creature: 'nightmare', palette: P('#FFF3C8', '#3A3458', '#14102A', '#5A3AA8', '#2A1A5A', '#FFE58A', '#8A6AFF'), name: t('The Night mare'), theme: t('A dark horse with a mane of stars, under a crescent moon') },
  vintageculture: { creature: 'gramophone', palette: P('#FFF4D8', '#D8A85A', '#5A3A1A', '#7A4A2A', '#3A2214', '#FFD86B', '#FFC861'), name: t('The Gramophone'), theme: t('An old gramophone playing a brand new record') },
  arminvanbuuren: { creature: 'trancestar', palette: P('#FFFFFF', '#8AC8FF', '#2A4AA8', '#B99CFF', '#3A2A8A', '#FFE58A', '#7FB8FF'), name: t('The Trance star'), theme: t('A bright star with rings of light pulsing out from it') },
  hedex: { creature: 'hedgehog', palette: P('#FFF0E0', '#E8C8A8', '#3A2A3A', '#5AE8FF', '#2A7AA8', '#B6FF5A', '#5AE8FF'), name: t('The Hedgehog'), theme: t('A hedgehog curled up tight, its spikes lit in neon') },
  knock2: { creature: 'door', palette: P('#FFF4E0', '#C86A3A', '#4A2214', '#8A3A1E', '#3A1A0E', '#FFD24A', '#FFB86B'), name: t('The Door'), theme: t('Knock knock: a little door with the party behind it') },
  martingarrix: { creature: 'stampede', palette: P('#FFF0E0', '#5A4A6A', '#1E1828', '#8A7A9A', '#3A2E48', '#FF4FD0', '#B8A8FF'), name: t('The Stampede'), theme: t('A little bull charging, head down, horns lit') },
  acraze: { creature: 'boombox', palette: P('#F2F2FF', '#5A6AFF', '#1A1A4A', '#B8C0FF', '#2A2A6A', '#FFE36B', '#7F8AFF'), name: t('The Boombox'), theme: t('A boombox with bass rolling out of it') },
  maup: { creature: 'tulip', palette: P('#FFF0F0', '#FF5A6A', '#8A1A2A', '#4AA85A', '#2A4A6A', '#FFE58A', '#FF8A9A'), name: t('The Tulip'), theme: t('A tulip from Amsterdam, canal houses behind it') },
  hardwell: { creature: 'spaceman', palette: P('#FFFFFF', '#E2E6EE', '#5A6278', '#2A3A8A', '#0E1230', '#FF4A5A', '#7FB8FF'), name: t('The Spaceman'), theme: t('A little astronaut floating among the stars') },
  alok: { creature: 'toucan', palette: P('#FFFFFF', '#23232E', '#0A0A12', '#FF8A1E', '#D8321A', '#FFE34A', '#4ADFB0'), name: t('The Toucan'), theme: t('A toucan with a beak in sunset colours') },
  alesso: { creature: 'hero', palette: P('#FFF4E0', '#3A7BFF', '#16308A', '#FF3A5A', '#8A1030', '#FFD36E', '#7FA8FF'), name: t('The Hero'), theme: t('A little hero in a mask, cape in the wind') },
  boogiet: { creature: 'gumbo', palette: P('#FFF0D8', '#3A3A44', '#16161C', '#C8642A', '#E8402A', '#FFC94A', '#FF8A3D'), name: t('The Gumbo pot'), theme: t('A pot of gumbo bubbling, a crawfish peeking out') },
  adventureclub: { creature: 'balloon', palette: P('#FFFFFF', '#FF5A7A', '#8A1A3A', '#5BC8FF', '#B07A3A', '#FFE36B', '#FF8AB0'), name: t('The Balloon'), theme: t('A hot-air balloon drifting off on an adventure') },
  peekaboo: { creature: 'peeker', palette: P('#FFE8F4', '#C77DFF', '#5A2A8A', '#2A2A36', '#121218', '#7CFFDA', '#C77DFF'), name: t('The Peekaboo'), theme: t('Peeking over the speakers, waiting for the drop') },
  habstrakt: { creature: 'croissant', palette: P('#FFF0D0', '#E8A84A', '#9A5A1A', '#2A2A34', '#121218', '#FF5A8A', '#FFC46A'), name: t('The Croissant'), theme: t('A croissant in a beret, fresh from Paris') },
  afrojack: { creature: 'jackbox', palette: P('#FFFFFF', '#FF4A5A', '#8A1424', '#FFD24A', '#B8861A', '#5BC8FF', '#FF6A7A'), name: t('The Jack-in-the-box'), theme: t('Wind it up and it jumps out on the drop') },
  artbat: { creature: 'bat', palette: P('#E8E0FF', '#4A3A6A', '#1E1430', '#2A2040', '#120C1E', '#FF4FD0', '#9A7AFF'), name: t('The Bat'), theme: t('A little bat that only comes out at night') },
  ihatemodels: { creature: 'rose', palette: P('#FFE0F0', '#2A1A2E', '#0E0812', '#3A7A4A', '#1A3A22', '#FF3A6A', '#C02A5A'), name: t('The Black rose'), theme: t('A black rose, its petals edged in red light') },
  interplanetarycriminal: { creature: 'ufo', palette: P('#E8FFF0', '#9AA8C0', '#3A4458', '#7CFF8A', '#1E5A2A', '#FFE36B', '#7CFF8A'), name: t('The Getaway'), theme: t('A flying saucer, a masked little alien at the controls') },
  taikinulight: { creature: 'nightlight', palette: P('#FFF8E0', '#FFD36E', '#B87A1A', '#5A4A8A', '#2A1E4A', '#FFFFFF', '#FFE08A'), name: t('The Night light'), theme: t('A little lamp glowing warm in the dark') },
  alleycvt: { creature: 'alleycat', palette: P('#F0F0F8', '#4A4A5A', '#1E1E28', '#FF5FCB', '#7A1E5A', '#7CFFDA', '#FF5FCB'), name: t('The Alley cat'), theme: t('A cat in a beanie by a tagged brick wall') },
  jessicaaudiffred: { creature: 'monarch', palette: P('#FFF4E0', '#FF8A1E', '#1E1418', '#FFB84A', '#2A1A10', '#FFFFFF', '#FFA040'), name: t('The Monarch'), theme: t('A monarch butterfly on its long flight home') },
  hol: { creature: 'exclaim', palette: P('#FFFFFF', '#FF3A5A', '#8A1024', '#FFE34A', '#8A6A10', '#FFFFFF', '#FF5A7A'), name: t('The Exclamation'), theme: t('An exclamation mark shouting for joy') },
  discoveryproject: { creature: 'telescope', palette: P('#E8F0FF', '#7A8AB8', '#2A3458', '#FFD36E', '#8A6A1A', '#B8FFF0', '#8AB8FF'), name: t('The Observatory'), theme: t('A little observatory, its telescope out to the stars') },
  klangkuenstler: { creature: 'cog', palette: P('#E8ECF4', '#8A94A8', '#3A4252', '#FF3A3A', '#5A1010', '#FF3A3A', '#FF4A4A'), name: t('The Gear'), theme: t('A heavy steel cog, turning and turning') },
  hayla: { creature: 'songbird', palette: P('#FFF4F8', '#7FB8FF', '#2A4A8A', '#FFD36E', '#B8861A', '#FF7EB6', '#9AC8FF'), name: t('The Songbird'), theme: t('A little bird singing its heart out') },
  nicomoreno: { creature: 'anvil', palette: P('#F0F0F4', '#5A5E6A', '#22242C', '#FFB84A', '#8A4A10', '#FF6A2A', '#FF8A3D'), name: t('The Anvil'), theme: t('A blacksmith’s anvil, sparks flying on every kick') },
  frankyrizardo: { creature: 'lizard', palette: P('#F4FFE0', '#6ACF5A', '#1E6A2A', '#C89A6A', '#6A4A2A', '#FFD36E', '#8AE87A'), name: t('The Lizard'), theme: t('A little lizard sunning itself on a warm rock') },
  denniscruz: { creature: 'palm', palette: P('#FFE8C8', '#B8865A', '#1E4A3A', '#3AA8C8', '#6A3A1A', '#FF8A4A', '#FFB86B'), name: t('The Palm'), theme: t('A palm tree on a little island at sunset') },
  madvktm: { creature: 'bomb', palette: P('#FFFFFF', '#2A2A3A', '#0E0E16', '#E8C88A', '#5A4A2A', '#FF5A2A', '#FF7A3D'), name: t('The Bomb'), theme: t('A cartoon bomb, its fuse fizzing, ready to drop') },
  sippy: { creature: 'sippycup', palette: P('#FFFFFF', '#E8F0FF', '#5A6A9A', '#7FD3FF', '#2A4A8A', '#B6FF5A', '#9AD8FF'), name: t('The Sippy cup'), theme: t('A sippy cup full of something glowing, wobbling with the bass') },
  sofitukker: { creature: 'parrot', palette: P('#FFFFFF', '#E8322A', '#2A1A1A', '#2A7AE8', '#123A8A', '#FFD24A', '#FF6A4A'), name: t('The Parrot'), theme: t('A bright macaw on a branch, wings of blue and gold') },
  jkylhyde: { creature: 'twoface', palette: P('#FFF4E0', '#E8D8B8', '#5A4A3A', '#3A1E5A', '#14081E', '#FF3A5A', '#B99CFF'), name: t('The Two faces'), theme: t('Half sunny and kind, half dark with fangs') },
  thexx: { creature: 'xmark', palette: P('#FFFFFF', '#F0F0F4', '#5A5A6A', '#2A2A3A', '#0A0A10', '#FFFFFF', '#E8E8FF'), name: t('The X'), theme: t('A soft white X glowing in the dark, quiet and still') },
  rayvolpe: { creature: 'laserfox', palette: P('#FFF4E8', '#FF7A2A', '#3A1A0A', '#FF3ACF', '#5A1A4A', '#5BFFE0', '#FF9A4A'), name: t('The Laser fox'), theme: t('A little fox with laser beams fanning out behind it') },
  labrinth: { creature: 'maze', palette: P('#FFF8E8', '#C8B8F0', '#3A2A6A', '#FFD24A', '#2A1E4A', '#FFD24A', '#B99CFF'), name: t('The Maze'), theme: t('A round labyrinth with a face at its heart') },
  parcels: { creature: 'parcel', palette: P('#FFF8EC', '#D8A86A', '#6A4A2A', '#E8322A', '#8A1A1A', '#FF7EB6', '#FFC88A'), name: t('The Parcel'), theme: t('A parcel tied up with string and a big red bow') },
  twentyonepilots: { creature: 'biplane', palette: P('#FFF4E8', '#E8E4D8', '#3A2E2A', '#E8322A', '#2A2A3A', '#FFD24A', '#FF8A6A'), name: t('The Pilot'), theme: t('A little pilot in goggles, flying a biplane') },
  charlixcx: { creature: 'lime', palette: P('#F4FFD8', '#8ACE00', '#3A6A0A', '#2A2A2A', '#0A0A0A', '#B6FF3A', '#8ACE00'), name: t('The Lime'), theme: t('A slice of lime in sunglasses, bright green and unbothered') },
  lorde: { creature: 'greenlight', palette: P('#E8FFE8', '#3A3A44', '#14141A', '#FF3A3A', '#0A0A10', '#5BFF8A', '#5BFF8A'), name: t('The Green light'), theme: t('A traffic light gone green: go on, then') },
  bloodorange: { creature: 'orange', palette: P('#FFF0D8', '#FF8A2A', '#7A2A0A', '#3A8A3A', '#B8122A', '#FFD24A', '#FF7A3D'), name: t('The Orange'), theme: t('A blood orange, cut open to its deep red inside') },
  turnstile: { creature: 'turnstile', palette: P('#F0F4F8', '#8A94A8', '#2A3040', '#3A4252', '#121620', '#5BFF8A', '#9AB8D8'), name: t('The Turnstile'), theme: t('A turnstile at the gate, its arms turning') },
  geese: { creature: 'goose', palette: P('#FFFFFF', '#F0F0F0', '#6A6A74', '#FF9A2A', '#D8641A', '#FFE36B', '#D8E4FF'), name: t('The Goose'), theme: t('A goose, neck out, honking at nobody in particular') },
  kingsofleon: { creature: 'crown', palette: P('#FFF8D8', '#FFC93A', '#8A5A0A', '#E8A42A', '#D8263A', '#5BC8FF', '#FFD86B'), name: t('The Crown'), theme: t('A gold crown set with jewels') },
  snowstrippers: { creature: 'snowflake', palette: P('#FFFFFF', '#CFE8FF', '#3A5A8A', '#8AB8FF', '#1A2A4A', '#E8F4FF', '#9AC8FF'), name: t('The Snowflake'), theme: t('A glittering snowflake, cold light all around it') },
  sukiwaterhouse: { creature: 'houseboat', palette: P('#FFF4E8', '#F0C8A8', '#3A2A4A', '#3A5A8A', '#6A3A2A', '#FFD86B', '#B8A8E8'), name: t('The Water house'), theme: t('A little house afloat on still water, its window lit') },
  rebeccablack: { creature: 'friday', palette: P('#FFFFFF', '#FF5AA8', '#3A2A4A', '#B85AFF', '#2A1A3A', '#FFD24A', '#FF8AC8'), name: t('The Friday'), theme: t('A calendar page with the best day of the week circled') },
  brandonflowers: { creature: 'bouquet', palette: P('#FFF8F0', '#FF7E9A', '#3A2A2A', '#4AA85A', '#8A1A3A', '#FFD24A', '#FF9AB8'), name: t('The Bouquet'), theme: t('A bunch of flowers wrapped in paper, tied with a ribbon') },
  brigittecallsmebaby: { creature: 'telephone', palette: P('#FFF4E8', '#E8324A', '#5A0A1A', '#2A2A34', '#121218', '#FFD24A', '#FF6A7A'), name: t('The Telephone'), theme: t('A retro telephone ringing, its curly cord trailing') },
  palace: { creature: 'palace', palette: P('#FFF8EC', '#F0E0C8', '#5A4A3A', '#6A8AD8', '#2A3A6A', '#FFD86B', '#C8B8F0'), name: t('The Palace'), theme: t('A little palace with domes, its windows lit at night') },
  natashabedingfield: { creature: 'notebook', palette: P('#FFFFFF', '#B8C8E8', '#2A2A3A', '#E8A8C8', '#8A3A5A', '#FF7EB6', '#F0C8E0'), name: t('The Notebook'), theme: t('An open notebook, its pages still unwritten') },
  finnwolfhard: { creature: 'sharkfin', palette: P('#E8F4FF', '#6A8AA8', '#1A2A3A', '#2A6AA8', '#0A1A2A', '#7FD3FF', '#8AB8E8'), name: t('The Fin'), theme: t('A shark fin cutting through the water, friendlier than it looks') },
  lp: { creature: 'record', palette: P('#FFFFFF', '#2A2A34', '#0A0A10', '#FF5A7A', '#5A1A2A', '#FFD24A', '#FF8AA8'), name: t('The Record'), theme: t('A long player spinning, light catching its grooves') },
  cmat: { creature: 'catmat', palette: P('#FFF4E8', '#FF9A4A', '#5A2A0A', '#3AA8A8', '#1A5A5A', '#FF7EB6', '#FFB86B'), name: t('The Cat on the mat'), theme: t('A contented cat curled up on a woven mat') },
  lykkeli: { creature: 'clover', palette: P('#FFFFFF', '#4AC86A', '#1A5A2A', '#2A8A3A', '#0A3A1A', '#FFE36B', '#7AE88A'), name: t('The Clover'), theme: t('A four-leaf clover, for luck, a dewdrop shining on it') },
  skyenewman: { creature: 'cloud', palette: P('#FFFFFF', '#E8F0FF', '#4A5A7A', '#7FD3FF', '#B99CFF', '#FF9AC8', '#BFD8FF'), name: t('The Cloud'), theme: t('A soft cloud drifting, a rainbow peeking out behind') },
  mph: { creature: 'speedo', palette: P('#FFFFFF', '#8A94A8', '#14141C', '#3A3A44', '#0A0A10', '#FF3A3A', '#FF6A4A'), name: t('The Speedometer'), theme: t('A speedometer with its needle in the red') },
  pegassi: { creature: 'pegasus', palette: P('#FFFFFF', '#F0EAFF', '#4A3A6A', '#B8D8FF', '#3A4A8A', '#FF9AD8', '#C8B8FF'), name: t('The Pegasus'), theme: t('A little winged horse, a star on its brow') },
  ravenscoon: { creature: 'raccoon', palette: P('#F4F4F8', '#8A8A98', '#1E1E26', '#5A5A6A', '#2A2A34', '#B6FF5A', '#A8A8C0'), name: t('The Raccoon'), theme: t('A raccoon in its bandit mask, up to no good') },
  kream: { creature: 'icecream', palette: P('#FFF8F0', '#FF9AC8', '#5A2A3A', '#E8B07A', '#9A6A3A', '#FF3A5A', '#FFB8D8'), name: t('The Ice cream'), theme: t('A double scoop in a waffle cone, a cherry on top') },
  joshbaker: { creature: 'loaf', palette: P('#FFFFFF', '#E0A050', '#6A3A10', '#C8803A', '#5A2A0A', '#FF9A6A', '#FFC07A'), name: t('The Loaf'), theme: t('A fresh loaf in a chef’s hat, warm from the oven') },
  chefboyarbeatz: { creature: 'saucepan', palette: P('#FFFFFF', '#B8C0D0', '#2A2E3A', '#C8925A', '#C8321A', '#FF5A7A', '#FF8A5A'), name: t('The Saucepan'), theme: t('A saucepan in headphones, the sauce bubbling') },
  skullmachine: { creature: 'robotskull', palette: P('#FFFFFF', '#C8D0DC', '#1A1E28', '#3A4252', '#121620', '#FF3A5A', '#8AA0C8'), name: t('The Skull bot'), theme: t('A friendly robot skull with lights for eyes') },
  discolines: { creature: 'conga', palette: P('#FFFFFF', '#D8DCE8', '#4A4E5A', '#B99CFF', '#2A2E3A', '#FF7EDB', '#C8D8FF'), name: t('The Conga'), theme: t('Three little mirror balls dancing in a line') },
  arcydrive: { creature: 'convertible', palette: P('#FFFFFF', '#5AB8E8', '#1A3A5A', '#FFD24A', '#1A1A22', '#FF7EB6', '#8AD0FF'), name: t('The Convertible'), theme: t('A little open-top car out for a drive') },
  nighttapes: { creature: 'nighttape', palette: P('#FFFFFF', '#3A2A6A', '#120A2A', '#1E2E5A', '#0A0A1A', '#FFE08A', '#8A7AE8'), name: t('The Night tape'), theme: t('A cassette with a moon on its label') },
  devault: { creature: 'vault', palette: P('#FFFFFF', '#8A94A8', '#2A3040', '#C8A84A', '#5A4A1A', '#FFD24A', '#B8C0D8'), name: t('The Vault'), theme: t('A little bank vault, its big dial turning') },
  chasewest: { creature: 'tumbleweed', palette: P('#FFF4E0', '#C89A5A', '#5A3A1A', '#E8A85A', '#3A6A3A', '#FF8A3D', '#FFB86B'), name: t('The Tumbleweed'), theme: t('A tumbleweed rolling west into the sunset') },
  live: { creature: 'mic', palette: P('#FFFFFF', '#C8D0DC', '#1A1E28', '#3A3E4A', '#0A0A10', '#FF3A3A', '#B8C8E8'), name: t('The Mic'), theme: t('A vintage microphone, the on-air light glowing') },
  bleachers: { creature: 'megaphone', palette: P('#FFFFFF', '#F0F0F4', '#2A2A34', '#E8323A', '#3A1A1A', '#FFD24A', '#FF8A8A'), name: t('The Megaphone'), theme: t('A cheer squad megaphone, shouting the chorus back') },
  parispaloma: { creature: 'origami', palette: P('#FFFFFF', '#E8E4F0', '#4A4A5A', '#8A7AC8', '#2A2A3A', '#FFB84A', '#D8D0F0'), name: t('The Paper dove'), theme: t('An origami dove, folded from a page of a song') },
  roddylima: { creature: 'llama', palette: P('#FFFFFF', '#F4E8D8', '#4A3A2A', '#E8323A', '#2A6AC8', '#FFD24A', '#F0D8B8'), name: t('The Llama'), theme: t('A fluffy llama in a woven blanket, tassels on its ears') },
  jessewelles: { creature: 'well', palette: P('#FFFFFF', '#A8A8B8', '#2A2A34', '#B8763A', '#5A3A1A', '#FFD24A', '#C8C0E0'), name: t('The Wishing well'), theme: t('A stone wishing well, a coin glinting in it') },
  kiki: { creature: 'kiwi', palette: P('#FFF8E8', '#A8784A', '#3A2410', '#E8C88A', '#3A2A1A', '#FF9AB8', '#C8A07A'), name: t('The Kiwi'), theme: t('A round little kiwi bird, poking about at night') },
  fakemink: { creature: 'mink', palette: P('#FFF4EC', '#B8845A', '#2A1A10', '#6A4430', '#2A1A12', '#FF9AD8', '#9A7AE8'), name: t('The Mink'), theme: t('A sleek little mink, very pleased with itself') },
  kompany: { creature: 'crew', palette: P('#FFFFFF', '#FF8A3D', '#2A1A12', '#5BC8FF', '#B99CFF', '#FFD24A', '#FFB86B'), name: t('The Crew'), theme: t('Three little friends arm in arm') },
  siennaspiro: { creature: 'spirograph', palette: P('#FFFFFF', '#8AB8FF', '#2A2A4A', '#B99CFF', '#1A1A2A', '#FF9AD8', '#B8C8FF'), name: t('The Spirograph'), theme: t('Loops of light drawn round and round') },
  balubrigada: { creature: 'cub', palette: P('#F4E8D8', '#9A6A4A', '#2A1A10', '#3A8A4A', '#1A3A1A', '#FFD24A', '#C89A6A'), name: t('The Bear cub'), theme: t('A little bear cub sat in the jungle leaves') },
  layz: { creature: 'snooze', palette: P('#FFFFFF', '#7FC8F0', '#2A3A5A', '#C8C0E8', '#2A2A3A', '#FFE08A', '#9AC8F0'), name: t('The Snooze'), theme: t('An alarm clock fast asleep, the snooze button pressed') },
  rossi: { creature: 'scooter', palette: P('#FFFFFF', '#E8322A', '#2A1A1A', '#C8C8D4', '#1A1A22', '#FFD24A', '#FF7A6A'), name: t('The Scooter'), theme: t('A little red scooter, a basket of flowers on the front') },
  whethan: { creature: 'kite', palette: P('#FFFFFF', '#FF7A3D', '#5A2A1A', '#5BC8FF', '#1A3A5A', '#FFD24A', '#FFB070'), name: t('The Kite'), theme: t('A bright diamond kite up in the wind') },
  prospa: { creature: 'strobe', palette: P('#FFFFFF', '#3A3A44', '#0A0A10', '#8A8A98', '#1A1A22', '#5BFFE0', '#E8F0FF'), name: t('The Strobe'), theme: t('A strobe light flashing white across the room') },
  aaronhibell: { creature: 'lighthouse', palette: P('#FFFFFF', '#E8323A', '#1A2A4A', '#2A5A8A', '#3A3A44', '#FFE08A', '#8AB8E8'), name: t('The Lighthouse'), theme: t('A striped lighthouse, its beam sweeping the sea') },
  maiiachetti: { creature: 'sailboat', palette: P('#FFFFFF', '#FF9AB8', '#2A2A3A', '#3A8AC8', '#2A3A6A', '#FFC86A', '#9AD0FF'), name: t('The Sailboat'), theme: t('A little sailboat on gentle waves, its sails full') },
  slander: { creature: 'trooper', palette: P('#A8F4FF', '#3E6E86', '#14263A', '#D9A33A', '#7A5212', '#FF9A2E', '#5FE6FF'), name: t('The Trooper'), theme: t('An armoured trooper bursting out of hyperspace') },
  spacelaces: { creature: 'astronaut', palette: P('#F2F8FF', '#C4D6EA', '#5A6E8C', '#2D4F8A', '#0E1A3A', '#7FD3FF', '#7FC8FF'), name: t('The Astronaut'), theme: t('A little astronaut lost in space') },
  alisonwonderland: { creature: 'rabbit', palette: P('#FFFFFF', '#F2E6F2', '#B98AB0', '#FFC2E0', '#FF85C8', '#FFD24A', '#FF9AD5'), name: t('The White Rabbit'), theme: t('A white rabbit, always late') },
  ofthetrees: { creature: 'spirit', palette: P('#F4F8EA', '#D6DEC4', '#8A9472', '#8FD67A', '#2E6A2A', '#E9FFB0', '#7FD87A'), name: t('The Forest spirit'), theme: t('A spirit of the forest') },
  sanholo: { creature: 'dove', palette: P('#FFFFFF', '#E4E0F0', '#6A6488', '#FFC6E0', '#C8D8FF', '#FFC86B', '#FFC6E0'), name: t('The White bird'), theme: t('A white bird in flight against a pastel sky') },
  sullivanking: { creature: 'thornskull', palette: P('#F4EEE6', '#D6CABD', '#6E5F58', '#C8344A', '#8A1E30', '#FF4A5E', '#E0324A'), name: t('The Thorn King'), theme: t('A grinning skull crowned with thorns and roses') },
  zomboy: { creature: 'skull', palette: P('#F4F7E8', '#C9D6A8', '#5E7A3A', '#A6E05A', '#2E4A1A', '#B6FF5A', '#A6E05A'), name: t('The Undead'), theme: t('A stitched-up skull with a green glow') },
  djsnake: { creature: 'serpent', palette: P('#C8FFE8', '#3FC8A0', '#0F6A58', '#FFE9A8', '#C9A050', '#FF5F8F', '#3FC8A0'), name: t('The Serpent'), theme: t('A coiled serpent') },
  atliens: { creature: 'chromemask', palette: P('#F4F6FA', '#A8AEB8', '#3A3E48', '#1C1A22', '#0A090E', '#FF4A1E', '#FF2A1A'), name: t('The Masked visitor'), theme: t('A chrome mask with burning eyes, under a flaming UFO') },
  tokimonsta: { creature: 'monster', palette: P('#EEE4FF', '#A98CFF', '#5B3FB0', '#FF85C8', '#C23A8A', '#FFD24A', '#A98CFF'), name: t('The Little monster'), theme: t('A little monster with a flower') },
  sloth: { creature: 'sloth', palette: P('#F2E4CC', '#B8936A', '#6B4A2E', '#8FD67A', '#5A3A22', '#2E2018', '#C9A57E'), name: t('The Sloth'), theme: t('A sloth hanging around') },
  reaper: { creature: 'reaper', palette: P('#A8A2C8', '#5A5480', '#1E1A34', '#E8E4F8', '#8E88AA', '#B9F3FF', '#8FA6FF'), name: t('The Reaper'), theme: t('A hooded reaper under the moon') },
  levity: { creature: 'jelly', palette: P('#E8F8FF', '#6FC3FF', '#2A6AC8', '#B9F3FF', '#4A8AE8', '#FFFFFF', '#6FC3FF'), name: t('The Floater'), theme: t('A jellyfish floating by') },
  levelup: { creature: 'patchbear', palette: P('#C8F59A', '#78C84A', '#3E7A22', '#6A2E86', '#2E0F3E', '#B6FF6A', '#8FE05A'), name: t('The Patched bear'), theme: t('A stitched-up teddy with one eye sewn shut') },
  ganjawhitenight: { creature: 'wobble', palette: P('#FFB27A', '#E8762A', '#9A3E12', '#8E4FE0', '#3E1A6E', '#FF4FE0', '#FF4FE0'), name: t('The Wobbler'), theme: t('A round fellow with a glowing bucket for a head') },
  troyboi: { creature: 'cat', palette: P('#FFF2D6', '#D9A66B', '#7A4E26', '#2A2030', '#0E0A14', '#FFD24A', '#FFD24A'), name: t('The King cat'), theme: t('A cat with a crown'), extra: 'crown' },
};

/** One creature per sound, in the artist's colours, for everyone without a signature. */
const SOUND: Record<SoundTag | 'none', Spec> = {
  dubstep: { creature: 'beast', palette: P('#C9D8FF', '#5B8CFF', '#1E3A9A', '#F2EEE0', '#9A8E70', '#7FF0FF', '#5B8CFF'), name: t('The Bass beast'), theme: t('A horned bass beast') },
  riddim: { creature: 'bot', palette: P('#D6FFFB', '#3FC8C0', '#136A78', '#13202A', '#060A10', '#6CFFE0', '#3FC8C0'), name: t('The Riddim bot'), theme: t('A little robot that loves a wobble') },
  trap: { creature: 'wolf', palette: P('#FFD6E2', '#FF5F8F', '#8A1E48', '#FFF4F8', '#C9A8B8', '#FFE36B', '#FF5F8F'), name: t('The Night wolf'), theme: t('A wolf with glowing eyes') },
  'melodic-bass': { creature: 'moth', palette: P('#F1E8FF', '#A97CFF', '#4A2E9A', '#FFC6F0', '#FF85C8', '#FFF2B0', '#A97CFF'), name: t('The Moth'), theme: t('A moth drawn to the lights') },
  house: { creature: 'cat', palette: P('#FFE6D2', '#FFA86B', '#A84E1E', '#2A2030', '#0E0A14', '#FFE36B', '#FFA86B'), name: t('The Disco cat'), theme: t('A cat in shades under the mirror ball') },
  techno: { creature: 'owl', palette: P('#DCE6FA', '#8FA6D6', '#3A4A78', '#F2F6FF', '#5A6A90', '#FF5A5A', '#8FA6D6'), name: t('The Night owl'), theme: t('An owl that stays up till sunrise') },
  pop: { creature: 'jelly', palette: P('#FFE8F4', '#FF85C8', '#B83A8A', '#FFD6EC', '#FF6AB0', '#FFFFFF', '#FF85C8'), name: t('The Jelly'), theme: t('A sparkly jellyfish') },
  indie: { creature: 'fox', palette: P('#FFE2CC', '#F08A4A', '#9A3E16', '#FFFFFF', '#E8DCD0', '#7FD8A4', '#F08A4A'), name: t('The Fox'), theme: t('A curious fox') },
  rock: { creature: 'dragon', palette: P('#FFD6CC', '#FF7A5C', '#9A2A1E', '#FFE0A8', '#C98A3A', '#FFD24A', '#FF7A5C'), name: t('The Dragon'), theme: t('A small dragon breathing sparks') },
  'hip-hop': { creature: 'bear', palette: P('#FFEED0', '#E0A85A', '#7A4A1E', '#FFE08A', '#C9961E', '#FFF6D0', '#FFC861'), name: t('The Bear'), theme: t('A bear with a gold chain') },
  none: { creature: 'wisp', palette: P('#F4ECFF', '#B99CFF', '#5A3EB0', '#FFF2B0', '#FFC861', '#FFFFFF', '#B99CFF'), name: t('The Wisp'), theme: t('A little light that follows the music') },
};

/** Names folded for matching: lower case, letters and digits only. */
export const foldName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
/** `a` mixed `t` of the way towards `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
const isHex = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
/** How light a colour is, 0 to 1. */
const lightness = (c: string) => {
  const [r, g, b] = hex(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
/** A photo's colour, lifted so a dark one still glows on the night tile. */
const lift = (c: string) => {
  const l = lightness(c);
  return l < 0.45 ? mix(c, '#FFFFFF', Math.min(0.5, 0.45 - l + 0.1)) : c;
};

type ArtistLike = { id: string; name: string; sound?: Partial<Record<SoundTag, number>>; color?: string };

/** The artist's main sound, or none when they have no sound tags. */
export function mainSound(a: Pick<ArtistLike, 'sound'>): SoundTag | 'none' {
  let best: SoundTag | 'none' = 'none';
  let w = 0;
  for (const [k, v] of Object.entries(a.sound ?? {}) as [SoundTag, number][]) if (v > w) [best, w] = [k, v];
  return best;
}

/** Their sound's creature in their colours: the body and glow take their colour; the eyes and details stay the creature's own. */
function tinted(p: Palette, tint: string): Palette {
  const t = lift(tint);
  return { ...p, light: mix(p.light, t, 0.2), mid: mix(p.mid, t, 0.6), deep: mix(p.deep, t, 0.45), glow: t };
}

export function artistLook(a: ArtistLike): ArtistLook {
  const sig = SIGNATURES[foldName(a.name)];
  if (sig) return { ...sig, accent: sig.accent ?? sig.palette.glow, signature: true };
  const spec = SOUND[mainSound(a)];
  const palette = isHex(a.color) ? tinted(spec.palette, a.color) : spec.palette;
  return { ...spec, palette, accent: palette.glow, signature: false };
}

/** A colour turned round the colour wheel (`deg`), its lightness kept. */
function turned(c: string, deg: number): string {
  const [r, g, b] = hex(c).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return c;
  const sat = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + deg) % 360) + 360) % 360;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0), f(8), f(4)].map((v) => Math.round(v * 255)));
}

/**
 * A shiny one: the same creature in a rare second colouring, its colours
 * turned round the wheel (the eyes' and details' accent too). One in
 * `SHINY_ODDS` of anyone's collectibles is shiny (see `shinyFor`).
 */
export function shinyLook(look: ArtistLook): ArtistLook {
  const deg = 150;
  const p = look.palette;
  const palette: Palette = { light: turned(p.light, deg), mid: turned(p.mid, deg), deep: turned(p.deep, deg), alt: turned(p.alt, deg), altDeep: turned(p.altDeep, deg), accent: turned(p.accent, deg), glow: turned(p.glow, deg) };
  return { ...look, palette, accent: palette.glow };
}

/** One in this many collectibles is shiny. */
export const SHINY_ODDS = 12;

/** Whether this account's collectible of this artist is shiny: decided once, the same on every phone. */
export function shinyFor(account: string, artistId: string): boolean {
  let h = 2166136261;
  for (const ch of `${account}:${artistId}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h % SHINY_ODDS === 0;
}

/** Which artists have a hand-made collectible (folded names). */
export const SIGNATURE_NAMES = Object.keys(SIGNATURES);

/** Festival-place creatures, for stickers you find in the wild (features/finds). */
const PLACES: Record<PlaceCreature, Spec> = {
  ferris: { creature: 'ferris', palette: P('#FFE9F4', '#FF7EB6', '#B03A7A', '#7FD3FF', '#3A6AC8', '#FFE36B', '#FF7EB6'), name: t('The Ferris wheel'), theme: t('A Ferris wheel that lights up the night') },
  rail: { creature: 'rail', palette: P('#E9FFF4', '#5BE3B5', '#1F8C6A', '#D6DAE4', '#6A7086', '#FF5FCB', '#5BE3B5'), name: t('The Rail rider'), theme: t('Front row on the rail, glow sticks up') },
  sunrise: { creature: 'sunrise', palette: P('#FFF6D0', '#FFC24A', '#E8742A', '#FFB070', '#2E2458', '#FF8A5C', '#FFB347'), name: t('The Sunrise'), theme: t('Still dancing when the sun comes up') },
  lantern: { creature: 'lantern', palette: P('#FFF4D6', '#FFCF6B', '#B8761E', '#6A4C36', '#2E2018', '#FFE9A0', '#FFC861'), name: t('The Camp lantern'), theme: t('A lantern that keeps the campsite cosy') },
  confetti: { creature: 'confetti', palette: P('#F2E8FF', '#A97CFF', '#5A3EB0', '#FF7EB6', '#5BE3B5', '#FFE36B', '#A97CFF'), name: t('The Confetti popper'), theme: t('A burst of confetti at the drop') },
  frog: { creature: 'frog', palette: P('#DFFFD0', '#6CD85A', '#2A8A2E', '#BFEFFF', '#3A9AE0', '#FFFFFF', '#6CD85A'), name: t('The Water frog'), theme: t('A frog that reminds you to drink water') },
  discoball: { creature: 'discoball', palette: P('#FFFFFF', '#C8CEDE', '#4A5068', '#FF7EF0', '#7AE0FF', '#FFE36B', '#B8A8FF'), name: t('The Mirror ball'), theme: t('A mirror ball throwing colours round the room') },
  totem: { creature: 'totem', palette: P('#FFF0FB', '#FF7EB6', '#3A2A4A', '#7FD3FF', '#FFE36B', '#FFFFFF', '#FF7EB6'), name: t('The Totem'), theme: t('A totem to find your friends by') },
  tent: { creature: 'tent', palette: P('#FFE9C8', '#FF9A5A', '#8A3A1E', '#2A1A30', '#14101C', '#FFE36B', '#FFB070'), name: t('The Tent'), theme: t('Home at the campsite, fairy lights on') },
  glowstick: { creature: 'glowstick', palette: P('#EFFFD0', '#7CFF6A', '#1E7A2A', '#FF5FD0', '#7FD3FF', '#FFFFFF', '#7CFF6A'), name: t('The Glow stick'), theme: t('Cracked and glowing till sunrise') },
  glowshroom: { creature: 'glowshroom', palette: P('#E0FFFF', '#5A7CFF', '#2A2A8A', '#F0E8FF', '#6A5AA8', '#8AFFF0', '#7AA8FF'), name: t('The Glow shroom'), theme: t('A mushroom glowing by the forest stage') },
  bassbin: { creature: 'bassbin', palette: P('#E0E4F0', '#2E3244', '#1E2030', '#4A4E66', '#0E0F18', '#5BE3B5', '#8A7CFF'), name: t('The Bass bin'), theme: t('A speaker stack you can feel in your chest') },
  campfire: { creature: 'campfire', palette: P('#FFF4C0', '#FF8A2A', '#C2361E', '#8A5A36', '#4A2E1A', '#FFE36B', '#FF9A3D'), name: t('The Campfire'), theme: t('Where everyone ends up after the last set') },
  mainstage: { creature: 'mainstage', palette: P('#F0E8FF', '#8A92B0', '#2A2E44', '#7A5CFF', '#14102A', '#FF5FD0', '#8A6AFF'), name: t('The Main stage'), theme: t('Lasers over a sea of hands') },
  bubbles: { creature: 'bubbles', palette: P('#F0FFFF', '#9AE8FF', '#2A6A98', '#FFB8F0', '#B85AD0', '#FFE36B', '#9AE8FF'), name: t('The Bubble'), theme: t('Blown across the crowd in rainbow sheen') },
  mixtape: { creature: 'mixtape', palette: P('#FFF6E0', '#FF7EB6', '#2A1A2E', '#3A3448', '#18141E', '#5BE3B5', '#FF7EB6'), name: t('The Mixtape'), theme: t('A tape of the sets you can’t stop playing') },
  portapotty: { creature: 'portapotty', palette: P('#CFE8FF', '#3A86E0', '#163A78', '#4FD86A', '#123A2A', '#B6FF5A', '#5BE3B5'), name: t('The Portal potty'), theme: t('Open the door and step through to somewhere else') },
  refill: { creature: 'refill', palette: P('#E6FBFF', '#4FC3F7', '#1B5E9A', '#B8C4D0', '#4A5868', '#FF9AC8', '#6FD8FF'), name: t('The Refill'), theme: t('Fill up, drink up, keep dancing') },
  charger: { creature: 'charger', palette: P('#F0FFE6', '#7CE85A', '#2A7A1E', '#3A3F4A', '#1C2028', '#FFE36B', '#9BFF6A'), name: t('The Charger'), theme: t('Topped up and ready for the headliner') },
  fan: { creature: 'fan', palette: P('#FFF0FA', '#FF5FCB', '#7A1E6A', '#7FD3FF', '#2A4A9A', '#FFE36B', '#FF7EDB'), name: t('The Fan'), theme: t('Clacked open on the drop') },
  silentdisco: { creature: 'silentdisco', palette: P('#E8F0FF', '#8A7AFF', '#3A2A8A', '#2A2A36', '#121218', '#5BFFB0', '#5BC8FF'), name: t('The Silent disco'), theme: t('Dancing to a song only its headphones can hear') },
  shuttle: { creature: 'shuttle', palette: P('#FFFFFF', '#FFC23A', '#B87A10', '#2A3A5A', '#121A2A', '#FF5A7A', '#FFD36E'), name: t('The Shuttle'), theme: t('The bus that takes you to the gates and back') },
  hammock: { creature: 'hammock', palette: P('#FFF0E0', '#7FD3B0', '#2A7A5A', '#FF8A5A', '#7A4A2A', '#FFE08A', '#7FD3B0'), name: t('The Hammock'), theme: t('Taking five in the chill zone') },
  foodtruck: { creature: 'foodtruck', palette: P('#FFF6E0', '#FF6A4A', '#8A2A1A', '#FFD24A', '#2A1E2E', '#FFB86B', '#FF8A5A'), name: t('The Food truck'), theme: t('Something hot from the grill between sets') },
  caretent: { creature: 'caretent', palette: P('#FFFFFF', '#7FC8FF', '#2A5A9A', '#1E2E4A', '#121A2A', '#FF7EB6', '#9AD8FF'), name: t('The Care tent'), theme: t('Where people look after each other, lantern lit all night') },
  lostfound: { creature: 'lostfound', palette: P('#FFF4E0', '#D8A86A', '#7A5228', '#7FD3FF', '#2A2A3A', '#7CFF8A', '#FFC88A'), name: t('The Lost and found'), theme: t('Where lost bucket hats and phones turn up again') },
  pickup: { creature: 'pickup', palette: P('#FFFFFF', '#FF5A7A', '#8A1A3A', '#FFD24A', '#2A2A3A', '#7FD3FF', '#FF8AA8'), name: t('The Pick-up point'), theme: t('Where your ride home is waiting') },
  merch: { creature: 'merch', palette: P('#FFFFFF', '#2A2A3A', '#0E0E16', '#FF7EB6', '#7A2A5A', '#FFD24A', '#B99CFF'), name: t('The Merch tee'), theme: t('The festival tee you’ll wear for years') },
  gates: { creature: 'gates', palette: P('#FFF4E0', '#7A5AD8', '#2A1E5A', '#FF5A7A', '#121A2A', '#FFD24A', '#B99CFF'), name: t('The Gates'), theme: t('The arch of lights you walk through on day one') },
  shower: { creature: 'shower', palette: P('#FFFFFF', '#C8D4E4', '#4A5A74', '#FF9A2A', '#FFD24A', '#7FD3FF', '#9AD8FF'), name: t('The Shower'), theme: t('A hot shower and a rubber duck, camping luxury') },
  gnome: { creature: 'gnome', palette: P('#FFE2CC', '#E8463A', '#8A1E1A', '#F6F2EA', '#3D6FD0', '#FFC95A', '#FF7A6A'), name: t('The Garden gnome'), theme: t('A garden gnome keeping watch over the sprouts') },
  flask: { creature: 'flask', palette: P('#F3EEFF', '#A97CFF', '#4A2E9A', '#D9B48A', '#7A5634', '#C9F7FF', '#A97CFF'), name: t('The Alchemist'), theme: t('A bubbling potion from the underground') },
};
export type PlaceCreature = 'ferris' | 'rail' | 'sunrise' | 'lantern' | 'confetti' | 'frog' | 'flask' | 'discoball' | 'totem' | 'tent' | 'glowstick' | 'glowshroom' | 'bassbin' | 'campfire' | 'mainstage' | 'bubbles' | 'mixtape' | 'portapotty' | 'refill' | 'charger' | 'fan' | 'silentdisco' | 'shuttle' | 'hammock' | 'foodtruck' | 'caretent' | 'lostfound' | 'pickup' | 'merch' | 'gates' | 'shower' | 'gnome';
export const PLACE_CREATURES = Object.keys(PLACES) as PlaceCreature[];

/** The sound creatures (no artist's identity), which stickers can use too. */
export const SOUND_CREATURES: readonly Creature[] = [...new Set(Object.values(SOUND).map((s) => s.creature))];

/** A sticker's creature: a festival place, or a sound creature in its own colours. Never an artist's hand-made one. */
export function stickerLook(creature: string): ArtistLook | undefined {
  const place = PLACES[creature as PlaceCreature];
  if (place) return { ...place, accent: place.palette.glow, signature: false };
  const sound = Object.values(SOUND).find((s) => s.creature === creature);
  return sound ? { ...sound, accent: sound.palette.glow, signature: false } : undefined;
}

/** Every look, for galleries and tests. */
export const ALL_LOOKS: readonly ArtistLook[] = [
  ...Object.values(SIGNATURES).map((s) => ({ ...s, accent: s.palette.glow, signature: true })),
  ...Object.values(SOUND).map((s) => ({ ...s, accent: s.palette.glow, signature: false })),
  ...Object.values(PLACES).map((s) => ({ ...s, accent: s.palette.glow, signature: false })),
];
