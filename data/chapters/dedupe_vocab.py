import json
import sys
from pathlib import Path

def dedupe_file(path: str) -> None:
    p = Path(path)

    data = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Top-level JSON must be a list of objects.")

    seen = set()
    deduped = []
    removed = []  # stores the duplicated german words (each removal)

    for item in data:
        word = item.get("german")
        if word in seen:
            removed.append(word)
            continue
        seen.add(word)
        deduped.append(item)

    # overwrite the file with the cleaned list
    p.write_text(json.dumps(deduped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    removed_count = len(removed)
    print(f"Removed {removed_count} duplicate entr{'y' if removed_count == 1 else 'ies'}.")

    if removed_count:
        # unique words (in order of first removal)
        unique_words = list(dict.fromkeys(removed))
        print("Words with duplicates removed:")
        for w in unique_words:
            print(f"- {w}")

if __name__ == "__main__":
    # Use hardcoded path instead of command-line argument
    file_path = "/Users/laurentoulson/Desktop/Folders/vocab_app/words/c_1.json" # change to desired file name I wish to amend
    
    try:
        dedupe_file(file_path)
    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")
        print("Please check the file path exists.")
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format - {e}")
    except Exception as e:
        print(f"Error: {type(e).__name__} - {e}")
