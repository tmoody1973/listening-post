import { Agent } from "agents";
import type { Env, TriagedStory, EpisodeAct, DialogueTurn } from "../types";

interface EpisodeState {
  episodeId: string;
  edition: "morning" | "evening";
  status: "idle" | "scripting" | "voicing" | "assembling" | "published" | "failed";
  stories: TriagedStory[];
  acts: EpisodeAct[];
  finalAudioR2Key: string | null;
  transcript: string | null;
  totalDuration: number;
  progress: number;
  retryCount: number;
  lastError: string | null;
}

export class EpisodeAgent extends Agent<Env, EpisodeState> {
  initialState: EpisodeState = {
    episodeId: "",
    edition: "morning",
    status: "idle",
    stories: [],
    acts: [],
    finalAudioR2Key: null,
    transcript: null,
    totalDuration: 0,
    progress: 0,
    retryCount: 0,
    lastError: null,
  };

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/produce" && request.method === "POST") {
      const { episodeId, edition, stories } = await request.json() as {
        episodeId: string;
        edition: "morning" | "evening";
        stories: TriagedStory[];
      };

      this.setState({
        ...this.state,
        episodeId,
        edition,
        status: "scripting",
        stories,
        acts: buildActShells(edition),
        progress: 0,
      });

      // Run pipeline non-blocking
      await this.schedule(0, "runPipeline", { episodeId, edition });

      return Response.json({ status: "production started", episodeId });
    }

    if (url.pathname === "/status") {
      return Response.json(this.state);
    }

    return Response.json({ agent: "EpisodeAgent", state: this.state });
  }

  async onConnect(connection: unknown) {
    console.log(`[Episode ${this.state.episodeId}] Client connected`);
  }

  onStateChanged(state: EpisodeState, source: string | unknown) {
    console.log(`[Episode ${state.episodeId}] ${state.status} (${state.progress}%)`);
  }

  // ─── Production Pipeline ──────────────────────────────────

  async runPipeline(_payload: { episodeId: string; edition: string }) {
    try {
      // Stage 1: Script generation
      await this.transitionTo("scripting", 5);
      await this.generateScripts();

      // Stage 2: Voice production via ElevenLabs Text to Dialogue
      await this.transitionTo("voicing", 30);
      await this.voiceActs();

      // Stage 3: Audio assembly
      await this.transitionTo("assembling", 80);
      await this.assembleAudio();

      // Stage 4: Publish
      await this.transitionTo("published", 100);
      await this.publishEpisode();

      console.log(`[Episode ${this.state.episodeId}] Published successfully`);
    } catch (error) {
      console.error(`[Episode ${this.state.episodeId}] Failed:`, error);

      this.setState({
        ...this.state,
        status: "failed",
        lastError: String(error),
      });

      if (this.state.retryCount < 3) {
        this.setState({ ...this.state, retryCount: this.state.retryCount + 1 });
        await this.schedule(60, "runPipeline", {
          episodeId: this.state.episodeId,
          edition: this.state.edition,
        });
      }
    }
  }

  private async transitionTo(status: EpisodeState["status"], progress: number) {
    this.setState({ ...this.state, status, progress });
  }

  // ─── Stage 1: Script Generation ───────────────────────────

  private async generateScripts() {
    // TODO: Wire up Workers AI dialogue generation (Day 3)
    const updatedActs = this.state.acts.map((act) => ({
      ...act,
      status: "scripted" as const,
      dialogue: act.dialogue.length > 0 ? act.dialogue : [
        { voice: "anchor" as const, voiceId: "", text: `[placeholder] ${act.title} script` },
      ],
    }));

    this.setState({
      ...this.state,
      acts: updatedActs,
      progress: 25,
    });
  }

  // ─── Stage 2: Voice Production ────────────────────────────

  private async voiceActs() {
    // TODO: Wire up ElevenLabs Text to Dialogue (Day 3)
    for (let i = 0; i < this.state.acts.length; i++) {
      const act = this.state.acts[i];
      console.log(`[Episode] Voicing act ${i + 1}/${this.state.acts.length}: ${act.title}`);

      // TODO: POST /v1/text-to-dialogue with act.dialogue
      // Store MP3 in R2
      const r2Key = `audio/${this.state.episodeId}/${act.id}.mp3`;

      const updatedActs = this.state.acts.map((a, idx) =>
        idx === i ? { ...a, audioR2Key: r2Key, status: "voiced" as const } : a
      );

      this.setState({
        ...this.state,
        acts: updatedActs,
        progress: 30 + ((i + 1) / this.state.acts.length) * 50,
      });
    }
  }

  // ─── Stage 3: Audio Assembly ──────────────────────────────

  private async assembleAudio() {
    // TODO: Concatenate act MP3s from R2 into final episode (Day 3)
    const finalR2Key = `audio/${this.state.episodeId}/final.mp3`;

    this.setState({
      ...this.state,
      finalAudioR2Key: finalR2Key,
      progress: 90,
    });
  }

  // ─── Stage 4: Publish ─────────────────────────────────────

  private async publishEpisode() {
    // TODO: Write episode + stories to D1, embed in Vectorize (Day 3)
    this.setState({
      ...this.state,
      progress: 100,
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────

function buildActShells(edition: "morning" | "evening"): EpisodeAct[] {
  if (edition === "morning") {
    return [
      { id: "act-1", title: "The Briefing", dialogue: [], audioR2Key: null, durationSeconds: null, status: "pending" },
      { id: "act-2", title: "The Deep Dive", dialogue: [], audioR2Key: null, durationSeconds: null, status: "pending" },
      { id: "act-3", title: "The Outlook", dialogue: [], audioR2Key: null, durationSeconds: null, status: "pending" },
    ];
  }
  return [
    { id: "act-1", title: "Day in Review", dialogue: [], audioR2Key: null, durationSeconds: null, status: "pending" },
    { id: "act-2", title: "Analysis", dialogue: [], audioR2Key: null, durationSeconds: null, status: "pending" },
    { id: "act-3", title: "The Signal", dialogue: [], audioR2Key: null, durationSeconds: null, status: "pending" },
  ];
}
