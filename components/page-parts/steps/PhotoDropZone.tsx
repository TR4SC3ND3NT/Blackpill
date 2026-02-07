"use client";
/* eslint-disable @next/next/no-img-element */

import type { DragEvent as ReactDragEvent, RefObject } from "react";
import styles from "@/app/page.module.css";
import type { ImageState } from "@/lib/page-flow/types";

type Props = {
  title: string;
  note: string;
  previewAlt: string;
  image: ImageState | null;
  isActive: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onActivate: () => void;
  onDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onFileChange: (file?: File) => void;
};

export default function PhotoDropZone({
  title,
  note,
  previewAlt,
  image,
  isActive,
  inputRef,
  onActivate,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}: Props) {
  return (
    <div className={styles.uploadCard}>
      <div>
        <strong>{title}</strong>
        <div className={styles.note}>{note}</div>
      </div>
      <div className={styles.preview}>
        {image ? (
          <img src={image.dataUrl} alt={previewAlt} />
        ) : (
          <div className={styles.previewPlaceholder}>{previewAlt}</div>
        )}
      </div>
      <div
        className={`${styles.dropZone} ${isActive ? styles.dropZoneActive : ""}`}
        role="button"
        tabIndex={0}
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className={styles.dropTitle}>
          {image ? `Replace ${title.toLowerCase()}` : `Drop ${title.toLowerCase()} here`}
        </div>
        <div className={styles.dropHint}>or click to browse</div>
      </div>
      <input
        ref={inputRef}
        className={styles.hiddenFileInput}
        type="file"
        accept="image/*"
        onChange={(event) => {
          onFileChange(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
