# The Listening Post — Demo Video Script

**Format:** Prescription drug commercial parody
**Length:** 90 seconds
**Tools:** ElevenLabs Flow (voiceover + music + SFX), Veo 3.1 (cinematic scenes, 8s max each), Remotion (motion graphics + assembly), screen recordings
**Tone:** Warm, slightly absurd, pharmaceutical-ad sincerity with a civic news punchline

---

## THE SCRIPT

### COLD OPEN (0:00-0:08)
**[Veo 3.1 Scene 1: 8s]** Soft-focus shot of someone scrolling their phone at a kitchen table, morning light, coffee steam. They look frustrated, overwhelmed by headlines.

**NARRATOR (ElevenLabs Flow — calm pharmaceutical voice):**
"Are you tired of not knowing what your city council voted on last Tuesday?"

---

### THE PROBLEM (0:08-0:18)
**[Veo 3.1 Scene 2: 5s]** Person staring at a wall of confusing government PDFs on a laptop. Papers scattered.

**[Veo 3.1 Scene 3: 5s]** Same person at dinner with friends, shrugging when someone asks "Did you hear about the zoning thing?"

**NARRATOR:**
"Do you suffer from chronic civic confusion? Legislative bewilderment? Zoning-related anxiety?"

---

### THE PRODUCT REVEAL (0:18-0:30)
**[Remotion: Motion graphic — pill bottle labeled "THE LISTENING POST" spins into frame. Milwaukee skyline in background.]**

**NARRATOR:**
"Introducing The Listening Post."

**[Screen recording: Homepage loads. Podcast player visible. Clean, editorial dark mode.]**

**NARRATOR:**
"The first AI-powered newsroom that wakes up every morning, reads what Congress and your state legislature did, and turns it into a podcast you can listen to on your commute."

---

### THE EXPERIENCE (0:30-0:50)
**[Screen recording: Press play on the podcast. Audio clip of Marcus, Sarah, and Kesha plays for 3 seconds — real episode audio.]**

**NARRATOR:**
"Three AI correspondents. Real Milwaukee news. Every morning at six AM."

**[Screen recording: Scrolling the City Hall page — new restaurants, legislation, meetings.]**

**NARRATOR:**
"New restaurants opening in your neighborhood. What the council is working on. Legislation moving through committees."

**[Screen recording: Click "Talk to Kesha" — voice agent orb appears. User asks a question.]**

**NARRATOR:**
"And if you have questions... just ask."

---

### THE SIDE EFFECTS (0:50-1:10)
**[Veo 3.1 Scene 4: 8s]** Person walking confidently into a coffee shop, phone in hand, smiling. Sunlight.

**NARRATOR (reading faster, classic drug-ad cadence):**
"Side effects of The Listening Post may include: knowing what legislation your representatives are pushing..."

**[Veo 3.1 Scene 5: 8s]** Person at a dinner party, confidently explaining something. Friends leaning in, impressed.

**NARRATOR:**
"...dangerously informed dinner conversations... spontaneous opinions about TIF districts..."

**[Remotion: Quick montage — topic pages flashing: Housing, Economy, Politics, Health. FRED data cards. Bill tracker.]**

**NARRATOR:**
"...an unexplained urge to attend city council meetings... and a sudden awareness that there are fifteen aldermanic districts."

---

### THE TECH FLEX (1:10-1:20)
**[Remotion: Animated infographic — Cloudflare + ElevenLabs logos. Service icons appear one by one:]**

**NARRATOR:**
"Powered by seven Cloudflare services. Four ElevenLabs APIs. Runs autonomously. No human in the loop."

**[Remotion: Text overlay — "8 Data Sources → AI Triage → 3-Voice Podcast → Published by 6 AM"]**

---

### THE CLOSE (1:18-1:30)
**[Veo 3.1 Scene 6: 8s]** Milwaukee skyline at golden hour. Narrator starts speaking over the last 3 seconds of the skyline.

**NARRATOR (over skyline, warm and sincere):**
"Ask your city council about The Listening Post."

**[Remotion: Logo + URL fades in over the skyline shot, holds for 4s]**
**"the listening POST"**
**listening-post.vercel.app**

**NARRATOR (over logo card):**
"Local news didn't die because nobody needed it."

---

## ASSET LIST

### Veo 3.1 Scenes (6 clips, each ≤8 seconds)

**Shared style prefix for ALL Veo prompts:** "35mm film, warm color grade, shallow depth of field, slow subtle camera movement, cinematic lighting, no text overlay"

**Character consistency:** Never show faces clearly — use over-shoulder shots, hands-only, silhouettes, or wide shots to avoid Veo's inconsistent face generation.

