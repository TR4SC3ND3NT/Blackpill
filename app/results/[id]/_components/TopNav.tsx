"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Button from "@/components/Button";
import styles from "../results.module.css";
import { useFace } from "./FaceProvider";

export default function TopNav({ id }: { id: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { face, diagnostics } = useFace();

  const tabs = useMemo(
    () => [
      { label: "Overview", href: `/results/${id}` },
      { label: "Harmony", href: `/results/${id}/harmony` },
      { label: "Angularity", href: `/results/${id}/angularity` },
      { label: "Dimorphism", href: `/results/${id}/dimorphism` },
      { label: "Features", href: `/results/${id}/features` },
      { label: "Plan", href: `/results/${id}/plan` },
    ],
    [id]
  );

  const handleDownload = () => {
    if (!face) return;
    const payload = {
      exportedAtIso: new Date().toISOString(),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      faceId: face.id,
      face,
      diagnostics,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    let url = "";
    const link = document.createElement("a");
    try {
      url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `face-${face.id}.debug.json`;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      if (url) {
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    }
  };

  return (
    <div className={styles.topNavWrap}>
      <nav className={styles.topNav}>
        <div className={styles.topNavLeft}>
          <div className={styles.logoMark}>Blackpill</div>
        </div>
        <div className={styles.topNavTabs}>
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={styles.navTab}
              >
                {active ? (
                  <motion.span
                    layoutId="active-tab"
                    className={styles.navTabPill}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                ) : null}
                <span className={styles.navTabLabel}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
        <div className={styles.topNavRight}>
          <Link href="/" className={styles.navLink}>
            Support
          </Link>
          <button
            type="button"
            className={styles.optionsButton}
            onClick={() => setOpen((prev) => !prev)}
          >
            Options
          </button>
          <div className={`${styles.optionsMenu} ${open ? styles.optionsMenuOpen : ""}`}>
            <Button
              variant="ghost"
              onClick={handleDownload}
              type="button"
              className={styles.optionsItem}
            >
              Download debug JSON
            </Button>
            <Link href="/" className={styles.optionsItemLink}>
              Start new
            </Link>
            <Link href="/" className={styles.optionsItemLink}>
              Support
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
}
