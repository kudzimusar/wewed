#!/usr/bin/env python3
"""Validate Wewed Mobile Shadow snapshot material before import or commit.

Standard-library only. This tool does not connect to production.
It validates the manifest safety contract and scans JSON keys for
known secret/authentication material.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

FORBIDDEN_KEY_FRAGMENTS = {
    "password",
    "passwordhash",
    "access_token",
    "accesstoken",
    "refresh_token",
    "refreshtoken",
    "sessioncookie",
    "session_token",
    "sessiontoken",
    "api_key",
    "apikey",
    "privatekey",
    "private_key",
    "webhooksecret",
    "webhook_secret",
    "otpsecret",
    "otp_secret",
    "paymentsecret",
    "payment_secret",
}

REQUIRED_MANIFEST_KEYS = {
    "snapshotId",
    "sourceEnvironment",
    "sourceWeddingId",
    "exportedAt",
    "schemaVersion",
    "sanitizationVersion",
    "domains",
    "rowCounts",
    "checksumSha256",
    "operator",
    "productionWritesPerformed",
}


def normalized(value: str) -> str:
    return value.replace("-", "_").replace(" ", "").lower()


def scan_keys(value: Any, path: str = "$") -> list[str]:
    findings: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            key_norm = normalized(str(key))
            if any(fragment in key_norm for fragment in FORBIDDEN_KEY_FRAGMENTS):
                findings.append(f"{path}.{key}")
            findings.extend(scan_keys(child, f"{path}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            findings.extend(scan_keys(child, f"{path}[{index}]"))
    return findings


def validate_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    missing = sorted(REQUIRED_MANIFEST_KEYS - manifest.keys())
    if missing:
        errors.append("missing manifest keys: " + ", ".join(missing))
    if manifest.get("sourceEnvironment") != "production-read-only":
        errors.append("sourceEnvironment must be production-read-only")
    if manifest.get("productionWritesPerformed") is not False:
        errors.append("productionWritesPerformed must be false")
    checksum = str(manifest.get("checksumSha256", ""))
    if len(checksum) != 64 or any(c not in "0123456789abcdefABCDEF" for c in checksum):
        errors.append("checksumSha256 must be a 64-character hex SHA-256")
    return errors


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--snapshot", type=Path, required=False)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    errors = validate_manifest(manifest)
    findings = scan_keys(manifest)

    if args.snapshot:
        snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
        findings.extend(scan_keys(snapshot))
        actual = sha256(args.snapshot)
        expected = str(manifest.get("checksumSha256", "")).lower()
        if expected and actual.lower() != expected:
            errors.append(f"snapshot checksum mismatch: expected {expected}, got {actual}")

    if findings:
        errors.append("forbidden secret/auth key names found: " + ", ".join(sorted(set(findings))))

    if errors:
        print("SHADOW MATERIAL VALIDATION: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1

    print("SHADOW MATERIAL VALIDATION: PASS")
    print(f"snapshotId={manifest['snapshotId']}")
    print(f"sourceWeddingId={manifest['sourceWeddingId']}")
    print("productionWritesPerformed=false")
    return 0


if __name__ == "__main__":
    sys.exit(main())
