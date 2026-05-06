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
  // Financial & Crypto
  { type:"Prohibited Industry", rule:"Financial & Crypto",
    keywords:["payday loan","credit score","credit report","coin offering","ico token","cryptocurrency","crypto trading","token sale","altcoin","defi protocol","nft mint","binance","forex trading","binary option"] },
  // Health & Supplements
  { type:"Prohibited Industry", rule:"Health & Supplements",
    keywords:["weight loss supplement","weight-loss pill","garcinia","fat burner","diet pill","nutritional supplement","medical alternative","erectile dysfunction","cosmetic surgery","liposuction","breast augmentation","botox"] },
  // Regulated Goods — standalone root words so any mention triggers it
  { type:"Prohibited Industry", rule:"Regulated Goods",
    keywords:["tobacco","marihuana","marijuana","cannabis","dispensary","weed delivery","gun shop","firearm","weapons dealer","explosive","ammunition dealer","vape shop","cigar","cigarette brand","alcohol brand","liquor store"] },
  // Adult & Lifestyle
  { type:"Prohibited Industry", rule:"Adult & Lifestyle",
    keywords:["adult content","adult entertainment","dating site","escort service","gambling","sports betting","online casino","poker site","explicit music","adult podcast","onlyfans","cam site"] },
  // Legal Restrictions
  { type:"Legal Restriction", rule:"Litigation or Legal Threats",
    keywords:["illegal behavior","breach of contract","legal action","lawsuit","file suit","filing suit","court action","criminal charges","cease and desist","defamation","libel","slander"] },
  { type:"Legal Restriction", rule:"Harmful Content",
    keywords:["incite hatred","incite violence","hate speech","bigotry against","discriminat"] },
  // Schemes
  { type:"Prohibited Industry", rule:"Prohibited Schemes",
    keywords:["affiliate marketing link","get rich quick","buy followers","buy instagram followers","buy social media followers","pyramid scheme","multi-level marketing opportunity"] },
  // Promotional Phrasing
  { type:"Prohibited Phrasing", rule:"Prohibited Phrasing",
    keywords:["click here","great business opportunity","!!!","act now!"] },
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
