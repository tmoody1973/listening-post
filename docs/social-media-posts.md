# The Listening Post — Social Media Posts

---

## LINKEDIN

### Post 1: The origin story

1,800 local newsrooms have closed since 2005.

Milwaukee used to have reporters at every city council meeting. Every zoning fight. Every school board vote. Now nobody's there.

So I built an AI newsroom. In a week. I'm not even a developer. I'm a Howard-trained architect with Claude Code and 20 years of being annoyed that I can't find out what my alderperson voted on.

It has three AI hosts named Marcus, Sarah, and Kesha. Every morning at 6 AM they deliver a Milwaukee briefing. Congress, state legislature, economic data, new restaurant openings, the whole thing. I wake up and it's already done.

The part that still trips me out: you can talk to the reporter. Click a button on any article and have an actual voice conversation with Kesha about the story. She'll search the web if she doesn't know the answer.

It also scrapes Milwaukee's license application system and found 17 new restaurants filing to open. Eggrollicious on Menomonee River Parkway. Crab Legs and Sushi on Mitchell Street. That's the kind of thing a neighborhood reporter used to cover.

Runs on Cloudflare's edge. Four ElevenLabs APIs for the voices and music. No servers. Costs about $6/month.

Side effects may include knowing what your representatives actually voted on.

listening-post.vercel.app

Built for #ElevenHacks (Cloudflare × ElevenLabs hackathon).

#BuildInPublic #ClaudeCode #Cloudflare #ElevenLabs #LocalNews #Milwaukee #ElevenHacks

---

### Post 2: The tech under the hood

There's something kind of unsettling about an AI newsroom that works harder than you do.

Every morning at 3 AM, mine wakes up. It pulls from Congress, the state legislature, Milwaukee's Legistar system, FRED economic data, Perigon, Perplexity, the city's building permit database, and a restaurant license scraper I built because I wanted to know what's opening on Mitchell Street.

Then it writes a broadcast script. Three hosts argue about zoning reform and hand off to each other mid-sentence. ElevenLabs Text to Dialogue handles the conversation. There's an intro jingle the Music API generated. Transition stingers from the Sound Effects API. By 6 AM, it's published and I haven't touched anything.

The stack, if you're curious:

Cloudflare side: Workers, Agents SDK for the scheduling, D1 for the database, R2 for audio, KV for caching, Vectorize for editorial memory, Workers AI for triage and image generation.

ElevenLabs side: Text to Dialogue for the podcast, Music for the jingle, Sound Effects for transitions, Conversational AI so you can literally talk to the reporter on any article page.

I keep thinking about the Conversational AI part. You click "Talk to Kesha" and she knows the article, the related legislation, the economic data. Ask her something she doesn't know and she searches the web. It's the feature I built last and it might be the most important one.

listening-post.vercel.app

#Cloudflare #ElevenLabs #AI #EdgeComputing

---

## X / TWITTER

### Tweet 1: The hook

1,800 local newsrooms have closed since 2005.

I built one back in a weekend.

3 AI voices. 8 data sources. Daily podcast. $6/month to run.

Side effects include knowing what your city council actually voted on.

listening-post.vercel.app

---

### Thread

How I built an AI newsroom in 7 days. Not a summary. An actual newsroom.

1/ Every morning at 3 AM it pulls from Congress, Wisconsin's state legislature, FRED economic data, Milwaukee's Legistar system, and four other sources. It reads everything so you don't have to read five different government websites.

2/ Then it writes a podcast script. Three hosts. Marcus anchors, Sarah does the deep dive, Kesha covers the capitol. ElevenLabs Text to Dialogue generates their conversation. They hand off, interrupt each other, react. It sounds like public radio.

3/ There's an intro jingle the Music API wrote. Transition stingers from Sound Effects. An outro. The whole thing stitches together and publishes by 6 AM. I'm usually still asleep.

4/ The part I didn't expect to work this well: you can talk to the reporter. Any article. Click "Talk to Kesha." Ask her about the legislation, the economic context, whatever. She searches the web if she doesn't know. It's ElevenLabs Conversational AI with a Perplexity search tool.

5/ The City Hall page scrapes Milwaukee's LIRA system for new restaurant license applications. It found 17 this week. Eggrollicious on Menomonee River Parkway. Crab Legs and Sushi on Mitchell Street. That's neighborhood news that nobody else is covering.

6/ Runs on Cloudflare's edge. Seven services. Cron triggers fire twice daily. The whole thing is autonomous. I check on it like you'd check on a plant.

7/ I'm not a developer. I'm an architect who builds with Claude Code. My first program was a blackjack game in BASIC on a TI-99/4A in 1983. I was 10. It took 43 years to get from that to this.

Local news didn't die because nobody needed it.

listening-post.vercel.app

Built for #ElevenHacks @elevaborapi @CloudflareDev

---

### Tweet: The one-liner

my ai newsroom produces a better morning briefing than most actual news sites and it costs $6/month to run

---

### Tweet: The pharma ad (MAIN VIRAL POST — use on all platforms)

Are you tired of not knowing what your city council voted on last Tuesday? Do you suffer from chronic civic confusion? Legislative bewilderment? Zoning-related anxiety?

Ask your representatives about The Listening Post.

The Listening Post is a once-daily AI newsroom that delivers a Milwaukee morning briefing with three correspondents, real data from eight government sources, and a voice agent you can call with questions.

