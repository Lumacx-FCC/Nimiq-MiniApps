"use client";

import {
  Check,
  ChevronDown,
  Coins,
  CreditCard,
  BookOpen,
  Image as ImageIcon,
  ArrowLeft,
  Languages,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  Play,
  Plus,
  Package,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";
import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveServerMessage, Session } from "@google/genai";
import type { AvatarProfile, ChatMessage, Locale, VoiceName } from "@/lib/types";

const TEST_PHRASE = "Hi there! What do you want to talk about today?";
const LIVE_MODEL = "gemini-3.1-flash-live-preview";
const IMAGE_GENERATION_CREDITS = 3;
const FIREBASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
);

const BUILT_IN_AVATARS: AvatarProfile[] = [
  {
    id: "kaelen-female",
    name: "Kaelen Thorne",
    alias: "Juniper",
    gender: "female",
    summary: {
      en: "A dark-elf warder-scholar who carries ancient knowledge with measured precision.",
      es: "Una elfa oscura, guardiana y erudita, que carga conocimiento antiguo con precisión serena.",
    },
    systemPrompt: `You are Kaelen Thorne, called Juniper: a dark-elf warder-scholar, scout, loremaster and ritualist. You are stoic, vigilant, protective and quietly haunted by choices that cannot be undone. Speak with measured precision and restrained warmth. Scan a situation before answering, treat ancient knowledge as a burden, and reveal lore through natural conversation rather than exposition. Remain fully in character. Keep spoken answers vivid and usually under 90 words unless asked for detail.`,
    outfits: [
      { id: "adventurer", label: { en: "Warder", es: "Guardiana" }, spriteUrl: "/avatars/kaelen-female.webp" },
      { id: "ceremonial", label: { en: "Ceremonial", es: "Ceremonial" }, spriteUrl: "/avatars/kaelen-female-ceremonial.webp" },
    ],
  },
  {
    id: "kaelen-male",
    name: "Kaelen Thorne",
    alias: "Juniper",
    gender: "male",
    summary: {
      en: "A northern protector marked by forbidden runes and the weight of duty.",
      es: "Un protector del norte marcado por runas prohibidas y el peso del deber.",
    },
    systemPrompt: `You are Kaelen Thorne, called Juniper: a northern clan protector who turned to forbidden runic magic to save his people from extinction. You are stoic, burdened by duty, observant and fiercely protective. Speak little but with weight. Your humor is dry and rare. You carry the cost of forbidden knowledge in your voice and never boast about your power. Remain fully in character. Keep spoken answers cinematic and usually under 90 words unless asked for detail.`,
    outfits: [
      { id: "adventurer", label: { en: "Warder", es: "Guardián" }, spriteUrl: "/avatars/kaelen-male.webp" },
      { id: "ceremonial", label: { en: "Ceremonial", es: "Ceremonial" }, spriteUrl: "/avatars/kaelen-male-ceremonial.webp" },
    ],
  },
];

const BACKGROUNDS = [
  { id: "forest", label: { en: "Rune forest", es: "Bosque rúnico" }, url: "/backgrounds/forest.webp" },
  { id: "tavern", label: { en: "Ember tavern", es: "Taberna de brasas" }, url: "/backgrounds/tavern.webp" },
  { id: "ruins", label: { en: "Lost archive", es: "Archivo perdido" }, url: "/backgrounds/ruins.webp" },
];

const VOICES: Array<{ name: VoiceName; gender: "male" | "female"; tone: { en: string; es: string } }> = [
  { name: "Zubenelgenubi", gender: "male", tone: { en: "Deep & grounded", es: "Profunda y firme" } },
  { name: "Puck", gender: "male", tone: { en: "Bright & playful", es: "Brillante y juguetona" } },
  { name: "Achird", gender: "male", tone: { en: "Warm & steady", es: "Cálida y serena" } },
  { name: "Sulafat", gender: "female", tone: { en: "Rich & composed", es: "Rica y serena" } },
  { name: "Zephyr", gender: "female", tone: { en: "Airy & expressive", es: "Ligera y expresiva" } },
  { name: "Kore", gender: "female", tone: { en: "Clear & confident", es: "Clara y segura" } },
];

