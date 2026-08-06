import {
  ArrowLeftRight, BarChart3, FileText, Gem, LayoutDashboard, PiggyBank,
  Settings, Tags, Target, TrendingDown, TrendingUp, Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Reports", href: "/reports", icon: FileText },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { label: "Income", href: "/income", icon: TrendingUp },
      { label: "Expenses", href: "/expenses", icon: TrendingDown },
      { label: "People & Debts", href: "/people", icon: Users },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Categories", href: "/categories", icon: Tags },
      { label: "Budgets", href: "/budgets", icon: PiggyBank },
      { label: "Savings", href: "/savings", icon: Target },
      { label: "Assets", href: "/assets", icon: Gem },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Primary destinations for the mobile bottom bar. */
export const MOBILE_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Activity", href: "/transactions", icon: ArrowLeftRight },
  { label: "Budgets", href: "/budgets", icon: PiggyBank },
  { label: "Insights", href: "/analytics", icon: BarChart3 },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
