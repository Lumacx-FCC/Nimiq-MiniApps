# Aeternum Voice Roleplay

MVP bilingüe de roleplay por voz construido con Next.js/Vinext. Incluye dos versiones de Kaelen Thorne, lip-sync con seis posiciones de boca, tres escenarios, dos atuendos, seis voces de Gemini, carga de hojas de personaje, generación real con GPT Image y almacenamiento opcional en Firebase.

## Configuración segura

No coloques claves privadas en componentes React ni uses prefijos `NEXT_PUBLIC_` para ellas.

1. Copia `.env.example` como `.env.local`.
2. Agrega estas variables exclusivamente del lado servidor:

```bash
GEMINI_API_KEY=...
OPENAI_API_KEY=...
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_PROFILE_MODEL=gpt-4.1-mini
```

`GEMINI_API_KEY` nunca llega al navegador. `/api/gemini-token` crea un token efímero de un solo uso para abrir Gemini Live directamente desde el cliente con baja latencia. `OPENAI_API_KEY` solamente se utiliza en `/api/generate-avatar`.

GPT Image puede requerir que la organización de OpenAI esté verificada. Se usa `gpt-image-2` por defecto; el prompt mantiene bloqueados la identidad, el encuadre y la pose entre las seis celdas del sprite.

## Firebase

En Firebase Console:

1. Habilita Authentication → Anonymous.
2. Crea Firestore y Cloud Storage.
3. Copia la configuración pública de la aplicación web en las variables `NEXT_PUBLIC_FIREBASE_*` de `.env.local`.
4. Ajusta el proyecto en `.firebaserc.example`, cópialo como `.firebaserc` y despliega las reglas:

```bash
firebase deploy --only firestore:rules,storage
```

Las reglas incluidas aíslan cada avatar bajo `users/{uid}`. Sin configuración Firebase, los avatares generados funcionan durante la sesión actual, pero no persisten después de recargar.

## Ejecutar

```bash
npm install
npm run dev
```

Abre la URL local mostrada en la terminal y permite el micrófono al iniciar el roleplay.

## Flujo técnico

- Entrada de micrófono: PCM 16-bit, mono, 16 kHz.
- Salida de Gemini: PCM 16-bit, 24 kHz.
- Modelo: `gemini-3.1-flash-live-preview`.
- Voces masculinas: Zubenelgenubi, Puck, Achird.
- Voces femeninas: Sulafat, Zephyr, Kore.
- Lip-sync: envolvente RMS suavizada + análisis espectral, histéresis y cambios limitados a 105 ms → seis posiciones del sprite.
- Generación: hoja de referencia → perfil de personaje + sprite 3×2 con fondo transparente mediante OpenAI.
- Créditos: simulados; desbloquear los cinco espacios adicionales cuesta 250 créditos.

## Verificación

```bash
npm run build
npm run lint
```

La prueba de voz usa la frase: “Hi there! What do you want to talk about today?”
