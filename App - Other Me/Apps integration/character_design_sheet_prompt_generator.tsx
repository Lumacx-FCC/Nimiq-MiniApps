import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Sparkles, Copy, Check, RotateCcw, Sliders, Video, User, 
  Image, Terminal, Play, Flame, RefreshCw, AlertCircle, Eye, ChevronRight, 
  Info, ChevronDown, CheckCircle, FileText, Compass, Film
} from 'lucide-react';

// Initialize Firebase values if available (fallback to default)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'char-prompt-studio';

// Standard high-quality presets if users want a quick-start
const PRESETS = [
  {
    id: 'cyber_scavenger',
    name: 'Vance - Cyberpunk Scavenger',
    imgUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80',
    data: {
      name: "Vance Sterling",
      alias: "Neon Ghost",
      age: "24",
      height: "5'11\" (180 cm)",
      build: "Slightly wire-thin but exceptionally agile, perpetual light slouch, weight resting on the balls of his feet as if ready to jump.",
      ethnicity: "Neo-Tokyo cyberpunk, stylized realism with slightly exaggerated high cheekbones and sharp, angular angles.",
      structure: "Chiseled, asymmetrical jawline, sharp chin, lean cheeks with stylized soft geometry in the forehead.",
      skin: "Pale with a subtle blue/violet digital undertone from neon reflection, slight oil smudge on the left cheekbone, minor micro-abrasions around the jaw.",
      eyes: "Enlarged stylized cybernetic eyes, glowing electric cyan iris, thin brass casing around the sclera, intense focus.",
      hair: "Undercut with messy, wind-blown top hair in matte obsidian black with a single streak of neon green, sharp polygon chunks.",
      features: "A thin glowing data port scar running down the left temple, dimpled chin.",
      traits: "Resourceful, hyper-vigilant, cynical but secretly sentimental, obsessive over technology.",
      conflict: "He wants to uncover his sister's memory files but fear of corporate detection forces him to stay hidden.",
      patterns: "Fidgets constantly with a mechanical cyber-wrench, bites his bottom lip when looking at screens, look back over shoulder every ten steps.",
      baseline: "Calculated alertness shifting instantly to sarcastic humor under pressure.",
      bodyLanguage: "Slightly defensive, hands deep in pockets, head tilted forward to shield face.",
      rhythm: "Sharp, jerky, hyper-efficient movements with sudden bursts of speed.",
      idle: "Tension coiled in his neck, fingers drumming an invisible data sequence.",
      garment1: "Weathered matte-black ballistic nylon technical jacket with worn yellow hazard stitching, frayed cuffs, and grease stains.",
      garment2: "Loose carbon-fiber threaded cargo pants, baggy around the knees, heavy heat-welded pockets, dusty fabric wrinkles.",
      layering: "An asymmetric high-collar glowing cowl draped over a torn dark grey thermal shirt.",
      footwear: "Scuffed composite-toe combat boots, rubberized soles embedded with dirt particles, neon yellow laces.",
      accessories: "Shattered holographic visor resting on his neck, glowing blue wrist-mounted multi-tool.",
      props: "A rusted retro-designed hand scanner with electrical tape wrapped around its grip.",
      environment: "A damp, narrow neon-lit Tokyo back-alley with steam rising from rusted iron grates and high contrast reflections.",
      lighting: "Searing cyan and magenta key lights from neon advertisements, dark cool shadows, soft rim lighting.",
      colorTone: "Highly saturated cyber-cool tones offset by warm practical yellow streetlights.",
      expression: "A micro-expression of calculated suspicion, eyes slightly narrowed, jaw tensed mid-thought.",
      camera: "85mm prime lens, exceptionally shallow depth of field, cinematic realistic bokeh in the background.",
      style: "Cyberpunk stylized realism with appealing exaggeration and premium movie poster composition."
    }
  },
  {
    id: 'clockwork_cartographer',
    name: 'Evelyn - Clockwork Explorer',
    imgUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    data: {
      name: "Evelyn Thorne",
      alias: "The Wind-up Archivist",
      age: "29",
      height: "5'6\" (168 cm)",
      build: "Poised and strictly upright, elegant posture but with a nervous energy that translates into rapid, precise hand movements.",
      ethnicity: "Victorian Steampunk, Ghibli-esque stylized design with large, highly expressive features.",
      structure: "Heart-shaped face, soft rounded cheeks, expressive eyebrows with subtle asymmetric curve.",
      skin: "Warm ivory, freckled across the bridge of the nose, smudge of brass polish on her forehead.",
      eyes: "Over-sized deep amber eyes, wide-set, reflecting clockwork gear outlines, highly expressive.",
      hair: "Thick chestnut hair tied up in a chaotic, loose bun secured with brass calipers, curly stray strands framing her face.",
      features: "Faint circular brass monocle-indentation mark around her right eye socket, deep laugh lines.",
      traits: "Intellectually insatiable, clumsy in social spaces, highly meticulous, stubbornly optimistic.",
      conflict: "She wants to map the uncharted floating islands but is restricted by her crumbling clockwork heart which needs frequent winding.",
      patterns: "Winds her wrist-watch whenever nervous, cleans her spectacles with her shirt-tail, hums steam engine rhythms.",
      baseline: "Perpetually curious, shifts rapidly to frantic excitement when discovering new map data.",
      bodyLanguage: "Leaning forward as if physically drawn to maps, hands gesturing wide coordinates.",
      rhythm: "Stiff and precise, alternating with sudden energetic bounces when excited.",
      idle: "Slight tapping of her leather-booted toes, adjusting her glove straps.",
      garment1: "Heavy, double-stitched brown leather corset vest over an ivory linen blouse, fabric showing realistic stretch and fabric pulling.",
      garment2: "Dark teal pleated utility skirt with brass reinforcement rings, showing light scuffs and ink stains.",
      layering: "A heavy oiled-canvas duster coat worn over one shoulder, draped naturally with complex fabric folds.",
      footwear: "High-top lace-up leather boots with brass eyelets, scuffed toes showing natural leather wear.",
      accessories: "An intricate brass mechanical arm gauntlet showing moving gears, worn leather tool belt.",
      props: "An ancient roll of star-maps inside a leather cylinder capsule, a pocket brass astrolabe.",
      environment: "An old library observatory filled with brass telescopes, floating dust motes illuminated by sunbeams.",
      lighting: "Warm golden hour sunlight streaming through a large stained-glass window, high contrast shadows.",
      colorTone: "Rich sepia tones, warm brass, emerald greens, and deep ambers.",
      expression: "A look of sudden eureka, eyes widened, lips slightly parted as if speaking a discovery.",
      camera: "50mm lens, soft focus background, realistic cinematic lighting and depth.",
      style: "Warm stylized realism, Ghibli-inspired details combined with Disney-esque soft character geometry."
    }
  }
];