| # | Prompt (prepend shared style prefix) | Duration | Section |
|---|--------|----------|---------|
| 1 | Over-shoulder shot of person scrolling phone at kitchen table, morning light streaming through window, steam rising from coffee cup, frustrated body language | 8s | Cold Open |
| 2 | Overhead shot of hands on laptop keyboard, confusing government PDF documents visible on screen, papers scattered on desk, overwhelmed energy | 5s | Problem |
| 3 | Wide shot of dinner table with friends, one person shrugging with palms up "I don't know" gesture, warm restaurant lighting, laughter in background | 5s | Problem |
| 4 | Back-of-head shot of person walking confidently down a Milwaukee city street, phone in hand, morning golden sunlight, urban buildings | 8s | Side Effects |
| 5 | Wide shot of dinner party, one person gesturing enthusiastically explaining something, friends leaning in impressed, warm candlelit lighting, hands visible | 8s | Side Effects |
| 6 | Cinematic aerial shot of Milwaukee skyline at golden hour, Lake Michigan in foreground, reflections on water, no people | 8s | Close |

### Screen Recordings (4 captures)
| # | What to capture | Choreography | Duration | Section |
|---|----------------|-------------|----------|---------|
| 1 | Homepage loads, scroll down slowly past podcast hero + stories | Start at top, slow scroll to "Today's News" | 5s | Product Reveal |
| 2 | Press play on sticky player, audio plays, act pill highlights | Click play button, wait for audio to start, show waveform | 3s | Experience |
| 3 | City Hall page — scroll through restaurants accordion, open one | Navigate to /city-hall, click an accordion item, scroll to legislation | 5s | Experience |
| 4 | Click "Talk to Kesha" on an article, orb appears, type "What does this bill do?" | Navigate to article, click button, wait for orb, type the question | 5s | Experience |

**Audio mix note:** During screen recording 2, duck the narrator and background music. Let the real podcast audio (Marcus/Sarah/Kesha voices) play at full volume for 3 seconds so judges HEAR the voices. Then narrator comes back over.

### ElevenLabs Flow Pipeline
| Node | Purpose |
|------|---------|
| Text → TTS | Narrator voiceover (pharmaceutical ad voice — calm, warm, authoritative) |
| Music | Background music — soft piano + light strings (pharma ad mood) |
| SFX | Transition whooshes between sections |
| Composition | Layer voice + music + SFX |

### Remotion Motion Graphics (4 sequences)
**Specs:** 1920x1080, 30fps, MP4 output. All graphics use the Listening Post color palette: dark bg (#0a0a0a), coral accent (#D85A30), white text, Anybody font for headlines.
| # | What | Duration | Section |
|---|------|----------|---------|
| 1 | 2D pill bottle graphic (flat design, not 3D) with "THE LISTENING POST" label, slides in from right, Milwaukee skyline bg | 3s | Product Reveal |
| 2 | Quick topic page montage (Housing → Economy → Politics → Health) | 4s | Side Effects |
| 3 | Left side: Cloudflare logo + 8 service names fading in vertically. Right side: ElevenLabs logo + 4 API names. Center: animated pipeline arrow connecting them. Dark bg, coral accents. | 8s | Tech Flex |
| 4 | Logo + URL reveal with fade | 5s | Close |

---

## PRODUCTION ORDER

### Phase 1: Asset Production (parallel)
1. **ElevenLabs Flow** — Build scene pipelines:
   - Scene 1-6: Veo 3.1 prompts → generated video clips (8s max each)
   - Narrator TTS: full voiceover track using pharma-ad voice
   - Music: soft piano + strings background track
   - SFX: transition whooshes, subtle UI sounds
   - Export each scene as individual clips with audio baked in
2. **Screen recordings** — Capture 4 app clips from the live site
3. **Remotion motion graphics** — Build 4 animated sequences:
   - Pill bottle reveal
   - Topic page montage
   - Tech infographic (Cloudflare + ElevenLabs)
   - Logo + URL card

### Phase 2: Final Assembly in Remotion
4. **Import all assets into Remotion:**
   - Flow scene clips (6 Veo scenes with voiceover + music)
   - Screen recordings (4 clips)
   - Motion graphic sequences (4 Remotion-built animations)
5. **Remotion compiles the final 90-second video:**
   - Precise timing and sequencing per the script
   - Transitions between scenes
   - Text overlays (side effects text, tech specs)
   - Audio mixing (narrator ducks for podcast clip at 0:33)
   - Export 1920x1080 30fps MP4

### Phase 3: Polish + Submit
6. **Review final render** — check timing, audio levels, readability
7. **Submit to hackathon**

### Why this workflow:
- **Flow** = AI-powered scene production (Veo + TTS + music + SFX in one pipeline)
- **Remotion** = programmatic video assembly (precise frame-level control, motion graphics, final export)
- Flow produces the ingredients, Remotion bakes the cake

---

## HUMANIZER NOTES

The script avoids AI slop by:
- Leading with a relatable human problem (not a feature list)
- Using humor that's specific to civic life (TIF districts, aldermanic districts)
- The "side effects" format lets us list features without it feeling like a pitch deck
- The close pivots from funny to genuine — "Local news didn't die because nobody needed it"
- No buzzwords: no "leveraging AI," no "revolutionary platform," no "powered by cutting-edge"
- The narrator voice IS the joke — the pharmaceutical sincerity applied to civic news is inherently absurd
