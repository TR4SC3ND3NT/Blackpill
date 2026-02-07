import type { ReactNode } from "react";
import { FaceProvider } from "./_components/FaceProvider";
import { SubscriptionProvider } from "./_components/SubscriptionProvider";
import TopNav from "./_components/TopNav";
import styles from "./results.module.css";

export default async function ResultsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <FaceProvider id={id}>
      <SubscriptionProvider>
        <div className={styles.resultsShell}>
          <TopNav id={id} />
          <div className={styles.resultsContainer}>{children}</div>
        </div>
      </SubscriptionProvider>
    </FaceProvider>
  );
}
