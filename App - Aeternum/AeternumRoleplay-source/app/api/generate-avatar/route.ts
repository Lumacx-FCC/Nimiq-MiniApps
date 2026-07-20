type SpriteSubject = "human" | "object";

function createSpritePrompt(subject: SpriteSubject) {
  const direction = subject === "object"
    ? `SUBJECT: The reference is a non-human object. Turn that exact object into a polished, family-friendly 3D animated-film character. Preserve its recognisable silhouette, construction, materials, colours and defining details. Do not generate a person, a human body, human clothing, or replace the object with a humanoid. Add only a subtle expressive face and speaking mouth naturally integrated into the object; do not add limbs unless they are already part of the object.`
    : `SUBJECT: The reference is a human or humanoid character. Create a realistic humanoid talking avatar that preserves their visible identity, anatomy, clothing and styling.`;

  return `Create one exact 3x2 talking-avatar sprite sheet from the supplied character reference sheet.
Canvas: 1536x1024, six equal 512x512 cells, no gaps, no borders, no text.
${direction}
Pose: centered, front-facing portrait of the selected subject, identically framed in every cell. Use a perfectly flat, solid chroma-key green background (#00FF00) with no gradient, texture, scenery, floor, cast shadow or glow. Do not use this exact green in the subject or its details.
Cells in reading order: 1 mouth closed, 2 slightly open, 3 medium open, 4 wide open, 5 rounded O, 6 friendly open-mouth smile.
STRICT LOCK: preserve the selected subject's identity, geometry, orientation, material, lighting and framing. Only the mouth and minimal facial movement needed for speech may change. Do not create six different poses or expressions. Do not add any backdrop beyond the required flat chroma-key green, floor, shadow rectangle or scenery.`;
}

export const runtime = "nodejs";

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function inferProfile(apiKey: string, file: File, fallbackName: string, subject: SpriteSubject) {
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_PROFILE_MODEL || "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_image", image_url: dataUrl },
            { type: "input_text", text: `Read this ${subject === "object" ? "object" : "human or humanoid character"} reference. Return only compact JSON with keys name, alias, summary, systemPrompt. The systemPrompt must make a real-time roleplay voice agent embody the visible personality, lore, behavior and speaking style while staying in character. ${subject === "object" ? "The subject is an object: do not describe it as human or invent a human identity." : ""} Use ${fallbackName || "the visible name"} when uncertain.` },
          ],
        }],
      }),
    });
    if (!response.ok) throw new Error("Profile inference failed");
    const json = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const raw = json.output_text || json.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("") || "";
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

async function createSprite(apiKey: string, form: FormData) {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!RETRYABLE_STATUS.has(response.status) || attempt === 2) return response;
    await pause(700 * (attempt + 1));
  }
  return response!;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not configured", demo: true }, { status: 503 });
  }

  try {
    const incoming = await request.formData();
    const image = incoming.get("image");
    const name = String(incoming.get("name") || "New Character").slice(0, 80);
    const requestedSubject = String(incoming.get("subjectType") || "human");
    const subject: SpriteSubject = requestedSubject === "object" ? "object" : "human";
    if (!(image instanceof File)) {
      return Response.json({ error: "A character reference image is required" }, { status: 400 });
    }
    if (!image.type.startsWith("image/") || image.size > 20 * 1024 * 1024) {
      return Response.json({ error: "Use a PNG, JPG or WEBP image under 20 MB" }, { status: 400 });
    }

    const profileFile = new File([await image.arrayBuffer()], image.name, { type: image.type });
    const editForm = new FormData();
    const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    editForm.append("model", imageModel);
    editForm.append("image", image, image.name);
    editForm.append("prompt", createSpritePrompt(subject));
    editForm.append("size", "1536x1024");
    editForm.append("quality", "medium");
    // GPT Image 2 rejects input_fidelity; retain this enhancement only for its compatible predecessors.
    if (imageModel === "gpt-image-1" || imageModel === "gpt-image-1.5") {
      editForm.append("input_fidelity", "high");
    }
    editForm.append("output_format", "webp");

    const [imageResponse, profile] = await Promise.all([
      createSprite(apiKey, editForm),
      inferProfile(apiKey, profileFile, name, subject),
    ]);

    if (!imageResponse.ok) {
      const details = await imageResponse.text();
      if (RETRYABLE_STATUS.has(imageResponse.status)) {
        throw new Error("GPT Image is temporarily unavailable after retrying. Please try again in a minute.");
      }
      throw new Error(`GPT Image request failed (${imageResponse.status}): ${details.slice(0, 300)}`);
    }
    const result = await imageResponse.json() as { data?: Array<{ b64_json?: string }> };
    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error("GPT Image returned no image data");

    return Response.json({
      spriteDataUrl: `data:image/webp;base64,${imageBase64}`,
      profile: profile || {
        name,
        alias: "The Newcomer",
        summary: "A mysterious traveler whose story is still unfolding.",
        systemPrompt: `You are ${name}, a cinematic roleplaying character. Stay in character, respond naturally and keep spoken turns concise.`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Avatar generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
