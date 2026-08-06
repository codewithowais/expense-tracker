import {
  Baby, Banknote, BookOpen, Briefcase, Building2, Bus, Car, Coffee, Coins,
  CreditCard, DollarSign, Dumbbell, Ellipsis, Film, Fuel, Gamepad2, Gem, Gift,
  GraduationCap, HandCoins, HeartPulse, Home, Landmark, PawPrint, Percent,
  PiggyBank, Pill, Plane, ReceiptText, ShoppingCart, Shirt, Smartphone,
  Sparkles, TrendingUp, Utensils, Wallet, Wifi, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

/** Curated icon set used by categories and payment methods. */
export const ICON_MAP: Record<string, LucideIcon> = {
  Baby, Banknote, BookOpen, Briefcase, Building2, Bus, Car, Coffee, Coins,
  CreditCard, DollarSign, Dumbbell, Ellipsis, Film, Fuel, Gamepad2, Gem, Gift,
  GraduationCap, HandCoins, HeartPulse, Home, Landmark, PawPrint, Percent,
  PiggyBank, Pill, Plane, ReceiptText, ShoppingCart, Shirt, Smartphone,
  Sparkles, TrendingUp, Utensils, Wallet, Wifi, Wrench, Zap,
};

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? ReceiptText;
}
