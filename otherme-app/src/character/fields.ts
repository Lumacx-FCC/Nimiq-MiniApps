/**
 * Character sheet data model — the 30 fields of the original
 * character_design_sheet_prompt_generator, grouped into its 7 sections,
 * with EN/ES labels.
 */
export interface CharacterSheet {
  name: string, alias: string, age: string, height: string, build: string, ethnicity: string
  structure: string, skin: string, eyes: string, hair: string, features: string
  traits: string, conflict: string, patterns: string, baseline: string
  bodyLanguage: string, rhythm: string, idle: string
  garment1: string, garment2: string, layering: string, footwear: string, accessories: string, props: string
  environment: string, lighting: string, colorTone: string, expression: string, camera: string, style: string
}

export type SheetField = keyof CharacterSheet

interface FieldDef {
  key: SheetField
  label: { en: string, es: string }
  placeholder: string
}

export interface SectionDef {
  id: string
  title: { en: string, es: string }
  subtitle: { en: string, es: string }
  fields: FieldDef[]
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'identity',
    title: { en: 'Identity', es: 'Identidad' },
    subtitle: { en: 'Name, age, stature and design language', es: 'Nombre, edad, estatura y lenguaje de diseño' },
    fields: [
      { key: 'name', label: { en: 'Character Name', es: 'Nombre del personaje' }, placeholder: 'e.g. Vance Sterling' },
      { key: 'alias', label: { en: 'Alias / Codename', es: 'Alias / Nombre clave' }, placeholder: 'e.g. Neon Ghost' },
      { key: 'age', label: { en: 'Age', es: 'Edad' }, placeholder: 'e.g. 24' },
      { key: 'height', label: { en: 'Height', es: 'Estatura' }, placeholder: 'e.g. 180 cm' },
      { key: 'build', label: { en: 'Build & Posture', es: 'Complexión y postura' }, placeholder: 'e.g. Wire-thin, slouched stance' },
      { key: 'ethnicity', label: { en: 'Design Language & Style', es: 'Lenguaje de diseño y estilo' }, placeholder: 'e.g. Pixar-style stylized realism' },
    ],
  },
  {
    id: 'face',
    title: { en: 'Face Design', es: 'Diseño facial' },
    subtitle: { en: 'Structure, skin, eyes, hair and marks', es: 'Estructura, piel, ojos, cabello y marcas' },
    fields: [
      { key: 'structure', label: { en: 'Bone Structure', es: 'Estructura ósea' }, placeholder: 'e.g. Chiseled, angular jawline' },
      { key: 'skin', label: { en: 'Skin Texture', es: 'Textura de piel' }, placeholder: 'e.g. Matte warm olive, minor freckles' },
      { key: 'eyes', label: { en: 'Eyes', es: 'Ojos' }, placeholder: 'e.g. Large hazel, active highlights' },
      { key: 'hair', label: { en: 'Hair', es: 'Cabello' }, placeholder: 'e.g. Spiky undercut, messy clumps' },
      { key: 'features', label: { en: 'Distinct Marks', es: 'Marcas distintivas' }, placeholder: 'e.g. Thin scar on temple' },
    ],
  },
  {
    id: 'psychology',
    title: { en: 'Psychology', es: 'Psicología' },
    subtitle: { en: 'Traits, conflict, patterns, baseline', es: 'Rasgos, conflicto, patrones, estado base' },
    fields: [
      { key: 'traits', label: { en: 'Personality Traits', es: 'Rasgos de personalidad' }, placeholder: 'e.g. Resourceful, paranoid, loyal' },
      { key: 'conflict', label: { en: 'Internal Conflict', es: 'Conflicto interno' }, placeholder: 'e.g. Wants safety but feels duty-bound' },
      { key: 'patterns', label: { en: 'Behavior Patterns', es: 'Patrones de conducta' }, placeholder: 'e.g. Taps gauntlet when nervous' },
      { key: 'baseline', label: { en: 'Emotional Baseline', es: 'Estado emocional base' }, placeholder: 'e.g. Quiet stoicism, shifting to panic' },
    ],
  },
  {
    id: 'performance',
    title: { en: 'Performance', es: 'Actuación' },
    subtitle: { en: 'Motion and animation direction', es: 'Dirección de movimiento y animación' },
    fields: [
      { key: 'bodyLanguage', label: { en: 'Body Language', es: 'Lenguaje corporal' }, placeholder: 'e.g. Coiled stance, tight shoulders' },
      { key: 'rhythm', label: { en: 'Movement Rhythm', es: 'Ritmo de movimiento' }, placeholder: 'e.g. Swift, sharp, calculated' },
      { key: 'idle', label: { en: 'Idle Behavior', es: 'Comportamiento en reposo' }, placeholder: 'e.g. Scanning exit routes' },
    ],
  },
  {
    id: 'wardrobe',
    title: { en: 'Wardrobe', es: 'Vestuario' },
    subtitle: { en: 'Garments, layering, footwear, props', es: 'Prendas, capas, calzado, utilería' },
    fields: [
      { key: 'garment1', label: { en: 'Garment 1 (Top)', es: 'Prenda 1 (Superior)' }, placeholder: 'e.g. Weathered leather tactical jacket' },
      { key: 'garment2', label: { en: 'Garment 2 (Bottom)', es: 'Prenda 2 (Inferior)' }, placeholder: 'e.g. Dark-grey cargo pants' },
      { key: 'layering', label: { en: 'Layering', es: 'Capas' }, placeholder: 'e.g. Loose scarf over armor' },
      { key: 'footwear', label: { en: 'Footwear', es: 'Calzado' }, placeholder: 'e.g. Scuffed combat boots' },
      { key: 'accessories', label: { en: 'Accessories', es: 'Accesorios' }, placeholder: 'e.g. Brass arm-gauntlet' },
      { key: 'props', label: { en: 'Props', es: 'Utilería' }, placeholder: 'e.g. Rusty data scanner' },
    ],
  },
  {
    id: 'portrait',
    title: { en: 'Cinematic Portrait', es: 'Retrato cinematográfico' },
    subtitle: { en: 'Scene, lighting, color, camera', es: 'Escena, iluminación, color, cámara' },
    fields: [
      { key: 'environment', label: { en: 'Environment', es: 'Entorno' }, placeholder: 'e.g. Crumbling stone observatory' },
      { key: 'lighting', label: { en: 'Lighting', es: 'Iluminación' }, placeholder: 'e.g. Rim-lighting, volumetric clouds' },
      { key: 'colorTone', label: { en: 'Color Palette', es: 'Paleta de color' }, placeholder: 'e.g. Dark teal with neon ambers' },
      { key: 'expression', label: { en: 'Micro-Expression', es: 'Microexpresión' }, placeholder: 'e.g. Sudden eye widening' },
      { key: 'camera', label: { en: 'Camera Setup', es: 'Cámara' }, placeholder: 'e.g. 85mm prime, shallow DOF' },
    ],
  },
  {
    id: 'style',
    title: { en: 'Style & Art', es: 'Estilo y arte' },
    subtitle: { en: 'Overall artistic direction', es: 'Dirección artística general' },
    fields: [
      { key: 'style', label: { en: 'Stylistic Theme', es: 'Tema estilístico' }, placeholder: 'e.g. Warm stylized 3D design' },
    ],
  },
]