In clinical trials, residents reported:
- knowing what legislation their reps were pushing
- dangerously informed dinner conversations
- spontaneous opinions about TIF districts
- an unexplained urge to attend city council meetings
- a sudden awareness that there are 15 aldermanic districts

The Listening Post is not for everyone. Do not use if you prefer blissful ignorance about municipal zoning. Discontinue use if you find yourself reading city council agendas recreationally.

The Listening Post runs autonomously on Cloudflare's edge with ElevenLabs voice AI. No servers. No journalists. No human in the loop. Costs $6/month. Side effects are permanent.

Ask your city council about The Listening Post today.

listening-post.vercel.app

Built for #ElevenHacks

---

## INSTAGRAM

### Carousel (10 slides)

Slide 1: 1,800 LOCAL NEWSROOMS HAVE CLOSED

Slide 2: SO I BUILT ONE (screenshot of the app)

Slide 3: IT WAKES UP AT 3 AM (clock graphic)

Slide 4: READS WHAT CONGRESS DID (screenshot of legislation)

Slide 5: THREE AI VOICES DELIVER YOUR BRIEFING (screenshot of podcast player)

Slide 6: FINDS NEW RESTAURANTS BEFORE ANYONE ELSE (screenshot of City Hall restaurants)

Slide 7: AND YOU CAN TALK TO THE REPORTER (screenshot of voice agent)

Slide 8: SIDE EFFECTS MAY INCLUDE (informed dinner conversations, opinions about TIF districts, urge to attend council meetings)

Slide 9: 7 CLOUDFLARE SERVICES. 4 ELEVENLABS APIS. $6/MONTH. (tech diagram)

Slide 10: THE LISTENING POST (logo + "Local news didn't die because nobody needed it.")

Caption:

1,800 local newsrooms have closed since 2005. I built one in a weekend. Not a developer. Just an architect with Claude Code and a problem I couldn't stop thinking about.

Three AI hosts. Real Milwaukee news. Every morning at 6 AM. You can even talk to the reporter.

Side effects include civic engagement.

#BuildInPublic #ClaudeCode #Cloudflare #ElevenLabs #LocalNews #Milwaukee #CivicTech

---

### Reel script (30 seconds)

[Walking through Milwaukee, phone in hand]

"1,800 newsrooms have closed."

[Show the app on phone]

"So I built one."

[Podcast audio plays, three voices]

"Three AI voices. Every morning. While I sleep."

[Scrolling City Hall page]

"It tracks new restaurants opening."

[Click Talk to Kesha, orb appears]

"And you can talk to the reporter."

[Text: Side effects include being informed]

"Side effects include knowing what your city council voted on."

---

## TIKTOK

### Video 1: The POV (15-30 seconds)

Text on screen: "POV: you got tired of not knowing what your city council does so you built an entire newsroom"

[Screen recording: app loading, podcast playing, scrolling stories]

You talking, casual:
"So I couldn't find out what was happening at Milwaukee City Hall. Googled it. Nothing useful. Turns out 1,800 local newsrooms have just closed across the country. So I built one. It wakes up every morning, reads what Congress did, produces a podcast with three AI hosts, and tracks what restaurants are opening in your neighborhood. Oh and you can literally have a conversation with the AI reporter about any story. I built this in a week. I'm not even a developer."

End card: listening-post.vercel.app

---

### Video 2: The pharma commercial (15 seconds)

[Soft focus. You at kitchen table. Concerned look. Scrolling phone.]

Calm pharma narrator voice:
"Are you tired of not knowing what your city council voted on? Ask your representatives about The Listening Post."

[Quick cuts of the app]

Small text, fast (pharma disclaimer style):
"Side effects include informed dinner conversations, opinions about TIF districts, and an urge to attend city council meetings."

End card: THE LISTENING POST

---

### Video 3: The "wait that's possible?" moment (15 seconds)

[You on camera]

"I built an AI newsroom that runs itself."

[Click Talk to Kesha on an article]

"And you can have a conversation with the reporter."

[Kesha's voice responds to a question about the article]

[You react genuinely — surprised it worked]

"She searched the internet for that answer. In real time."

---

## POSTING SCHEDULE

| Day | Platform | Post |
|-----|----------|------|
| Submit day | LinkedIn | Origin story |
| Submit day | X | Hook tweet + thread |
| Submit day | Instagram | Carousel |
| Submit day | TikTok | POV video |
| Day after | X | Pharma tweet |
| Day after | Instagram | Reel |
| Day after | TikTok | Pharma commercial |
| Day +2 | LinkedIn | Tech under the hood |
| Day +2 | X | One-liner |
| Day +2 | TikTok | "Wait that's possible?" |

## HASHTAGS

Always: #BuildInPublic #ElevenHacks #Cloudflare #ElevenLabs #LocalNews

Rotate: #ClaudeCode #Milwaukee #CivicTech #SoloFounder #IndieHacker

Platform-specific:
- LinkedIn: #AI #EdgeComputing
- Instagram: #MilwaukeeNews #AIVoice
- TikTok: #techtok #aitools

## ASSETS NEEDED

1. Screenshots: homepage, City Hall, podcast player, voice agent orb
2. Tech diagram from the Remotion video
3. Screen recording of the voice agent conversation (the shareable moment)
4. Your photo for authenticity
5. The Remotion demo video (LinkedIn native + TikTok)
