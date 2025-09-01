// src/i18n/useT.js
import { useSelector } from "react-redux";
import en from "./en";
import th from "./th";

const dict = { en, th };

export default function useT() {
  const lang = useSelector((s) => s.language?.value || "en");
  return dict[lang] || en; // returns a plain object so you can do t.xxx
}
