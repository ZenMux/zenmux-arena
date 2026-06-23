import { Calculator, type LucideIcon } from "lucide-react";

export interface ArenaTool {
  id: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
}

export const TOOLS: ArenaTool[] = [
  {
    id: "discount-to-deepseek",
    title: "Discount to DeepSeek",
    tagline: "Normalize model pricing against DeepSeek anchors.",
    description:
      "Adjust an input/output basket, compare every selected model with DeepSeek V4 Pro or Flash, and export the discounted input and output prices.",
    href: "/tools/discount-to-deepseek",
    icon: Calculator,
    accent: "text-sky-600 dark:text-sky-400",
  },
];

export const PRIMARY_TOOL = TOOLS[0]!;
