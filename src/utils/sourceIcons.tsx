import React from 'react';
import {
  Briefcase,
  Coins,
  Gift,
  Percent,
  ShoppingBag,
  Sparkles,
  Tag,
  Trophy,
} from 'lucide-react';

export function getSourceIcon(sourceTag: string): React.ReactNode {
  const lower = sourceTag.toLowerCase();
  if (lower.includes('vinted') || lower.includes('subito')) {
    return <ShoppingBag className="w-4 h-4" />;
  }
  if (lower.includes('lavoretto') || lower.includes('ripetizion') || lower.includes('freelance')) {
    return <Briefcase className="w-4 h-4" />;
  }
  if (lower.includes('monetine') || lower.includes('resti')) {
    return <Coins className="w-4 h-4" />;
  }
  if (lower.includes('cashback') || lower.includes('rimborso') || lower.includes('bonus')) {
    return <Percent className="w-4 h-4" />;
  }
  if (lower.includes('scommessa')) {
    return <Trophy className="w-4 h-4" />;
  }
  if (lower.includes('manc') || lower.includes('regalo') || lower.includes('premio')) {
    return <Gift className="w-4 h-4" />;
  }
  if (lower.includes('mercatino') || lower.includes('usati')) {
    return <Tag className="w-4 h-4" />;
  }
  return <Sparkles className="w-4 h-4" />;
}
