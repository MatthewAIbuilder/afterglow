import type { Dictionary } from '../translate';

/** Spanish for account (see `../es.ts` for the rules). */
export const es_account: Dictionary = {
  // Music connections
  'Start your map from the artists you already play. What you do in Afterglow still counts for more.':
    'Empieza tu mapa con los artistas que ya escuchas. Lo que haces en Afterglow sigue contando más.',
  'What Afterglow reads': 'Qué lee Afterglow',
  'The artists you follow, the songs you’ve saved and the artists you play most. From those it keeps only each artist’s name, how much you play them and their genres.':
    'Los artistas que sigues, las canciones que guardaste y los artistas que más escuchas. De ahí solo guarda el nombre de cada artista, cuánto lo escuchas y sus géneros.',
  'What it never keeps': 'Lo que nunca guarda',
  'Your password, your account details, your playlists or the songs themselves. The sign-in is kept in this phone’s secure storage and used only to read your library.':
    'Tu contraseña, los datos de tu cuenta, tus playlists o las canciones en sí. El inicio de sesión se guarda en el almacenamiento seguro de este teléfono y solo se usa para leer tu biblioteca.',
  'Private to you': 'Solo para ti',
  'Your library stays on this phone and is never shown to anyone. Disconnecting removes everything imported and forgets the sign-in.':
    'Tu biblioteca se queda en este teléfono y nunca se muestra a nadie. Al desconectar se borra todo lo importado y se olvida el inicio de sesión.',
  'Disconnect {service}?': '¿Desconectar {service}?',
  'Everything Afterglow imported from {service} is removed from this phone and the sign-in is forgotten. Your likes, saves and ratings stay.':
    'Todo lo que Afterglow importó de {service} se borra de este teléfono y se olvida el inicio de sesión. Tus me gusta, guardados y valoraciones se quedan.',
  'To also remove Afterglow from your Spotify account, visit spotify.com/account/apps.':
    'Para quitar también Afterglow de tu cuenta de Spotify, entra en spotify.com/account/apps.',
  'Disconnect & remove': 'Desconectar y borrar',
  '{action}, {service}': '{action}, {service}',
  'Disconnect {service} and remove imported music data': 'Desconectar {service} y borrar la música importada',
  'Disconnect & remove imported music data': 'Desconectar y borrar la música importada',

  // A service's card
  'just now': 'ahora mismo',
  yesterday: 'ayer',
  '{n} minute ago': 'hace {n} minuto',
  '{n} minutes ago': 'hace {n} minutos',
  '{n} hour ago': 'hace {n} hora',
  '{n} hours ago': 'hace {n} horas',
  'on {date}': 'el {date}',
  'Not available in this version of Afterglow yet.': 'Todavía no está disponible en esta versión de Afterglow.',
  'Needs the full version of Afterglow. It can’t connect in this preview.': 'Necesita la versión completa de Afterglow. No se puede conectar en esta vista previa.',
  'Not available on this device.': 'No está disponible en este dispositivo.',
  'saved songs': 'canciones guardadas',
  'followed artists': 'artistas que sigues',
  'top artists': 'artistas más escuchados',
  'recent listening': 'escuchas recientes',
  'Not available': 'No disponible',
  Connecting: 'Conectando',
  Connected: 'Conectado',
  Syncing: 'Sincronizando',
  Synced: 'Sincronizado',
  'Sign in again': 'Vuelve a iniciar sesión',
  'Sync failed': 'Error al sincronizar',
  '{service} didn’t connect: access wasn’t allowed. You can try again any time.':
    '{service} no se conectó: no se permitió el acceso. Puedes volver a intentarlo cuando quieras.',
  'Couldn’t reach {service}. Check your connection and try again.': 'No se pudo conectar con {service}. Revisa tu conexión y vuelve a intentarlo.',
  '{service} is busy right now. Try again in a few minutes.': '{service} está ocupado ahora mismo. Vuelve a intentarlo en unos minutos.',
  '{service} didn’t connect. Try again.': '{service} no se conectó. Vuelve a intentarlo.',
  'Last synced': 'Última sincronización',
  'artist analyzed': 'artista analizado',
  'artists analyzed': 'artistas analizados',
  'on upcoming festivals': 'en próximos festivales',
  'Your {service} library had no saved songs, followed artists or top artists to read yet.':
    'Tu biblioteca de {service} todavía no tenía canciones guardadas, artistas seguidos ni artistas más escuchados que leer.',
  'None of these artists play Afterglow’s lineups yet, so your map grows from what you do here.':
    'Ninguno de estos artistas toca todavía en los carteles de Afterglow, así que tu mapa crece con lo que haces aquí.',
  '{service} didn’t share your {parts} this time, so this uses the rest.': '{service} no compartió tus {parts} esta vez, así que se usa el resto.',
  'Your last import is still used until you disconnect.': 'Se sigue usando tu última importación hasta que desconectes.',
  'Your last import is still used.': 'Se sigue usando tu última importación.',
  'Start your map from the artists you already play.': 'Empieza tu mapa con los artistas que ya escuchas.',
  'Connect {service}': 'Conectar {service}',
  'Connecting to {service}…': 'Conectando con {service}…',
  'Finish signing in on {service}’s page.': 'Termina de iniciar sesión en la página de {service}.',
  'Connected to {service}': 'Conectado a {service}',
  'Ready to bring in your library.': 'Listo para traer tu biblioteca.',
  'Sync now': 'Sincronizar ahora',
  'Syncing your library…': 'Sincronizando tu biblioteca…',
  'Reading your library…': 'Leyendo tu biblioteca…',
  'This takes a few seconds.': 'Tarda unos segundos.',
  '{service} didn’t allow access': '{service} no permitió el acceso',
  '{service} needs you to sign in again': '{service} necesita que vuelvas a iniciar sesión',
  'Sign in again to allow Afterglow to read your library.': 'Vuelve a iniciar sesión para que Afterglow pueda leer tu biblioteca.',
  'Access ended or was removed.': 'El acceso terminó o se quitó.',
  'Something went wrong reading your library. Try again.': 'Algo salió mal al leer tu biblioteca. Vuelve a intentarlo.',
  'Couldn’t sync your library': 'No se pudo sincronizar tu biblioteca',

  // Contact support
  'I need help': 'Necesito ayuda',
  'Something’s broken': 'Algo no funciona',
  'An idea': 'Una idea',
  'A festival': 'Un festival',
  'Couldn’t send it': 'No se pudo enviar',
  'Check the signal and try again, or email {email}.': 'Revisa la señal y vuelve a intentarlo, o escribe a {email}.',
  'A question, something broken, an idea, a festival we should add: tell us. A real person reads every message and replies here.':
    'Una pregunta, algo que no funciona, una idea, un festival que deberíamos añadir: cuéntanos. Una persona real lee cada mensaje y responde aquí.',
  'What’s up?': '¿Qué pasa?',
  'Your message to support': 'Tu mensaje para soporte',
  'Sent. We’ll reply here, usually within a day or two.': 'Enviado. Te responderemos aquí, normalmente en uno o dos días.',
  'We’ll see your name, @handle and sign-in email with it, so we can write back.':
    'Veremos tu nombre, tu @nombre de usuario y el correo con el que inicias sesión, para poder responderte.',
  'Your messages': 'Tus mensajes',
  'Afterglow support': 'Soporte de Afterglow',
  Closed: 'Cerrado',
  'Waiting for a reply': 'Esperando respuesta',
  'Sign in to send a message and see replies here, or email us.': 'Inicia sesión para enviar un mensaje y ver las respuestas aquí, o escríbenos por correo.',
  'Email {email}': 'Escribir a {email}',
  'Email us': 'Escríbenos',

  // Legal pages' frame
  'Last updated {date}': 'Última actualización: {date}',
  'This page is only in English for now.': 'Por ahora esta página solo está en inglés.',

  // Sharing and the calendar
  'Your lineup and plan: {url}': 'Tu cartel y tu plan: {url}',
  Copied: 'Copiado',
  'Paste it wherever you like.': 'Pégalo donde quieras.',
  'Couldn’t make the picture': 'No se pudo crear la imagen',
  'Try again, or share it as text.': 'Vuelve a intentarlo, o compártelo como texto.',
  'Your picture is ready': 'Tu imagen está lista',
  'Picture saved': 'Imagen guardada',
  'It’s in your downloads, ready to post or send.': 'Está en tus descargas, lista para publicar o enviar.',

  // Loose ends across shared screens
  'Hold for Look after yourself': 'Mantén pulsado para Cuídate',
  'Other nights': 'Otras noches',
  'In {year}': 'En {year}',
  'Questions or problems: {email}': '¿Dudas o problemas? {email}',
  // The guidelines as shown when creating a profile (the legal page keeps them in English)
  'Share only videos you filmed yourself.': 'Comparte solo videos que hayas grabado tú.',
  'Keep it friendly: no hate, harassment, threats or explicit content.': 'Sé amable: nada de odio, acoso, amenazas ni contenido explícito.',
  'No spam, and don’t pretend to be someone else.': 'Nada de spam, y no te hagas pasar por otra persona.',
  'Report anything that breaks these, and block anyone you don’t want to see. Reports are reviewed, and accounts that break the guidelines are removed.':
    'Denuncia todo lo que no cumpla estas normas y bloquea a quien no quieras ver. Revisamos las denuncias y eliminamos las cuentas que no cumplen las normas.',
  // Sign in with Apple and with Google.
  'There’s already an Afterglow account with that email. Sign in with your email and password.': 'Ya hay una cuenta de Afterglow con ese correo. Inicia sesión con tu correo y contraseña.',
  'Sign-in was cancelled.': 'Se canceló el inicio de sesión.',
  'Continue with Apple': 'Continuar con Apple',
  'Continue with Google': 'Continuar con Google',
  'Confirm with Apple': 'Confirmar con Apple',
  'Confirm with Google': 'Confirmar con Google',
  'Couldn’t open the sign-in. Check your connection and try again.': 'No se pudo abrir el inicio de sesión. Revisa tu conexión e inténtalo de nuevo.',
  'By continuing with Apple or Google you confirm you’re 18 or older and agree to the community guidelines, Terms and Privacy Policy.':
    'Al continuar con Apple o Google confirmas que tienes 18 años o más y que aceptas las normas de la comunidad, los Términos y la Política de privacidad.',
  'or with email': 'o con correo',
  'This deletes your profile, everything you shared and your account, for good. Memories on this phone stay. Confirm with Apple to delete it.':
    'Esto borra tu perfil, todo lo que compartiste y tu cuenta, para siempre. Los recuerdos de este teléfono se quedan. Confirma con Apple para borrarla.',
  'This deletes your profile, everything you shared and your account, for good. Memories on this phone stay. Confirm with Google to delete it.':
    'Esto borra tu perfil, todo lo que compartiste y tu cuenta, para siempre. Los recuerdos de este teléfono se quedan. Confirma con Google para borrarla.',
  'Delete it from Afterglow on your iPhone, where you can confirm with Apple.': 'Bórrala desde Afterglow en tu iPhone, donde puedes confirmar con Apple.',
  'Delete it from Afterglow where you signed in with Google.': 'Bórrala desde Afterglow donde iniciaste sesión con Google.',
  // Feedback from any page.
  'Spotted a problem, or got an idea?': '¿Has visto un problema, o tienes una idea?',
  'Report a problem on this page': 'Informa de un problema en esta página',
  'Report a problem': 'Informar de un problema',
  'Something not working?': '¿Algo no funciona?',
  'A problem': 'Un problema',
  'Share an idea for this page': 'Comparte una idea para esta página',
  'Share an idea': 'Comparte una idea',
  'Got an idea?': '¿Tienes una idea?',
  'Tell us what happened, or what looks wrong. We’ll know which page you were on.': 'Cuéntanos qué pasó o qué se ve mal. Sabremos en qué página estabas.',
  'Anything that would make Afterglow better, big or small. We’ll know which page you were on.': 'Cualquier cosa que mejore Afterglow, grande o pequeña. Sabremos en qué página estabas.',
  'Thank you!': '¡Gracias!',
  'A real person reads every one. If we reply, you’ll find it in Settings → Contact support.': 'Una persona de verdad lee cada mensaje. Si te respondemos, lo verás en Ajustes → Contactar con soporte.',
  'Send another': 'Enviar otro',
  'What happened?': '¿Qué pasó?',
  'Your idea': 'Tu idea',
  'Sign in to send it here, or email us. Both reach a real person.': 'Inicia sesión para enviarlo aquí, o escríbenos un correo. Las dos cosas llegan a una persona de verdad.',
};
