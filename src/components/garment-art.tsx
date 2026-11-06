import { useId } from "react";
import type { Product } from "@/lib/products";

// Hand-drawn SVG stand-ins for product photos, on a 240×300 (4:5) canvas. The 3D
// rack rasterises these (without the hanger) as the garment's front, back and side.

const OUTLINE = "rgba(0,0,0,0.22)";

type Side = "front" | "back" | "side";

const BODY = {
  tee: "M98 44 Q120 {neck} 142 44 L174 56 L178 286 Q120 290 62 286 L66 56 Z",
  longsleeve: "M98 44 Q120 {neck} 142 44 L174 56 L178 290 Q120 294 62 290 L66 56 Z",
  hoodie: "M98 44 Q120 {neck} 142 44 L176 58 L180 288 Q120 292 60 288 L64 58 Z",
  jacket: "M98 44 Q120 {neck} 142 44 L178 58 L182 282 L58 282 L62 58 Z",
  shirt: "M98 44 Q120 {neck} 142 44 L178 58 L182 268 L58 268 L62 58 Z",
};

// Left sleeves only; the right one is the same path mirrored.
const SLEEVE = {
  tee: "M70 56 L40 102 L64 116 L72 96 Z",
  longsleeve: "M70 56 C50 60 40 80 38 110 L36 272 L62 276 L72 120 Z",
  hoodie: "M68 58 C48 62 38 82 36 112 L34 274 L62 278 L70 122 Z",
  jacket: "M66 58 C46 62 36 84 34 114 L32 268 L60 272 L68 124 Z",
  shirt: "M68 56 L32 114 L62 130 L72 100 Z",
};

const CUFF = {
  longsleeve: "M36 258 L36 272 L62 276 L63 262 Z",
  hoodie: "M34 256 L34 274 L62 278 L63 260 Z",
  jacket: "M32 252 L32 268 L60 272 L61 256 Z",
};

function Mirror({ children }: { children: React.ReactNode }) {
  return <g transform="translate(240 0) scale(-1 1)">{children}</g>;
}

function Hanger() {
  return (
    <g>
      <path
        d="M120 40 V18 C120 6 134 4 135 14"
        fill="none"
        stroke="#7c7c80"
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <path d="M120 34 L66 56 L174 56 Z" fill="#8a5a3b" />
    </g>
  );
}

export function GarmentArt({
  product,
  side = "front",
  hanger = true,
  className,
}: {
  product: Product;
  side?: Side;
  hanger?: boolean;
  className?: string;
}) {
  if (product.type === "pants") return <PantsArt product={product} side={side} className={className} />;
  if (side === "side") return <SideArt product={product} className={className} />;
  return <FlatArt product={product} side={side} hanger={hanger} className={className} />;
}

function FabricPattern({ id, product }: { id: string; product: Product }) {
  const { fabric, color } = product;
  if (fabric.kind === "stripe") {
    return (
      <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
        <rect width="18" height="18" fill={color} />
        <rect width="7" height="18" fill={fabric.stripe} />
      </pattern>
    );
  }
  if (fabric.kind === "plaid") {
    return (
      <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
        <rect width="22" height="22" fill={color} />
        <rect width="22" height="5" y="4" fill={fabric.lines[0]} opacity={0.7} />
        <rect width="5" height="22" x="4" fill={fabric.lines[0]} opacity={0.7} />
        <rect width="22" height="1.5" y="15" fill={fabric.lines[1]} />
        <rect width="1.5" height="22" x="15" fill={fabric.lines[1]} />
      </pattern>
    );
  }
  return null;
}

