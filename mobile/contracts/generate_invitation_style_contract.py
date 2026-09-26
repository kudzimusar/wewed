#!/usr/bin/env python3
"""Derive the native invitation-style registry from the web registry.

The invitation design is a wedding-configured product object. If native's idea of the catalogue
drifts from `src/lib/digital-invitation-card.ts`, a wedding saved as one design renders as another
— which is the substitution this contract exists to prevent. So the catalogue is generated, never
retyped.

Run from the repository root:

    python3 mobile/contracts/generate_invitation_style_contract.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SOURCE = Path("src/lib/digital-invitation-card.ts")
TARGET_JSON = Path("mobile/contracts/invitation-styles.json")
TARGET_KOTLIN = Path("apps/android/app/src/main/java/pro/wewed/app/models/GeneratedInvitationStyles.kt")
TARGET_SWIFT = Path("apps/ios/Wewed/Models/GeneratedInvitationStyles.swift")

# All 12 known styles have real native renderers across Android Compose and iOS SwiftUI.
# Truly unknown style IDs remain unmapped and unsupported.
NATIVE_RENDERERS = {
    "ivory-floral-gold",
    "midnight",
    "botanical",
    "royal-emerald",
    "classic-white",
    "blush-romance",
    "african-luxe",
    "editorial",
    "black-tie",
    "watercolour-garden",
    "sunset-terracotta",
    "celestial",
}

ENTRY = re.compile(
    r"\{\s*id:\s*'(?P<id>[a-z0-9-]+)'\s*,"
    r"\s*name:\s*'(?P<name>[^']+)'\s*,"
    r".*?category:\s*'(?P<category>[a-z]+)'\s*,"
    r"\s*motion:\s*'(?P<motion>[a-z-]+)'\s*,"
    r"\s*atmosphere:\s*'(?P<atmosphere>[a-z-]+)'\s*,"
    r".*?palette:\s*\{\s*stage:\s*'(?P<stage>#[0-9a-fA-F]+)'\s*,"
    r"\s*paper:\s*'(?P<paper>#[0-9a-fA-F]+)'\s*,"
    r"\s*ink:\s*'(?P<ink>#[0-9a-fA-F]+)'\s*,"
    r"\s*primary:\s*'(?P<primary>#[0-9a-fA-F]+)'\s*,"
    r"\s*accent:\s*'(?P<accent>#[0-9a-fA-F]+)'\s*,"
    r"\s*muted:\s*'(?P<muted>#[0-9a-fA-F]+)'\s*\}",
    re.S,
)
FALLBACK = re.compile(r"STYLE_IDS\.has\(value\)[\s\S]{0,120}?:\s*'(?P<id>[a-z0-9-]+)'")


class ContractValidationError(Exception):
    """Raised when web and native invitation style registries drift or violate invariants."""


def classify_renderer(sid: str, is_native: bool) -> str | None:
    """Derive the renderer kind.

    Invariant: nativeRenderer == true <-> rendererKind in {IVORY_CUSTOM, GENERIC_MOTION}.
    An unsupported style must never be assigned GENERIC_MOTION.
    """
    if not is_native:
        return None
    if sid == "ivory-floral-gold":
        return "IVORY_CUSTOM"
    return "GENERIC_MOTION"


def validate_style_support(web_style_ids: set[str], native_renderer_ids: set[str]) -> None:
    """Validate bidirectional set equality between web and native style registries.

    Fails closed if the web defines a style native has not explicitly approved,
    or if native claims a style absent from the web registry.
    """
    missing_native = sorted(web_style_ids - native_renderer_ids)
    if missing_native:
        missing_list = "\n".join(f"  {s}" for s in missing_native)
        raise ContractValidationError(
            f"Web invitation styles missing native renderer approval:\n{missing_list}"
        )
    extra_native = sorted(native_renderer_ids - web_style_ids)
    if extra_native:
        raise ContractValidationError(
            f"NATIVE_RENDERERS names styles the web does not define: {extra_native}"
        )


def parse_web_styles(text: str) -> list[dict]:
    block = text.split("export const INVITATION_CARD_STYLES", 1)
    if len(block) != 2:
        raise ContractValidationError("could not locate INVITATION_CARD_STYLES")
    block = block[1].split("] as const", 1)[0]

    styles = [
        {
            "id": m.group("id"),
            "name": m.group("name"),
            "category": m.group("category"),
            "motion": m.group("motion"),
            "atmosphere": m.group("atmosphere"),
            "palette": {
                "stage": m.group("stage"),
                "paper": m.group("paper"),
                "ink": m.group("ink"),
                "primary": m.group("primary"),
                "accent": m.group("accent"),
                "muted": m.group("muted"),
            },
        }
        for m in ENTRY.finditer(block)
    ]
    if not styles:
        raise ContractValidationError("parsed zero styles")
    return styles


def parse_fallback_style_id(text: str) -> str:
    fallback = FALLBACK.search(text)
    if not fallback:
        raise ContractValidationError("could not locate normalizeInvitationCardStyle fallback")
    return fallback.group("id")


def build_contract_styles(raw_styles: list[dict], native_renderer_ids: set[str] = NATIVE_RENDERERS) -> list[dict]:
    contract_styles = []
    for s in raw_styles:
        sid = s["id"]
        is_native = sid in native_renderer_ids
        contract_styles.append({
            "id": sid,
            "name": s["name"],
            "category": s["category"],
            "motion": s["motion"],
            "atmosphere": s["atmosphere"],
            "palette": s["palette"],
            "nativeRenderer": is_native,
            "rendererKind": classify_renderer(sid, is_native),
        })
    return contract_styles


def generate_kotlin(styles: list[dict], fallback_id: str) -> str:
    motion_enum_members = {
        "tri-fold": "TRI_FOLD",
        "envelope-letter": "ENVELOPE_LETTER",
        "gate-fold": "GATE_FOLD",
        "book-open": "BOOK_OPEN",
        "single-card-lift": "SINGLE_CARD_LIFT",
        "floral-reveal": "FLORAL_REVEAL",
        "sleeve-pull": "SLEEVE_PULL",
    }
    atmosphere_enum_members = {
        "champagne-glow": "CHAMPAGNE_GLOW",
        "soft-bokeh": "SOFT_BOKEH",
        "petals": "PETALS",
        "candlelight": "CANDLELIGHT",
        "stars": "STARS",
        "watercolour-bloom": "WATERCOLOUR_BLOOM",
        "minimal": "MINIMAL",
    }

    lines = [
        "package pro.wewed.app.models",
        "",
        "import androidx.compose.ui.graphics.Color",
        "",
        "/**",
        " * Autogenerated by mobile/contracts/generate_invitation_style_contract.py from src/lib/digital-invitation-card.ts.",
        " * Do not edit directly.",
        " */",
        "",
        "data class InvitationPalette(",
        "    val stage: Color,",
        "    val paper: Color,",
        "    val ink: Color,",
        "    val primary: Color,",
        "    val accent: Color,",
        "    val muted: Color,",
        "    val stageHex: String,",
        "    val paperHex: String,",
        "    val inkHex: String,",
        "    val primaryHex: String,",
        "    val accentHex: String,",
        "    val mutedHex: String",
        ")",
        "",
        "enum class InvitationMotion(val wire: String) {",
        '    TRI_FOLD("tri-fold"),',
        '    ENVELOPE_LETTER("envelope-letter"),',
        '    GATE_FOLD("gate-fold"),',
        '    BOOK_OPEN("book-open"),',
        '    SINGLE_CARD_LIFT("single-card-lift"),',
        '    FLORAL_REVEAL("floral-reveal"),',
        '    SLEEVE_PULL("sleeve-pull");',
        "",
        "    companion object {",
        "        fun fromWire(wire: String?): InvitationMotion =",
        "            entries.firstOrNull { it.wire == wire } ?: TRI_FOLD",
        "    }",
        "}",
        "",
        "enum class InvitationAtmosphere(val wire: String) {",
        '    CHAMPAGNE_GLOW("champagne-glow"),',
        '    SOFT_BOKEH("soft-bokeh"),',
        '    PETALS("petals"),',
        '    CANDLELIGHT("candlelight"),',
        '    STARS("stars"),',
        '    WATERCOLOUR_BLOOM("watercolour-bloom"),',
        '    MINIMAL("minimal");',
        "",
        "    companion object {",
        "        fun fromWire(wire: String?): InvitationAtmosphere =",
        "            entries.firstOrNull { it.wire == wire } ?: MINIMAL",
        "    }",
        "}",
        "",
        "enum class InvitationRendererKind {",
        "    IVORY_CUSTOM,",
        "    GENERIC_MOTION",
        "}",
        "",
        "data class InvitationThemeDefinition(",
        "    val id: String,",
        "    val name: String,",
        "    val category: String,",
        "    val motion: InvitationMotion,",
        "    val atmosphere: InvitationAtmosphere,",
        "    val palette: InvitationPalette,",
        "    val rendererKind: InvitationRendererKind",
        ")",
        "",
        "object GeneratedInvitationStyles {",
        "    fun parseColor(hex: String): Color {",
        '        val clean = hex.removePrefix("#")',
        "        val longVal = clean.toLong(16)",
        "        return when (clean.length) {",
        "            6 -> Color(0xFF000000 or longVal)",
        "            8 -> Color(longVal)",
        "            else -> Color.Black",
        "        }",
        "    }",
        "",
        "    private fun palette(stage: String, paper: String, ink: String, primary: String, accent: String, muted: String): InvitationPalette =",
        "        InvitationPalette(",
        "            stage = parseColor(stage),",
        "            paper = parseColor(paper),",
        "            ink = parseColor(ink),",
        "            primary = parseColor(primary),",
        "            accent = parseColor(accent),",
        "            muted = parseColor(muted),",
        "            stageHex = stage,",
        "            paperHex = paper,",
        "            inkHex = ink,",
        "            primaryHex = primary,",
        "            accentHex = accent,",
        "            mutedHex = muted",
        "        )",
        "",
        "    val STYLES: Map<String, InvitationThemeDefinition> = mapOf(",
    ]

    for s in styles:
        sid = s["id"]
        sname = s["name"]
        scat = s["category"]
        smotion = motion_enum_members[s["motion"]]
        satm = atmosphere_enum_members[s["atmosphere"]]
        pal = s["palette"]
        rkind = s.get("rendererKind")
        if rkind == "IVORY_CUSTOM":
            ren = "InvitationRendererKind.IVORY_CUSTOM"
        elif rkind == "GENERIC_MOTION":
            ren = "InvitationRendererKind.GENERIC_MOTION"
        else:
            raise ContractValidationError(
                f"Cannot generate Kotlin for style '{sid}' without valid native rendererKind (got {rkind})"
            )
        lines.append(f'        "{sid}" to InvitationThemeDefinition(')
        lines.append(f'            id = "{sid}",')
        lines.append(f'            name = "{sname}",')
        lines.append(f'            category = "{scat}",')
        lines.append(f"            motion = InvitationMotion.{smotion},")
        lines.append(f"            atmosphere = InvitationAtmosphere.{satm},")
        lines.append(
            f'            palette = palette("{pal["stage"]}", "{pal["paper"]}", "{pal["ink"]}", "{pal["primary"]}", "{pal["accent"]}", "{pal["muted"]}"),'
        )
        lines.append(f"            rendererKind = {ren}")
        lines.append("        ),")

    lines.extend([
        "    )",
        "",
        f'    val FALLBACK_STYLE_ID: String = "{fallback_id}"',
        "}",
        "",
    ])
    return "\n".join(lines)


def generate_swift(styles: list[dict], fallback_id: str) -> str:
    motion_enum_members = {
        "tri-fold": "triFold",
        "envelope-letter": "envelopeLetter",
        "gate-fold": "gateFold",
        "book-open": "bookOpen",
        "single-card-lift": "singleCardLift",
        "floral-reveal": "floralReveal",
        "sleeve-pull": "sleevePull",
    }
    atmosphere_enum_members = {
        "champagne-glow": "champagneGlow",
        "soft-bokeh": "softBokeh",
        "petals": "petals",
        "candlelight": "candlelight",
        "stars": "stars",
        "watercolour-bloom": "watercolourBloom",
        "minimal": "minimal",
    }

    lines = [
        "import SwiftUI",
        "",
        "/// Autogenerated by mobile/contracts/generate_invitation_style_contract.py from src/lib/digital-invitation-card.ts.",
        "/// Do not edit directly.",
        "",
        "public struct InvitationPalette: Sendable, Equatable {",
        "    public let stageHex: String",
        "    public let paperHex: String",
        "    public let inkHex: String",
        "    public let primaryHex: String",
        "    public let accentHex: String",
        "    public let mutedHex: String",
        "",
        "    public var stage: Color { Color(hex: stageHex) }",
        "    public var paper: Color { Color(hex: paperHex) }",
        "    public var ink: Color { Color(hex: inkHex) }",
        "    public var primary: Color { Color(hex: primaryHex) }",
        "    public var accent: Color { Color(hex: accentHex) }",
        "    public var muted: Color { Color(hex: mutedHex) }",
        "",
        "    public init(",
        "        stageHex: String,",
        "        paperHex: String,",
        "        inkHex: String,",
        "        primaryHex: String,",
        "        accentHex: String,",
        "        mutedHex: String",
        "    ) {",
        "        self.stageHex = stageHex",
        "        self.paperHex = paperHex",
        "        self.inkHex = inkHex",
        "        self.primaryHex = primaryHex",
        "        self.accentHex = accentHex",
        "        self.mutedHex = mutedHex",
        "    }",
        "}",
        "",
        "public enum InvitationMotion: String, Sendable, CaseIterable {",
        '    case triFold = "tri-fold"',
        '    case envelopeLetter = "envelope-letter"',
        '    case gateFold = "gate-fold"',
        '    case bookOpen = "book-open"',
        '    case singleCardLift = "single-card-lift"',
        '    case floralReveal = "floral-reveal"',
        '    case sleevePull = "sleeve-pull"',
        "}",
        "",
        "public enum InvitationAtmosphere: String, Sendable, CaseIterable {",
        '    case champagneGlow = "champagne-glow"',
        '    case softBokeh = "soft-bokeh"',
        '    case petals = "petals"',
        '    case candlelight = "candlelight"',
        '    case stars = "stars"',
        '    case watercolourBloom = "watercolour-bloom"',
        '    case minimal = "minimal"',
        "}",
        "",
        "public enum InvitationRendererKind: String, Sendable, CaseIterable {",
        '    case ivoryCustom = "IVORY_CUSTOM"',
        '    case genericMotion = "GENERIC_MOTION"',
        "}",
        "",
        "public struct InvitationThemeDefinition: Sendable {",
        "    public let id: String",
        "    public let name: String",
        "    public let category: String",
        "    public let motion: InvitationMotion",
        "    public let atmosphere: InvitationAtmosphere",
        "    public let palette: InvitationPalette",
        "    public let rendererKind: InvitationRendererKind",
        "}",
        "",
        "public enum GeneratedInvitationStyles {",
        "    public static let styles: [String: InvitationThemeDefinition] = [",
    ]

    for s in styles:
        sid = s["id"]
        sname = s["name"]
        scat = s["category"]
        smotion = motion_enum_members[s["motion"]]
        satm = atmosphere_enum_members[s["atmosphere"]]
        pal = s["palette"]
        rkind = s.get("rendererKind")
        if rkind == "IVORY_CUSTOM":
            ren = ".ivoryCustom"
        elif rkind == "GENERIC_MOTION":
            ren = ".genericMotion"
        else:
            raise ContractValidationError(
                f"Cannot generate Swift for style '{sid}' without valid native rendererKind (got {rkind})"
            )
        lines.append(f'        "{sid}": InvitationThemeDefinition(')
        lines.append(f'            id: "{sid}",')
        lines.append(f'            name: "{sname}",')
        lines.append(f'            category: "{scat}",')
        lines.append(f"            motion: .{smotion},")
        lines.append(f"            atmosphere: .{satm},")
        lines.append(
            f'            palette: InvitationPalette(stageHex: "{pal["stage"]}", paperHex: "{pal["paper"]}", inkHex: "{pal["ink"]}", primaryHex: "{pal["primary"]}", accentHex: "{pal["accent"]}", mutedHex: "{pal["muted"]}"),'
        )
        lines.append(f"            rendererKind: {ren}")
        lines.append("        ),")

    lines.extend([
        "    ]",
        "",
        f'    public static let fallbackStyleId = "{fallback_id}"',
        "}",
        "",
    ])
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]

    if not SOURCE.exists():
        print(f"missing {SOURCE}", file=sys.stderr)
        return 1

    try:
        text = SOURCE.read_text()
        raw_styles = parse_web_styles(text)
        fallback_id = parse_fallback_style_id(text)

        web_style_ids = {s["id"] for s in raw_styles}
        validate_style_support(web_style_ids, NATIVE_RENDERERS)
        styles = build_contract_styles(raw_styles, NATIVE_RENDERERS)

        contract = {
            "contract": "wewed-invitation-styles/1",
            "source": str(SOURCE),
            "generatedBy": str(Path(__file__).relative_to(Path.cwd())),
            "fallbackStyleId": fallback_id,
            "styles": styles,
        }
        json_code = json.dumps(contract, indent=2) + "\n"
        kotlin_code = generate_kotlin(styles, fallback_id)
        swift_code = generate_swift(styles, fallback_id)
    except ContractValidationError as err:
        print(str(err), file=sys.stderr)
        return 1

    if "--check" in argv:
        mismatches = []
        if not TARGET_JSON.exists() or TARGET_JSON.read_text() != json_code:
            mismatches.append(str(TARGET_JSON))
        if not TARGET_KOTLIN.exists() or TARGET_KOTLIN.read_text() != kotlin_code:
            mismatches.append(str(TARGET_KOTLIN))
        if not TARGET_SWIFT.exists() or TARGET_SWIFT.read_text() != swift_code:
            mismatches.append(str(TARGET_SWIFT))

        if mismatches:
            print(f"Contract drift detected in: {', '.join(mismatches)}", file=sys.stderr)
            print("Run 'python3 mobile/contracts/generate_invitation_style_contract.py' to update.", file=sys.stderr)
            return 1
        print("Contract check passed: JSON, Kotlin, and Swift contracts match source.")
        return 0

    TARGET_JSON.parent.mkdir(parents=True, exist_ok=True)
    TARGET_JSON.write_text(json_code)

    TARGET_KOTLIN.parent.mkdir(parents=True, exist_ok=True)
    TARGET_KOTLIN.write_text(kotlin_code)

    TARGET_SWIFT.parent.mkdir(parents=True, exist_ok=True)
    TARGET_SWIFT.write_text(swift_code)

    rendered = sum(1 for s in styles if s["nativeRenderer"])
    print(f"{TARGET_JSON}: {len(styles)} styles, {rendered} with a native renderer, fallback '{contract['fallbackStyleId']}'")
    print(f"Generated Kotlin: {TARGET_KOTLIN}")
    print(f"Generated Swift: {TARGET_SWIFT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

