"use client";

import { useEffect } from "react";
import { applyUiSettingsClasses, loadUiSettings, subscribeUiSettings } from "@/lib/uiSettings";

export function UiSettingsApplier() {
  useEffect(() => {
    const apply = () => applyUiSettingsClasses(loadUiSettings());
    apply();
    return subscribeUiSettings(apply);
  }, []);

  useEffect(() => {
    return () => {
      const root = document.querySelector<HTMLElement>(".bp");
      const targets: Array<HTMLElement> = [document.documentElement];
      if (root) targets.push(root);
      for (const el of targets) {
        el.classList.remove("bp-compact", "bp-reduce-motion");
      }
    };
  }, []);

  return null;
}

