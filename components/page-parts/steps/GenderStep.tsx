"use client";

import Button from "@/components/Button";
import Card from "@/components/Card";
import styles from "@/app/page.module.css";

type Props = {
  gender: string;
  error: string | null;
  onSelectGender: (value: string) => void;
  onContinue: () => void;
};

export default function GenderStep({
  gender,
  error,
  onSelectGender,
  onContinue,
}: Props) {
  return (
    <Card className={`${styles.homeCard} ${styles.grid}`}>
      <div>
        <strong>Select your gender</strong>
        <div className={styles.note}>
          This helps us calibrate symmetry and ratio benchmarks.
        </div>
      </div>
      <div className={styles.choiceGrid}>
        {[
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.choiceButton} ${
              gender === option.value ? styles.choiceButtonActive : ""
            }`}
            onClick={() => onSelectGender(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.actions}>
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </Card>
  );
}
