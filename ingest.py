import hashlib
from pathlib import Path
from rag_store import get_collection, get_model

DOCS = Path(__file__).resolve().parent / "documents"

def chunks(text, size=900, overlap=150):
    text = " ".join(text.split())
    out, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        part = text[start:end].strip()
        if part:
            out.append(part)
        if end == len(text):
            break
        start = end - overlap
    return out

def main():
    files = list(DOCS.glob("*.txt"))
    if not files:
        raise FileNotFoundError(f"No TXT files found in {DOCS}")
    rows = []
    for path in files:
        for i, chunk in enumerate(chunks(path.read_text(encoding="utf-8-sig"))):
            ident = hashlib.sha256(f"{path.name}:{i}:{chunk}".encode()).hexdigest()
            rows.append((ident, chunk, {"source": path.name}))
    if not rows:
        raise ValueError("No readable text chunks found")
    col, model = get_collection(), get_model()
    for start in range(0, len(rows), 64):
        batch = rows[start:start+64]
        vectors = model.encode([r[1] for r in batch], normalize_embeddings=True).tolist()
        col.upsert(ids=[r[0] for r in batch], documents=[r[1] for r in batch],
                   metadatas=[r[2] for r in batch], embeddings=vectors)
    # Remove superseded chunks only after all replacement embeddings are stored.
    current_ids = {r[0] for r in rows}
    existing = col.get(where={"source": {"$in": [p.name for p in files]}}, include=[])
    stale_ids = [ident for ident in existing["ids"] if ident not in current_ids]
    if stale_ids:
        col.delete(ids=stale_ids)
    print(f"Ingested {len(rows)} chunks; collection count={col.count()}")

if __name__ == "__main__":
    main()
