import { ImageResponse } from "next/og";
import { getShareCardData } from "@/lib/share-cards";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

type ShareCardImageProps = {
  params: Promise<{ kind: string; id: string }>;
};

export default async function OpenGraphImage({ params }: ShareCardImageProps) {
  const { kind, id } = await params;
  const card = await getShareCardData(kind, id);

  if (!card) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            height: "100%",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(160deg, rgb(255,249,239) 0%, rgb(255,253,248) 50%, rgb(244,239,227) 100%)",
            color: "rgb(28,25,23)",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          Politired
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          background:
            "linear-gradient(160deg, rgb(255,249,239) 0%, rgb(255,253,248) 50%, rgb(244,239,227) 100%)",
          color: "rgb(28,25,23)",
          padding: 48,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            border: "1px solid rgba(214,211,209,1)",
            borderRadius: 36,
            padding: 36,
            background: "rgba(255,255,255,0.88)",
            boxShadow: "0 24px 70px rgba(15,23,42,0.12)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "rgb(180,83,9)",
                }}
              >
                {card.eyebrow}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgb(87,83,78)",
                }}
              >
                Politired
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 58,
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: "-0.04em",
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgb(87,83,78)",
                }}
              >
                {card.subtitle}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  lineHeight: 1.35,
                  color: "rgb(68,64,60)",
                  maxWidth: 980,
                }}
              >
                {card.summary}
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {card.stats.slice(0, 4).map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    flex: 1,
                    borderRadius: 24,
                    border: "1px solid rgba(231,229,228,1)",
                    background: "rgba(250,250,249,1)",
                    padding: "18px 20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "rgb(120,113,108)",
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 32,
                      fontWeight: 800,
                      lineHeight: 1.1,
                    }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 24,
              marginTop: 32,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {card.bullets.slice(0, 2).map((bullet) => (
                <div
                  key={bullet}
                  style={{
                    display: "flex",
                    fontSize: 20,
                    lineHeight: 1.35,
                    color: "rgb(68,64,60)",
                  }}
                >
                  • {bullet}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
                fontSize: 18,
                color: "rgb(120,113,108)",
              }}
            >
              <div style={{ display: "flex", fontWeight: 700 }}>
                Ask. Verify. Share receipts.
              </div>
              <div style={{ display: "flex" }}>politired</div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
