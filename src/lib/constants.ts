// ─── Types ────────────────────────────────────────────────────────────────────
export interface ServicePage  { name: string; url: string; keywords: string[]; }
export interface LocationPage { name: string; url: string; keywords: string[]; }

export interface CompanyData {
  name: string; industry: string; websiteUrl: string; googleProfileUrl: string;
  summaryFileUrl: string; quoteAttribution: string;
  about: string; tagline: string; targetAudience: string; differentiators: string;
  services: string;
  servicePages: ServicePage[];
  locationPages: LocationPage[];
  address: string; phone: string; email: string;
}

export interface Topic {
  title: string;
  summary: string;
  source: string;
  date: string;
  url: string;
  relevance: string;
  selectedIdea?: string;
}

export interface Order {
  id: string;
  prTitle: string;
  productName: string;
  price: string;
  date: string;
  prContent: string;
}

// ─── Company Data Default ─────────────────────────────────────────────────────
export const EMPTY_COMPANY: CompanyData = {
  name: "", industry: "", websiteUrl: "", googleProfileUrl: "",
  summaryFileUrl: "", quoteAttribution: "", about: "", tagline: "",
  targetAudience: "", differentiators: "", services: "",
  servicePages: [], locationPages: [],
  address: "", phone: "", email: "",
};

// ─── Stripe Packages ──────────────────────────────────────────────────────────
export const PR_PACKAGES: Record<string, {
  price: string; outlets: number; words: number;
  readers: string; authority: number; paymentLink: string;
}> = {
  Starter:  { price: "$497",  outlets: 200, words: 350,  readers: "2.2M",   authority: 69, paymentLink: "https://buy.stripe.com/fZu6oHdbu3zH6DTdMl6J201" },
  Standard: { price: "$797",  outlets: 300, words: 500,  readers: "26.4M",  authority: 88, paymentLink: "https://buy.stripe.com/aFadR9gnGb290fveQp6J202" },
  Premium:  { price: "$997",  outlets: 450, words: 1000, readers: "224.5M", authority: 94, paymentLink: "https://buy.stripe.com/bJeeVd3AU5HP7HXeQp6J203" },
};

// ─── PR Creator Options ───────────────────────────────────────────────────────
export const FOCUS_OPTIONS = [
  { value: "Company News",       emoji: "📢", desc: "Announcements, partnerships, updates" },
  { value: "How-to Guide",       emoji: "📚", desc: "Step-by-step tutorial or instructional" },
  { value: "Thought Leadership", emoji: "💡", desc: "Expert perspectives and insights" },
  { value: "Opinion/Editorial",  emoji: "✍️", desc: "Commentary on current topics" },
  { value: "Best Practices",     emoji: "⭐", desc: "Proven strategies and recommendations" },
  { value: "Case Study",         emoji: "📋", desc: "Real-world examples and lessons" },
];

export const THEME_OPTIONS = [
  { value: "thought-provoking", emoji: "💭", label: "Thought-Provoking", desc: "Intellectual, encourages deep reflection" },
  { value: "investigative",     emoji: "🔎", label: "Investigative",     desc: "In-depth, fact-finding, analytical" },
  { value: "breaking-news",     emoji: "📰", label: "Breaking News",     desc: "Urgent, immediate, time-sensitive" },
  { value: "scientific",        emoji: "📊", label: "Scientific",        desc: "Data-driven, objective, precise" },
];

export const RADAR_COLORS = ["#818cf8", "#34d399", "#fb923c", "#f472b6"];
