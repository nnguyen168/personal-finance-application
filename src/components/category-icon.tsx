import {
  ArrowLeftRight, Baby, Banknote, Bike, BookOpen, BriefcaseBusiness, Car, Clapperboard, Coffee, Coins, Dog, Droplet, Dumbbell,
  Fuel, Gift, GraduationCap, Hammer, HandCoins, Heart, House, Landmark, Music, Package, Palette, PiggyBank, Pill, Plane,
  Receipt, Scissors, ShieldCheck, Shirt, ShoppingBag, ShoppingBasket, Smartphone, Sofa, Sparkles, Stethoscope, TrainFront,
  Tv, Umbrella, UtensilsCrossed, Wifi, Wine, Zap, type LucideIcon,
} from "lucide-react";
import { cx } from "./cx";

/** Line icons for categories. Built-in categories use their slug as key. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  salary: BriefcaseBusiness,
  "other-income": HandCoins,
  mortgage: House,
  energy: Zap,
  water: Droplet,
  internet: Wifi,
  insurance: ShieldCheck,
  subscriptions: Tv,
  taxes: Landmark,
  groceries: ShoppingBasket,
  restaurants: UtensilsCrossed,
  clothes: Shirt,
  entertainment: Clapperboard,
  transport: Car,
  health: Pill,
  household: Sofa,
  kids: Baby,
  beauty: Sparkles,
  gifts: Gift,
  travel: Plane,
  shopping: ShoppingBag,
  cash: Banknote,
  other: Package,
  transfers: ArrowLeftRight,
  // Extra choices for custom categories.
  coffee: Coffee,
  wine: Wine,
  train: TrainFront,
  fuel: Fuel,
  bike: Bike,
  pets: Dog,
  education: GraduationCap,
  sport: Dumbbell,
  music: Music,
  books: BookOpen,
  charity: Heart,
  hair: Scissors,
  savings: PiggyBank,
  bills: Receipt,
  phone: Smartphone,
  hobbies: Palette,
  doctor: Stethoscope,
  repairs: Hammer,
  holidays: Umbrella,
  coins: Coins,
};

export const ICON_CHOICES = Object.keys(CATEGORY_ICONS);

/**
 * A category's mark: a thin line icon inside a hairline circle, or the
 * category's initial set in the display serif when it has no icon.
 */
export function CategoryIcon({
  icon,
  name,
  size = "md",
  className,
}: {
  icon: string | null | undefined;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = icon ? CATEGORY_ICONS[icon] : undefined;
  const box = size === "lg" ? "size-12" : size === "sm" ? "size-8" : "size-10";
  const glyph = size === "lg" ? "size-5" : size === "sm" ? "size-3.5" : "size-[18px]";
  return (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2",
        box,
        className,
      )}
    >
      {Icon ? (
        <Icon className={glyph} strokeWidth={1.4} />
      ) : (
        <span className="font-display text-[17px] leading-none text-ink">{name.trim().charAt(0).toUpperCase() || "·"}</span>
      )}
    </span>
  );
}
