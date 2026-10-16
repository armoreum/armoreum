import type { LucideIcon } from 'lucide-react';

export type InfoLink = { label: string; href: string; external?: boolean; note?: string };
export type InfoBlock = {
  p?: string;
  ul?: string[];
  table?: { headers: string[]; rows: string[][]; label: string };
  callout?: { title: string; text: string; tone?: 'warn' | 'note' };
  steps?: { title: string; text: string }[];
  cards?: { title: string; text: string; tag?: string }[];
  links?: InfoLink[];
};
export type InfoSectionDef = { id: string; title: string; kicker?: string; blocks: InfoBlock[] };
export type InfoCta = { title: string; text: string; label: string; href: string; secondary?: InfoLink };
export type InfoPageDef = {
  eyebrow: string;
  title: string;
  lead: string;
  icon: LucideIcon;
  evidence?: { label: string; value: string }[];
  sections: InfoSectionDef[];
  cta?: InfoCta;
};
