import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function BrandFrame() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #17191D 0%, #0B0B0C 70%)",
        position: "relative",
        overflow: "hidden",
        color: "#F3F1EC",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 28,
          borderRadius: 26,
          border: "1px solid rgba(124, 143, 163, 0.24)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 48,
          display: "flex",
          justifyContent: "space-between",
          gap: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 620,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              <div
                style={{
                  width: 78,
                  height: 78,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 16,
                  border: "1px solid rgba(124, 143, 163, 0.5)",
                  background: "rgba(26, 33, 40, 0.72)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 50,
                    fontWeight: 800,
                    letterSpacing: "-0.08em",
                    fontFamily: "Georgia, serif",
                    transform: "translateX(-3px)",
                  }}
                >
                  D
                </div>
                <div
                  style={{
                    position: "absolute",
                    right: 16,
                    top: 20,
                    width: 14,
                    height: 4,
                    borderRadius: 999,
                    background:
                      "linear-gradient(90deg, #91A3B5 0%, #7C8FA3 100%)",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 20,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "#A7ADB7",
                  }}
                >
                  DueForm
                </div>
                <div
                  style={{
                    display: "flex",
                    width: 140,
                    height: 2,
                    background: "rgba(124, 143, 163, 0.6)",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 78,
                  lineHeight: 0.95,
                  letterSpacing: "-0.06em",
                  fontWeight: 700,
                  fontFamily: "Georgia, serif",
                }}
              >
                Create invoices,
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 78,
                  lineHeight: 0.95,
                  letterSpacing: "-0.06em",
                  fontWeight: 700,
                  fontFamily: "Georgia, serif",
                }}
              >
                send PDFs,
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 78,
                  lineHeight: 0.95,
                  letterSpacing: "-0.06em",
                  fontWeight: 700,
                  fontFamily: "Georgia, serif",
                }}
              >
                track payments.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                width: 520,
                fontSize: 28,
                lineHeight: 1.45,
                color: "#A7ADB7",
              }}
            >
              Premium invoicing with public links, payment tracking, reminders,
              and client-ready documents.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 24,
              color: "#A7ADB7",
              fontSize: 22,
              letterSpacing: "0.04em",
            }}
          >
            <div style={{ display: "flex" }}>Saved clients</div>
            <div style={{ display: "flex" }}>Credits &amp; offsets</div>
            <div style={{ display: "flex" }}>Public invoice links</div>
          </div>
        </div>

        <div
          style={{
            width: 380,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: 480,
              borderRadius: 24,
              background:
                "linear-gradient(180deg, rgba(243,241,236,0.98) 0%, rgba(234,231,224,0.98) 100%)",
              border: "1px solid rgba(124, 143, 163, 0.28)",
              boxShadow: "0 22px 48px rgba(0, 0, 0, 0.28)",
              padding: "34px 32px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              color: "#1B1916",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 22,
                      fontWeight: 700,
                      fontFamily: "Georgia, serif",
                    }}
                  >
                    DueForm Studio
                  </div>
                  <div
                    style={{
                      display: "flex",
                      width: 84,
                      height: 2,
                      background: "#7C8FA3",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.24em",
                      color: "#738292",
                    }}
                  >
                    Invoice
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 28,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      color: "#7C8FA3",
                    }}
                  >
                    DF-0042
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  borderTop: "1px solid rgba(124, 143, 163, 0.18)",
                  paddingTop: 18,
                  fontSize: 16,
                  color: "#413D37",
                }}
              >
                <div style={{ display: "flex" }}>Bill to: Studio Retainer</div>
                <div style={{ display: "flex" }}>Website design deposit</div>
                <div style={{ display: "flex" }}>Product photography setup</div>
                <div style={{ display: "flex" }}>Artwork credit applied</div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                borderTop: "1px solid rgba(124, 143, 163, 0.18)",
                paddingTop: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                  color: "#5B554E",
                }}
              >
                <span>Invoice total</span>
                <span>$900.00</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                  color: "#5B554E",
                }}
              >
                <span>Artwork credit</span>
                <span>-$500.00</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#7C8FA3",
                  borderTop: "1px solid rgba(124, 143, 163, 0.28)",
                  paddingTop: 16,
                }}
              >
                <span>Total due</span>
                <span>$400.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(<BrandFrame />, size);
}
