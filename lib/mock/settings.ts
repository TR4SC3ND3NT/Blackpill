export type SettingsSectionId = "general" | "privacy" | "appearance" | "api";

export type SettingsSelectOption = {
  value: string;
  label: string;
};

export type SettingsItemBase = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type SettingsToggleItem = SettingsItemBase & {
  type: "toggle";
  value: boolean;
};

export type SettingsSelectItem = SettingsItemBase & {
  type: "select";
  value: string;
  options: SettingsSelectOption[];
};

export type SettingsTextItem = SettingsItemBase & {
  type: "text";
  value: string;
  placeholder?: string;
  monospaced?: boolean;
};

export type SettingsItem = SettingsToggleItem | SettingsSelectItem | SettingsTextItem;

export type SettingsSection = {
  id: SettingsSectionId;
  title: string;
  description?: string;
  items: SettingsItem[];
};

export type SettingsDefaults = {
  language: string;
  units: string;
  defaultCohort: string;
  shareAnonymizedAnalytics: boolean;
  allowModelImprovement: boolean;
  compactMode: boolean;
  reducedMotion: boolean;
};

export const mockSettings: {
  defaults: SettingsDefaults;
  cohorts: SettingsSelectOption[];
  sections: SettingsSection[];
} = {
  defaults: {
    language: "English (US)",
    units: "Metric",
    defaultCohort: "asian_male_young",
    shareAnonymizedAnalytics: true,
    allowModelImprovement: false,
    compactMode: false,
    reducedMotion: false,
  },
  cohorts: [
    { value: "asian_male_young", label: "asian_male_young" },
    { value: "white_male_young", label: "white_male_young" },
    { value: "black_male_young", label: "black_male_young" },
    { value: "latino_male_young", label: "latino_male_young" },
  ],
  sections: [
    {
      id: "general",
      title: "General",
      description: "Language, units, and defaults.",
      items: [
        {
          id: "language",
          type: "select",
          label: "Language",
          description: "Used for UI labels and formatting.",
          value: "English (US)",
          options: [
            { value: "English (US)", label: "English (US)" },
            { value: "English (UK)", label: "English (UK)" },
            { value: "Spanish", label: "Spanish" },
          ],
        },
        {
          id: "units",
          type: "select",
          label: "Units",
          description: "Preferred measurement units for ratios and angles.",
          value: "Metric",
          options: [
            { value: "Metric", label: "Metric" },
            { value: "Imperial", label: "Imperial" },
          ],
        },
        {
          id: "defaultCohort",
          type: "select",
          label: "Default cohort",
          description: "Applied to new analyses by default.",
          value: "asian_male_young",
          options: [
            { value: "asian_male_young", label: "asian_male_young" },
            { value: "white_male_young", label: "white_male_young" },
            { value: "black_male_young", label: "black_male_young" },
            { value: "latino_male_young", label: "latino_male_young" },
          ],
        },
      ],
    },
    {
      id: "privacy",
      title: "Privacy",
      description: "Control how your data is used for improvements.",
      items: [
        {
          id: "shareAnonymizedAnalytics",
          type: "toggle",
          label: "Share anonymized analytics",
          description: "Help Blackpill improve with aggregate metrics.",
          value: true,
        },
        {
          id: "allowModelImprovement",
          type: "toggle",
          label: "Allow model improvement",
          description: "Opt in to use samples for model tuning (mock).",
          value: false,
        },
      ],
    },
    {
      id: "appearance",
      title: "Appearance",
      description: "UI behavior and accessibility preferences.",
      items: [
        {
          id: "compactMode",
          type: "toggle",
          label: "Compact mode",
          description: "Reduce padding in tables and cards.",
          value: false,
        },
        {
          id: "reducedMotion",
          type: "toggle",
          label: "Reduced motion",
          description: "Minimize animations across the UI.",
          value: false,
        },
      ],
    },
    {
      id: "api",
      title: "API",
      description: "Developer access (UI only).",
      items: [
        {
          id: "apiKey",
          type: "text",
          label: "API key",
          description: "Mocked key. Generation is disabled in UI-only mode.",
          value: "bp_live_xxxxxxxxxxxxxxxxxxxxxxxx",
          placeholder: "Not generated",
          monospaced: true,
          disabled: true,
        },
      ],
    },
  ],
};

