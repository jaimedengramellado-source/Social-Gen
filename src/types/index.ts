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
  generate_5_ideas: 1,
  generate_10_ideas: 2,
  generate_15_ideas: 3,
  generate_script: 3,
  regenerate_section: 1,
  sorprendeme: 2,
  analyze_channel: 2,
  analyze_idea: 2,
  score_script: 1,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export const PLAN_CREDITS: Record<Plan, number> = {
  free: 10,
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
  price_monthly: number;
  price_annual: number;
  credits: number;
  features: string[];
  highlighted?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "100 seguidores",
    price_monthly: 0,
    price_annual: 0,
    credits: 10,
    features: [
      "10 créditos/mes",
      "Generador de ideas",
      "Guiones básicos",
      "1 canal guardado",
    ],
  },
  {
    id: "starter",
    name: "1.000 seguidores",
    price_monthly: 19,
    price_annual: 15,
    credits: 100,
    features: [
      "100 créditos/mes",
      "Hook Comparator",
      "Biblioteca ilimitada",
      "5 canales guardados",
      "Modo Sorpréndeme",
    ],
  },
  {
    id: "pro",
    name: "100.000 seguidores",
    price_monthly: 49,
    price_annual: 39,
    credits: 300,
    highlighted: true,
    features: [
      "300 créditos/mes",
      "Todo de Starter",
      "Explorar competidores",
      "Puntúa tus guiones",
      "Canales ilimitados",
      "Soporte prioritario",
    ],
  },
  {
    id: "agency",
    name: "1.000.000 seguidores",
    price_monthly: 99,
    price_annual: 79,
    credits: 1000,
    features: [
      "1000 créditos/mes",
      "Todo de Pro",
      "Multi-workspace",
      "API access",
      "Onboarding dedicado",
    ],
  },
];