const COPY = {
  en: {
    studio: "ROLEPLAY STUDIO",
    characters: "Characters",
    freeSlots: "Free custom slots",
    addCharacter: "Add character",
    unlock: "Unlock 5 more slots",
    credits: "credits",
    outfit: "Outfit",
    scene: "Scene",
    talkingWith: "Talking with",
    character: "Character",
    voice: "Voice",
    characterBackground: "Character Background",
    testVoice: "Test voice",
    live: "Begin roleplay",
    end: "End session",
    ready: "Ready",
    listening: "Listening",
    speaking: "Speaking",
    connecting: "Opening the veil…",
    chat: "Conversation",
    placeholder: "Say something to begin the story…",
    send: "Send",
    uploadTitle: "Create a talking avatar",
    uploadHelp: "Upload a PNG, JPG or WEBP character reference sheet. GPT Image will create six mouth positions and the profile will shape the roleplay personality.",
    spriteSubject: "Sprite subject",
    humanSubject: "Human",
    objectSubject: "Object",
    humanSubjectHelp: "Realistic humanoid avatar",
    objectSubjectHelp: "Stylized animated object",
    characterName: "Character name",
    chooseFile: "Choose reference sheet",
    generate: "Generate talking sprite",
    generating: "Reading the sheet and forging the sprite…",
    storedFirebase: "Stored securely with Firebase",
    storedSession: "Available in this session",
    apiNeeded: "Add your API keys to enable real generation.",
    demo: "Demo mode",
    demoHelp: "Add server secrets to activate Gemini Live and GPT Image.",
    remove: "Remove avatar",
    empty: "Empty slot",
    cancel: "Cancel",
    unlocked: "Five avatar slots unlocked",
    insufficient: "Not enough simulated credits",
    conversationTime: "Conversation",
    useCredits: "Use Credits",
    backToHub: "Back to Hub",
    setAvatarWidget: "Set as Avatar Widget",
    avatarWidgetSaved: "Avatar widget defaults saved",
    noCredits: "You need credits to continue the conversation",
    addCredits: "Add more credits",
    logIn: "Log in",
    loggedIn: "Signed in",
    loginToUnlock: "Log in to unlock custom avatars",
    customLocked: "Sign in required",
    paymentTitle: "Add more credits",
    paymentHelp: "Payment checkout placeholder — select a pack to simulate a top-up.",
    simulateCheckout: "Simulate checkout",
    loginTitle: "Welcome to Aeternum",
    loginHelp: "Sign-in is a placeholder for the upcoming authentication module.",
    continueGoogle: "Continue with Google",
    continueFacebook: "Continue with Facebook",
    continueEmail: "Continue with email",
    imageCost: "3 credits used for sprite generation",
    insufficientImageCredits: "You need 3 credits to generate a talking sprite",
  },
  es: {
    studio: "ESTUDIO DE ROLEPLAY",
    characters: "Personajes",
    freeSlots: "Espacios personalizados gratuitos",
    addCharacter: "Agregar personaje",
    unlock: "Desbloquear 5 espacios",
    credits: "créditos",
    outfit: "Atuendo",
    scene: "Escena",
    talkingWith: "Conversando con",
    character: "Personaje",
    voice: "Voz",
    characterBackground: "Trasfondo del personaje",
    testVoice: "Probar voz",
    live: "Iniciar roleplay",
    end: "Terminar sesión",
    ready: "Listo",
    listening: "Escuchando",
    speaking: "Hablando",
    connecting: "Abriendo el velo…",
    chat: "Conversación",
    placeholder: "Di algo para comenzar la historia…",
    send: "Enviar",
    uploadTitle: "Crear un avatar parlante",
    uploadHelp: "Sube una hoja de referencia PNG, JPG o WEBP. GPT Image creará seis posiciones de boca y el perfil definirá la personalidad del roleplay.",
    spriteSubject: "Tipo de sprite",
    humanSubject: "Humano",
    objectSubject: "Objeto",
    humanSubjectHelp: "Avatar humano realista",
    objectSubjectHelp: "Objeto animado estilizado",
    characterName: "Nombre del personaje",
    chooseFile: "Elegir hoja de referencia",
    generate: "Generar sprite parlante",
    generating: "Leyendo la hoja y forjando el sprite…",
    storedFirebase: "Guardado de forma segura con Firebase",
    storedSession: "Disponible durante esta sesión",
    apiNeeded: "Agrega tus API keys para habilitar la generación real.",
    demo: "Modo demostración",
    demoHelp: "Agrega los secretos del servidor para activar Gemini Live y GPT Image.",
    remove: "Eliminar avatar",
    empty: "Espacio vacío",
    cancel: "Cancelar",
    unlocked: "Cinco espacios de avatar desbloqueados",
    insufficient: "No tienes suficientes créditos simulados",
    conversationTime: "Conversación",
    useCredits: "Créditos usados",
    backToHub: "Volver al Hub",
    setAvatarWidget: "Definir como Avatar Widget",
    avatarWidgetSaved: "Preferencias del Avatar Widget guardadas",
    noCredits: "Necesitas créditos para continuar la conversación",
    addCredits: "Agregar créditos",
    logIn: "Iniciar sesión",
    loggedIn: "Sesión iniciada",
    loginToUnlock: "Inicia sesión para desbloquear avatares personalizados",
    customLocked: "Inicio de sesión requerido",
    paymentTitle: "Agregar créditos",
    paymentHelp: "Checkout de pago temporal: selecciona un paquete para simular una recarga.",
    simulateCheckout: "Simular checkout",
    loginTitle: "Bienvenido a Aeternum",
    loginHelp: "El inicio de sesión es un placeholder para el próximo módulo de autenticación.",
    continueGoogle: "Continuar con Google",
    continueFacebook: "Continuar con Facebook",
    continueEmail: "Continuar con email",
    imageCost: "3 créditos usados para generar el sprite",
    insufficientImageCredits: "Necesitas 3 créditos para generar un sprite parlante",
  },
} as const;

type LiveState = "idle" | "connecting" | "listening" | "speaking";
type SpriteSubject = "human" | "object";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const stride = 0x8000;
  for (let i = 0; i < bytes.length; i += stride) {
    binary += String.fromCharCode(...bytes.subarray(i, i + stride));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function downsampleToPcm16(input: Float32Array, inputRate: number, outputRate = 16000) {
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const result = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j];
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return new Uint8Array(result.buffer);
}

function dataUrlToBlob(dataUrl: string) {
  const [header, payload] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "image/png";
  return new Blob([base64ToBytes(payload)], { type: mime });
}