export default function App() {
  // Application states
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [apiKey, setApiKey] = useState("");
  const [activeTab, setActiveTab] = useState('identity'); // identity | face | psychology | performance | wardrobe | portrait | style
  const [videoAction, setVideoAction] = useState("Walking slowly through a crowded market, checking over their shoulder with intense suspicion");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [currentMode, setCurrentMode] = useState('compiler'); // compiler | pitchboard | videoprompt
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generatedImg, setGeneratedImg] = useState(null);
  const [showNotification, setShowNotification] = useState(null);
  const [activePreset, setActivePreset] = useState("");

  // Word Document Template-mapped fields state
  const [formData, setFormData] = useState({
    name: "Aiden Vance",
    alias: "None",
    age: "28",
    height: "182 cm",
    build: "Lean, athletic with slightly elongated limbs. Posture is relaxed but coiled with physical capability.",
    ethnicity: "Pixar-style stylized realism with sharp, defined jaw and expressive brow lines.",
    structure: "Strong square jawline with soft geometric contours, pronounced cheekbones.",
    skin: "Olive-toned, highly realistic texture with minor sweat sheen and a faint scar across the left cheek.",
    eyes: "Intense hazel, slightly larger than life, bright reflecting highlights indicating active thought.",
    hair: "Messy, wind-tossed ash brown, individual clump definitions, dry matte texture.",
    features: "Small nick on the left eyebrow, light stubble across the jaw.",
    traits: "Determined, highly analytical, cautious, quietly compassionate.",
    conflict: "Desperately wants to protect his clan but fears his own unstable powers will cause their destruction.",
    patterns: "Unconsciously clenches his fists when challenged, checks his holster, looks towards the horizon.",
    baseline: "Stoic, calm, quiet but shifts into sharp focus under imminent danger.",
    bodyLanguage: "Slightly guarded stance, shoulders drawn back, poised for instant reaction.",
    rhythm: "Efficient and fluid, no wasted energy.",
    idle: "Subtle scanning of the perimeter, weight distributed evenly.",
    garment1: "Weathered brown leather tactical jacket with reinforced double stitching, showing cracks along sleeves.",
    garment2: "Fitted dark-grey canvas trousers with utility pockets and reinforced knee panels.",
    layering: "An off-center charcoal grey scarf wrapped twice, tucked under tactical shoulder straps.",
    footwear: "Ankle-high scuffed leather boots with thick rubber treading and mud stains.",
    accessories: "A brass pocket-watch tied to his belt, distressed leather fingerless gloves.",
    props: "A stylized hand-held scanning device with green light indicators.",
    environment: "A desolate cliffside overlooking a vast cloud-sea, ancient ruins crumbling in the background.",
    lighting: "Dramatic overcast mountain light, cold diffused sky ambient with warm orange rim light from a campfire.",
    colorTone: "Muted earth tones punctuated by high-contrast orange and teal atmospheric accents.",
    expression: "A micro-expression of sudden alarm, eyebrows pinched together, gaze locked on an unseen threat.",
    camera: "85mm cinematic prime, shallow depth of field, sharp foreground details.",
    style: "Semi-realistic cinematic design, appealing stylized geometry, professional film production lighting."
  });

  // Log handler
  const addLog = (message) => {
    setApiLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Notification helper
  const triggerNotification = (message, type = 'success') => {
    setShowNotification({ message, type });
    setTimeout(() => setShowNotification(null), 4000);
  };

  // Convert image file to Base64
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setImageBase64(reader.result.split(',')[1]);
        setActivePreset("");
        addLog("New reference image successfully loaded into local canvas.");
        triggerNotification("Reference image loaded. Click 'Analyze Reference with Gemini' to map data!");
      };
      reader.readAsDataURL(file);
    }
  };

  // Quick preset loader
  const loadPreset = (preset) => {
    setFormData(preset.data);
    setImage(preset.imgUrl);
    setImageBase64(""); // Presets don't need raw analysis upload unless triggered
    setActivePreset(preset.id);
    addLog(`Loaded production preset: ${preset.name}`);
    triggerNotification(`Applied preset parameters for "${preset.data.name}"`);
  };

  // Call Gemini API with Exponential Backoff
  const callGeminiAPI = async (promptText, imageBase64Data = null, isJson = true) => {
    const activeKey = apiKey || ""; // Allow custom key, or default empty string which pulls from environment
    const modelName = "gemini-2.5-flash-preview-09-2025";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`;
    
    // Build payload structure
    let parts = [{ text: promptText }];
    if (imageBase64Data) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: imageBase64Data
        }
      });
    }

    const payload = {
      contents: [{ parts }],
    };

    if (isJson) {
      payload.generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            alias: { type: "STRING" },
            age: { type: "STRING" },
            height: { type: "STRING" },
            build: { type: "STRING" },
            ethnicity: { type: "STRING" },
            structure: { type: "STRING" },
            skin: { type: "STRING" },
            eyes: { type: "STRING" },
            hair: { type: "STRING" },
            features: { type: "STRING" },
            traits: { type: "STRING" },
            conflict: { type: "STRING" },
            patterns: { type: "STRING" },
            baseline: { type: "STRING" },
            bodyLanguage: { type: "STRING" },
            rhythm: { type: "STRING" },
            idle: { type: "STRING" },
            garment1: { type: "STRING" },
            garment2: { type: "STRING" },
            layering: { type: "STRING" },
            footwear: { type: "STRING" },
            accessories: { type: "STRING" },
            props: { type: "STRING" },
            environment: { type: "STRING" },
            lighting: { type: "STRING" },
            colorTone: { type: "STRING" },
            expression: { type: "STRING" },
            camera: { type: "STRING" },
            style: { type: "STRING" }
          },
          required: [
            "name", "alias", "age", "height", "build", "ethnicity", "structure", "skin", "eyes", "hair", "features",
            "traits", "conflict", "patterns", "baseline", "bodyLanguage", "rhythm", "idle",
            "garment1", "garment2", "layering", "footwear", "accessories", "props",
            "environment", "lighting", "colorTone", "expression", "camera", "style"
          ]
        }
      };
    }

    // Exponential Backoff Loop
    let delay = 1000;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          return result;
        }
        
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      } catch (err) {
        if (attempt === 4) throw err; // Re-throw if last attempt fails
        addLog(`API Busy/Failed. Retrying in ${delay / 1000} seconds...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  };

  // Perform Gemini Image Analysis
  const handleAnalyzeImage = async () => {
    if (!image) {
      triggerNotification("Please select or upload a character reference image first!", "error");
      return;
    }

    setIsAnalyzing(true);
    setApiLogs([]);
    addLog("Initializing visual character scanning protocol...");
    addLog("Compiling base64 image data payload...");

    const analysisPrompt = `
      You are an expert film-production character designer and casting director.
      Analyze the uploaded character design / portrait image. Your task is to dissect the visual elements and return a highly detailed character design sheet conforming exactly to the structured layout.
      
      Generate creative, highly descriptive, industry-grade terminology for every field. If the image is a portrait, use logical creative extrapolation to fill out the clothing, shoes, props, and psychological profiles that perfectly match the visual aesthetic, genre, and lighting of the reference image.
      
      Output exactly in JSON format mapping all properties:
      - name: Creative cinematic full name
      - alias: Cool nickname or codename
      - age: Real or stylized age (e.g. "Late 20s", "420 (looks 25)")
      - height: Realistic height in metric or imperial
      - build: Body type, posture, proportions
      - ethnicity: Style language (e.g. "Pixar-style stylized realism", "Semi-realistic anime crossover")
      - structure: Head shape, bone structure, exaggerations
      - skin: Texture, color, micro-imperfections (scars, dirt, smudges)
      - eyes: Size, spacing, glow, expressive state
      - hair: Style, volume, clumping, movement dynamics
      - features: Notable unique traits (scars, markings, mechanical additions)
      - traits: 3 to 5 dominant personality traits
      - conflict: Internal desire vs personal roadblock
      - patterns: 3 physical habits that reveal their mind state
      - baseline: Core emotional state
      - bodyLanguage: Posture and muscle tension defaults
      - rhythm: Movement style (e.g. sharp, lazy, bouncy)
      - idle: Idle fidgeting or stillness habits
      - garment1: Fabric details, wear patterns, seams of top clothing
      - garment2: Fit and construction of bottom trousers/clothing
      - layering: Outerwear draping, jackets, or armor arrangements
      - footwear: Boots/shoes material and sole scuff styles
      - accessories: Small items revealing lore
      - props: Handheld equipment or gear
      - environment: A cinematic location where this character lives
      - lighting: Pro cinematographic setup (rembrandt, volumetric, rim)
      - colorTone: Color palette coordination
      - expression: A specific micro-expression showing mid-thought transition
      - camera: Prime lens setup, depth of field specification
      - style: Overall artistic direction
    `;

    try {
      addLog("Transmitting request to Gemini-2.5-Flash...");
      const result = await callGeminiAPI(analysisPrompt, imageBase64 || null, true);
      
      addLog("Successfully received model payload.");
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error("Empty candidate response returned from the model.");
      }

      const parsedData = JSON.parse(textResponse);
      setFormData(parsedData);
      addLog("Decoded structured JSON payload successfully.");
      addLog("Synchronized form inputs with AI analysis output.");
      triggerNotification("AI Analysis complete! Form fields updated with visual data.");
    } catch (error) {
      console.error(error);
      addLog(`Error: ${error.message}`);
      triggerNotification(`Failed to analyze image: ${error.message}. Loaded default fallback parameters instead.`, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate Image from the finalized compiled prompt via Imagen-4
  const handleGenerateCharacterSheet = async () => {
    setGenerationLoading(true);
    setGeneratedImg(null);
    addLog("Sending design sheet prompt to Imagen-4 generation engine...");

    const compiledPrompt = getCompiledPromptText();
    const activeKey = apiKey || "";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${activeKey}`;

    // Payload exactly matching instructions
    const payload = {
      instances: { prompt: compiledPrompt },
      parameters: { sampleCount: 1 }
    };

    let delay = 1000;
    let success = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          const base64Bytes = result.predictions?.[0]?.bytesBase64Encoded;
          if (base64Bytes) {
            setGeneratedImg(`data:image/png;base64,${base64Bytes}`);
            addLog("Successfully rendered high-fidelity concept image via Imagen 4.");
            triggerNotification("Concept Character Sheet generated successfully!");
            success = true;
            break;
          }
        }
        throw new Error(`HTTP Error ${response.status}`);
      } catch (err) {
        if (attempt === 4) {
          addLog(`Imagen 4 execution failed: ${err.message}`);
          triggerNotification("Could not connect to image generator. Using simulated rendering.", "info");
        }
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
    setGenerationLoading(false);
  };

  // Compile final prompt string based on state
  const getCompiledPromptText = () => {
    return `Create a cinematic, film-production-grade character design sheet for a director, casting team, and costume department. Character name: ${formData.name}. Must feel like a high-budget animated film pitch board, not a generic model sheet. CORE DIRECTIVE (NON-NEGOTIABLE): No generic layouts. No evenly spaced grids. No symmetry for symmetry's sake. Composition must feel art-directed, intentional, slightly asymmetrical. Every section must feel placed, not auto-generated.

CHARACTER IDENTITY: Name: ${formData.name} | Alias: ${formData.alias} | Age: ${formData.age} | Height: ${formData.height} | Build: ${formData.build} | Ethnicity / Design Language: ${formData.ethnicity}

FACE DESIGN: Structure: ${formData.structure} | Skin: ${formData.skin} | Eyes: ${formData.eyes} | Hair: ${formData.hair} | Distinct Features: ${formData.features}

PSYCHOLOGICAL PROFILE: Core Traits: ${formData.traits} | Internal Conflict: ${formData.conflict} | Behavior Patterns: ${formData.patterns} | Emotional Baseline: ${formData.baseline}

PERFORMANCE DIRECTION: Character must feel like a real actor caught mid-moment, NOT posing. Micro-expressions required (lip tension, eye flicker, brow shift). Avoid staged symmetry. Capture transitional emotion.
Body Language: ${formData.bodyLanguage} | Movement rhythm: ${formData.rhythm} | Idle behavior: ${formData.idle}

WARDROBE: Garment 1: ${formData.garment1} | Garment 2: ${formData.garment2} | Layering logic: ${formData.layering} | Footwear: ${formData.footwear} | Accessories: ${formData.accessories} | Props: ${formData.props}

MATERIAL ACCURACY: Fabrics must show stretch, stitching, wrinkles, wear. No plastic look unless intentional. Skin must have soft light interaction. Include imperfections: dirt, smudges, aging, usage marks.

TURNAROUND (STRICT): Full-body front, 3/4, side, back, 3/4 back views. Identical proportions and design fidelity. No drift in face or costume across any angle.

HEAD STUDY: Front (neutral) | 3/4 (primary personality) | Profile (structure) | Looking Down | Looking Up | Dynamic Angle (intense state). All expressions mid-thought, not posed.

CINEMATIC PORTRAIT: Environment: ${formData.environment} | Lighting: ${formData.lighting} | Color Tone: ${formData.colorTone} | Expression: ${formData.expression} | Camera: ${formData.camera}

LAYOUT: Clean, art-directed sheet. Neutral gray background. Include: height scale, annotation callouts, wardrobe breakdown, production notes. Must feel like a premium studio board.

STYLE: ${formData.style}. Must include: appealing exaggeration, soft geometry, cinematic lighting, high emotional readability.

CONSISTENCY RULE (STRICT): Face, proportions, costume, and details must remain IDENTICAL across all views. No reinterpretation between angles. Ever.

OUTPUT: Extremely high detail. Sharp focus. Production-ready fidelity. Suitable for film development, merchandising, and pitch decks.`;
  };

  // Compile Video Prompt Text
  const handleCompileVideoPrompt = () => {
    const videoPromptText = `Cinematic video scene, highly realistic camera tracking. Character: ${formData.name} (Alias: ${formData.alias}), described as a ${formData.ethnicity} with a ${formData.build} build. 
Facial features: ${formData.eyes} eyes, ${formData.hair} hair, ${formData.structure} face structure with ${formData.skin}.
Wardrobe includes: ${formData.garment1} layered with ${formData.layering}, wearing ${formData.footwear}.
Action: The character is ${videoAction}. Their body language is ${formData.bodyLanguage} with a ${formData.rhythm} rhythm, showing signs of ${formData.idle}.
Environment: ${formData.environment}.
Lighting: ${formData.lighting}, showcasing real physical fabric interactions, rich depth, accurate environmental reflections. 
Camera: Cinematic camera, ${formData.camera}, extreme shallow depth of field, natural motion blur, production-ready cinematic visual fidelity.`;
    
    setVideoPrompt(videoPromptText);
    triggerNotification("Cinematic Video Prompt successfully compiled!");
  };

  // Sync video prompt changes whenever active fields or action changes
  useEffect(() => {
    handleCompileVideoPrompt();
  }, [formData, videoAction]);

  // Utility to handle clipboard copy
  const copyToClipboard = (textToCopy) => {
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = textToCopy;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    try {
      document.execCommand('copy');
      triggerNotification("Copied prompt text to clipboard!");
    } catch (err) {
      triggerNotification("Could not copy automatically. Please select and copy manually.", "error");
    }
    document.body.removeChild(tempTextArea);
  };

  // Custom Input Field Helper
  const renderField = (label, key, placeholder, description) => {
    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            {label}
          </label>
          {description && (
            <span className="text-[10px] text-slate-500 italic font-mono">{description}</span>
          )}
        </div>
        <textarea
          className="w-full bg-slate-900/90 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-150 resize-y min-h-[64px]"
          value={formData[key] || ""}
          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
          placeholder={placeholder}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Dynamic Floating Notification */}
      {showNotification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border transition-all duration-300 transform translate-y-0 scale-100 ${
          showNotification.type === 'error' 
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-200' 
            : showNotification.type === 'info'
            ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
            : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
        }`}>
          {showNotification.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" /> : <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
          <div className="text-sm font-medium">{showNotification.message}</div>
        </div>
      )}

      {/* Primary Studio Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-purple-600 rounded-xl shadow-lg shadow-cyan-500/10">
            <Film className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                PREMIUM CHARACTER SHEET PROMPTER
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-800/40 text-[10px] text-cyan-400 font-mono font-semibold uppercase tracking-widest">
                Studio V2
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Art-Directed Model Sheets, Turnarounds & Live Action Director Outputs
            </p>
          </div>
        </div>

        {/* Global Control Interface */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Preset Pill Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl p-1">
            <span className="text-[10px] uppercase tracking-wider font-mono px-2 text-slate-500 font-bold">Presets:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => loadPreset(preset)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-all duration-150 ${
                  activePreset === preset.id 
                    ? 'bg-slate-800 border border-slate-700 text-cyan-400 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                {preset.name.split(' - ')[0]}
              </button>
            ))}
          </div>

          {/* API Key Modal / Settings panel */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/60 rounded-xl px-2.5 py-1.5 shadow-inner">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">Gemini API Key:</span>
            <input 
              type="password" 
              placeholder="System Default Active" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-36 font-mono"
            />
          </div>
        </div>
      </header>

      {/* Workspace Arena */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-0 overflow-y-auto">
        
        {/* LEFT COLUMN: Visual Reference, Scanning Desk & Form Editor (7 Cols) */}
        <section className="xl:col-span-7 border-r border-slate-800 flex flex-col bg-slate-950">
          
          {/* Stage 1: The Visual Scanner Panel */}
          <div className="p-6 border-b border-slate-800 bg-slate-900/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                </span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 font-mono">
                  Visual Character Reference & AI Analyzer
                </h3>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">STEP 1: PROVIDE REFERENCE IMAGE</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Drop / Preview Canvas */}
              <div className="md:col-span-4 relative group aspect-square md:aspect-auto md:h-44 border-2 border-dashed border-slate-800 hover:border-cyan-500/40 rounded-xl overflow-hidden bg-slate-900/40 flex flex-col items-center justify-center transition-all duration-300">
                {image ? (
                  <>
                    <img 
                      src={image} 
                      alt="Reference Character Visual" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                      <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1">
                        <RotateCcw className="w-3.5 h-3.5" />
                        Replace
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                    </div>
                  </>
                ) : (
                  <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-4 text-center group-hover:bg-slate-900/20">
                    <Upload className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 mb-2.5 transition-colors" />
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 block">Upload Reference</span>
                    <span className="text-[10px] text-slate-600 block mt-1">Drag file or click</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                )}

                {/* Laser scan effect overlay during analysis */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none overflow-hidden">
                    <div className="w-full h-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-pulse relative top-0" style={{
                      animation: 'scan 2s linear infinite',
                      position: 'absolute'
                    }}></div>
                  </div>
                )}
              </div>

              {/* Action Deck & Interactive Studio Terminal */}
              <div className="md:col-span-8 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-1">
                    {image ? "Reference Loaded Successfully" : "Awaiting Image Attachment"}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    Upload a portrait, rough sketch, or style concept. The Gemini vision model will analyze your reference image to describe and map professional physical details, apparel choices, and character aesthetics directly into the prompt template fields below.
                  </p>
                </div>

                {/* AI Describe trigger Button - PROMINENT & ACTIVE */}
                <div className="flex gap-2.5">
                  <button
                    onClick={handleAnalyzeImage}
                    disabled={isAnalyzing || !image}
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2.5 transition-all duration-200 ${
                      !image 
                        ? 'bg-slate-900/50 border border-slate-800 text-slate-600 cursor-not-allowed'
                        : isAnalyzing 
                        ? 'bg-cyan-950 border border-cyan-800 text-cyan-400 animate-pulse'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] shadow-lg hover:scale-[1.01]'
                    }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        AI Analysis in Progress...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950" />
                        Analyze Reference with Gemini AI
                      </>
                    )}
                  </button>

                  {image && (
                    <button
                      onClick={() => { setImage(null); setImageBase64(""); setApiLogs([]); setActivePreset(""); }}
                      className="px-3.5 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-950/20 rounded-xl transition-colors text-slate-400 hover:text-rose-400"
                      title="Clear Reference"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Simulated Live Studio Terminal Feed */}
            {apiLogs.length > 0 && (
              <div className="mt-4 bg-slate-950 border border-slate-800/80 rounded-xl p-3 max-h-36 overflow-y-auto font-mono">
                <div className="flex items-center gap-1.5 border-b border-slate-900 pb-1.5 mb-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Studio Scanner Logs</span>
                </div>
                {apiLogs.map((log, index) => (
                  <div key={index} className="text-[10px] text-slate-400 leading-relaxed py-0.5 border-l-2 border-slate-800 pl-2 ml-0.5">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stage 2: Step-by-Step Production Form Editor */}
          <div className="flex-1 flex flex-col min-h-[500px]">
            {/* Form Segment Tabs */}
            <div className="border-b border-slate-800 bg-slate-900/20 p-2 flex gap-1 overflow-x-auto scrollbar-none sticky top-[81px] z-10 backdrop-blur-sm">
              {[
                { id: 'identity', label: 'Identity', icon: User },
                { id: 'face', label: 'Face Design', icon: SmileIcon },
                { id: 'psychology', label: 'Psychology', icon: BrainIcon },
                { id: 'performance', label: 'Performance', icon: Play },
                { id: 'wardrobe', label: 'Wardrobe', icon: ShirtIcon },
                { id: 'portrait', label: 'Cinematic Portrait', icon: Image },
                { id: 'style', label: 'Style & Art', icon: Sliders }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all duration-150 shrink-0 ${
                      activeTab === tab.id
                        ? 'bg-slate-800 text-white shadow-md border border-slate-700/60'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Interactive Inputs */}
            <div className="p-6 flex-1 overflow-y-auto max-h-[600px]">
              
              {activeTab === 'identity' && (
                <div className="space-y-4">
                  <div className="border-l-4 border-cyan-500 pl-3 mb-6">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Character Identity</h3>
                    <p className="text-xs text-slate-500">Define general naming conventions, age metrics, stature, and baseline ethnic styling</p>
                  </div>
                  {renderField("Character Name", "name", "e.g. Vance Sterling", "Must sound premium and movie-ready")}
                  {renderField("Alias / Codename", "alias", "e.g. Neon Ghost", "Optional nickname")}
                  {renderField("Age Structure", "age", "e.g. 24", "Real or stylized age")}
                  {renderField("Stature & Height", "height", "e.g. 180 cm", "E.g., 5'11\" (180 cm)")}
                  {renderField("Proportions & Build", "build", "e.g. Wire-thin, slouched stance", "Body structure and default posture")}
                  {renderField("Design Language & Style Style", "ethnicity", "e.g. Pixar-style stylized realism", "Art style, aesthetic roots")}
                </div>
              )}

              {activeTab === 'face' && (
                <div className="space-y-4">
                  <div className="border-l-4 border-cyan-500 pl-3 mb-6">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Face & Head Detail</h3>
                    <p className="text-xs text-slate-500">Sculpt details, skin textures, eye expressions, hair styling, and iconic micro-features</p>
                  </div>
                  {renderField("Bone Structure", "structure", "e.g. Chiseled, angular jawline", "Head shape and geometric stylization")}
                  {renderField("Skin Texture & Surface", "skin", "e.g. Matte warm olive, minor freckles", "Light interaction, dirt, aging marks")}
                  {renderField("Eyes & Expressive Iris", "eyes", "e.g. Large hazel, active highlights", "Glow, expressive focus, color, shape")}
                  {renderField("Hair Dynamics", "hair", "e.g. Spiky undercut, messy clumps", "Flow direction, color, strand shapes")}
                  {renderField("Distinct Facial Marks", "features", "e.g. Thin cybernetic port scar on temple", "Birthmarks, scars, tattoos, prosthetics")}
                </div>
              )}

              {activeTab === 'psychology' && (
                <div className="space-y-4">
                  <div className="border-l-4 border-cyan-500 pl-3 mb-6">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Psychological Profile</h3>
                    <p className="text-xs text-slate-500">Define core characteristics, motivations, internal conflicts, and behavioral actions</p>
                  </div>
                  {renderField("Core Personality Traits", "traits", "e.g. Resourceful, paranoid, loyal", "3 to 5 dominant traits")}
                  {renderField("Internal Narrative Conflict", "conflict", "e.g. Wants safety but feels duty-bound", "What they want vs what holds them back")}
                  {renderField("Behavioral Patterns", "patterns", "e.g. Constantly taps mechanical gauntlet", "3 habits highlighting their frame of mind")}
                  {renderField("Emotional Baseline State", "baseline", "e.g. Quiet stoicism, shifting to panic", "Core mood and rate of transition")}
                </div>
              )}

              {activeTab === 'performance' && (
                <div className="space-y-4">
                  <div className="border-l-4 border-cyan-500 pl-3 mb-6">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Performance Direction</h3>
                    <p className="text-xs text-slate-500">Provide direct motion and animation notes for the model sheet pose aesthetics</p>
                  </div>
                  {renderField("Default Body Language", "bodyLanguage", "e.g. Coiled stance, shoulders held tight", "Resting tension and alignment")}
                  {renderField("Movement Rhythm", "rhythm", "e.g. Swift, sharp, calculated", "Walk rhythm, reaction rate")}
                  {renderField("Idle Behavior", "idle", "e.g. Continuous scanning of exit routes", "Fidgeting, breathing depth, tension")}
                </div>
              )}

              {activeTab === 'wardrobe' && (
                <div className="space-y-4">
                  <div className="border-l-4 border-cyan-500 pl-3 mb-6">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Wardrobe & Gear Specification</h3>
                    <p className="text-xs text-slate-500">Outline the materials, layering, footwear styles, and core handheld design props</p>
                  </div>
                  {renderField("Garment 1 (Torso / Top)", "garment1", "e.g. Weathered leather tactical jacket", "Fabric type, stitch colors, realistic wear")}
                  {renderField("Garment 2 (Legs / Bottom)", "garment2", "e.g. Dark-grey technical cargo pants", "Fit style, pocket sizes, wear patterns")}
                  {renderField("Draping & Layering Logic", "layering", "e.g. Loose dark-grey scarf over armor", "Fabric weight, overlap layers")}
                  {renderField("Footwear Model", "footwear", "e.g. High-top scuffed combat boots", "Footwear material, dust details, sole wear")}
                  {renderField("Accessories", "accessories", "e.g. Mechanized brass arm-gauntlet", "Small items revealing backstory details")}
                  {renderField("Handheld Props", "props", "e.g. Compact rusty data scanner", "Character gadgets, tools or weaponry")}
                </div>
              )}

              {activeTab === 'portrait' && (
                <div className="space-y-4">
                  <div className="border-l-4 border-cyan-500 pl-3 mb-6">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Cinematic Portrait Settings</h3>
                    <p className="text-xs text-slate-500">Configure scene cameras, lighting directions, color tones, and environmental staging</p>
                  </div>
                  {renderField("Environment & Location", "environment", "e.g. Crumbling stone observatory", "Exact cinematic background environment")}
                  {renderField("Lighting Profile", "lighting", "e.g. Rim-lighting, volumetric clouds", "Source lights, key angles, contrast levels")}
                  {renderField("Color Palette Coordination", "colorTone", "e.g. Dark teal atmosphere with neon ambers", "Warmth, coolness, stylized color grading")}
                  {renderField("Micro-Expression Frame", "expression", "e.g. Sudden eye widening, mouth slightly parted", "The precise split-second emotion")}
                  {renderField("Cinematographic Camera Setup", "camera", "e.g. 85mm prime lens, shallow depth of field", "Focal length, realistic aperture background bokeh")}
                </div>
              )}

              {activeTab === 'style' && (
                <div className="space-y-4">
                  <div className="border-l-4 border-cyan-500 pl-3 mb-6">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Aesthetic & Render Style</h3>
                    <p className="text-xs text-slate-500">Direct stylistic constraints to dictate the overall quality of output assets</p>
                  </div>
                  {renderField("Stylistic Theme", "style", "e.g. Warm Disney-style stylized 3D design", "Stylistic design (Pixar, anime, high realism)")}
                </div>
              )}

            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Studio outputs, Live Compiler, Pitch-board & Video Director (5 Cols) */}
        <section className="xl:col-span-5 bg-slate-900/40 flex flex-col border-t xl:border-t-0 border-slate-800">
          
          {/* Workspace Tab Toggles */}
          <div className="border-b border-slate-800 bg-slate-950 p-4 flex gap-2">
            <button
              onClick={() => setCurrentMode('compiler')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                currentMode === 'compiler'
                  ? 'bg-slate-800 border border-slate-700 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <FileText className="w-4 h-4" />
              Live Prompt
            </button>
            
            <button
              onClick={() => setCurrentMode('pitchboard')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                currentMode === 'pitchboard'
                  ? 'bg-slate-800 border border-slate-700 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Compass className="w-4 h-4" />
              Pitch Board
            </button>

            <button
              onClick={() => setCurrentMode('videoprompt')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                currentMode === 'videoprompt'
                  ? 'bg-slate-800 border border-slate-700 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Video className="w-4 h-4" />
              Video Director
            </button>
          </div>

          {/* View Panels */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[85vh]">
            
            {/* VIEW A: Real-time Compiled Character Sheet Prompt */}
            {currentMode === 'compiler' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Production-Ready Form Prompt</h3>
                    <p className="text-xs text-slate-500">Live compilation of your Word document configuration</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(getCompiledPromptText())}
                    className="px-3 py-1.5 bg-cyan-950 border border-cyan-800/80 hover:bg-cyan-900 text-cyan-400 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy All
                  </button>
                </div>

                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 to-purple-500/5 rounded-xl pointer-events-none border border-slate-800/80"></div>
                  <pre className="p-4 bg-slate-950/80 text-slate-300 font-mono text-[11px] leading-relaxed rounded-xl overflow-x-auto whitespace-pre-wrap max-h-[460px] border border-slate-800 select-all scrollbar-thin">
                    {getCompiledPromptText()}
                  </pre>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                      Image Engine Render Setup
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-normal">
                    You can copy the prompt above directly into Midjourney, Stable Diffusion, or use Gemini's built-in preview engine directly below to render concept art sheets instantly.
                  </p>
                  <button
                    onClick={handleGenerateCharacterSheet}
                    disabled={generationLoading}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all duration-150 ${
                      generationLoading 
                        ? 'bg-slate-900 border-slate-800 text-slate-500 animate-pulse'
                        : 'bg-cyan-500 hover:bg-cyan-400 border-cyan-400/20 text-slate-950 hover:shadow-lg'
                    }`}
                  >
                    {generationLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Imagen Engine Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Generate Visual Sheet via Imagen 4
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* VIEW B: Premium Pitch Board Mockup */}
            {currentMode === 'pitchboard' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Creative Production Pitch Board</h3>
                  <p className="text-xs text-slate-500">Live blueprint mockup rendering visual proportions and design callouts</p>
                </div>

                {/* Simulated Character Board */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
                  
                  {/* Top blueprint grids */}
                  <div className="bg-slate-900/80 border-b border-slate-800 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-500"></div>
                      <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest">
                        Model: {formData.name || "Awaiting Setup"}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-cyan-500">
                      SCALE RATIO: 1:12
                    </span>
                  </div>

                  {/* Character visual panel */}
                  <div className="p-6 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950 min-h-[300px]">
                    {generatedImg ? (
                      <div className="w-full">
                        <img 
                          src={generatedImg} 
                          alt="AI Generated Concept Pitch Board" 
                          className="w-full h-auto rounded-lg shadow-xl border border-slate-800"
                        />
                        <p className="text-[10px] text-slate-400 font-mono text-center mt-2.5 italic">
                          Real-time rendering generated utilizing active compiled parameters
                        </p>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col items-center text-center py-6">
                        {/* Interactive Scale Ruler Simulation */}
                        <div className="w-full h-24 mb-6 flex items-end justify-center gap-1.5 border-b border-slate-800 pb-2 relative">
                          <span className="absolute left-2 top-0 text-[9px] text-slate-500 font-mono">HEIGHT GRAPH</span>
                          
                          {/* Simulated silhouette heights */}
                          <div className="w-1.5 h-16 bg-slate-800 rounded-t"></div>
                          <div className="w-1.5 h-20 bg-slate-800 rounded-t"></div>
                          <div className="w-1.5 h-24 bg-gradient-to-t from-cyan-950 to-cyan-500 rounded-t relative group">
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-mono text-cyan-400 bg-slate-950 border border-cyan-800 px-1 rounded whitespace-nowrap">
                              {formData.height || "180cm"}
                            </span>
                          </div>
                          <div className="w-1.5 h-14 bg-slate-800 rounded-t"></div>
                          <div className="w-1.5 h-18 bg-slate-800 rounded-t"></div>
                        </div>

                        <User className="w-12 h-12 text-slate-700 mb-2.5" />
                        <span className="text-xs font-semibold text-slate-400">Blueprint Sketch Active</span>
                        <p className="text-[10px] text-slate-500 max-w-[240px] mt-1.5">
                          Tweak prompt inputs or hit "Generate Visual Sheet" above to render a fully detailed movie poster preview!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Production specs footer */}
                  <div className="bg-slate-900/40 border-t border-slate-800 p-4 grid grid-cols-2 gap-3.5 text-[11px] font-mono text-slate-400">
                    <div>
                      <span className="text-[9px] text-slate-500 block">PROTAGONIST BUILD</span>
                      <span className="text-slate-300 font-semibold">{formData.build?.slice(0, 42)}...</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">WARDROBE SEAMS</span>
                      <span className="text-slate-300 font-semibold">{formData.garment1?.slice(0, 42)}...</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-800/80 pt-2.5">
                      <span className="text-[9px] text-slate-500 block">KEY EXPRESSIVE PERFORMANCE DIRECTION</span>
                      <span className="text-cyan-400 font-medium">"{formData.expression || "No action recorded"}"</span>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* VIEW C: Live Cinematic Video Prompter */}
            {currentMode === 'videoprompt' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200">Cinematic Video Prompt Engine</h3>
                  <p className="text-xs text-slate-500">
                    Generates dynamic motion prompts for Sora, Runway Gen-3, or Luma using your custom character details as consistent anchor data.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5 font-mono">
                      Define Dynamic Scene Action
                    </label>
                    <textarea
                      value={videoAction}
                      onChange={(e) => setVideoAction(e.target.value)}
                      placeholder="e.g. Walking down a rainy Tokyo street looking back in distress..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 min-h-[72px]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCompileVideoPrompt}
                      className="flex-1 py-2 bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Re-Compile Motion Video Prompt
                    </button>
                    
                    <button
                      onClick={() => copyToClipboard(videoPrompt)}
                      className="px-3 bg-cyan-950 border border-cyan-800 text-cyan-400 text-xs font-semibold rounded-lg hover:bg-cyan-900 transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    Compiled Video Prompt Output
                  </span>
                  <div className="p-4 bg-slate-950 text-slate-300 font-mono text-[10px] leading-relaxed rounded-xl border border-slate-800 select-all max-h-[220px] overflow-y-auto">
                    {videoPrompt || "Compiling motion matrix..."}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono pt-1">
                    <Info className="w-3.5 h-3.5 text-cyan-500/80" />
                    Copy this directly into Runway Gen-3 Alpha, Sora, or Luma Dream Machine to maintain highly detailed facial/clothing anchors!
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Quick Info Desk Footer */}
          <div className="border-t border-slate-800 p-4 bg-slate-950 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>STUDIO APP CONFIG: active</span>
            <span>MODEL: {image ? "AI SCANNED" : "MANUAL BUILD"}</span>
          </div>
        </section>

      </main>

    </div>
  );
}

// Inline Simplified Icon helpers for self-contained execution
function SmileIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function BrainIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function ShirtIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M20.38 3.46 16 1.7a2 2 0 0 0-1.48 0l-4.52 1.82a2 2 0 0 1-1.48 0L4 1.7a2 2 0 0 0-1.48 0L1.13 4.2a2 2 0 0 0-.15 2.45l2.64 4.13a2 2 0 0 0 1.62.9h1.75a1 1 0 0 1 1 1v7a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-7a1 1 0 0 1 1-1h1.75a2 2 0 0 0 1.62-.9l2.64-4.13a2 2 0 0 0-.15-2.45z" />
    </svg>
  );
}