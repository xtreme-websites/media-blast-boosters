export interface ProhibitedMatch {
  type: "Prohibited Industry" | "Legal Restriction" | "Prohibited Phrasing";
  rule: string;
  matched: string;
}

interface Rule {
  type: ProhibitedMatch["type"];
  rule: string;
  // Simple keywords — matched anywhere (no exclusions needed)
  keywords?: string[];
  // Smart keywords — each entry has a term + exclusion phrases
  // If ANY exclusion phrase appears within 6 words of the term, skip it
  smart?: Array<{ term: string; exclude: string[] }>;
}

const PROHIBITED_RULES: Rule[] = [
  // Adult & Lifestyle
  { type: "Prohibited Industry", rule: "Adult & Lifestyle",
    keywords: ["dating site","dating app","gambling","betting","sports betting","casino","poker site","onlyfans","prostitution","escort service","escort agency","adult entertainment","cam site","cam girl"],
    smart: [
      // "sex" is very broad — allow: sex education, sex trafficking awareness, sexual harassment training
      { term: "sex", exclude: ["education","trafficking awareness","harassment","abuse awareness","health","assault awareness","assault prevention"] },
      // "gambling addiction" awareness articles are legit
      { term: "gambling", exclude: ["addiction awareness","addiction treatment","addiction recovery","problem gambling"] },
    ]
  },

  // Regulated Goods
  { type: "Prohibited Industry", rule: "Regulated Goods",
    keywords: ["marijuana","marihuana","cannabis","dispensary","gun shop","firearms dealer","ammunition dealer"],
    smart: [
      // "alcohol" — allow abuse/awareness/education context
      { term: "alcohol", exclude: ["abuse","awareness","education","addiction","recovery","treatment","consumption study"] },
      // "tobacco" — allow health/anti-smoking context
      { term: "tobacco", exclude: ["awareness","cessation","anti-smoking","health risk","education","free zones"] },
      // "guns" — allow gun control, gun safety, gun laws discussion
      { term: "guns", exclude: ["control","safety","law","legislation","reform","violence prevention","buyback"] },
      // "weapons" — allow discussion of weapons regulations/policy
      { term: "weapons", exclude: ["control","regulation","policy","ban","legislation","disarmament","nonproliferation","treaty"] },
      // "explosives" — allow news context about explosive detection, regulations
      { term: "explosives", exclude: ["detection","safety","regulation","disposal","ordinance","prevention"] },
      // "firearm" — allow safety and regulation context
      { term: "firearm", exclude: ["safety","training","regulation","law","license"] },
    ]
  },

  // Health & Supplements
  { type: "Prohibited Industry", rule: "Health & Supplements",
    keywords: ["weight loss pill","weight loss supplement","nutritional supplement","garcinia","fat burner","diet pill"],
    smart: [
      // "weight-loss" / "weight loss" — allow programs, surgery, medical supervision
      { term: "weight-loss", exclude: ["program","surgery","center","clinic","counseling","management","coaching","medical"] },
      { term: "weight loss", exclude: ["program","surgery","center","clinic","counseling","management","coaching","medical","journey"] },
      // "erectile dysfunction" — allow medical/awareness context
      { term: "erectile dysfunction", exclude: ["treatment center","awareness","medical","specialist","therapy","counseling"] },
    ]
  },

  // Financial & Crypto
  { type: "Prohibited Industry", rule: "Financial & Crypto",
    keywords: ["payday loan","initial coin offering","ico token","altcoin","defi protocol","nft mint","token sale","forex trading","binary option"],
    smart: [
      // "credit score" — allow news about improvements, financial literacy
      { term: "credit score", exclude: ["awareness","education","literacy","improvement","advice","tips","counseling"] },
      // "credit report" — allow monitoring, fraud awareness context
      { term: "credit report", exclude: ["monitoring","fraud","awareness","error","dispute","freeze","protection"] },
      // "cryptocurrency" — allow regulation, news, technology discussions
      { term: "cryptocurrency", exclude: ["regulation","policy","law","fraud","scam","awareness","news","market analysis","technology","ban"] },
      // "crypto" — allow cryptography, encryption, security context
      { term: "crypto", exclude: ["graphy","graphic","graphic design","encryption","security","currency regulation","fraud","scam","awareness"] },
      // "blockchain" — explicitly allow technology/infrastructure context
      { term: "blockchain", exclude: ["technology","tech","platform","infrastructure","developer","development","solution","application","network","protocol","transparency","supply chain","healthcare","voting","records"] },
      // "nft" — allow news/criticism/fraud context
      { term: "nft", exclude: ["fraud","scam","regulation","news","market collapse","technology"] },
      // "ico" — allow regulatory/fraud context
      { term: "ico", exclude: ["fraud","regulation","ban","enforcement","investigation"] },
    ]
  },

  // Legal Restrictions
  { type: "Legal Restriction", rule: "Litigation or Legal Threats",
    keywords: ["illegal behavior","breach of contract","filing suit","court action","criminal charges","cease and desist","defamation","libel","slander"],
    smart: [
      { term: "lawsuit", exclude: ["coverage","dismissed","settlement news","filed against","won","lost","landmark"] },
      { term: "legal action", exclude: ["awareness","education","resources","aid","firm","services"] },
    ]
  },
  { type: "Legal Restriction", rule: "Harmful Content",
    keywords: ["incite hatred","incite violence","hate speech","bigotry against"] },

  // Schemes
  { type: "Prohibited Industry", rule: "Prohibited Schemes",
    keywords: ["get rich quick","buy followers","pyramid scheme","multi-level marketing opportunity","affiliate marketing link"] },

  // Phrasing
  { type: "Prohibited Phrasing", rule: "Prohibited Phrasing",
    keywords: ["click here","great business opportunity","act now!"] },
];

// Extract words in a window of ±8 words around a match index
function getWordWindow(lower: string, idx: number, term: string, windowSize = 8): string {
  const words = lower.split(/\s+/);
  // Find which word index the match falls in
  let charCount = 0;
  let matchWordIdx = 0;
  for (let i = 0; i < words.length; i++) {
    if (charCount >= idx) { matchWordIdx = i; break; }
    charCount += words[i].length + 1;
    matchWordIdx = i;
  }
  const start = Math.max(0, matchWordIdx - windowSize);
  const end   = Math.min(words.length, matchWordIdx + term.split(" ").length + windowSize);
  return words.slice(start, end).join(" ");
}

export function scanForProhibitedContent(text: string): ProhibitedMatch[] {
  const lower = text.toLowerCase();
  const matches: ProhibitedMatch[] = [];
  const seen = new Set<string>();

  for (const rule of PROHIBITED_RULES) {
    // Simple keywords — exact substring match
    if (rule.keywords && !seen.has(rule.rule)) {
      for (const kw of rule.keywords) {
        if (lower.includes(kw)) {
          seen.add(rule.rule);
          const idx = lower.indexOf(kw);
          matches.push({ type: rule.type, rule: rule.rule, matched: text.slice(idx, idx + kw.length) });
          break;
        }
      }
    }

    // Smart keywords — check exclusion window
    if (rule.smart && !seen.has(rule.rule)) {
      for (const { term, exclude } of rule.smart) {
        const idx = lower.indexOf(term);
        if (idx === -1) continue;
        const window = getWordWindow(lower, idx, term);
        const isExcluded = exclude.some(ex => window.includes(ex));
        if (!isExcluded) {
          seen.add(rule.rule);
          matches.push({ type: rule.type, rule: rule.rule, matched: text.slice(idx, idx + term.length) });
          break;
        }
      }
    }
  }

  return matches;
}
