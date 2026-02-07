"use client";

import type { DragEvent as ReactDragEvent, RefObject } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import styles from "@/app/page.module.css";
import type { ImageState } from "@/lib/page-flow/types";
import PhotoDropZone from "./PhotoDropZone";

type Props = {
  frontImage: ImageState | null;
  sideImage: ImageState | null;
  activeDropZone: "front" | "side" | null;
  frontInputRef: RefObject<HTMLInputElement | null>;
  sideInputRef: RefObject<HTMLInputElement | null>;
  error: string | null;
  canProceed: boolean;
  setActiveDropZone: (value: "front" | "side" | null) => void;
  onFrontFileChange: (file?: File) => void;
  onSideFileChange: (file?: File) => void;
  onFrontDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onSideDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onBack: () => void;
  onContinue: () => void;
  onReset: () => void;
};

export default function UploadStep({
  frontImage,
  sideImage,
  activeDropZone,
  frontInputRef,
  sideInputRef,
  error,
  canProceed,
  setActiveDropZone,
  onFrontFileChange,
  onSideFileChange,
  onFrontDrop,
  onSideDrop,
  onBack,
  onContinue,
  onReset,
}: Props) {
  return (
    <Card className={`${styles.homeCard} ${styles.grid}`}>
      <div className={styles.uploadGrid}>
        <PhotoDropZone
          title="Front Photo"
          note="Straight-on, eyes open, even lighting."
          previewAlt="Front photo preview"
          image={frontImage}
          isActive={activeDropZone === "front"}
          inputRef={frontInputRef}
          onActivate={() => frontInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setActiveDropZone("front");
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            setActiveDropZone(null);
          }}
          onDrop={onFrontDrop}
          onFileChange={onFrontFileChange}
        />

        <PhotoDropZone
          title="Side Photo"
          note="Clear profile, chin neutral."
          previewAlt="Side photo preview"
          image={sideImage}
          isActive={activeDropZone === "side"}
          inputRef={sideInputRef}
          onActivate={() => sideInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setActiveDropZone("side");
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            setActiveDropZone(null);
          }}
          onDrop={onSideDrop}
          onFileChange={onSideFileChange}
        />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={!canProceed}>
          Continue to Consent
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Reset
        </Button>
      </div>
    </Card>
  );
}
