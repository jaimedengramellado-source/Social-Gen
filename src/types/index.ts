export type Platform = "youtube_long" | "youtube_shorts" | "tiktok" | "reels";
export type Plan = "free" | "starter" | "pro" | "agency";
export type ScriptStatus = "draft" | "saved";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan;
  credits_remaining: number;
  credits_total: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
  niche: string | null;
  tone: string | null;
  ai_instructions: string | null;
  main_platform: string | null;
  platforms: string[] | null;
  channel_name: string | null;
  weekly_digest: boolean;
  posting_frequency: string | null;
  recording_style: string | null;
  reference_creators: string | null;
  main_goal: string | null;
}

export type ScheduledPostStatus = "uploading" | "scheduled" | "publishing" | "published" | "failed";
export type PublishPlatform = "youtube" | "instagram" | "facebook" | "tiktok" | "x" | "linkedin" | "threads";
export type SocialPlatform = Exclude<PublishPlatform, "youtube">;

export interface ScheduledPost {
  id: string;
  user_id: string;
  platform: PublishPlatform;
  title: string;
  description: string | null;
  tags: string[];
  privacy: "public" | "unlisted" | "private";
  scheduled_at: string | null;
  status: ScheduledPostStatus;
  youtube_video_id: string | null;
  platform_post_id: string | null;
  storage_path: string | null;
  media_type: "video" | "image";
  group_id: string | null;
  attempts: number;
  settings: Record<string, unknown>;
  error: string | null;
  script_id: string | null;
  calendar_event_id: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface SocialConnection {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  account_id: string;
  account_name: string | null;
  account_avatar: string | null;
  page_id: string | null;
  scopes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type CrosspostRuleStatus = "waiting" | "fired" | "expired" | "failed";

export interface CrosspostRule {
  id: string;
  user_id: string;
  rule_group_id: string;
  source_post_id: string;
  source_platform: PublishPlatform;
  target_platform: PublishPlatform;
  threshold: number;
  window_days: number;
  text: string;
  settings: Record<string, unknown>;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  status: CrosspostRuleStatus;
  error: string | null;
  fired_post_id: string | null;
  last_views: number | null;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostAutomation {
  id: string;
  user_id: string;
  platform: string;
  trigger: string;
  threshold: number;
  action: string;
  active: boolean;
  created_at: string;
}

export interface Snippet {
  id: string;
  user_id: string;
  name: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  user_id: string;
  platform: Platform;
  channel_name: string;
  channel_url: string | null;
  subscribers_range: string;
  niche: string;
  niche_description: string;
  content_format: string;
  main_goal: string;
  differentiator: string;
  audience_pain: string;
  best_video_reason: string;
  is_public: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  platform: string | null;
  niche: string | null;
  created_at: string;
}

export interface Idea {
  id: string;
  user_id: string;
  channel_id: string | null;
  project_id: string | null;
  title: string;
  description: string;
  platform: Platform;
  format: string;
  niche: string;
  viral_score: number;
  hook_type: string;
  content_style: string;
  why_viral?: string;
  is_saved: boolean;
  created_at: string;
}

export interface ScriptSection {
  timestamp: string;
  section: string;
  content: string;
}

export interface RetentionPeak {
  timestamp: string;
  suggestion: string;
}

export interface HookVariants {
  aggressive: string;
  curious: string;
  emotional: string;
}

export interface Script {
  id: string;
  user_id: string;
  channel_id: string | null;
  idea_id: string | null;
  project_id: string | null;
  title: string;
  platform: Platform;
  format: string;
  niche: string;
  duration: string;
  tone: string;
  hook: string;
  intro: string;
  main_content: ScriptSection[];
  retention_peaks: RetentionPeak[];
  cta: string;
  title_suggestions: string[];
  thumbnail_concepts: string[];
  viral_score: number;
  estimated_retention: number;
  hooks_variants?: HookVariants;
  status: ScriptStatus;
  share_token: string;
  credits_used: number;
  created_at: string;
  updated_at: string;
}

export interface WatchlistChannel {
  id: string;
  user_id: string;
  channel_name: string;
  channel_url: string;
  platform: Platform;
  subscribers: string;
  niche: string;
  outlier_detected: boolean;
  engagement_tag: string;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  action: string;
  credits_spent: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const CREDIT_COSTS = {
  chat_message: 1,
  generate_5_ideas: 1,
  generate_10_ideas: 2,
  generate_15_ideas: 3,
  generate_script: 3,
  regenerate_section: 1,
  sorprendeme: 2,
  analyze_channel: 2,
  analyze_idea: 2,
  score_script: 1,
  generate_image: 2,
  edit_image: 2,
  image_variation: 1,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export const PLAN_CREDITS: Record<Plan, number> = {
  free: 5,
  starter: 100,
  pro: 300,
  agency: 1000,
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube_long: "YouTube (largo)",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  reels: "Instagram Reels",
};

export interface PricingPlan {
  id: Plan;
  name: string;
  price_weekly: number;
  price_annual_total: number;
  credits: number;
  features: string[];
  highlighted?: boolean;
}

export interface GeneratedImage {
  id: string;
  user_id: string;
  prompt: string;
  model_used: "imagen-3" | "gemini-2.0-flash";
  image_url: string;
  storage_path: string;
  parent_image_id: string | null;
  aspect_ratio: string;
  created_at: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "100 seguidores",
    price_weekly: 0,
    price_annual_total: 0,
    credits: 5,
    features: [
      "5 créditos/semana",
      "Generador de ideas y guiones completos",
      "Hook Comparator y modo Sorpréndeme",
      "Explorar competidores y puntúa tus guiones",
      "Imágenes con IA, documentos y calendario",
    ],
  },
  {
    id: "starter",
    name: "10.000 seguidores",
    price_weekly: 2.49,
    price_annual_total: 124.99,
    credits: 100,
    features: [
      "100 créditos/semana",
      "Generador de ideas y guiones completos",
      "Hook Comparator y modo Sorpréndeme",
      "Explorar competidores y puntúa tus guiones",
      "Imágenes con IA, documentos y calendario",
    ],
  },
  {
    id: "pro",
    name: "100.000 seguidores",
    price_weekly: 6.49,
    price_annual_total: 324.99,
    credits: 300,
    highlighted: true,
    features: [
      "300 créditos/semana",
      "Generador de ideas y guiones completos",
      "Hook Comparator y modo Sorpréndeme",
      "Explorar competidores y puntúa tus guiones",
      "Imágenes con IA, documentos y calendario",
      "Animaciones y vídeo (Próximamente)",
      "Soporte prioritario",
    ],
  },
  {
    id: "agency",
    name: "1.000.000 seguidores",
    price_weekly: 19.99,
    price_annual_total: 999.99,
    credits: 1000,
    features: [
      "1000 créditos/semana",
      "Generador de ideas y guiones completos",
      "Hook Comparator y modo Sorpréndeme",
      "Explorar competidores y puntúa tus guiones",
      "Imágenes con IA, documentos y calendario",
      "Soporte prioritario",
      "Onboarding dedicado",
    ],
  },
];
