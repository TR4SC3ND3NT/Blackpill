"use client";

import Button from "@/components/Button";
import Card from "@/components/Card";
import styles from "@/app/page.module.css";

type Props = {
  race: string;
  error: string | null;
  onSelectRace: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

export default function EthnicityStep({
  race,
  error,
  onSelectRace,
  onBack,
  onContinue,
}: Props) {
  return (
    <Card className={`${styles.homeCard} ${styles.grid}`}>
      <div>
        <strong>Select your ethnicity</strong>
        <div className={styles.note}>
          Choose the closest match to align feature comparisons.
        </div>
      </div>
      <div className={`${styles.choiceGrid} ${styles.choiceGridVertical}`}>
        {[
          { value: "asian", label: "Asian" },
          { value: "black", label: "Black / African" },
          { value: "latino", label: "Hispanic / Latino" },
          { value: "middle-eastern", label: "Middle Eastern" },
          { value: "white", label: "White / Caucasian" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.choiceButton} ${
              race === option.value ? styles.choiceButtonActive : ""
            }`}
            onClick={() => onSelectRace(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </Card>
  );
}