export const DEFAULT_SHEET: CharacterSheet = {
  name: 'Aiden Vance',
  alias: 'None',
  age: '28',
  height: '182 cm',
  build: 'Lean, athletic with slightly elongated limbs. Posture is relaxed but coiled with physical capability.',
  ethnicity: 'Pixar-style stylized realism with sharp, defined jaw and expressive brow lines.',
  structure: 'Strong square jawline with soft geometric contours, pronounced cheekbones.',
  skin: 'Olive-toned, highly realistic texture with minor sweat sheen and a faint scar across the left cheek.',
  eyes: 'Intense hazel, slightly larger than life, bright reflecting highlights indicating active thought.',
  hair: 'Messy, wind-tossed ash brown, individual clump definitions, dry matte texture.',
  features: 'Small nick on the left eyebrow, light stubble across the jaw.',
  traits: 'Determined, highly analytical, cautious, quietly compassionate.',
  conflict: 'Desperately wants to protect his clan but fears his own unstable powers will cause their destruction.',
  patterns: 'Unconsciously clenches his fists when challenged, checks his holster, looks towards the horizon.',
  baseline: 'Stoic, calm, quiet but shifts into sharp focus under imminent danger.',
  bodyLanguage: 'Slightly guarded stance, shoulders drawn back, poised for instant reaction.',
  rhythm: 'Efficient and fluid, no wasted energy.',
  idle: 'Subtle scanning of the perimeter, weight distributed evenly.',
  garment1: 'Weathered brown leather tactical jacket with reinforced double stitching, showing cracks along sleeves.',
  garment2: 'Fitted dark-grey canvas trousers with utility pockets and reinforced knee panels.',
  layering: 'An off-center charcoal grey scarf wrapped twice, tucked under tactical shoulder straps.',
  footwear: 'Ankle-high scuffed leather boots with thick rubber treading and mud stains.',
  accessories: 'A brass pocket-watch tied to his belt, distressed leather fingerless gloves.',
  props: 'A stylized hand-held scanning device with green light indicators.',
  environment: 'A desolate cliffside overlooking a vast cloud-sea, ancient ruins crumbling in the background.',
  lighting: 'Dramatic overcast mountain light, cold diffused sky ambient with warm orange rim light from a campfire.',
  colorTone: 'Muted earth tones punctuated by high-contrast orange and teal atmospheric accents.',
  expression: 'A micro-expression of sudden alarm, eyebrows pinched together, gaze locked on an unseen threat.',
  camera: '85mm cinematic prime, shallow depth of field, sharp foreground details.',
  style: 'Semi-realistic cinematic design, appealing stylized geometry, professional film production lighting.',
}

