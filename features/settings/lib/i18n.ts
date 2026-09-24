"use client";

import { useRuntimePreferences } from "./runtime-preferences";

const URDU: Record<string, string> = {
  "Home": "ہوم",
  "Explore": "دریافت",
  "Messages": "پیغامات",
  "Activity": "سرگرمی",
  "Saved": "محفوظ",
  "Profile": "پروفائل",
  "Settings": "سیٹنگز",
  "Settings home": "سیٹنگز ہوم",
  "App Settings": "ایپ سیٹنگز",
  "Profile & Account": "پروفائل اور اکاؤنٹ",
  "Blocked Accounts": "بلاک شدہ اکاؤنٹس",
  "Create post": "پوسٹ بنائیں",
  "Sign out": "سائن آؤٹ",
  "Search people": "لوگ تلاش کریں",
  "Back to AVENZO": "AVENZO پر واپس",
  "About": "متعلق",
  "Terms": "شرائط",
  "Privacy": "پرائیویسی",
  "Help & Support": "مدد اور سپورٹ",
  "Privacy Policy": "پرائیویسی پالیسی",
  "Account": "اکاؤنٹ",
  "App": "ایپ",
  "Other": "دیگر"
};

export function useUiTranslation() {
  const { language } = useRuntimePreferences();

  return (text: string) =>
    language === "ur" ? URDU[text] || text : text;
}