function FlatArt({
  product,
  side,
  hanger,
  className,
}: {
  product: Product;
  side: "front" | "back";
  hanger: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const { type, color, accent, fabric } = product;
  if (type === "pants") return null; // drawn by PantsArt
  const fabricId = `fabric-${uid}`;
  const shadeId = `shade-${uid}`;
  const clipId = `clip-${uid}`;
  const fill = fabric.kind === "solid" ? color : `url(#${fabricId})`;

  const neck = side === "front" ? (type === "tee" || type === "longsleeve" ? 58 : 54) : 49;
  const body = BODY[type].replace("{neck}", String(neck));
  const sleeve = SLEEVE[type];
  const cuff = type in CUFF ? CUFF[type as keyof typeof CUFF] : null;
  const light = isLight(color);
  const trim = light ? "rgba(0,0,0,0.55)" : "#f2f0ea";

  const sleeveShape = (mirrored: boolean) => {
    const panelSleeve = product.panel && mirrored === (side === "front");
    return (
      <>
        <path d={sleeve} fill={panelSleeve ? product.panel : fill} stroke={OUTLINE} />
        {panelSleeve && side === "front" && (
          <path d="M44 96 L64 108" stroke="#d6ec5a" strokeWidth={2} fill="none" />
        )}
        {side === "back" && product.panel && (
          <path d="M46 92 L66 104 L62 122 L36 108 Z" fill={product.panel} stroke="#d6ec5a" strokeWidth={1.4} />
        )}
        {cuff && (
          <path d={cuff} fill={fabric.kind === "solid" && type !== "jacket" ? accent : color} stroke={OUTLINE} />
        )}
      </>
    );
  };

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 240 300" className={className} aria-hidden>
      <defs>
        <FabricPattern id={fabricId} product={product} />
        <linearGradient id={shadeId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={0.14} />
          <stop offset="0.3" stopColor="#000" stopOpacity={0} />
          <stop offset="0.55" stopColor="#fff" stopOpacity={0.08} />
          <stop offset="1" stopColor="#000" stopOpacity={0.18} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={body} />
        </clipPath>
      </defs>

      {hanger && <Hanger />}

      {/* Sleeves sit behind the body. */}
      {sleeveShape(false)}
      <Mirror>{sleeveShape(true)}</Mirror>

      <path d={body} fill={fill} stroke={OUTLINE} />

      <g clipPath={`url(#${clipId})`}>
        {product.panel && side === "front" && (
          <path
            d="M120 60 C150 78 136 128 166 150 C186 166 160 210 190 230 L190 290 L120 290 Z"
            fill={product.panel}
            stroke="#d6ec5a"
            strokeWidth={2}
          />
        )}
        {/* Hem rib. */}
        {(type === "hoodie" || type === "longsleeve") && (
          <rect x="50" y={type === "hoodie" ? 270 : 276} width="140" height="30" fill={accent} opacity={0.9} />
        )}
        {type === "jacket" && <rect x="50" y="264" width="140" height="20" fill={color} stroke={OUTLINE} />}
        {/* Soft folds. */}
        <path d="M92 120 Q96 200 88 284" stroke="#000" strokeOpacity={0.07} strokeWidth={3} fill="none" />
        <path d="M150 110 Q146 190 154 284" stroke="#000" strokeOpacity={0.07} strokeWidth={3} fill="none" />
        <rect x="0" y="0" width="240" height="300" fill={`url(#${shadeId})`} />
      </g>

      {side === "front" ? <FrontDetails product={product} trim={trim} /> : <BackDetails product={product} trim={trim} />}
    </svg>
  );
}

function FrontDetails({ product, trim }: { product: Product; trim: string }) {
  const { type, color, accent } = product;
  const stitch = { stroke: accent, strokeWidth: 1.4, strokeDasharray: "3 2.5", fill: "none" } as const;

  if (type === "hoodie") {
    return (
      <g>
        <path d="M90 48 C88 30 102 20 120 20 C138 20 152 30 150 48 Q120 72 90 48 Z" fill={color} stroke={OUTLINE} />
        <path d="M100 47 C102 36 110 30 120 30 C130 30 138 36 140 47 Q120 62 100 47 Z" fill={accent} />
        <path d="M110 60 L107 122" stroke={trim} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M130 60 L133 122" stroke={trim} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M84 204 L156 204 L170 258 L70 258 Z" fill="none" stroke="#000" strokeOpacity={0.18} strokeWidth={1.5} />
      </g>
    );
  }

  if (type === "jacket") {
    return (
      <g>
        <path d="M120 70 V282" stroke="#000" strokeOpacity={0.35} strokeWidth={1.5} />
        <path d="M117 72 V280" {...stitch} />
        {[100, 140, 180, 220, 254].map((y) => (
          <circle key={y} cx={126} cy={y} r={3.4} fill="#b9b9bd" stroke="#555" strokeWidth={0.8} />
        ))}
        {[78, 136].map((x) => (
          <g key={x}>
            <rect x={x} y={110} width={28} height={30} fill="none" stroke="#000" strokeOpacity={0.25} />
            <rect x={x + 2} y={112} width={24} height={26} {...stitch} />
            <path d={`M${x - 1} 106 H${x + 29} V118 H${x - 1} Z`} fill={color} stroke="#000" strokeOpacity={0.25} />
          </g>
        ))}
        <path d="M54 268 H186" {...stitch} />
        <path d="M96 40 L120 72 L98 86 L82 54 Z" fill={color} stroke="#000" strokeOpacity={0.3} />
        <path d="M144 40 L120 72 L142 86 L158 54 Z" fill={color} stroke="#000" strokeOpacity={0.3} />
        <path d="M94 46 L117 74 M146 46 L123 74" {...stitch} />
      </g>
    );
  }

  if (type === "shirt") {
    return (
      <g>
        <path d="M120 64 V268" stroke="#000" strokeOpacity={0.25} strokeWidth={1.2} />
        {[92, 132, 172, 212, 250].map((y) => (
          <circle key={y} cx={120} cy={y} r={2.8} fill="#f4f2ec" stroke="#888" strokeWidth={0.6} />
        ))}
        <path d="M96 40 Q92 54 88 68 L112 82 L120 62 Z" fill={product.fabric.kind === "solid" ? color : `${color}`} stroke={OUTLINE} />
        <path d="M144 40 Q148 54 152 68 L128 82 L120 62 Z" fill={product.panel ?? color} stroke={OUTLINE} />
        {product.fabric.kind === "stripe" && (
          <rect x="132" y="104" width="22" height="24" fill={product.fabric.stripe} opacity={0.4} stroke={OUTLINE} />
        )}
      </g>
    );
  }

  // Tee and longsleeve: ribbed crew neck.
  return (
    <path
      d={`M98 44 Q120 58 142 44 L146 46 Q120 66 94 46 Z`}
      fill={accent}
      stroke={OUTLINE}
      strokeWidth={0.8}
    />
  );
}

function BackDetails({ product, trim }: { product: Product; trim: string }) {
  const { type, color, accent, backPrint, panel } = product;
  const printColor = panel ?? trim;

  return (
    <g>
      {type === "hoodie" && (
        <>
          <path d="M90 46 C84 92 100 130 120 134 C140 130 156 92 150 46 Q120 58 90 46 Z" fill={color} stroke={OUTLINE} />
          <path d="M120 52 V132" stroke="#000" strokeOpacity={0.15} />
        </>
      )}
      {(type === "jacket" || type === "shirt") && (
        <>
          <path d="M96 40 Q120 48 144 40 L146 50 Q120 58 94 50 Z" fill={color} stroke={OUTLINE} />
          <path d="M62 86 Q120 96 178 86" stroke="#000" strokeOpacity={0.2} fill="none" />
        </>
      )}
      {(type === "tee" || type === "longsleeve") && (
        <path d="M98 44 Q120 50 142 44 L145 47 Q120 56 95 47 Z" fill={accent} stroke={OUTLINE} strokeWidth={0.8} />
      )}
      {backPrint && (
        <text
          x="120"
          y={type === "hoodie" ? 172 : 124}
          textAnchor="middle"
          fontSize={backPrint.length > 6 ? 20 : 26}
          fontWeight={900}
          letterSpacing={1}
          fill={printColor}
          stroke={panel ? "#d6ec5a" : "none"}
          strokeWidth={0.8}
          style={{ fontFamily: "var(--font-display), sans-serif", fontStretch: "125%" }}
        >
          {backPrint}
        </text>
      )}
    </g>
  );
}

// Side view, with the front of the garment facing right. Same canvas and the same
// top and hem heights as the front, so the two line up in 3D.
const SIDE_HEM = { tee: 286, longsleeve: 290, hoodie: 288, jacket: 282, shirt: 268 };

function SideArt({ product, className }: { product: Product; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const { type, color, accent, fabric, panel } = product;
  if (type === "pants") return null; // drawn by PantsArt
  const fabricId = `side-fabric-${uid}`;
  const shadeId = `side-shade-${uid}`;
  const fill = fabric.kind === "solid" ? color : `url(#${fabricId})`;
  const hem = SIDE_HEM[type];
  const flare = type === "shirt" || type === "jacket" ? 6 : 3;
  const body = `M104 50 Q118 40 134 46 C140 70 141 110 ${140 + flare / 2} 160 L${140 + flare} ${hem} Q120 ${hem + 3} ${100 - flare} ${hem} L${101 - flare / 2} 160 C100 110 100 70 104 50 Z`;
  const longSleeve = type === "longsleeve" || type === "hoodie" || type === "jacket";
  const sleeve = longSleeve
    ? `M110 54 C104 70 103 130 105 ${hem - 6} L131 ${hem - 4} C133 130 133 72 128 54 Z`
    : type === "shirt"
      ? "M106 52 L100 124 L136 128 L131 52 Z"
      : "M107 52 L102 116 L134 120 L130 52 Z";

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 240 300" className={className} aria-hidden>
      <defs>
        {fabric.kind === "stripe" && (
          <pattern id={fabricId} width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill={color} />
            <rect width="7" height="18" fill={fabric.stripe} />
          </pattern>
        )}
        {fabric.kind === "plaid" && (
          <pattern id={fabricId} width="22" height="22" patternUnits="userSpaceOnUse">
            <rect width="22" height="22" fill={color} />
            <rect width="22" height="5" y="4" fill={fabric.lines[0]} opacity={0.7} />
            <rect width="5" height="22" x="4" fill={fabric.lines[0]} opacity={0.7} />
            <rect width="22" height="1.5" y="15" fill={fabric.lines[1]} />
          </pattern>
        )}
        <linearGradient id={shadeId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={0.2} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0.05} />
          <stop offset="1" stopColor="#000" stopOpacity={0.18} />
        </linearGradient>
      </defs>

      {/* The hood falls down the back. */}
      {type === "hoodie" && (
        <path d="M112 44 C112 26 98 18 90 30 C82 52 84 92 96 118 C102 104 106 76 112 56 Z" fill={color} stroke={OUTLINE} />
      )}

      <path d={body} fill={fill} stroke={OUTLINE} />
      {(type === "hoodie" || type === "longsleeve") && (
        <path d={`M${99 - flare} ${hem - 14} L${141 + flare} ${hem - 14} L${140 + flare} ${hem} Q120 ${hem + 3} ${100 - flare} ${hem} Z`} fill={accent} />
      )}
      {type === "jacket" && (
        <path d={`M${99 - flare} ${hem - 16} L${141 + flare} ${hem - 16} L${140 + flare} ${hem} L${100 - flare} ${hem} Z`} fill={color} stroke={OUTLINE} />
      )}
      <path d={body} fill={`url(#${shadeId})`} />
      <path d={`M114 120 Q112 200 110 ${hem - 4}`} stroke="#000" strokeOpacity={0.08} strokeWidth={2} fill="none" />

      {/* The near sleeve hangs over the side seam. */}
      <path d={sleeve} fill={panel ?? fill} stroke={panel ? "#d6ec5a" : OUTLINE} strokeWidth={panel ? 1.5 : 1} />
      {longSleeve && (
        <path d={`M105 ${hem - 22} L131 ${hem - 20} L131 ${hem - 4} L105 ${hem - 6} Z`} fill={type === "jacket" ? color : accent} stroke={OUTLINE} />
      )}
      <path d={sleeve} fill={`url(#${shadeId})`} />
      <path d={`M118 70 Q116 ${longSleeve ? 160 : 100} 117 ${longSleeve ? hem - 30 : 112}`} stroke="#000" strokeOpacity={0.1} strokeWidth={1.5} fill="none" />

      {(type === "jacket" || type === "shirt") && (
        <path d="M124 42 L138 46 L136 62 L126 54 Z" fill={type === "shirt" && panel ? panel : color} stroke={OUTLINE} />
      )}
      {(type === "tee" || type === "longsleeve") && <path d="M108 46 Q120 40 132 45 L132 49 Q120 45 108 50 Z" fill={accent} />}
      {type === "jacket" && (
        <path d={`M${139 + flare / 2} 64 L${139 + flare} ${hem - 4}`} stroke={accent} strokeWidth={1.2} strokeDasharray="3 2.5" />
      )}
    </svg>
  );
}

// Pants are long, so they fill nearly the whole height: waistband at the top, legs
// slightly apart, and in the side view the front faces right and the seat bulges left.
const PANTS = {
  flat: "M70 12 L170 12 L176 84 L171 286 L125 286 L121 106 Q120 102 119 106 L115 286 L69 286 L64 84 Z",
  side: "M98 12 L140 12 C144 34 147 64 146 96 L139 286 L101 286 C97 210 92 140 89 92 C87 60 92 34 98 12 Z",
};

function PantsArt({ product, side, className }: { product: Product; side: Side; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const { color, accent, fabric } = product;
  const fabricId = `pants-fabric-${uid}`;
  const shadeId = `pants-shade-${uid}`;
  const clipId = `pants-clip-${uid}`;
  const fill = fabric.kind === "solid" ? color : `url(#${fabricId})`;
  const outline = side === "side" ? PANTS.side : PANTS.flat;
  const seam = { stroke: "#000", strokeOpacity: 0.22, strokeWidth: 1.2, fill: "none" } as const;
  const stitch = { stroke: accent, strokeWidth: 1.2, strokeDasharray: "3 2.5", fill: "none" } as const;
  const fold = { stroke: "#000", strokeOpacity: 0.08, strokeWidth: 2.5, fill: "none" } as const;
  const loops = side === "side" ? [117] : side === "front" ? [80, 104, 136, 156] : [80, 104, 118, 132, 156];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 240 300" className={className} aria-hidden>
      <defs>
        <FabricPattern id={fabricId} product={product} />
        <linearGradient id={shadeId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={0.16} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0.06} />
          <stop offset="1" stopColor="#000" stopOpacity={0.18} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={outline} />
        </clipPath>
      </defs>

      <path d={outline} fill={fill} stroke={OUTLINE} />
      <g clipPath={`url(#${clipId})`}>
        {/* Waistband and hems. */}
        <path d="M0 27 H240" {...seam} />
        <path d="M0 24 H240 M0 279 H240" {...stitch} />
        {side === "front" && (
          <>
            <path d="M120 27 V100" {...seam} />
            <path d="M128 27 V76 Q128 88 120 92" {...stitch} />
            <path d="M78 27 Q90 50 65 64 M162 27 Q150 50 175 64" {...seam} />
          </>
        )}
        {side === "back" && (
          <>
            <path d="M120 27 V104" {...seam} />
            <path d="M60 44 Q92 52 120 62 Q148 52 180 44" {...seam} />
            <path d="M80 70 L110 66 L111 100 L96 108 L82 102 Z M160 70 L130 66 L129 100 L144 108 L158 102 Z" {...seam} />
          </>
        )}
        {side === "side" ? (
          <>
            <path d="M121 27 Q118 150 121 286" {...seam} />
            <path d="M140 27 Q133 44 146 54" {...seam} />
            <path d="M108 120 Q106 200 109 280" {...fold} />
          </>
        ) : (
          <path d="M92 112 Q95 200 92 280 M148 112 Q145 200 148 280" {...fold} />
        )}
        <rect x="0" y="0" width="240" height="300" fill={`url(#${shadeId})`} />
      </g>

      {loops.map((x) => (
        <rect key={x} x={x} y={12} width={4} height={17} rx={1} fill={fill} stroke={OUTLINE} strokeWidth={0.8} />
      ))}
      {side === "front" && <circle cx={124} cy={19} r={3} fill="#b9b9bd" stroke="#555" strokeWidth={0.8} />}
    </svg>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
