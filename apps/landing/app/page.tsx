import { Logo } from "@tollgate/ui";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: "0 24px",
        textAlign: "center",
      }}
    >
      <Logo size="lg" variant="full" />

      <div style={{ maxWidth: 600 }}>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            margin: 0,
          }}
        >
          Bounded autonomy
          <br />
          <span style={{ color: "#F4533C" }}>for AI agents.</span>
        </h1>

        <p
          className="text-secondary"
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            fontWeight: 400,
            marginTop: 24,
          }}
        >
          Define what your agents can do. Approve what's risky. Audit
          everything. tollgate is the policy and approval layer between your
          agents and the real world.
        </p>
      </div>
    </main>
  );
}