export const PRESETS: Array<{ id: string, name: string, data: CharacterSheet }> = [
  {
    id: 'cyber_scavenger',
    name: 'Vance — Cyberpunk Scavenger',
    data: {
      name: 'Vance Sterling',
      alias: 'Neon Ghost',
      age: '24',
      height: '5\'11" (180 cm)',
      build: 'Slightly wire-thin but exceptionally agile, perpetual light slouch, weight resting on the balls of his feet as if ready to jump.',
      ethnicity: 'Neo-Tokyo cyberpunk, stylized realism with slightly exaggerated high cheekbones and sharp, angular angles.',
      structure: 'Chiseled, asymmetrical jawline, sharp chin, lean cheeks with stylized soft geometry in the forehead.',
      skin: 'Pale with a subtle blue/violet digital undertone from neon reflection, slight oil smudge on the left cheekbone, minor micro-abrasions around the jaw.',
      eyes: 'Enlarged stylized cybernetic eyes, glowing electric cyan iris, thin brass casing around the sclera, intense focus.',
      hair: 'Undercut with messy, wind-blown top hair in matte obsidian black with a single streak of neon green, sharp polygon chunks.',
      features: 'A thin glowing data port scar running down the left temple, dimpled chin.',
      traits: 'Resourceful, hyper-vigilant, cynical but secretly sentimental, obsessive over technology.',
      conflict: "He wants to uncover his sister's memory files but fear of corporate detection forces him to stay hidden.",
      patterns: 'Fidgets constantly with a mechanical cyber-wrench, bites his bottom lip when looking at screens, look back over shoulder every ten steps.',
      baseline: 'Calculated alertness shifting instantly to sarcastic humor under pressure.',
      bodyLanguage: 'Slightly defensive, hands deep in pockets, head tilted forward to shield face.',
      rhythm: 'Sharp, jerky, hyper-efficient movements with sudden bursts of speed.',
      idle: 'Tension coiled in his neck, fingers drumming an invisible data sequence.',
      garment1: 'Weathered matte-black ballistic nylon technical jacket with worn yellow hazard stitching, frayed cuffs, and grease stains.',
      garment2: 'Loose carbon-fiber threaded cargo pants, baggy around the knees, heavy heat-welded pockets, dusty fabric wrinkles.',
      layering: 'An asymmetric high-collar glowing cowl draped over a torn dark grey thermal shirt.',
      footwear: 'Scuffed composite-toe combat boots, rubberized soles embedded with dirt particles, neon yellow laces.',
      accessories: 'Shattered holographic visor resting on his neck, glowing blue wrist-mounted multi-tool.',
      props: 'A rusted retro-designed hand scanner with electrical tape wrapped around its grip.',
      environment: 'A damp, narrow neon-lit Tokyo back-alley with steam rising from rusted iron grates and high contrast reflections.',
      lighting: 'Searing cyan and magenta key lights from neon advertisements, dark cool shadows, soft rim lighting.',
      colorTone: 'Highly saturated cyber-cool tones offset by warm practical yellow streetlights.',
      expression: 'A micro-expression of calculated suspicion, eyes slightly narrowed, jaw tensed mid-thought.',
      camera: '85mm prime lens, exceptionally shallow depth of field, cinematic realistic bokeh in the background.',
      style: 'Cyberpunk stylized realism with appealing exaggeration and premium movie poster composition.',
    },
  },
  {
    id: 'clockwork_cartographer',
    name: 'Evelyn — Clockwork Explorer',
    data: {
      name: 'Evelyn Thorne',
      alias: 'The Wind-up Archivist',
      age: '29',
      height: '5\'6" (168 cm)',
      build: 'Poised and strictly upright, elegant posture but with a nervous energy that translates into rapid, precise hand movements.',
      ethnicity: 'Victorian Steampunk, Ghibli-esque stylized design with large, highly expressive features.',
      structure: 'Heart-shaped face, soft rounded cheeks, expressive eyebrows with subtle asymmetric curve.',
      skin: 'Warm ivory, freckled across the bridge of the nose, smudge of brass polish on her forehead.',
      eyes: 'Over-sized deep amber eyes, wide-set, reflecting clockwork gear outlines, highly expressive.',
      hair: 'Thick chestnut hair tied up in a chaotic, loose bun secured with brass calipers, curly stray strands framing her face.',
      features: 'Faint circular brass monocle-indentation mark around her right eye socket, deep laugh lines.',
      traits: 'Intellectually insatiable, clumsy in social spaces, highly meticulous, stubbornly optimistic.',
      conflict: 'She wants to map the uncharted floating islands but is restricted by her crumbling clockwork heart which needs frequent winding.',
      patterns: 'Winds her wrist-watch whenever nervous, cleans her spectacles with her shirt-tail, hums steam engine rhythms.',
      baseline: 'Perpetually curious, shifts rapidly to frantic excitement when discovering new map data.',
      bodyLanguage: 'Leaning forward as if physically drawn to maps, hands gesturing wide coordinates.',
      rhythm: 'Stiff and precise, alternating with sudden energetic bounces when excited.',
      idle: 'Slight tapping of her leather-booted toes, adjusting her glove straps.',
      garment1: 'Heavy, double-stitched brown leather corset vest over an ivory linen blouse, fabric showing realistic stretch and fabric pulling.',
      garment2: 'Dark teal pleated utility skirt with brass reinforcement rings, showing light scuffs and ink stains.',
      layering: 'A heavy oiled-canvas duster coat worn over one shoulder, draped naturally with complex fabric folds.',
      footwear: 'High-top lace-up leather boots with brass eyelets, scuffed toes showing natural leather wear.',
      accessories: 'An intricate brass mechanical arm gauntlet showing moving gears, worn leather tool belt.',
      props: 'An ancient roll of star-maps inside a leather cylinder capsule, a pocket brass astrolabe.',
      environment: 'An old library observatory filled with brass telescopes, floating dust motes illuminated by sunbeams.',
      lighting: 'Warm golden hour sunlight streaming through a large stained-glass window, high contrast shadows.',
      colorTone: 'Rich sepia tones, warm brass, emerald greens, and deep ambers.',
      expression: 'A look of sudden eureka, eyes widened, lips slightly parted as if speaking a discovery.',
      camera: '50mm lens, soft focus background, realistic cinematic lighting and depth.',
      style: 'Warm stylized realism, Ghibli-inspired details combined with Disney-esque soft character geometry.',
    },
  },
]