async function optimizeReferenceImage(file: File) {
  const maxBytes = 700 * 1024;
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  let width = Math.min(bitmap.width, 1600);
  let height = Math.round(bitmap.height * (width / bitmap.width));
  let quality = 0.86;
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image optimization is not available in this browser");
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not optimize image")), "image/webp", quality);
      });
      if (blob.size <= maxBytes || attempt === 3) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "reference"}.webp`, { type: "image/webp" });
      }
      width = Math.max(720, Math.round(width * 0.8));
      height = Math.max(720, Math.round(height * 0.8));
      quality = Math.max(0.64, quality - 0.08);
    }
  } finally {
    bitmap.close();
  }
  return file;
}

async function removeChromaGreen(dataUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not prepare generated sprite"));
    element.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Transparency processing is not available in this browser");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const greenDominance = green - Math.max(red, blue);
    // The generation prompt reserves pure chroma green for the matte; teal magical accents retain blue and stay visible.
    if (green > 150 && red < 95 && blue < 95 && greenDominance > 100) {
      pixels.data[index + 3] = 0;
    } else if (green > 125 && red < 120 && blue < 120 && greenDominance > 65) {
      const edgeAlpha = Math.max(0, Math.min(255, Math.round((150 - greenDominance) * 3)));
      pixels.data[index + 3] = Math.min(pixels.data[index + 3], edgeAlpha);
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function SpriteAvatar({ spriteUrl, frame, speaking }: { spriteUrl: string; frame: number; speaking: boolean }) {
  const col = frame % 3;
  const row = Math.floor(frame / 3);
  return (
    <div className={`sprite-shell ${speaking ? "is-speaking" : ""}`}>
      <div
        className="sprite-frame"
        aria-label="Animated character portrait"
        style={{
          backgroundImage: `url("${spriteUrl}")`,
          backgroundSize: "300% 200%",
          backgroundPosition: `${col * 50}% ${row * 100}%`,
        }}
      />
    </div>
  );
}

export default function RoleplayStudio() {
  const [locale, setLocale] = useState<Locale>("en");
  const [customAvatars, setCustomAvatars] = useState<AvatarProfile[]>([]);
  const [activeId, setActiveId] = useState(BUILT_IN_AVATARS[0].id);
  const [outfitId, setOutfitId] = useState("adventurer");
  const [backgroundId, setBackgroundId] = useState("forest");
  const [voice, setVoice] = useState<VoiceName>("Sulafat");
  const [liveState, setLiveState] = useState<LiveState>("idle");
  const [mouthFrame, setMouthFrame] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [credits, setCredits] = useState(500);
  const [conversationSeconds, setConversationSeconds] = useState(0);
  const [usageCredits, setUsageCredits] = useState(0);
  const [widgetSaved, setWidgetSaved] = useState(false);
  const [hubUrl, setHubUrl] = useState("https://www.narratum.app");
  const [extraUnlocked, setExtraUnlocked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadSubject, setUploadSubject] = useState<SpriteSubject>("human");
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [creditPack, setCreditPack] = useState(50);

  const sessionRef = useRef<Session | null>(null);
  const previewOnlyRef = useRef(false);
  const inputContextRef = useRef<AudioContext | null>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const inputProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputCursorRef = useRef(0);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mouthAnimationRef = useRef<number | null>(null);
  const transcriptRef = useRef("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const creditsRef = useRef(500);
  const userSpeechUntilRef = useRef(0);
  const modelSpeechUntilRef = useRef(0);
  const usageMillisecondsRef = useRef(0);
  const billedUsageCreditsRef = useRef(0);

  const t = COPY[locale];
  const allAvatars = useMemo(() => [...BUILT_IN_AVATARS, ...customAvatars], [customAvatars]);
  const activeAvatar = allAvatars.find((item) => item.id === activeId) || BUILT_IN_AVATARS[0];
  const activeOutfit = activeAvatar.outfits.find((item) => item.id === outfitId) || activeAvatar.outfits[0];
  const activeBackground = BACKGROUNDS.find((item) => item.id === backgroundId) || BACKGROUNDS[0];
  const customSlotCount = extraUnlocked ? 8 : 3;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedUnlock = localStorage.getItem("aeternum-extra-slots") === "true";
      const savedLogin = localStorage.getItem("aeternum-demo-login") === "true";
      const storedCredits = localStorage.getItem("aeternum-demo-credits");
      const savedCredits = storedCredits === null ? 500 : Number(storedCredits);
      setExtraUnlocked(savedUnlock);
      setIsLoggedIn(savedLogin);
      if (Number.isFinite(savedCredits) && savedCredits >= 0) {
        creditsRef.current = savedCredits;
        setCredits(savedCredits);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let previousTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(1000, now - previousTick);
      previousTick = now;
      const interactionActive = now < userSpeechUntilRef.current || now < modelSpeechUntilRef.current;
      if (!interactionActive || creditsRef.current <= 0) return;

      usageMillisecondsRef.current += elapsed;
      const elapsedSeconds = Math.floor(usageMillisecondsRef.current / 1000);
      setConversationSeconds((current) => current === elapsedSeconds ? current : elapsedSeconds);

      const requiredCredits = Math.ceil(usageMillisecondsRef.current / 60000);
      if (requiredCredits > billedUsageCreditsRef.current) {
        const charge = requiredCredits - billedUsageCreditsRef.current;
        billedUsageCreditsRef.current = requiredCredits;
        setUsageCredits(requiredCredits);
        setCredits((current) => {
          const next = Math.max(0, current - charge);
          creditsRef.current = next;
          localStorage.setItem("aeternum-demo-credits", String(next));
          return next;
        });
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const flash = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 4200);
  }, []);

  const resetUsage = useCallback(() => {
    usageMillisecondsRef.current = 0;
    billedUsageCreditsRef.current = 0;
    userSpeechUntilRef.current = 0;
    modelSpeechUntilRef.current = 0;
    setConversationSeconds(0);
    setUsageCredits(0);
  }, []);

  const stopMouthAnimation = useCallback(() => {
    if (mouthAnimationRef.current) cancelAnimationFrame(mouthAnimationRef.current);
    mouthAnimationRef.current = null;
    setMouthFrame(0);
  }, []);

  const startMouthAnimation = useCallback(() => {
    const analyser = outputAnalyserRef.current;
    if (!analyser) return;
    const samples = new Uint8Array(analyser.fftSize);
    const frequencies = new Uint8Array(analyser.frequencyBinCount);
    let displayedFrame = 0;
    let smoothedRms = 0;
    let lastUpdate = 0;
    const tick = (timestamp: number) => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / samples.length);
      const smoothing = rms > smoothedRms ? 0.42 : 0.16;
      smoothedRms += (rms - smoothedRms) * smoothing;

      if (timestamp - lastUpdate >= 105) {
        analyser.getByteFrequencyData(frequencies);
        const averageBand = (start: number, end: number) => {
          let total = 0;
          for (let index = start; index < end; index += 1) total += frequencies[index] || 0;
          return total / Math.max(1, end - start);
        };
        const lowBand = averageBand(1, 7);
        const midBand = averageBand(7, 18);
        let target = smoothedRms < 0.016 ? 0 : smoothedRms < 0.042 ? 1 : smoothedRms < 0.082 ? 2 : 3;

        // Rounded vowels carry more low-frequency energy; use the O frame sparingly.
        if (target >= 2 && lowBand > midBand * 1.22) target = 4;

        let next = target;
        if (target !== 4 && displayedFrame !== 4) {
          if (target > displayedFrame + 1) next = displayedFrame + 1;
          if (target < displayedFrame - 1) next = displayedFrame - 1;
        }
        if (next !== displayedFrame) {
          setMouthFrame(next);
          displayedFrame = next;
        }
        lastUpdate = timestamp;
      }
      mouthAnimationRef.current = requestAnimationFrame(tick);
    };
    mouthAnimationRef.current = requestAnimationFrame(tick);
  }, []);

  const clearOutput = useCallback(() => {
    outputSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch { /* already stopped */ }
    });
    outputSourcesRef.current.clear();
    outputCursorRef.current = 0;
    modelSpeechUntilRef.current = 0;
    stopMouthAnimation();
  }, [stopMouthAnimation]);

  const playPcm = useCallback(async (base64: string) => {
    let context = outputContextRef.current;
    if (!context) {
      context = new AudioContext({ sampleRate: 24000 });
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      analyser.connect(context.destination);
      outputContextRef.current = context;
      outputAnalyserRef.current = analyser;
    }
    if (context.state === "suspended") await context.resume();
    if (!mouthAnimationRef.current) startMouthAnimation();
    const bytes = base64ToBytes(base64);
    const aligned = bytes.byteLength % 2 === 0 ? bytes : bytes.slice(0, -1);
    const pcm = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 2);
    const audioBuffer = context.createBuffer(1, pcm.length, 24000);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 32768;
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outputAnalyserRef.current!);
    const startAt = Math.max(context.currentTime + 0.02, outputCursorRef.current);
    source.start(startAt);
    setLiveState("speaking");
    outputCursorRef.current = startAt + audioBuffer.duration;
    modelSpeechUntilRef.current = performance.now() + Math.max(0, (outputCursorRef.current - context.currentTime) * 1000);
    outputSourcesRef.current.add(source);
    source.onended = () => {
      outputSourcesRef.current.delete(source);
      if (!outputSourcesRef.current.size) {
        setLiveState((state) => state === "idle" ? state : "listening");
        setMouthFrame(0);
      }
    };
  }, [startMouthAnimation]);

  const stopInput = useCallback(async () => {
    inputProcessorRef.current?.disconnect();
    inputProcessorRef.current = null;
    inputStreamRef.current?.getTracks().forEach((track) => track.stop());
    inputStreamRef.current = null;
    userSpeechUntilRef.current = 0;
    if (inputContextRef.current) await inputContextRef.current.close().catch(() => undefined);
    inputContextRef.current = null;
  }, []);

  const stopSession = useCallback(async () => {
    await stopInput();
    clearOutput();
    try { sessionRef.current?.close(); } catch { /* session already closed */ }
    sessionRef.current = null;
    previewOnlyRef.current = false;
    setLiveState("idle");
  }, [clearOutput, stopInput]);

  useEffect(() => () => {
    inputStreamRef.current?.getTracks().forEach((track) => track.stop());
    try { sessionRef.current?.close(); } catch { /* no-op */ }
    if (mouthAnimationRef.current) cancelAnimationFrame(mouthAnimationRef.current);
  }, []);

  const startMicrophone = useCallback(async (session: Session) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      if (!sessionRef.current) return;
      const input = event.inputBuffer.getChannelData(0);
      let energy = 0;
      for (const sample of input) energy += sample * sample;
      if (Math.sqrt(energy / input.length) > 0.026) {
        userSpeechUntilRef.current = performance.now() + 280;
      }
      const pcm = downsampleToPcm16(input, context.sampleRate);
      session.sendRealtimeInput({ audio: { data: bytesToBase64(pcm), mimeType: "audio/pcm;rate=16000" } });
    };
    source.connect(processor);
    processor.connect(context.destination);
    inputStreamRef.current = stream;
    inputContextRef.current = context;
    inputProcessorRef.current = processor;
  }, []);

  const browserVoiceFallback = useCallback((phrase: string) => {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = locale === "es" ? "es-ES" : "en-US";
    const desiredGender = VOICES.find((item) => item.name === voice)?.gender;
    const voices = window.speechSynthesis.getVoices().filter((item) => item.lang.startsWith(locale));
    utterance.voice = voices.find((item) => desiredGender === "female" ? /female|samantha|zira|aria/i.test(item.name) : /male|david|mark|daniel/i.test(item.name)) || voices[0] || null;
    utterance.onstart = () => {
      modelSpeechUntilRef.current = performance.now() + Math.max(1200, phrase.length * 55);
      setLiveState("speaking");
      startMouthAnimation();
    };
    utterance.onend = () => { modelSpeechUntilRef.current = 0; setLiveState("idle"); setMouthFrame(0); };
    const gentleSequence = [1, 2, 1, 3, 2, 1, 4, 1];
    let sequenceIndex = 0;
    const fake = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) return window.clearInterval(fake);
      setMouthFrame(gentleSequence[sequenceIndex]);
      sequenceIndex = (sequenceIndex + 1) % gentleSequence.length;
    }, 120);
    window.speechSynthesis.speak(utterance);
  }, [locale, startMouthAnimation, voice]);

  const openSession = useCallback(async (withMic: boolean, previewOnly = false) => {
    setLiveState("connecting");
    previewOnlyRef.current = previewOnly;
    try {
      const tokenResponse = await fetch("/api/gemini-token", { method: "POST" });
      const tokenResult = await tokenResponse.json() as { token?: string; error?: string; demo?: boolean };
      if (!tokenResponse.ok || !tokenResult.token) throw new Error(tokenResult.error || "Live API unavailable");
      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: tokenResult.token, httpOptions: { apiVersion: "v1beta" } });
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => setLiveState(withMic ? "listening" : "speaking"),
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.interrupted) clearOutput();
            const parts = content?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                setLiveState("speaking");
                void playPcm(part.inlineData.data);
              }
            }
            const outputText = content?.outputTranscription?.text;
            if (outputText) {
              transcriptRef.current += outputText;
              const text = transcriptRef.current;
              setMessages((current) => {
                const last = current.at(-1);
                if (last?.id === "live-transcript") return [...current.slice(0, -1), { ...last, text }];
                return [...current, { id: "live-transcript", role: "avatar", text }];
              });
            }
            if (content?.turnComplete) {
              setMessages((current) => current.map((item) => item.id === "live-transcript" ? { ...item, id: makeId() } : item));
              transcriptRef.current = "";
              if (previewOnlyRef.current) window.setTimeout(() => void stopSession(), 500);
              else window.setTimeout(() => {
                setLiveState((state) => state === "idle" ? state : outputSourcesRef.current.size ? "speaking" : "listening");
              }, 25);
            }
          },
          onerror: (error: ErrorEvent) => {
            flash(error.message || "Gemini Live connection error");
            void stopSession();
          },
          onclose: () => {
            if (!previewOnlyRef.current) setLiveState("idle");
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
          systemInstruction: { parts: [{ text: `${activeAvatar.systemPrompt}\nThe interface language is ${locale === "es" ? "Spanish" : "English"}. Answer in the user's language.` }] },
        },
      });
      sessionRef.current = session;
      if (withMic) await startMicrophone(session);
      return session;
    } catch (error) {
      setLiveState("idle");
      const message = error instanceof Error ? error.message : "Unable to connect";
      flash(`${t.demo}: ${message}`);
      return null;
    }
  }, [activeAvatar.systemPrompt, clearOutput, flash, locale, playPcm, startMicrophone, stopSession, t.demo, voice]);

  const previewVoice = async () => {
    if (liveState !== "idle") await stopSession();
    const session = await openSession(false, true);
    if (session) session.sendRealtimeInput({ text: `Say exactly this phrase and nothing else: ${TEST_PHRASE}` });
    else browserVoiceFallback(TEST_PHRASE);
  };

  const toggleLive = async () => {
    if (liveState !== "idle") return void stopSession();
    if (creditsRef.current <= 0) return flash(t.noCredits);
    await openSession(true, false);
  };

  const sendText = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMessages((current) => [...current, { id: makeId(), role: "user", text }]);
    let session = sessionRef.current;
    if (!session) session = await openSession(false, false);
    if (session) session.sendRealtimeInput({ text });
    else {
      const fallback = locale === "es"
        ? `${activeAvatar.alias} inclina la cabeza. “Te escucho. Cuando conectes la llave de Gemini, mi voz cruzará el velo.”`
        : `${activeAvatar.alias} inclines their head. “I hear you. Once the Gemini key is connected, my voice will cross the veil.”`;
      setMessages((current) => [...current, { id: makeId(), role: "avatar", text: fallback }]);
      browserVoiceFallback(fallback);
    }
  };

  const unlockSlots = () => {
    if (credits < 250) return flash(t.insufficient);
    const next = credits - 250;
    setCredits(next);
    creditsRef.current = next;
    setExtraUnlocked(true);
    localStorage.setItem("aeternum-extra-slots", "true");
    localStorage.setItem("aeternum-demo-credits", String(next));
    flash(t.unlocked);
  };

  const completeMockLogin = (provider: string) => {
    localStorage.setItem("aeternum-demo-login", "true");
    setIsLoggedIn(true);
    setLoginOpen(false);
    flash(`${t.loggedIn}: ${provider}`);
  };

  const simulateCreditPurchase = () => {
    const next = creditsRef.current + creditPack;
    creditsRef.current = next;
    setCredits(next);
    localStorage.setItem("aeternum-demo-credits", String(next));
    setPaymentOpen(false);
    flash(`+${creditPack} ${t.credits}`);
  };

  const setAsAvatarWidget = () => {
    const absoluteUrl = (value: string) => value.startsWith("data:") ? null : new URL(value, window.location.origin).toString();
    const spriteUrl = absoluteUrl(activeOutfit.spriteUrl);
    const backgroundUrl = absoluteUrl(activeBackground.url);
    const configuration = {
      version: 1,
      voice: voice,
      character: {
        id: activeAvatar.id,
        name: activeAvatar.name,
        alias: activeAvatar.alias,
        gender: activeAvatar.gender,
        systemPrompt: activeAvatar.systemPrompt,
      },
      background: { id: activeBackground.id, url: backgroundUrl },
      outfit: { id: activeOutfit.id, spriteUrl },
      image: {
        url: spriteUrl,
        frame: 0,
        framePosition: "0% 0%",
        frameWidth: 512,
        frameHeight: 512,
        columns: 3,
        rows: 2,
      },
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("narratum-avatar-widget", JSON.stringify(configuration));

    const parameters = new URLSearchParams({
      avatarCharacterId: activeAvatar.id,
      avatarCharacterName: activeAvatar.name,
      avatarVoice: voice,
      avatarBackgroundId: activeBackground.id,
      avatarOutfitId: activeOutfit.id,
      avatarFrame: "0",
      avatarFramePosition: "0,0",
      avatarFrameSize: "512x512",
      avatarSpriteGrid: "3x2",
    });
    if (spriteUrl) parameters.set("avatarImageUrl", spriteUrl);
    if (backgroundUrl) parameters.set("avatarBackgroundUrl", backgroundUrl);
    setHubUrl(`https://www.narratum.app/?${parameters.toString()}`);
    setWidgetSaved(true);
    flash(t.avatarWidgetSaved);
    window.setTimeout(() => setWidgetSaved(false), 2600);
  };

  const generateAvatar = async () => {
    if (!uploadFile || uploadSlot === null) return;
    if (creditsRef.current < IMAGE_GENERATION_CREDITS) return flash(t.insufficientImageCredits);
    setGenerating(true);
    try {
      const optimizedFile = await optimizeReferenceImage(uploadFile);
      const form = new FormData();
      form.append("image", optimizedFile);
      form.append("name", uploadName || uploadFile.name.replace(/\.[^.]+$/, ""));
      form.append("subjectType", uploadSubject);
      const response = await fetch("/api/generate-avatar", { method: "POST", body: form });
      const responseBody = await response.text();
      let result: { spriteDataUrl?: string; profile?: { name?: string; alias?: string; summary?: string; systemPrompt?: string }; error?: string };
      try {
        result = JSON.parse(responseBody) as { spriteDataUrl?: string; profile?: { name?: string; alias?: string; summary?: string; systemPrompt?: string }; error?: string };
      } catch {
        throw new Error(response.status === 413 ? "The reference image is still too large for this host. Please use an image under 700 KB." : "The generation service returned an invalid response. Please try again.");
      }
      if (!response.ok || !result.spriteDataUrl) throw new Error(result.error || "Generation failed");
      const transparentSpriteDataUrl = await removeChromaGreen(result.spriteDataUrl);
      const spriteBlob = dataUrlToBlob(transparentSpriteDataUrl);
      const { persistAvatar } = await import("@/lib/firebase");
      const stored = await persistAvatar(uploadSlot, optimizedFile, spriteBlob, result.profile || {}).catch(() => null);
      const id = `custom-${uploadSlot}-${Date.now()}`;
      const name = result.profile?.name || uploadName || "New Character";
      const avatar: AvatarProfile = {
        id,
        name,
        alias: result.profile?.alias || "The Newcomer",
        gender: "custom",
        custom: true,
        slot: uploadSlot,
        summary: { en: result.profile?.summary || "A new story waits to be told.", es: result.profile?.summary || "Una nueva historia espera ser contada." },
        systemPrompt: result.profile?.systemPrompt || `You are ${name}. Stay fully in character and keep spoken turns natural and concise.`,
        outfits: [{ id: "original", label: { en: "Original", es: "Original" }, spriteUrl: stored?.spriteUrl || transparentSpriteDataUrl }],
      };
      setCustomAvatars((current) => [...current.filter((item) => item.slot !== uploadSlot), avatar]);
      setOutfitId("original");
      setMessages([]);
      resetUsage();
      setWidgetSaved(false);
      setActiveId(id);
      setUploadSlot(null);
      setUploadFile(null);
      setUploadName("");
      setUploadSubject("human");
      setCredits((current) => {
        const next = Math.max(0, current - IMAGE_GENERATION_CREDITS);
        creditsRef.current = next;
        localStorage.setItem("aeternum-demo-credits", String(next));
        return next;
      });
      flash(stored ? t.storedFirebase : t.storedSession);
      window.setTimeout(() => flash(t.imageCost), 150);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      flash(message.includes("OPENAI_API_KEY") ? `${t.apiNeeded} ${message}` : message);
    } finally {
      setGenerating(false);
    }
  };

  const removeCustom = (avatar: AvatarProfile) => {
    setCustomAvatars((current) => current.filter((item) => item.id !== avatar.id));
    if (activeId === avatar.id) {
      setOutfitId("adventurer");
      setMessages([]);
      resetUsage();
      setWidgetSaved(false);
      setActiveId(BUILT_IN_AVATARS[0].id);
    }
  };

  const selectAvatar = (id: string) => {
    if (liveState !== "idle") void stopSession();
    const nextAvatar = allAvatars.find((item) => item.id === id) || BUILT_IN_AVATARS[0];
    setOutfitId(nextAvatar.outfits[0]?.id || "original");
    setMessages([]);
    resetUsage();
    setWidgetSaved(false);
    setActiveId(id);
    setSidebarOpen(false);
  };

  const handleCustomAvatarSelect = (event: MouseEvent<HTMLButtonElement>) => {
    selectAvatar(event.currentTarget.value);
  };

  const handleCustomAvatarRemove = (event: MouseEvent<HTMLButtonElement>) => {
    const avatar = customAvatars.find((item) => item.id === event.currentTarget.value);
    if (avatar) removeCustom(avatar);
  };

  return (
    <main className="app-shell">
      <div className="ambient-orb orb-one" />
      <div className="ambient-orb orb-two" />

      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open character menu"><Menu size={20} /></button>
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <div><strong>AETERNUM</strong><span>{t.studio}</span></div>
        </div>
        <div className="topbar-actions">
          <button className="topbar-utility-button" onClick={() => setPaymentOpen(true)}><Plus size={14} />{t.addCredits}</button>
          <button className={`topbar-utility-button login-button ${isLoggedIn ? "logged-in" : ""}`} onClick={() => !isLoggedIn && setLoginOpen(true)}><UserRound size={14} />{isLoggedIn ? t.loggedIn : t.logIn}</button>
          <div className="usage-pill" aria-label={`${t.conversationTime}: ${formatDuration(conversationSeconds)}. ${t.useCredits}: ${usageCredits}`}>
            <span>{t.conversationTime}: <strong>{formatDuration(conversationSeconds)}</strong></span>
            <i />
            <span>{t.useCredits}: <strong>{usageCredits}</strong></span>
          </div>
          <div className="credits-pill"><Coins size={15} /><strong>{credits}</strong><span>{t.credits}</span></div>
          <button className="language-button" onClick={() => setLocale(locale === "en" ? "es" : "en")}><Languages size={16} />{locale.toUpperCase()}</button>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className={`character-rail ${sidebarOpen ? "open" : ""}`}>
          <div className="rail-heading"><span>{t.characters}</span><button className="icon-button close-rail" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
          <div className="avatar-list">
            {BUILT_IN_AVATARS.map((avatar) => (
              <button key={avatar.id} className={`avatar-card ${activeId === avatar.id ? "active" : ""}`} onClick={() => selectAvatar(avatar.id)}>
                <span className="avatar-thumb" style={{ backgroundImage: `url(${avatar.outfits[0].spriteUrl})`, backgroundSize: "300% 200%", backgroundPosition: "0 0" }} />
                <span className="avatar-meta"><strong>{avatar.name}</strong><small>{avatar.alias} · {avatar.gender === "female" ? "F" : "M"}</small></span>
                {activeId === avatar.id && <Check size={16} />}
              </button>
            ))}

            <div className="rail-section-label">{t.freeSlots}</div>
            {!isLoggedIn ? Array.from({ length: 3 }, (_, index) => index + 1).map((slot) => (
              <div key={slot} className="avatar-card empty-card locked-slot" aria-label={t.customLocked}>
                <span className="empty-avatar"><LockKeyhole size={16} /></span>
                <span className="avatar-meta"><strong>{t.empty} {slot}</strong><small>{t.customLocked}</small></span>
              </div>
            )) : Array.from({ length: customSlotCount }, (_, index) => index + 1).map((slot) => {
              const avatar = customAvatars.find((item) => item.slot === slot);
              return avatar ? (
                <div key={slot} className={`avatar-card custom-card ${activeId === avatar.id ? "active" : ""}`}>
                  <button className="custom-select" value={avatar.id} onClick={handleCustomAvatarSelect}>
                    <span className="avatar-thumb" style={{ backgroundImage: `url(${avatar.outfits[0].spriteUrl})`, backgroundSize: "300% 200%", backgroundPosition: "0 0" }} />
                    <span className="avatar-meta"><strong>{avatar.name}</strong><small>{avatar.alias}</small></span>
                  </button>
                  <button className="remove-button" value={avatar.id} onClick={handleCustomAvatarRemove} title={t.remove}><Trash2 size={14} /></button>
                </div>
              ) : (
                <button key={slot} className="avatar-card empty-card" onClick={() => setUploadSlot(slot)}>
                  <span className="empty-avatar"><Plus size={18} /></span>
                  <span className="avatar-meta"><strong>{t.empty} {slot}</strong><small>{t.addCharacter}</small></span>
                </button>
              );
            })}
          </div>
          {!isLoggedIn && <button className="login-unlock-card" onClick={() => setLoginOpen(true)}><LockKeyhole size={16} />{t.loginToUnlock}</button>}
          {isLoggedIn && !extraUnlocked && (
            <button className="unlock-card" onClick={unlockSlots}>
              <span><LockKeyhole size={17} /></span>
              <div><strong>{t.unlock}</strong><small>250 {t.credits} · simulated</small></div>
            </button>
          )}
        </aside>

        <section className="stage-column">
          <div className="stage-toolbar">
            <div className="stage-nav-actions">
              <a href={hubUrl} className="toolbar-nav-button"><ArrowLeft size={14} />{t.backToHub}</a>
              <button className={`toolbar-nav-button widget-button ${widgetSaved ? "saved" : ""}`} onClick={setAsAvatarWidget}>
                {widgetSaved ? <Check size={14} /> : <Sparkles size={14} />}{t.setAvatarWidget}
              </button>
            </div>
            <div className="stage-selectors">
              <label><span><ImageIcon size={14} />{t.scene}</span><select value={backgroundId} onChange={(event) => { setBackgroundId(event.target.value); setWidgetSaved(false); }}>{BACKGROUNDS.map((item) => <option key={item.id} value={item.id}>{item.label[locale]}</option>)}</select><ChevronDown size={14} /></label>
              <label><span><WandSparkles size={14} />{t.outfit}</span><select value={activeOutfit.id} onChange={(event) => { setOutfitId(event.target.value); setWidgetSaved(false); }}>{activeAvatar.outfits.map((item) => <option key={item.id} value={item.id}>{item.label[locale]}</option>)}</select><ChevronDown size={14} /></label>
            </div>
          </div>

          <div className="character-stage" style={{ backgroundImage: `linear-gradient(180deg, rgba(4,8,10,.08), rgba(4,8,10,.58)), url(${activeBackground.url})` }}>
            <div className="stage-vignette" />
            <div className="live-status"><span className={liveState} />{liveState === "idle" ? t.ready : liveState === "connecting" ? t.connecting : liveState === "speaking" ? t.speaking : t.listening}</div>
            <SpriteAvatar spriteUrl={activeOutfit.spriteUrl} frame={mouthFrame} speaking={liveState === "speaking"} />
            <div className="character-caption">
              <div><span>{t.talkingWith}</span><h1>{activeAvatar.name}</h1></div>
            </div>
            <button className={`live-button ${liveState !== "idle" ? "active" : ""}`} onClick={toggleLive} disabled={liveState === "connecting"}>
              {liveState === "connecting" ? <LoaderCircle className="spin" size={20} /> : liveState === "idle" ? <Mic size={20} /> : <MicOff size={20} />}
              {liveState === "idle" ? t.live : liveState === "connecting" ? t.connecting : t.end}
            </button>
          </div>
        </section>

        <aside className="conversation-panel">
          <section className="voice-section">
            <div className="panel-title"><span><Volume2 size={16} />{t.voice}</span><small>Gemini 3.1 Flash Live</small></div>
            <div className="voice-grid">
              {VOICES.map((item) => (
                <button key={item.name} className={`voice-option ${voice === item.name ? "active" : ""}`} onClick={() => { setVoice(item.name); setWidgetSaved(false); }}>
                  <span className={`gender-dot ${item.gender}`} />
                  <span><strong>{item.name}</strong><small>{item.tone[locale]}</small></span>
                  {voice === item.name && <Check size={14} />}
                </button>
              ))}
            </div>
            <button className="preview-button" onClick={previewVoice}><Play size={14} fill="currentColor" />{t.testVoice}<small>“{TEST_PHRASE}”</small></button>
          </section>

          <section className="character-background-section">
            <div className="panel-title"><span><BookOpen size={16} />{t.characterBackground}</span><small>{activeAvatar.alias}</small></div>
            <p>{activeAvatar.summary[locale]}</p>
          </section>

          <section className="chat-section">
            <div className="panel-title"><span><MessageCircle size={16} />{t.chat}</span><span className="secure-label">{FIREBASE_CONFIGURED ? "FIREBASE" : t.demo}</span></div>
            <div className="message-list">
              {!messages.length && (
                <div className="empty-conversation"><div><MessageCircle size={22} /></div><p>{locale === "es" ? `Habla con ${activeAvatar.alias} por voz o escribe para comenzar.` : `Speak with ${activeAvatar.alias} by voice or type to begin.`}</p><small>{t.demoHelp}</small></div>
              )}
              {messages.map((message) => <div key={message.id} className={`message ${message.role}`}><span>{message.role === "user" ? (locale === "es" ? "Tú" : "You") : activeAvatar.alias}</span><p>{message.text}</p></div>)}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-input" onSubmit={sendText}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.placeholder} aria-label={t.placeholder} />
              <button type="submit" aria-label={t.send}><Send size={17} /></button>
            </form>
          </section>
        </aside>
      </div>

      {uploadSlot !== null && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !generating) setUploadSlot(null); }}>
          <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
            <button className="modal-close" onClick={() => !generating && setUploadSlot(null)}><X size={19} /></button>
            <div className="modal-icon"><WandSparkles size={24} /></div>
            <p className="eyebrow">CUSTOM SLOT {uploadSlot}</p>
            <h2 id="upload-title">{t.uploadTitle}</h2>
            <p className="modal-help">{t.uploadHelp}</p>
            <label className="field-label"><span>{t.characterName}</span><input value={uploadName} onChange={(event) => setUploadName(event.target.value)} placeholder="e.g. Elara Voss" disabled={generating} /></label>
            <div className="subject-picker">
              <span>{t.spriteSubject}</span>
              <div role="radiogroup" aria-label={t.spriteSubject}>
                <button type="button" role="radio" aria-checked={uploadSubject === "human"} className={uploadSubject === "human" ? "active" : ""} onClick={() => setUploadSubject("human")} disabled={generating}><UserRound size={16} /><b>{t.humanSubject}</b><small>{t.humanSubjectHelp}</small></button>
                <button type="button" role="radio" aria-checked={uploadSubject === "object"} className={uploadSubject === "object" ? "active" : ""} onClick={() => setUploadSubject("object")} disabled={generating}><Package size={16} /><b>{t.objectSubject}</b><small>{t.objectSubjectHelp}</small></button>
              </div>
            </div>
            <label className={`drop-zone ${uploadFile ? "has-file" : ""}`}>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} disabled={generating} />
              {uploadFile ? <><Check size={24} /><strong>{uploadFile.name}</strong><small>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</small></> : <><Upload size={26} /><strong>{t.chooseFile}</strong><small>PNG · JPG · WEBP · max 20 MB</small></>}
            </label>
            {generating && <div className="generation-progress"><span><i /></span><p>{t.generating}</p></div>}
            <div className="modal-actions"><button className="secondary-button" onClick={() => setUploadSlot(null)} disabled={generating}>{t.cancel}</button><button className="primary-button" onClick={generateAvatar} disabled={!uploadFile || generating || credits < IMAGE_GENERATION_CREDITS}>{generating ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}{t.generate} · {IMAGE_GENERATION_CREDITS} {t.credits}</button></div>
          </section>
        </div>
      )}

      {paymentOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentOpen(false); }}>
          <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
            <button className="modal-close" onClick={() => setPaymentOpen(false)}><X size={19} /></button>
            <div className="modal-icon"><CreditCard size={24} /></div>
            <p className="eyebrow">CREDITS</p>
            <h2 id="payment-title">{t.paymentTitle}</h2>
            <p className="modal-help">{t.paymentHelp}</p>
            <div className="credit-pack-grid">
              {[50, 100, 250].map((amount) => <button key={amount} className={creditPack === amount ? "active" : ""} onClick={() => setCreditPack(amount)}><strong>{amount}</strong><span>{t.credits}</span></button>)}
            </div>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setPaymentOpen(false)}>{t.cancel}</button><button className="primary-button" onClick={simulateCreditPurchase}><CreditCard size={17} />{t.simulateCheckout}</button></div>
          </section>
        </div>
      )}

      {loginOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginOpen(false); }}>
          <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
            <button className="modal-close" onClick={() => setLoginOpen(false)}><X size={19} /></button>
            <div className="modal-icon"><UserRound size={24} /></div>
            <p className="eyebrow">ACCOUNT</p>
            <h2 id="login-title">{t.loginTitle}</h2>
            <p className="modal-help">{t.loginHelp}</p>
            <div className="login-provider-list">
              <button onClick={() => completeMockLogin("Google")}><span className="provider-mark google">G</span>{t.continueGoogle}</button>
              <button onClick={() => completeMockLogin("Facebook")}><span className="provider-mark facebook">f</span>{t.continueFacebook}</button>
              <button onClick={() => completeMockLogin("Email")}><Mail size={17} />{t.continueEmail}</button>
            </div>
          </section>
        </div>
      )}

      {notice && <div className="toast"><Sparkles size={16} />{notice}</div>}
      {sidebarOpen && <div className="mobile-scrim" onClick={() => setSidebarOpen(false)} />}
    </main>
  );
}
