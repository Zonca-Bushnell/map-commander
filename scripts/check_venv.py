from __future__ import annotations

import sys
from pathlib import Path


root = Path(__file__).resolve().parents[1]
expected = root / ".venv"

print(f"Python: {sys.executable}")
print(f"Virtual env root: {sys.prefix}")
print(f"Expected project venv: {expected}")
print(f"Using project venv: {Path(sys.prefix).resolve() == expected.resolve()}")
