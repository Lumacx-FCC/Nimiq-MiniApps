export type Locale = "en" | "es";

export type VoiceName =
  | "Zubenelgenubi"
  | "Puck"
  | "Achird"
  | "Sulafat"
  | "Zephyr"
  | "Kore";

export type AvatarOutfit = {
  id: string;
  label: { en: string; es: string };
  spriteUrl: string;
};

export type AvatarProfile = {
  id: string;
  name: string;
  alias: string;
  summary: { en: string; es: string };
  systemPrompt: string;
  gender: "male" | "female" | "custom";
  outfits: AvatarOutfit[];
  custom?: boolean;
  slot?: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "avatar" | "system";
  text: string;
};

export type GeneratedProfile = {
  name?: string;
  alias?: string;
  summary?: string;
  systemPrompt?: string;
};
