import Link from "next/link";

export default function ResultsIndex() {
  return (
    <main>
      <h1>Results</h1>
      <p>
        This MVP uses direct result links. Go back to{" "}
        <Link href="/">upload</Link> to start a new analysis.
      </p>
    </main>
  );
}
