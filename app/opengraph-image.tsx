import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(180deg, #fbf6ef 0%, #f6efe5 55%, #f2e7d8 100%)",
          color: "#1d2740",
          padding: "56px"
        }}
      >
        <div
          style={{
            display: "flex",
            border: "1px solid rgba(183,138,73,0.28)",
            borderRadius: "999px",
            padding: "12px 20px",
            fontSize: 26,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#b78a49"
          }}
        >
          Premium Bedsheets
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 82,
              lineHeight: 0.92,
              letterSpacing: "-0.06em",
              fontWeight: 600,
              maxWidth: "820px"
            }}
          >
            Thread Theory Home
          </div>
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.35,
              color: "#5d615f",
              maxWidth: "820px"
            }}
          >
            Instagram-first bedding with direct order confirmation and private tracking.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center"
          }}
        >
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: 28,
              background: "#fffaf2",
              border: "1px solid rgba(29,39,64,0.10)",
              boxShadow: "0 20px 50px rgba(29,39,64,0.10)"
            }}
          />
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 36,
              background: "#b78a49",
              border: "1px solid rgba(29,39,64,0.10)",
              boxShadow: "0 20px 50px rgba(29,39,64,0.12)"
            }}
          />
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 32,
              background: "#1d2740",
              border: "1px solid rgba(29,39,64,0.10)",
              boxShadow: "0 20px 50px rgba(29,39,64,0.14)"
            }}
          />
        </div>
      </div>
    ),
    size
  );
}
