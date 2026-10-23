/** Talks listed on the homepage, with each entry pointing to its own player. */
export interface ArenaTalk {
  id: string;
  title: string;
  tagline: string;
  href: string;
}

export const TALKS: ArenaTalk[] = [
  {
    id: "if-tokens-could-talk",
    title: "如果 Token 会说话",
    tagline: "A research talk you can explore.",
    href: "/talk",
  },
];
