#!/usr/bin/env python3
"""Regression tests for invitation style contract generation and governance.

Enforces:
1. Bidirectional set equality between web and native style registries.
2. New PWA styles without native renderer approval fail closed.
3. Unsupported styles are never assigned a rendererKind (GENERIC_MOTION / IVORY_CUSTOM).
4. Native renderers absent from the web registry fail closed.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Add mobile/contracts to sys.path so we can import the generator module directly
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "mobile" / "contracts"))

from generate_invitation_style_contract import (  # noqa: E402
    NATIVE_RENDERERS,
    SOURCE,
    ContractValidationError,
    build_contract_styles,
    classify_renderer,
    generate_kotlin,
    generate_swift,
    main,
    parse_fallback_style_id,
    parse_web_styles,
    validate_style_support,
)


class InvitationStyleContractGovernanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.assertTrue(SOURCE.exists(), f"Authoritative web source missing: {SOURCE}")
        self.web_source_text = SOURCE.read_text()
        self.authoritative_raw_styles = parse_web_styles(self.web_source_text)
        self.authoritative_fallback_id = parse_fallback_style_id(self.web_source_text)
        self.authoritative_web_ids = {s["id"] for s in self.authoritative_raw_styles}

    def test_current_authoritative_registry_passes(self) -> None:
        """Current 12-style registry must match NATIVE_RENDERERS bidirectionally."""
        self.assertEqual(len(self.authoritative_raw_styles), 12)
        self.assertEqual(self.authoritative_web_ids, NATIVE_RENDERERS)
        # Must not raise
        validate_style_support(self.authoritative_web_ids, NATIVE_RENDERERS)

        styles = build_contract_styles(self.authoritative_raw_styles, NATIVE_RENDERERS)
        self.assertEqual(len(styles), 12)
        for s in styles:
            self.assertTrue(s["nativeRenderer"])
            if s["id"] == "ivory-floral-gold":
                self.assertEqual(s["rendererKind"], "IVORY_CUSTOM")
            else:
                self.assertEqual(s["rendererKind"], "GENERIC_MOTION")

    def test_synthetic_13th_style_without_native_declaration_fails(self) -> None:
        """Adding a 13th PWA style without native renderer declaration must fail validation."""
        synthetic_web_ids = set(self.authoritative_web_ids)
        synthetic_13th = "hand-lettered-vellum"
        synthetic_web_ids.add(synthetic_13th)

        with self.assertRaises(ContractValidationError) as ctx:
            validate_style_support(synthetic_web_ids, NATIVE_RENDERERS)

        error_message = str(ctx.exception)
        self.assertIn("Web invitation styles missing native renderer approval", error_message)
        self.assertIn(synthetic_13th, error_message)

    def test_synthetic_13th_style_with_explicit_native_declaration_succeeds(self) -> None:
        """Adding a 13th style succeeds only when native renderer approval is explicitly declared."""
        synthetic_13th = "hand-lettered-vellum"
        synthetic_web_ids = set(self.authoritative_web_ids) | {synthetic_13th}
        synthetic_native_renderers = set(NATIVE_RENDERERS) | {synthetic_13th}

        # Must not raise when both sets declare it
        validate_style_support(synthetic_web_ids, synthetic_native_renderers)

        raw_styles_with_13th = list(self.authoritative_raw_styles) + [{
            "id": synthetic_13th,
            "name": "Hand Lettered Vellum",
            "category": "classic",
            "motion": "single-card-lift",
            "atmosphere": "minimal",
            "palette": {
                "stage": "#111111",
                "paper": "#ffffff",
                "ink": "#000000",
                "primary": "#222222",
                "accent": "#444444",
                "muted": "#888888",
            },
        }]
        contract_styles = build_contract_styles(raw_styles_with_13th, synthetic_native_renderers)
        style_13 = next(s for s in contract_styles if s["id"] == synthetic_13th)
        self.assertTrue(style_13["nativeRenderer"])
        self.assertEqual(style_13["rendererKind"], "GENERIC_MOTION")

    def test_native_renderer_absent_from_web_fails(self) -> None:
        """NATIVE_RENDERERS claiming a style not defined in web registry must fail validation."""
        removed_web_ids = set(self.authoritative_web_ids) - {"midnight"}
        with self.assertRaises(ContractValidationError) as ctx:
            validate_style_support(removed_web_ids, NATIVE_RENDERERS)

        error_message = str(ctx.exception)
        self.assertIn("NATIVE_RENDERERS names styles the web does not define", error_message)
        self.assertIn("midnight", error_message)

    def test_never_assign_renderer_kind_to_unsupported_style(self) -> None:
        """Contract truth invariant: nativeRenderer == true <-> rendererKind != None.

        An unsupported style must never be assigned GENERIC_MOTION or IVORY_CUSTOM.
        """
        unsupported_id = "hand-lettered-vellum"
        # Pure classifier check
        self.assertIsNone(classify_renderer(unsupported_id, is_native=False))
        self.assertEqual(classify_renderer("ivory-floral-gold", is_native=True), "IVORY_CUSTOM")
        self.assertEqual(classify_renderer("midnight", is_native=True), "GENERIC_MOTION")

        raw_unsupported = [{
            "id": unsupported_id,
            "name": "Hand Lettered Vellum",
            "category": "classic",
            "motion": "single-card-lift",
            "atmosphere": "minimal",
            "palette": {
                "stage": "#111111",
                "paper": "#ffffff",
                "ink": "#000000",
                "primary": "#222222",
                "accent": "#444444",
                "muted": "#888888",
            },
        }]
        built = build_contract_styles(raw_unsupported, native_renderer_ids=set())
        self.assertFalse(built[0]["nativeRenderer"])
        self.assertIsNone(built[0]["rendererKind"])
        self.assertNotEqual(built[0]["rendererKind"], "GENERIC_MOTION")

        # Generating Kotlin or Swift for an unsupported style must fail
        with self.assertRaises(ContractValidationError):
            generate_kotlin(built, "botanical")
        with self.assertRaises(ContractValidationError):
            generate_swift(built, "botanical")

    def test_generator_check_cli_succeeds(self) -> None:
        """The CLI --check mode must return 0 on the clean authoritative repository."""
        ret = main(["--check"])
        self.assertEqual(ret, 0)


if __name__ == "__main__":
    unittest.main()
