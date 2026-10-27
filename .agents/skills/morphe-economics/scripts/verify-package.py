#!/usr/bin/env python3
"""Verify the Arena standalone artifact without extracting or exposing secrets."""
import sys
import zipfile
from pathlib import PurePosixPath


def verify(filename):
    with zipfile.ZipFile(filename) as archive:
        names = {name.removeprefix("./") for name in archive.namelist()}
        required = {"server.js"}
        missing = required - names
        if missing:
            raise ValueError(f"Missing runtime files: {sorted(missing)}")
        forbidden = []
        for name in names:
            parts = PurePosixPath(name).parts
            if parts[:1] == ("internal",) or any(p == "mysql2" or p.startswith("mysql2@") for p in parts):
                raise ValueError("Internal source code or driver in public artifact")
            if "node_modules" in parts:
                continue
            if any(p == ".cache" or p == ".npmrc" or p.startswith(".env") for p in parts):
                forbidden.append(name)
        if forbidden:
            raise ValueError(f"Local cache/credentials in artifact: {sorted(forbidden)}")
        if not any(name.startswith(".next/static/") for name in names):
            raise ValueError("Missing Next static assets")
        print(f"OK: {len(names)} entries; server/static present; no local cache or credentials")


if __name__ == "__main__":
    verify(sys.argv[1] if len(sys.argv) > 1 else "code.zip")
