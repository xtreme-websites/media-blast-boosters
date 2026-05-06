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
  { type:"Prohibited Industry", rule:"Financial & Crypto", keywords:["payday loan","payday loans","credit score","credit report","initial coin offering","ico token","cryptocurrency trading","crypto trading","token sale","altcoin","defi","nft","binance","coinbase","forex trading","binary options"] },
  // Health & Supplements
  { type:"Prohibited Industry", rule:"Health & Supplements", keywords:["weight loss supplement","weight-loss pill","garcinia cambogia","fat burner","diet pill","nutritional supplement","medical alternative","erectile dysfunction","ed pill","cosmetic surgery","liposuction","breast augmentation","botox injection"] },
  // Regulated Goods
  { type:"Prohibited Industry", rule:"Regulated Goods", keywords:["alcohol brand","liquor store","dispensary","cannabis dispensary","marijuana dispensary","weed delivery","gun shop","firearms dealer","weapons dealer","explosives","ammunition dealer","tobacco shop","vape shop"] },
  // Adult & Lifestyle
  { type:"Prohibited Industry", rule:"Adult & Lifestyle", keywords:["adult content","adult entertainment","dating site","escort service","gambling","sports betting","online casino","poker site","explicit music","adult podcast","onlyfans","cam site"] },
  // Legal Restrictions
  { type:"Legal Restriction", rule:"Litigation or Legal Threats", keywords:["illegal behavior","breach of contract","legal action","lawsuit","sue","filing suit","court action","criminal charges","cease and desist","defamation","libel","slander"] },
  { type:"Legal Restriction", rule:"Harmful Content", keywords:["incite hatred","incite violence","hate speech","bigotry against","discriminat"] },
  // Schemes
  { type:"Prohibited Industry", rule:"Prohibited Schemes", keywords:["affiliate marketing link","get rich quick","buy followers","buy instagram followers","buy social media followers","pyramid scheme","mlm opportunity","multi-level marketing opportunity"] },
  // Promotional Phrasing
  { type:"Prohibited Phrasing", rule:"Prohibited Phrasing", keywords:["click here","great business opportunity","limited time offer!!!","act now!!!","buy now!!"] },
];

export function scanForProhibitedContent(text: string): ProhibitedMatch[] {
  const lower = text.toLowerCase();
  const matches: ProhibitedMatch[] = [];
  const seen = new Set<string>();

  for (const rule of PROHIBITED_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw) && !seen.has(rule.rule)) {
        seen.add(rule.rule);
        // Find original casing for display
        const idx = lower.indexOf(kw);
        const matched = text.slice(idx, idx + kw.length);
        matches.push({ type: rule.type, rule: rule.rule, matched });
        break;
      }
    }
  }

  return matches;
}
