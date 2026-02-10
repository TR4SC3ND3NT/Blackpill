"use client";

export type ReferenceNotFoundProps = {
  code?: string;
  message?: string;
};

export function ReferenceNotFound({
  code = "404",
  message = "This page could not be found.",
}: ReferenceNotFoundProps) {
  return (
    <div
      className="bp-ref-404"
      style={{
        fontFamily:
          'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
        height: "100vh",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
.bp .bp-ref-404 { color: #000; background: #fff; margin: 0; }
.bp .bp-ref-404-h1 { border-right: 1px solid rgba(0, 0, 0, .3); }
@media (prefers-color-scheme: dark) {
  .bp .bp-ref-404 { color: #fff; background: #000; }
  .bp .bp-ref-404-h1 { border-right: 1px solid rgba(255, 255, 255, .3); }
}
      `}</style>

      <div>
        <h1
          className="bp-ref-404-h1"
          style={{
            display: "inline-block",
            margin: "0 20px 0 0",
            padding: "0 23px 0 0",
            fontSize: 24,
            fontWeight: 500,
            verticalAlign: "top",
            lineHeight: "49px",
          }}
        >
          {code}
        </h1>
        <div style={{ display: "inline-block" }}>
          <h2 style={{ fontSize: 14, fontWeight: 400, lineHeight: "49px", margin: 0 }}>
            {message}
          </h2>
        </div>
      </div>
    </div>
  );
}

