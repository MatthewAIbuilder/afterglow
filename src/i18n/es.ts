import type { Dictionary } from './translate';
import { es_discover } from './es/discover';
import { es_festivalPage } from './es/festivalPage';
import { es_festivals } from './es/festivals';
import { es_festivalsMore } from './es/festivalsMore';
import { es_organizers } from './es/organizers';
import { es_account } from './es/account';
import { es_artist } from './es/artist';
import { es_care } from './es/care';
import { es_crews } from './es/crews';
import { es_memories } from './es/memories';
import { es_friends } from './es/friends';
import { es_plan } from './es/plan';
import { es_play } from './es/play';
import { es_profile } from './es/profile';
import { es_profileLogic } from './es/profileLogic';
import { es_sound } from './es/sound';
import { es_sprouts } from './es/sprouts';

/**
 * Spanish, keyed by the English line exactly as it's written in the code
 * (`t('Settings')`). Neutral Latin American Spanish, informal "tú", sentence
 * case like the English. `{name}` slots must stay (their order can change).
 * A line that isn't here shows in English. `src/i18n/__tests__` checks every
 * line the code passes to `t()` has an entry, and that each keeps its slots.
 */
export const es: Dictionary = {
  // Each area keeps its own list (src/i18n/es/); the lines below are shared or from the first step.
  ...es_discover,
  ...es_festivals,
  ...es_festivalPage,
  ...es_plan,
  ...es_sound,
  ...es_profile,
  ...es_profileLogic,
  ...es_friends,
  ...es_crews,
  ...es_artist,
  ...es_memories,
  ...es_play,
  ...es_sprouts,
  ...es_care,
  ...es_festivalsMore,
  ...es_organizers,
  ...es_account,




  // Shared buttons and words
  OK: 'OK',
  Cancel: 'Cancelar',
  Close: 'Cerrar',
  Back: 'Atrás',
  Share: 'Compartir',
  End: 'Terminar',
  Skip: 'Saltar',
  Continue: 'Continuar',
  Loading: 'Cargando',
  'Try again': 'Reintentar',
  'Try again in a moment.': 'Vuelve a intentarlo en un momento.',
  'Clear the search': 'Borrar la búsqueda',

  // Ratings, artist rows and crew times (shared by many screens)
  'Love them': 'Me encantan',
  'Like them': 'Me gustan',
  'They’re OK': 'Están bien',
  'Not for me': 'No es lo mío',
  'you love their sound': 'te encanta su sonido',
  'you like them': 'te gustan',
  'you think they’re OK': 'te parecen bien',
  'not really for you': 'no es mucho lo tuyo',
  'not for you': 'no es lo tuyo',
  'Not really for you': 'No es mucho lo tuyo',
  '{artist}, {pct} percent match': '{artist}, {pct} por ciento de afinidad',
  'Just now': 'Ahora mismo',
  '{m} min ago': 'hace {m} min',
  '{h} h {m} min ago': 'hace {h} h {m} min',
  '{h} h ago': 'hace {h} h',
  'Replied {time}': 'Respondió a las {time}',
  'Can’t find the crew · {time}': 'No encuentro al grupo · {time}',
  'Not feeling great · {time}': 'No me siento bien · {time}',
  'I’m OK · {time}': 'Estoy bien · {time}',
  'Photo {time}': 'Foto {time}',
  'Updated {time}': 'Actualizado a las {time}',
  'Sent {time}, reached the crew {arrived}': 'Enviado a las {time}, llegó al grupo a las {arrived}',
  'Last update {time} · {ago}': 'Última novedad a las {time} · {ago}',
  'Looking for videos from {festival}': 'Buscando videos de {festival}',
  'Live from {festival}': 'En vivo desde {festival}',
  'Sign in to watch the videos people film here, and share yours.': 'Inicia sesión para ver los videos que la gente graba aquí y compartir los tuyos.',
  'Be the first: film a set and turn on Share to Discover. Videos people share from here show up as they come in.':
    'Sé el primero: graba un set y activa Compartir en Descubrir. Los videos que la gente comparta desde aquí aparecen en cuanto llegan.',
  'Tonight’s plan': 'El plan de esta noche',

  '{list} and {last}': '{list} y {last}',
  '{n} video {from}': '{n} video {from}',
  '{n} videos {from}': '{n} videos {from}',
  'from {n} person': 'de {n} persona',
  'from {n} people': 'de {n} personas',
  'Afterglow may earn a commission if you buy through these links. It doesn’t change your price.':
    'Afterglow puede ganar una comisión si compras con estos enlaces. Tu precio no cambia.',
  '{n} person on Afterglow is going': '{n} persona en Afterglow va',
  '{n} people on Afterglow are going': '{n} personas en Afterglow van',
  '{name} is going': '{name} va',
  '{a} and {b} are going': '{a} y {b} van',
  '{a} and {n} others you follow are going': '{a} y {n} personas más que sigues van',
  '{going}, plus {n} other on Afterglow': '{going}, y {n} persona más en Afterglow',
  '{going}, plus {n} others on Afterglow': '{going}, y {n} personas más en Afterglow',

  '{list} or {last}': '{list} o {last}',
  '+{n} more festival': '+{n} festival más',
  '+{n} more festivals': '+{n} festivales más',
  'Bringing in your {service} library…': 'Trayendo tu biblioteca de {service}…',
  'Your map still uses your last import.': 'Tu mapa sigue usando tu última importación.',
  '{service} needs you to sign in again.': '{service} necesita que vuelvas a iniciar sesión.',
  'Couldn’t sync {service}.': 'No se pudo sincronizar {service}.',
  'Try again from Music connections.': 'Vuelve a intentarlo desde Conexiones de música.',
  'None of your {services} artists play Afterglow’s lineups yet, so your map grows from what you do here.':
    'Ninguno de tus artistas de {services} toca todavía en los carteles de Afterglow, así que tu mapa crece con lo que haces aquí.',
  'Only {n} of your {services} artists plays Afterglow’s lineups so far. React to clips to place more.':
    'Solo {n} de tus artistas de {services} toca en los carteles de Afterglow por ahora. Reacciona a clips para añadir más.',
  'Only {n} of your {services} artists play Afterglow’s lineups so far. React to clips to place more.':
    'Solo {n} de tus artistas de {services} tocan en los carteles de Afterglow por ahora. Reacciona a clips para añadir más.',
  'Connect {services} to start your map from what you already play.': 'Conecta {services} para empezar tu mapa con lo que ya escuchas.',

  Leave: 'Salir',
  'Your messages got through': 'Tus mensajes llegaron',

  "See {artist}'s festivals and shows on the map": 'Ver los festivales y shows de {artist} en el mapa',
  'Opens the event page on EDMTrain': 'Abre la página del evento en EDMTrain',
  'Show · {weekday}': 'Show · {weekday}',
  'See where': 'Ver dónde',
  'No festivals or shows with a place yet': 'Aún no hay festivales ni shows con lugar',
  'Show: {show}': 'Show: {show}',
  '{n} show': '{n} show',
  '{n} shows': '{n} shows',
  '{n} shows, in date order': '{n} shows, por fecha',
  'Glow level. {done} of {total} quests done today. {streak}-day streak. Opens your quests.':
    'Nivel de brillo. {done} de {total} misiones hechas hoy. Racha de {streak} días. Abre tus misiones.',
  'Glow level. {done} of {total} quests done today. Opens your quests.': 'Nivel de brillo. {done} de {total} misiones hechas hoy. Abre tus misiones.',

  // Tabs





  Discover: 'Descubrir',
  Festivals: 'Festivales',
  'My Sound': 'Mi sonido',
  Friends: 'Amigos',
  Profile: 'Perfil',
  Lineup: 'Cartel',
  '{tab}, new from your crew': '{tab}, novedades de tu grupo',
  'Hold to switch accounts': 'Mantén pulsado para cambiar de cuenta',
  'Switch account': 'Cambiar de cuenta',
  'Film a video': 'Grabar un video',
  'Hold to open Look after yourself': 'Mantén pulsado para abrir Cuídate',
  'Look after yourself': 'Cuídate',
  'Testing festival mode': 'Probando el modo festival',
  'Testing festival mode with {festival}. End the test': 'Probando el modo festival con {festival}. Terminar la prueba',

  // Pages that can't be found, and the crash page
  'See all festivals': 'Ver todos los festivales',
  'Page not found': 'Página no encontrada',
  'This link isn’t quite right, or the page has moved.': 'Este enlace no es del todo correcto, o la página se ha movido.',
  'Festival not found': 'Festival no encontrado',
  'This festival isn’t on Afterglow any more, or the link isn’t quite right.': 'Este festival ya no está en Afterglow, o el enlace no es del todo correcto.',
  'Artist not found': 'Artista no encontrado',
  'This artist isn’t on Afterglow any more, or the link isn’t quite right.': 'Este artista ya no está en Afterglow, o el enlace no es del todo correcto.',
  'Something went wrong': 'Algo salió mal',
  'This page tripped over a cable. Your plans, ratings and videos are safe on this phone.':
    'Esta página se tropezó con un cable. Tus planes, valoraciones y videos están a salvo en este teléfono.',
  'Go to Discover': 'Ir a Descubrir',
  'Tell us what happened': 'Cuéntanos qué pasó',

  // Signal
  'No signal · your plan, crew and lineups still work': 'Sin señal · tu plan, tu grupo y los carteles siguen funcionando',
  'Back online': 'Conectado de nuevo',

  // Dates and countdowns
  '{month} {day}': '{day} de {month}',
  '{month} {day1} to {day2}': '{day1} al {day2} de {month}',
  '{month1} {day1} to {month2} {day2}': '{day1} de {month1} al {day2} de {month2}',
  Over: 'Terminado',
  'Happening now': 'Ahora mismo',
  Tomorrow: 'Mañana',
  'In {n} days': 'En {n} días',
  'In {n} month': 'En {n} mes',
  'In {n} months': 'En {n} meses',
  'Weekend {w} tomorrow': 'Fin de semana {w} mañana',
  'Weekend {w} in {n} days': 'Fin de semana {w} en {n} días',
  Now: 'Ahora',
  happening: 'en marcha',
  'weekend {w}': 'fin de semana {w}',
  'day to weekend {w}': 'día para el fin de semana {w}',
  'days to weekend {w}': 'días para el fin de semana {w}',
  'months to go': 'meses',
  'day to go': 'día',
  'days to go': 'días',
  // Set days as the catalogue writes them
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo',

  // Welcome
  'Live sets from the lineups you’re going to': 'Sets en vivo de los carteles a los que vas',
  'Your sound as a living map': 'Tu sonido como un mapa vivo',
  'A plan, set to set, with your crew': 'Un plan, set a set, con tu grupo',
  'Skip the welcome': 'Saltar la bienvenida',
  'Find your sets, see your sound, go with your people.': 'Encuentra tus sets, mira tu sonido, ve con tu gente.',
  'Where are you going?': '¿A dónde vas?',
  'Pick any you have tickets for, or are thinking about. You can change this later.':
    'Elige los que tengas entradas o en los que estés pensando. Puedes cambiarlo después.',
  'Find your festival': 'Busca tu festival',
  'No festival matches “{query}” yet.': 'Ningún festival coincide con “{query}” todavía.',
  'Every weekend': 'Todos los fines de semana',
  'Every weekend of {festival}': 'Todos los fines de semana de {festival}',
  'Weekend {w}': 'Fin de semana {w}',
  'Weekend {w} of {festival}, {dates}': 'Fin de semana {w} de {festival}, {dates}',
  'Here’s what’s waiting': 'Esto es lo que te espera',
  '{festival}. A few things to make the most of it.': '{festival}. Algunas cosas para aprovecharlo al máximo.',
  'A few things to find once you’re in.': 'Algunas cosas que encontrarás al entrar.',
  'Tell us what you love': 'Cuéntanos qué te encanta',
  'Play this or that: two live sets at a time, tap the one you’d rather hear. A minute, and your sound takes shape. Or tap the artists you love.':
    'Juega a esto o aquello: dos sets en vivo a la vez, toca el que prefieras escuchar. En un minuto, tu sonido toma forma. O toca los artistas que te encantan.',
  'Tap the artists you love from your festivals. It takes seconds and shapes your whole plan. Or go through the lineup one artist at a time.':
    'Toca los artistas que te encantan de tus festivales. Toma segundos y da forma a todo tu plan. O recorre el cartel artista por artista.',
  'Tap the artists you love from {festival}. It takes seconds and shapes your whole plan. Or go through the lineup one artist at a time.':
    'Toca los artistas que te encantan de {festival}. Toma segundos y da forma a todo tu plan. O recorre el cartel artista por artista.',
  'Play this or that: two live sets at a time, tap the one you’d rather hear, and {app} learns your sound in a minute. Or tap the artists you love.':
    'Juega a esto o aquello: dos sets en vivo a la vez, toca el que prefieras escuchar y {app} aprende tu sonido en un minuto. O toca los artistas que te encantan.',
  'Tap the artists you love and {app} learns your sound. Or start with the sets: like, save or skip clips.':
    'Toca los artistas que te encantan y {app} aprende tu sonido. O empieza con los sets: dale me gusta, guarda o salta clips.',
  'Get started': 'Empezar',
  'Not sure yet': 'Aún no lo sé',
  'Play this or that': 'Jugar a esto o aquello',
  'Pick artists you know': 'Elegir artistas que conoces',
  'Rate the lineup one by one': 'Valorar el cartel uno por uno',
  'Start watching instead': 'Mejor empezar a ver',
  'Step {n} of {total}': 'Paso {n} de {total}',
  'Your first sprout': 'Tu primer brote',
  'It’s already in your garden. Give sprouts to people you meet at festivals, and watch yours grow.':
    'Ya está en tu jardín. Regala brotes a la gente que conozcas en festivales y mira cómo crece el tuyo.',
  'Three quests a day': 'Tres misiones al día',
  'Small things to try, a streak to keep and a glow level that grows. Find them in the ring at the top of Discover.':
    'Pequeñas cosas por probar, una racha que mantener y un nivel de brillo que crece. Encuéntralas en el anillo de arriba en Descubrir.',
  'Plan with your crew': 'Planea con tu grupo',
  'Share picks, check in and chat on the day. Messages wait for signal and keep the time you sent them.':
    'Comparte tus elecciones, avisa dónde estás y chatea el día del festival. Los mensajes esperan a que haya señal y guardan la hora en que los enviaste.',
  'A private page for festival nights: timers, water, how you feel and help close by. It’s in Settings, and stays on your device.':
    'Una página privada para las noches de festival: temporizadores, agua, cómo te sientes y ayuda cercana. Está en Ajustes y se queda en tu dispositivo.',
  'Hold the camera button for a private page: timers, water, how you feel and help close by. It stays on your phone.':
    'Mantén pulsado el botón de la cámara para abrir una página privada: temporizadores, agua, cómo te sientes y ayuda cercana. Se queda en tu teléfono.',

  // Settings
  Settings: 'Ajustes',
  Account: 'Cuenta',
  'Edit profile': 'Editar perfil',
  'Friends and crews': 'Amigos y grupos',
  'Find people': 'Buscar personas',
  'Or hold the Profile tab': 'O mantén pulsada la pestaña Perfil',
  'Finish your profile': 'Termina tu perfil',
  'Create your profile': 'Crea tu perfil',
  'Or sign in': 'O inicia sesión',
  Yours: 'Lo tuyo',
  Memories: 'Recuerdos',
  '{n}, by festival': '{n}, por festival',
  'Add your videos': 'Añade tus videos',
  'Memories, {n}': 'Recuerdos, {n}',
  'Saved and liked clips': 'Clips guardados y que te gustan',
  'Your clips, {n}': 'Tus clips, {n}',
  'Your garden': 'Tu jardín',
  'Your garden, {n} sprout': 'Tu jardín, {n} brote',
  'Your garden, {n} sprouts': 'Tu jardín, {n} brotes',
  'Artists you follow': 'Artistas que sigues',
  'Follow artists': 'Sigue artistas',
  'Your artists, {n}': 'Tus artistas, {n}',
  'Your artists, none followed yet': 'Tus artistas, aún no sigues a ninguno',
  'Your sound': 'Tu sonido',
  Breakdown: 'Desglose',
  'Your {year}': 'Tu {year}',
  'So far': 'Hasta ahora',
  'Ready to share': 'Listo para compartir',
  Look: 'Aspecto',
  'App theme': 'Tema de la app',
  'App theme: {theme}. Change the colours of the whole app': 'Tema de la app: {theme}. Cambia los colores de toda la app',
  'Profile background': 'Fondo del perfil',
  'Cover photo': 'Foto de portada',
  Language: 'Idioma',
  'Language: {language}. Change the language of the app': 'Idioma: {language}. Cambia el idioma de la app',
  '{language} (from your phone)': '{language} (de tu teléfono)',
  'Same as my phone': 'El de mi teléfono',
  'Couldn’t change the language': 'No se pudo cambiar el idioma',
  Fun: 'Diversión',
  Quests: 'Misiones',
  'Your glow level': 'Tu nivel de brillo',
  "Quests: today's quests, your streak and your glow level": 'Misiones: las misiones de hoy, tu racha y tu nivel de brillo',
  Secrets: 'Secretos',
  'All {total} secrets found': 'Los {total} secretos encontrados',
  '{found} of {total} secrets found': '{found} de {total} secretos encontrados',
  'Festival nights': 'Noches de festival',
  Private: 'Privado',
  'Look after yourself: stopwatches, water, food and check-ins, private to you': 'Cuídate: cronómetros, agua, comida y chequeos, solo para ti',
  'End festival mode test': 'Terminar la prueba del modo festival',
  'Leave festival mode': 'Salir del modo festival',
  'Test festival mode': 'Probar el modo festival',
  'End the festival mode test, {festival}': 'Terminar la prueba del modo festival, {festival}',
  'Leave festival mode, {festival}': 'Salir del modo festival, {festival}',
  'Test festival mode with {festival}: see how the app looks on festival day': 'Probar el modo festival con {festival}: mira cómo se ve la app el día del festival',
  Connections: 'Conexiones',
  'Music connections': 'Conexiones de música',
  'Not connected': 'Sin conectar',
  'Music connections, {services}': 'Conexiones de música, {services}',
  'Music connections, none connected': 'Conexiones de música, ninguna conectada',
  About: 'Acerca de',
  'Contact support': 'Contactar con soporte',
  '{n} new reply': '{n} respuesta nueva',
  '{n} new replies': '{n} respuestas nuevas',
  Privacy: 'Privacidad',
  Terms: 'Términos',
  'Community guidelines': 'Normas de la comunidad',
  'made with ten toes': 'hecho con diez dedos de los pies',
};
