export interface ProhibitedMatch {
  type: "Prohibited Industry" | "Legal Restriction" | "Prohibited Phrasing";
  rule: string;
  matched: string;
}

const PROHIBITED_RULES: Array<{
  type: ProhibitedMatch["type"];
  rule: string;
  keywords: string[];
}> = [
  { type: "Prohibited Industry", rule: "Adult & Lifestyle",
    keywords: ["sex","dating site","dating app","gambling","betting","sports betting","casino","poker","onlyfans","prostitution","escort service","escort agency","escorts","adult content","adult entertainment","cam site","cam girl"] },
  { type: "Prohibited Industry", rule: "Regulated Goods",
    keywords: ["alcohol","tobacco","marijuana","marihuana","cannabis","guns","weapons","explosives","firearm","ammunition","rifle","handgun","pistol","shotgun","gun shop","dispensary"] },
  { type: "Prohibited Industry", rule: "Health & Supplements",
    keywords: ["weight-loss","weight loss pill","weight loss supplement","nutritional supplement","garcinia","fat burner","diet pill","erectile dysfunction"] },
  { type: "Prohibited Industry", rule: "Financial & Crypto",
    keywords: ["payday loan","credit score","credit report","initial coin offering","ico","cryptocurrency","crypto","token sale","blockchain","altcoin","defi","nft","forex trading","binary option"] },
  { type: "Legal Restriction", rule: "Litigation or Legal Threats",
    keywords: ["illegal behavior","breach of contract","legal action","lawsuit","filing suit","court action","criminal charges","cease and desist","defamation","libel","slander"] },
  { type: "Legal Restriction", rule: "Harmful Content",
    keywords: ["incite hatred","incite violence","hate speech","bigotry against"] },
  { type: "Prohibited Industry", rule: "Prohibited Schemes",
    keywords: ["get rich quick","buy followers","pyramid scheme","multi-level marketing opportunity","affiliate marketing link"] },
  { type: "Prohibited Phrasing", rule: "Prohibited Phrasing",
    keywords: ["click here","great business opportunity","act now!","!!!"] },
];

export function scanForProhibitedContent(text: string): ProhibitedMatch[] {
  const lower = text.toLowerCase();
  const matches: ProhibitedMatch[] = [];
  const seen = new Set<string>();
  for (const rule of PROHIBITED_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw) && !seen.has(rule.rule)) {
        seen.add(rule.rule);
        const idx = lower.indexOf(kw);
        const matched = text.slice(idx, idx + kw.length);
        matches.push({ type: rule.type, rule: rule.rule, matched });
        break;
      }
    }
  }
  return matches;
}