/** Render-style guideline the user picks before generating images/scenes. */
export type RenderStyleMode = 'realistic' | 'animated' | 'custom'

export interface RenderStyle {
  mode: RenderStyleMode
  customText: string
}

export function styleDirective(style: RenderStyle): string {
  if (style.mode === 'realistic')
    return 'RENDER STYLE GUIDELINE (USER SELECTED: REALISTIC): Photorealistic live-action treatment. Physically accurate skin pores, fabric weave, hair strands and lighting. Real-world camera optics and film grain. No cartoon or stylized exaggeration.'
  if (style.mode === 'animated')
    return 'RENDER STYLE GUIDELINE (USER SELECTED: ANIMATED): High-end 3D animated feature-film treatment. Appealing stylized geometry, soft shapes, expressive oversized features, clean subsurface skin shading, cinematic animation lighting.'
  return `RENDER STYLE GUIDELINE (USER SELECTED: CUSTOM): ${style.customText.trim() || 'Follow the style described in the STYLE section.'}`
}

/** Compiled character-sheet prompt — text preserved from the original generator. */
export function compileSheetPrompt(d: CharacterSheet): string {
  return `Create a cinematic, film-production-grade character design sheet for a director, casting team, and costume department. Character name: ${d.name}. Must feel like a high-budget animated film pitch board, not a generic model sheet. CORE DIRECTIVE (NON-NEGOTIABLE): No generic layouts. No evenly spaced grids. No symmetry for symmetry's sake. Composition must feel art-directed, intentional, slightly asymmetrical. Every section must feel placed, not auto-generated.

CHARACTER IDENTITY: Name: ${d.name} | Alias: ${d.alias} | Age: ${d.age} | Height: ${d.height} | Build: ${d.build} | Ethnicity / Design Language: ${d.ethnicity}

FACE DESIGN: Structure: ${d.structure} | Skin: ${d.skin} | Eyes: ${d.eyes} | Hair: ${d.hair} | Distinct Features: ${d.features}

PSYCHOLOGICAL PROFILE: Core Traits: ${d.traits} | Internal Conflict: ${d.conflict} | Behavior Patterns: ${d.patterns} | Emotional Baseline: ${d.baseline}

PERFORMANCE DIRECTION: Character must feel like a real actor caught mid-moment, NOT posing. Micro-expressions required (lip tension, eye flicker, brow shift). Avoid staged symmetry. Capture transitional emotion.
Body Language: ${d.bodyLanguage} | Movement rhythm: ${d.rhythm} | Idle behavior: ${d.idle}

WARDROBE: Garment 1: ${d.garment1} | Garment 2: ${d.garment2} | Layering logic: ${d.layering} | Footwear: ${d.footwear} | Accessories: ${d.accessories} | Props: ${d.props}

MATERIAL ACCURACY: Fabrics must show stretch, stitching, wrinkles, wear. No plastic look unless intentional. Skin must have soft light interaction. Include imperfections: dirt, smudges, aging, usage marks.

TURNAROUND (STRICT): Full-body front, 3/4, side, back, 3/4 back views. Identical proportions and design fidelity. No drift in face or costume across any angle.

HEAD STUDY: Front (neutral) | 3/4 (primary personality) | Profile (structure) | Looking Down | Looking Up | Dynamic Angle (intense state). All expressions mid-thought, not posed.

CINEMATIC PORTRAIT: Environment: ${d.environment} | Lighting: ${d.lighting} | Color Tone: ${d.colorTone} | Expression: ${d.expression} | Camera: ${d.camera}

LAYOUT: Clean, art-directed sheet. Neutral gray background. Include: height scale, annotation callouts, wardrobe breakdown, production notes. Must feel like a premium studio board.

STYLE: ${d.style}. Must include: appealing exaggeration, soft geometry, cinematic lighting, high emotional readability.

CONSISTENCY RULE (STRICT): Face, proportions, costume, and details must remain IDENTICAL across all views. No reinterpretation between angles. Ever.

OUTPUT: Extremely high detail. Sharp focus. Production-ready fidelity. Suitable for film development, merchandising, and pitch decks.`
}

/** Compiled video prompt — text preserved from the original generator. */
export function compileVideoPrompt(d: CharacterSheet, videoAction: string): string {
  return `Cinematic video scene, highly realistic camera tracking. Character: ${d.name} (Alias: ${d.alias}), described as a ${d.ethnicity} with a ${d.build} build.
Facial features: ${d.eyes} eyes, ${d.hair} hair, ${d.structure} face structure with ${d.skin}.
Wardrobe includes: ${d.garment1} layered with ${d.layering}, wearing ${d.footwear}.
Action: The character is ${videoAction}. Their body language is ${d.bodyLanguage} with a ${d.rhythm} rhythm, showing signs of ${d.idle}.
Environment: ${d.environment}.
Lighting: ${d.lighting}, showcasing real physical fabric interactions, rich depth, accurate environmental reflections.
Camera: Cinematic camera, ${d.camera}, extreme shallow depth of field, natural motion blur, production-ready cinematic visual fidelity.`
}
