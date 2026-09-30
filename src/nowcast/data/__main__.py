import argparse
import json

from .fixture import generate_fixture
from .loader import load_event

parser = argparse.ArgumentParser(description="Synthetic fixture and observed-only validation")
parser.add_argument("command", choices=("generate", "validate"))
parser.add_argument("path")
args = parser.parse_args()
path = generate_fixture(args.path) if args.command == "generate" else args.path
print(json.dumps(load_event(path), indent=2))
